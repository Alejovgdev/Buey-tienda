import { spawn } from 'node:child_process';
import http from 'node:http';
import path from 'node:path';

export const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
export async function freePort() {
  const listener = http.createServer();
  await new Promise((resolve, reject) => { listener.once('error', reject); listener.listen(0, '127.0.0.1', resolve); });
  const port = listener.address().port;
  await new Promise(resolve => listener.close(resolve));
  return port;
}

export async function openBrowser(artifacts, { rendering = 'legacy' } = {}) {
  if (!['legacy', 'default', 'trees-control'].includes(rendering)) throw new Error('Perfil de Chrome no válido');
  const port = await freePort();
  const flags = [
    '--headless=new', '--no-sandbox', '--disable-extensions',
    ...(['legacy', 'trees-control'].includes(rendering) ? ['--disable-gpu', '--disable-software-rasterizer'] : []),
    ...(rendering === 'trees-control' ? ['--disable-features=TreesInViz'] : []),
    '--no-first-run', '--no-default-browser-check', '--disable-background-networking',
    '--remote-debugging-port=' + port, '--user-data-dir=' + path.join(artifacts, 'chrome-' + Date.now()), 'about:blank',
  ];
  const child = spawn('C:/Program Files/Google/Chrome/Application/chrome.exe', flags, { windowsHide: true, stdio: 'ignore' });
  let version;
  for (let i = 0; i < 100; i++) {
    try { version = await (await fetch(`http://127.0.0.1:${port}/json/version`)).json(); if (version.webSocketDebuggerUrl) break; } catch {}
    await delay(100);
  }
  if (!version?.webSocketDebuggerUrl) { child.kill(); throw new Error('Chrome no disponible'); }
  return {
    version: { ...version, rendering, flags },
    async page() {
      const target = await (await fetch(`http://127.0.0.1:${port}/json/new?about:blank`, { method: 'PUT' })).json();
      const ws = new WebSocket(target.webSocketDebuggerUrl);
      await new Promise((resolve, reject) => { ws.addEventListener('open', resolve, { once: true }); ws.addEventListener('error', reject, { once: true }); });
      let number = 0;
      const pending = new Map(), listeners = new Map();
      ws.addEventListener('message', ({ data }) => {
        const message = JSON.parse(data);
        if (message.id) {
          const item = pending.get(message.id); pending.delete(message.id);
          if (item) message.error ? item.reject(new Error(JSON.stringify(message.error))) : item.resolve(message.result);
        }
        for (const fn of listeners.get(message.method) ?? []) fn(message.params);
      });
      ws.addEventListener('close', () => { for (const item of pending.values()) item.reject(new Error('CDP cerrado')); pending.clear(); });
      const send = (method, params = {}) => new Promise((resolve, reject) => {
        const id = ++number;
        const timeout = setTimeout(() => { pending.delete(id); reject(new Error('CDP timeout: ' + method)); }, 30000);
        pending.set(id, { resolve: value => { clearTimeout(timeout); resolve(value); }, reject: error => { clearTimeout(timeout); reject(error); } });
        ws.send(JSON.stringify({ id, method, params }));
      });
      return {
        send,
        on(method, fn) { if (!listeners.has(method)) listeners.set(method, []); listeners.get(method).push(fn); },
        async evaluate(expression) {
          const result = await send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true });
          if (result.exceptionDetails) throw new Error(result.exceptionDetails.exception?.description ?? result.exceptionDetails.text);
          return result.result.value;
        },
        async close() { await fetch(`http://127.0.0.1:${port}/json/close/${target.id}`); ws.close(); },
      };
    },
    async close() { if (child.exitCode === null) { const stopped = new Promise(resolve => child.once('exit', resolve)); child.kill(); await stopped; } },
  };
}
