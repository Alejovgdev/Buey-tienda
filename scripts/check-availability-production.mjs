// Compila y prueba únicamente con Supabase simulado en loopback. No carga .env
// en este proceso, no usa servicios remotos y no ejecuta migraciones ni cobros.
// El build resultante contiene configuración ficticia: NO es un artefacto para desplegar.
import assert from 'node:assert/strict';
import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
import { spawn } from 'node:child_process';

const root = process.cwd();
const artifacts = path.join(root, '.availability-check.local');
await fs.mkdir(artifacts, { recursive: true });
const guard = path.join(artifacts, 'network-guard.cjs');
await fs.writeFile(guard, `const original = globalThis.fetch;
globalThis.fetch = function(input, init) {
  const url = new URL(typeof input === 'string' || input instanceof URL ? input : input.url);
  if (!['127.0.0.1', 'localhost', '[::1]'].includes(url.hostname)) throw new Error('External network blocked: ' + url.hostname);
  return original.call(this, input, init);
};\n`);
const categoryId = '11111111-1111-4111-8111-111111111111';
const productId = '22222222-2222-4222-8222-222222222222';
const variantId = '33333333-3333-4333-8333-333333333333';
const state = { open: true, productActive: true, variantActive: true, categoryActive: true, stock: 8, price: 2500, name: 'Producto local inicial', fail: false };
const writes = [];
const privateReads = [];
const category = () => ({ id: categoryId, slug: 'local', name: 'Categoría local', description: 'Categoría de prueba', is_active: state.categoryActive });
const product = () => ({
  id: productId, slug: 'producto-local', name: state.name, description: 'Descripción comercial local en HTML',
  is_active: state.productActive, category_id: categoryId, allergens: [], allergens_notes: null,
  label_profile_id: null, ingredients: null, storage_conditions: null, prep_instructions: null,
  cooking_method: null, country_of_origin: null, label_display_name: null,
  usual_units_per_package: 1, suggested_package_count: 1,
});
const variant = () => ({ id: variantId, product_id: productId, name: '1 kg', price: state.price, stock: state.stock, is_active: state.variantActive });
const fixture = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, 'http://127.0.0.1');
    const table = url.pathname.split('/').at(-1);
    if (state.fail && req.method === 'GET') { res.writeHead(503, { 'Content-Type': 'application/json' }); res.end(JSON.stringify({ message: 'Simulated database outage' })); return; }
    let rows;
    if (req.method === 'GET') {
      if (['orders', 'order_items', 'payments', 'order_status_history', 'order_box_labels'].includes(table)) privateReads.push(table);
      if (table === 'categories') rows = state.categoryActive ? [category()] : [];
      else if (table === 'products') {
        rows = state.productActive && (!url.searchParams.has('categories.is_active') || state.categoryActive) ? [{
          ...product(), categories: category(),
          product_variants: state.variantActive ? [variant()] : [], product_images: [],
        }] : [];
        if (url.searchParams.has('slug')) rows = rows.filter(row => 'eq.' + row.slug === url.searchParams.get('slug'));
      } else if (table === 'product_variants') rows = [{ ...variant(), product: product() }];
      else if (table === 'shop_settings') rows = [{ accepting_orders: state.open, notice_message: 'ABIERTO_LOCAL', checkout_disabled_message: 'CERRADO_LOCAL' }];
      else if (table === 'promotions') rows = [];
      else if (table === 'orders') rows = { order_number: 'BM-LOCAL', status: 'PAID' };
      else throw new Error('Unexpected fixture read: ' + table);
    } else if (req.method === 'POST') {
      let raw = ''; for await (const chunk of req) raw += chunk;
      const body = raw ? JSON.parse(raw) : {};
      // Escrituras solo simuladas. La prueba falla si se intenta tocar stock o pagos.
      if (table === 'generate_redsys_ds_order') rows = '26000001';
      else if (table === 'generate_order_number') rows = 'BM-LOCAL';
      else if (table === 'orders') { writes.push({ table, body }); rows = { id: productId, order_number: 'BM-LOCAL' }; }
      else if (['order_items', 'order_status_history'].includes(table)) { writes.push({ table, body }); rows = null; }
      else throw new Error('Forbidden fixture write: ' + table);
    } else throw new Error('Forbidden fixture method: ' + req.method);
    res.writeHead(200, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
    res.end(JSON.stringify(rows));
  } catch (error) { res.writeHead(500); res.end(String(error)); }
});
const listen = (server, port = 0) => new Promise((resolve, reject) => { server.once('error', reject); server.listen(port, '127.0.0.1', () => resolve(server.address().port)); });
const freePort = async () => { const server = http.createServer(); const port = await listen(server); await new Promise(resolve => server.close(resolve)); return port; };
// Para repetir solo las comprobaciones si no ha cambiado el código de la app.
const reused = process.argv.includes('--skip-build') ? JSON.parse(await fs.readFile(path.join(artifacts, 'ports.json'), 'utf8')) : null;
const fixturePort = await listen(fixture, reused?.fixturePort ?? 0);
const port = reused?.port ?? await freePort();
await fs.writeFile(path.join(artifacts, 'ports.json'), JSON.stringify({ fixturePort, port }));
const base = `http://127.0.0.1:${port}`;
const env = {
  ...process.env, NEXT_PUBLIC_SUPABASE_URL: `http://127.0.0.1:${fixturePort}`, NEXT_PUBLIC_SUPABASE_ANON_KEY: 'local-only', SUPABASE_SERVICE_ROLE_KEY: 'local-only',
  NEXT_PUBLIC_BASE_URL: base,
  ADMIN_PASSWORD: 'local-only', ADMIN_JWT_SECRET: 'local-only-secret-for-isolated-tests',
  REDSYS_ENVIRONMENT: 'test', REDSYS_SECRET_KEY: 'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA', REDSYS_MERCHANT_CODE: '000000000', REDSYS_TERMINAL: '001',
  RESEND_API_KEY: 're_local_only', EMAIL_FROM: 'test@example.invalid', ADMIN_NOTIFICATION_EMAIL: 'test@example.invalid',
  NEXT_TELEMETRY_DISABLED: '1', NODE_OPTIONS: `--require "${guard.replaceAll('\\', '/')}"`,
};
const launchNext = args => spawn(process.execPath, ['node_modules/next/dist/bin/next', ...args], { cwd: root, env, stdio: 'inherit', windowsHide: true });
const exited = child => new Promise((resolve, reject) => { child.once('error', reject); child.once('exit', code => code === 0 ? resolve() : reject(new Error('Next exited ' + code))); });
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
const pass = name => console.log('PASS ' + name);
const get = async route => { const response = await fetch(base + route); return { status: response.status, headers: response.headers, html: await response.text() }; };
const line = { variantId, productSlug: 'producto-local', quantity: 2, expectedUnitPrice: 2500 };
const customer = { customerName: 'Ana', customerLastName: 'García', customerEmail: 'ana@example.invalid', customerPhone: '+34670775786', shippingStreet: 'Calle Mayor, 1', shippingCity: 'Xàtiva', shippingProvince: 'València', shippingPostalCode: '46800', acceptTerms: true };
const post = async (route, body) => { const response = await fetch(base + route, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }); return { status: response.status, headers: response.headers, data: await response.json() }; };
let next;
process.once('exit', () => next?.kill());
try {
  if (!reused) await exited(launchNext(['build', '--webpack']));
  next = launchNext(['start', '--hostname', '127.0.0.1', '--port', String(port)]);
  let ready = false;
  for (let i = 0; i < 100; i++) { try { if ((await get('/tienda')).status === 200) { ready = true; break; } } catch {} await delay(100); }
  assert.ok(ready, 'Next production starts');
  const manifest = JSON.parse(await fs.readFile('.next/prerender-manifest.json', 'utf8'));
  assert.equal(manifest.routes['/tienda'], undefined);
  assert.equal(manifest.routes['/checkout'], undefined);
  pass('catálogo y checkout no están prerenderizados');
  let page = await get('/tienda');
  assert.match(page.headers.get('cache-control'), /no-store/);
  assert.match(page.html, /<h3[^>]*>Producto local inicial<\/h3>/);
  state.name = 'Producto local actualizado'; state.price = 3000;
  for (const route of ['/tienda', '/tienda/local', '/tienda/producto/producto-local']) {
    page = await get(route);
    assert.equal(page.status, 200);
    assert.ok(page.html.includes('Producto local actualizado') && page.html.includes('30,00'));
    assert.ok(page.html.includes('ABIERTO_LOCAL'));
  }
  pass('nombre, descripción, precio y apertura actuales en HTML, sin recompilar');
  state.stock = 0;
  assert.ok((await get('/tienda')).html.includes('Agotado'));
  assert.ok((await get('/tienda/producto/producto-local')).html.includes('Agotado'));
  state.variantActive = false;
  assert.ok(!(await get('/tienda/producto/producto-local')).html.includes('Añadir al carrito'));
  state.productActive = false;
  assert.equal((await get('/tienda/producto/producto-local')).status, 404);
  assert.ok(!(await get('/tienda')).html.includes('<h3 class="line-clamp-1'));
  state.productActive = true; state.variantActive = true; state.stock = 8;
  pass('stock e inactivaciones actuales en catálogo y fichas');
  state.open = false;
  for (const route of ['/tienda', '/tienda/local', '/tienda/producto/producto-local', '/checkout']) assert.ok((await get(route)).html.includes('CERRADO_LOCAL'));
  assert.equal((await post('/api/checkout/create-session', { customer, items: [line], expectedTotal: 6000 })).status, 503);
  state.open = true;
  assert.ok((await get('/checkout')).html.includes('ABIERTO_LOCAL'));
  pass('cerrar y abrir ventas sin nuevo build');
  const changed = await post('/api/checkout/create-session', { customer, items: [line], expectedTotal: 6000 });
  assert.equal(changed.status, 409); assert.equal(changed.data.review.total, 7000); assert.equal(writes.length, 0);
  state.productActive = false;
  assert.equal((await post('/api/checkout/review', { items: [line] })).status, 409);
  assert.equal((await post('/api/checkout/create-session', { customer, items: [line], expectedTotal: 7000 })).status, 409);
  state.productActive = true;
  state.fail = true;
  assert.equal((await post('/api/checkout/review', { items: [line] })).status, 503);
  state.fail = false;
  pass('API real local: producto retirado, cambio de precio y consulta fallida no crean pedido');
  await checkBrowser();
  const accepted = await post('/api/checkout/create-session', { customer, items: [{ ...line, expectedUnitPrice: state.price }], expectedTotal: state.price * 2 + 1000, total: 1 });
  assert.equal(accepted.status, 200);
  const params = JSON.parse(Buffer.from(accepted.data.redsys.Ds_MerchantParameters, 'base64').toString());
  assert.equal(params.DS_MERCHANT_AMOUNT, String(state.price * 2 + 1000));
  assert.equal(state.stock, 8);
  pass('carrito válido: payload firmado con precio del servidor, sin contactar al banco ni descontar stock');
  await checkAccess(accepted.headers.get('set-cookie'));
  const spoofed = await fetch(base + '/api/checkout/create-session', {
    method: 'POST', headers: { 'Content-Type': 'application/json', Host: 'attacker.example.invalid', 'x-forwarded-host': 'attacker.example.invalid' },
    body: JSON.stringify({ customer, items: [{ ...line, expectedUnitPrice: state.price }], expectedTotal: state.price * 2 + 1000 }),
  });
  assert.equal(spoofed.status, 200);
  const spoofedData = await spoofed.json();
  const spoofedParams = JSON.parse(Buffer.from(spoofedData.redsys.Ds_MerchantParameters, 'base64').toString());
  for (const key of ['DS_MERCHANT_MERCHANTURL', 'DS_MERCHANT_URLOK', 'DS_MERCHANT_URLKO']) {
    assert.equal(new URL(spoofedParams[key]).origin, new URL(params[key]).origin, key + ' ignora cabeceras Host manipuladas');
    assert.notEqual(new URL(spoofedParams[key]).hostname, 'attacker.example.invalid');
  }
  pass('URLs de retorno y notificación Redsys no aceptan Host manipulado');
  console.log('Validación local terminada. Este build contiene fixtures y debe recompilarse para publicar.');
} finally {
  next?.kill();
  fixture.closeAllConnections();
  await new Promise(resolve => fixture.close(resolve));
}

async function checkAccess(setCookie) {
  const readsBefore = privateReads.length;
  const walk = async directory => (await Promise.all((await fs.readdir(directory, { withFileTypes: true })).map(entry => {
    const full = path.join(directory, entry.name);
    return entry.isDirectory() ? walk(full) : [full];
  }))).flat();
  for (const file of (await walk(path.join(root, 'src/app/api/admin'))).filter(file => file.endsWith('route.ts'))) {
    const route = '/api/admin/' + path.relative(path.join(root, 'src/app/api/admin'), path.dirname(file)).replaceAll('\\', '/').replaceAll('[id]', productId);
    if (['/api/admin/auth', '/api/admin/logout'].includes(route)) continue;
    const source = await fs.readFile(file, 'utf8');
    const method = source.match(/export async function (POST|PATCH|GET|DELETE|PUT)/)[1];
    for (const cookie of ['', 'admin_session=invalid']) {
      const response = await fetch(base + route, { method, headers: { Cookie: cookie, 'Content-Type': 'application/json' }, body: method === 'GET' ? undefined : '{}' });
      assert.equal(response.status, 401, method + ' ' + route);
    }
  }
  for (const file of (await walk(path.join(root, 'src/app/admin'))).filter(file => file.endsWith('page.tsx'))) {
    const route = '/admin/' + path.relative(path.join(root, 'src/app/admin'), path.dirname(file)).replaceAll('\\', '/').replaceAll('[id]', productId).replaceAll('[labelId]', variantId);
    if (route === '/admin/login') continue;
    const response = await fetch(base + route, { redirect: 'manual', headers: { 'x-middleware-subrequest': 'middleware:middleware:middleware:middleware:middleware' } });
    assert.equal(response.status, 307, route);
    assert.equal(new URL(response.headers.get('location'), base).pathname, '/admin/login');
  }
  assert.equal(privateReads.length, readsBefore);
  pass('todas las páginas y API administrativas, incluida caja: acceso anónimo/cookie inválida rechazados antes de leer pedidos');
  const login = await post('/api/admin/auth', { password: 'local-only', workerName: 'Ana local' });
  assert.equal(login.status, 200);
  assert.match(login.headers.get('set-cookie'), /HttpOnly/i);
  const signedSession = login.headers.get('set-cookie').split(';')[0];
  const invalidNotes = await fetch(base + `/api/admin/pedidos/${productId}/notas`, {
    method: 'PATCH', headers: { Cookie: signedSession, 'Content-Type': 'application/json' }, body: '{}',
  });
  assert.equal(invalidNotes.status, 400, 'la sesión válida pasa a validación del formulario');
  assert.ok(setCookie);
  assert.match(setCookie, /HttpOnly/i); assert.match(setCookie, /Secure/i); assert.match(setCookie, /SameSite=Lax/i);
  const cookie = setCookie.split(';')[0];
  for (const [number, access] of [['BM-LOCAL', ''], ['BM-LOCAL', 'order_status_BM-LOCAL=invalid'], ['BM-OTRO', cookie]]) {
    const response = await fetch(base + '/api/pedidos/estado?order=' + number, { headers: { Cookie: access } });
    assert.equal(response.status, 404);
    assert.equal(response.headers.get('cache-control'), 'no-store');
  }
  assert.equal(privateReads.length, readsBefore);
  const authorized = await fetch(base + '/api/pedidos/estado?order=BM-LOCAL', { headers: { Cookie: cookie } });
  assert.equal(authorized.status, 200);
  assert.deepEqual(await authorized.json(), { orderNumber: 'BM-LOCAL', status: 'PAID' });
  assert.equal(privateReads.length, readsBefore + 1);
  assert.equal(await (await fetch(base + '/api/pagos/notificacion', { method: 'POST', body: '' })).text(), 'Firma inválida');
  assert.equal(privateReads.length, readsBefore + 1);
  for (const route of ['/', '/carta', '/reservas', '/sobre-nosotros', '/contacto', '/pedido/confirmacion?order=BM-LOCAL']) {
    assert.equal((await get(route)).status, 200, route);
  }
  pass('login, cookie limitada al pedido, confirmación y restaurante; webhook sin firma rechazado sin acceder a pedidos');
}

async function checkBrowser() {
  const chromePath = process.env.CHROME_PATH ?? 'C:/Program Files/Google/Chrome/Application/chrome.exe';
  await fs.access(chromePath);
  const debugPort = await freePort();
  console.log('Chrome local: iniciando comprobación en puerto ' + debugPort);
  const chrome = spawn(chromePath, ['--headless=new', '--no-sandbox', '--in-process-gpu', '--disable-gpu', '--no-first-run', '--no-default-browser-check', '--disable-background-networking',
    `--remote-debugging-port=${debugPort}`, `--user-data-dir=${path.join(artifacts, 'chrome-' + Date.now())}`, 'about:blank'], { windowsHide: true, stdio: ['ignore', 'ignore', 'pipe'] });
  let launchError;
  chrome.once('error', error => { launchError = error; });
  chrome.stderr.on('data', chunk => fs.appendFile(path.join(artifacts, 'chrome.log'), chunk));
  let ws;
  try {
    let target;
    for (let i = 0; i < 30; i++) {
      if (launchError) throw launchError;
      try { target = (await (await fetch(`http://127.0.0.1:${debugPort}/json`, { signal: AbortSignal.timeout(1000) })).json()).find(tab => tab.type === 'page'); if (target) break; } catch {}
      await delay(100);
    }
    assert.ok(target, 'Chrome starts');
    ws = new WebSocket(target.webSocketDebuggerUrl);
    await new Promise(resolve => ws.addEventListener('open', resolve, { once: true }));
    let id = 0; const pending = new Map(); const exceptions = [];
    const send = (method, params = {}) => new Promise((resolve, reject) => {
      const n = ++id;
      const timeout = setTimeout(() => { pending.delete(n); reject(new Error('CDP timeout: ' + method)); }, 15000);
      pending.set(n, { resolve: result => { clearTimeout(timeout); resolve(result); }, reject: error => { clearTimeout(timeout); reject(error); } });
      ws.send(JSON.stringify({ id: n, method, params }));
    });
    ws.addEventListener('message', async ({ data }) => {
      const message = JSON.parse(data);
      if (message.id) { const p = pending.get(message.id); pending.delete(message.id); if (p) { if (message.error) p.reject(message.error); else p.resolve(message.result); } }
      if (message.method === 'Runtime.exceptionThrown') exceptions.push(message.params.exceptionDetails.text);
      if (message.method === 'Fetch.requestPaused') {
        const { requestId, request } = message.params;
        try {
          if (new URL(request.url).origin === base) await send('Fetch.continueRequest', { requestId });
          else await send('Fetch.failRequest', { requestId, errorReason: 'Aborted' });
        } catch (error) {
          // Una navegación puede cancelar la petición antes de contestar al CDP.
          if (error.code !== -32602) exceptions.push(String(error.message ?? error));
        }
      }
    });
    const evaluate = async expression => {
      const result = await send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true });
      if (result.exceptionDetails) throw new Error(result.exceptionDetails.exception?.description ?? result.exceptionDetails.text);
      return result.result.value;
    };
    const wait = async expression => {
      for (let i = 0; i < 120; i++) {
        try { if (await evaluate(expression)) return; } catch { /* contexto recreado durante navegación/recarga */ }
        await delay(100);
      }
      throw new Error('Browser timeout: ' + expression + '\n' + await evaluate('document.body.innerText'));
    };
    const navigate = async route => { await send('Page.navigate', { url: base + route }); await wait(`location.pathname === ${JSON.stringify(route)} && document.readyState === 'complete'`); await delay(350); };
    await send('Page.enable'); await send('Runtime.enable'); await send('Network.enable');
    await send('Fetch.enable', { patterns: [{ urlPattern: '*', requestStage: 'Request' }] });
    await navigate('/tienda');
    await evaluate(`localStorage.setItem('ebm_consent_v1',JSON.stringify({version:'1',date:new Date().toISOString(),decided:true,categories:{funcional:false,analisis:false}}));localStorage.setItem('ebm_pwa_dismissed_at',new Date().toISOString());`);
    await evaluate(`document.querySelector('a[href="/tienda/producto/producto-local"]').click()`);
    await wait(`location.pathname === '/tienda/producto/producto-local' && !!document.querySelector('button')`);
    await wait(`document.body.textContent.includes('Añadir al carrito')`);
    state.price = 3500;
    await evaluate('history.back()');
    await wait(`location.pathname === '/tienda' && document.body.textContent.includes('35,00')`);
    state.price = 4000;
    await evaluate('history.forward()');
    await wait(`location.pathname === '/tienda/producto/producto-local' && document.body.textContent.includes('40,00')`);
    pass('Chrome producción: atrás/adelante recargan datos comerciales actuales');
    const storedItem = { variantId, productSlug: 'producto-local', productName: 'Nombre antiguo', variantName: '1 kg', quantity: 2, unitPrice: 2500, stock: 8, allergens: [], imageUrl: null };
    await evaluate(`localStorage.setItem('ebm_cart_v1',${JSON.stringify(JSON.stringify([storedItem]))})`);
    await navigate('/checkout');
    await wait(`document.body.textContent.includes('Total revisado') && document.body.textContent.includes('90,00')`);
    await wait(`document.body.textContent.includes('Los precios han cambiado')`);
    assert.equal(writes.length, 0);
    await evaluate(`(() => {
      const values={customerName:'Ana',customerLastName:'García',customerEmail:'ana@example.invalid',customerPhone:'670775786',shippingStreet:'Calle Mayor, 1',shippingCity:'Xàtiva',shippingProvince:'València',shippingPostalCode:'46800'};
      const setter=Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set;
      for(const [name,value] of Object.entries(values)){const input=document.getElementById(name);setter.call(input,value);input.dispatchEvent(new Event('input',{bubbles:true}));}
      document.getElementById('acceptTerms').click();
    })()`);
    state.price = 4500;
    await evaluate(`document.querySelector('form').requestSubmit()`);
    await wait(`document.body.textContent.includes('100,00') && document.body.textContent.includes('vuelve a pulsar')`);
    assert.equal(writes.length, 0);
    assert.equal(await evaluate(`document.getElementById('customerName').value`), 'Ana');
    assert.ok(await evaluate(`!document.querySelector('button[type="submit"]').disabled`));
    pass('Chrome: carrito antiguo revisado al entrar; otro cambio de precio exige revisar sin perder formulario');
    state.productActive = false;
    await navigate('/checkout');
    await wait(`!!document.querySelector('[role="alert"]') && document.body.textContent.includes('elimínalo del carrito')`);
    assert.ok(await evaluate(`document.querySelector('button[type="submit"]').disabled && !!document.querySelector('a[href="/carrito"]')`));
    state.productActive = true;
    await evaluate(`Array.from(document.querySelectorAll('button')).find(button=>button.textContent==='Volver a comprobar').click()`);
    await wait(`document.body.textContent.includes('Total revisado') && !document.querySelector('[role="alert"]')`);
    pass('Chrome: retirada bloquea pago y permite corregir/reintentar');
    assert.deepEqual(exceptions, []);
    await send('Page.captureScreenshot', { format: 'png' }).then(result => fs.writeFile(path.join(artifacts, 'checkout.png'), Buffer.from(result.data, 'base64')));
  } finally { ws?.close(); chrome.kill(); }
}
