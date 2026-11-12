// Build temporal sin .env. Fixtures de lectura y navegador aislado, sin servicios reales.
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';

const root = process.cwd();
const artifacts = path.join(root, '.structured-data-check.local');
await fs.mkdir(artifacts, { recursive: true });
const project = await fs.mkdtemp(path.join(os.tmpdir(), 'buey-structured-data-check-'));
await fs.cp(path.join(root, 'src'), path.join(project, 'src'), { recursive: true });
for (const name of ['package.json', 'package-lock.json', 'next.config.ts', 'tsconfig.json', 'postcss.config.mjs', 'tailwind.config.ts']) await fs.copyFile(path.join(root, name), path.join(project, name));
await fs.symlink(path.join(root, 'node_modules'), path.join(project, 'node_modules'), 'junction');
await fs.symlink(path.join(root, 'public'), path.join(project, 'public'), 'junction');
await fs.writeFile(path.join(project, 'LOCAL-TEST-BUILD.txt'), 'SOLO PRUEBAS CON DATOS FICTICIOS. NO PUBLICAR.\n');
const guard = path.join(project, 'network-guard.cjs');
await fs.writeFile(guard, `const original=globalThis.fetch;
globalThis.fetch=function(input,init){const url=new URL(typeof input==='string'||input instanceof URL?input:input.url);
const method=(init?.method||input?.method||'GET').toUpperCase();
if(!['127.0.0.1','localhost','[::1]'].includes(url.hostname)||!['GET','HEAD'].includes(method))throw new Error('External request blocked');
return original.call(this,input,init);};\n`);

const originalCategory = { id: '11111111-1111-4111-8111-111111111111', slug: 'categoria-local', name: 'Categoría local', description: 'Categoría de prueba', is_active: true };
const originalProduct = {
  id: '22222222-2222-4222-8222-222222222222', slug: 'producto-local', name: 'Producto local', description: 'Descripción de prueba con datos actuales',
  category_id: originalCategory.id, is_active: true, allergens: [], allergens_notes: null,
  product_images: [{ url: '/assets/images/carne6.webp', alt_text: 'Foto local de prueba', is_main: true }],
  product_variants: [
    { id: 'initial', name: 'Formato inicial', price: 3250, stock: 3, is_active: true },
    { id: 'cheap', name: 'Formato menor', price: 975, stock: 5, is_active: true },
    { id: 'sold-out', name: 'Formato agotado', price: 2100, stock: 0, is_active: true },
  ],
};
const state = { category: structuredClone(originalCategory), product: structuredClone(originalProduct), open: true, fail: null };
const reads = { settings: 0 }, unexpected = [], results = [];
const fixture = http.createServer((req, res) => {
  const url = new URL(req.url, 'http://127.0.0.1');
  const table = url.pathname.split('/').at(-1);
  if (!['GET', 'HEAD'].includes(req.method)) { unexpected.push(req.method + ' ' + table); res.writeHead(405); res.end(); return; }
  if (state.fail === table) {
    res.writeHead(503, { 'Content-Type': 'application/json', 'Retry-After': '0' });
    res.end(JSON.stringify({ message: 'private-provider-sentinel', code: '08006' })); return;
  }
  let rows;
  if (table === 'categories') rows = state.category.is_active ? [state.category] : [];
  else if (table === 'products') rows = state.product.is_active && (!url.searchParams.has('categories.is_active') || state.category.is_active) ? [{
    ...state.product, categories: state.category,
    product_variants: state.product.product_variants.filter(variant => !url.searchParams.has('product_variants.is_active') || variant.is_active),
  }] : [];
  else if (table === 'shop_settings') {
    reads.settings++;
    rows = state.open === null ? [] : [{ accepting_orders: state.open, notice_message: 'TIENDA_ABIERTA_LOCAL', checkout_disabled_message: 'TIENDA_CERRADA_LOCAL' }];
  } else { unexpected.push('GET ' + table); res.writeHead(500); res.end(); return; }
  if (url.searchParams.has('slug')) rows = rows.filter(row => 'eq.' + row.slug === url.searchParams.get('slug'));
  const total = rows.length;
  const offset = Number(url.searchParams.get('offset') ?? 0);
  rows = rows.slice(offset, offset + Number(url.searchParams.get('limit') ?? total));
  res.writeHead(200, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store', 'Content-Range': rows.length ? `${offset}-${offset + rows.length - 1}/${total}` : `*/${total}` });
  res.end(JSON.stringify(rows));
});
const listen = server => new Promise((resolve, reject) => { server.once('error', reject); server.listen(0, '127.0.0.1', () => resolve(server.address().port)); });
const freePort = async () => { const server = http.createServer(); const port = await listen(server); await new Promise(resolve => server.close(resolve)); return port; };
const fixturePort = await listen(fixture), port = await freePort();
const base = `http://127.0.0.1:${port}`, origin = 'https://www.restauranteelbueymadurado.com';
const productUrl = origin + '/tienda/producto/producto-local';
const env = {
  ...process.env, NODE_ENV: 'production', NEXT_TELEMETRY_DISABLED: '1',
  NEXT_PUBLIC_SUPABASE_URL: `http://127.0.0.1:${fixturePort}`, NEXT_PUBLIC_SUPABASE_ANON_KEY: 'local-only', SUPABASE_SERVICE_ROLE_KEY: 'local-only',
  NEXT_PUBLIC_BASE_URL: base, NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME: 'local-only',
  ADMIN_PASSWORD: 'local-only', ADMIN_JWT_SECRET: 'local-only-secret-for-isolated-tests',
  REDSYS_ENVIRONMENT: 'test', REDSYS_SECRET_KEY: 'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA', REDSYS_MERCHANT_CODE: '000000000', REDSYS_TERMINAL: '001',
  RESEND_API_KEY: 're_local_only', EMAIL_FROM: 'test@example.invalid', ADMIN_NOTIFICATION_EMAIL: 'test@example.invalid',
  NODE_OPTIONS: `--require "${guard.replaceAll('\\', '/')}"`,
};
const launch = args => spawn(process.execPath, [path.join(root, 'node_modules/next/dist/bin/next'), ...args], { cwd: project, env, stdio: 'inherit', windowsHide: true });
const exited = child => new Promise((resolve, reject) => { child.once('error', reject); child.once('exit', code => code === 0 ? resolve() : reject(new Error('Next exited ' + code))); });
const parseJsonLd = html => [...html.matchAll(/<script\b[^>]*type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/g)].map(match => {
  assert.ok(!match[1].includes('<'), 'JSON-LD no contiene HTML ejecutable');
  return JSON.parse(match[1]);
});
const get = async (route, status = 200) => {
  const response = await fetch(base + route, { headers: { 'User-Agent': 'Twitterbot/1.0' }, redirect: 'manual', signal: AbortSignal.timeout(15000) });
  const html = await response.text();
  assert.equal(response.status, status, route);
  assert.ok(!html.includes('private-provider-sentinel'));
  const nodes = parseJsonLd(html);
  const ids = nodes.map(node => node['@id']);
  assert.equal(new Set(ids).size, ids.length, 'No hay entidades duplicadas');
  const forbidden = /"(?:sku|gtin\d*|review|aggregateRating|shippingDetails|hasMerchantReturnPolicy|openingHours(?:Specification)?)"\s*:/;
  assert.ok(!forbidden.test(JSON.stringify(nodes)));
  results.push({ route, status, nodes });
  return { html, nodes };
};
const productNode = page => page.nodes.find(node => node['@type'] === 'Product');
let next;
const stopNext = () => { if (next && !next.killed) next.kill(); };
process.once('exit', stopNext);
try {
  await exited(launch(['build', '--webpack']));
  next = launch(['start', '--hostname', '127.0.0.1', '--port', String(port)]);
  let ready = false;
  for (let i = 0; i < 100; i++) { try { await get('/'); ready = true; break; } catch {} await new Promise(resolve => setTimeout(resolve, 100)); }
  assert.ok(ready);
  const home = await get('/'), contact = await get('/contacto');
  assert.equal(home.nodes.length, 1); assert.deepEqual(home.nodes, contact.nodes);
  const restaurant = home.nodes[0];
  assert.equal(restaurant['@type'], 'Restaurant'); assert.equal(restaurant['@id'], origin + '/#restaurant');
  assert.equal(restaurant.telephone, '+34670775786'); assert.equal(restaurant.address.streetAddress, 'Calle Reina, 41');
  assert.equal(restaurant.menu, origin + '/carta');
  assert.ok(home.html.includes('Calle Reina, 41.') && contact.html.includes('Calle Reina, 41.'));
  for (const image of restaurant.image) assert.equal((await fetch(base + new URL(image).pathname)).status, 200);
  const category = await get('/tienda/categoria-local');
  assert.equal(category.nodes.length, 1);
  assert.deepEqual(category.nodes[0].itemListElement.map(item => item.name), ['Tienda', state.category.name]);

  const before = reads.settings;
  let page = await get('/tienda/producto/producto-local?utm_source=local');
  assert.equal(reads.settings - before, 1, 'Aviso y marcado comparten una lectura de apertura');
  let product = productNode(page);
  assert.equal(page.nodes.length, 2);
  assert.equal(product['@id'], productUrl + '#product'); assert.equal(product.url, productUrl);
  assert.deepEqual(product.image, [origin + '/assets/images/carne6.webp']);
  assert.equal(product.description, state.product.description);
  assert.equal(product.offers.price, '32.50'); assert.equal(product.offers.priceCurrency, 'EUR');
  assert.equal(product.offers.availability, 'https://schema.org/InStock');
  assert.ok(page.html.includes('32,50'));
  const trail = page.nodes.find(node => node['@type'] === 'BreadcrumbList').itemListElement;
  assert.deepEqual(trail.map(item => item.item), [origin + '/tienda', origin + '/tienda/categoria-local', productUrl]);
  assert.ok(page.html.includes('href="/tienda/categoria-local"'));

  state.product.product_variants[0].stock = 0;
  page = await get('/tienda/producto/producto-local');
  assert.equal(productNode(page).offers.availability, 'https://schema.org/OutOfStock');
  assert.equal(productNode(page).offers.price, '32.50'); assert.ok(page.html.includes('Agotado'));
  state.product.product_variants[0].stock = 3;
  state.open = false;
  page = await get('/tienda/producto/producto-local');
  assert.ok(page.html.includes('TIENDA_CERRADA_LOCAL')); assert.ok(!productNode(page).offers);
  state.open = null;
  page = await get('/tienda/producto/producto-local');
  assert.ok(page.html.includes('No se ha podido comprobar la apertura')); assert.ok(!productNode(page).offers);
  state.open = true; state.fail = 'shop_settings';
  page = await get('/tienda/producto/producto-local');
  assert.ok(!productNode(page).offers);
  state.fail = null;

  // El primer formato deja de estar activo: la ficha usa el siguiente y no su precio mínimo arbitrario.
  state.product.product_variants[0].is_active = false;
  page = await get('/tienda/producto/producto-local');
  assert.equal(productNode(page).offers.price, '9.75'); assert.equal(productNode(page).offers.name, 'Formato menor');
  state.product.product_variants = [];
  assert.ok(!productNode(await get('/tienda/producto/producto-local')).offers);
  state.product.product_images = [];
  assert.ok(!productNode(await get('/tienda/producto/producto-local')));
  state.product = structuredClone(originalProduct); state.product.description = null;
  assert.ok(!productNode(await get('/tienda/producto/producto-local')).description);
  state.product.is_active = false;
  assert.equal((await get('/tienda/producto/producto-local', 404)).nodes.length, 0);
  const emptyCategory = await get('/tienda/categoria-local');
  assert.ok(!/<meta name="robots" content="[^"]*noindex/.test(emptyCategory.html));
  state.product.is_active = true; state.category.is_active = false;
  assert.equal((await get('/tienda/producto/producto-local', 404)).nodes.length, 0);
  state.category.is_active = true; state.fail = 'products';
  assert.equal((await get('/tienda/producto/producto-local', 500)).nodes.length, 0);
  state.fail = null;

  const attack = '</script><script>globalThis.__SEO_INJECTED=true</script>';
  state.product.name = 'Producto ' + attack;
  state.product.description = 'Descripción ' + attack + '\u2028 & comillas "reales"';
  page = await get('/tienda/producto/producto-local');
  assert.equal(productNode(page).name, state.product.name); assert.equal(productNode(page).description, state.product.description);
  await fs.writeFile(path.join(artifacts, 'unsafe-content.html'), page.html);
  await checkBrowser(attack);
  assert.deepEqual(unexpected, []);
  await fs.writeFile(path.join(artifacts, 'results.json'), JSON.stringify({ project, checkedResponses: results.length, results, unexpected }, null, 2));
  console.log('PASS JSON-LD: ' + results.length + ' respuestas, HTML inicial, selección real de formatos en Chrome, contenido seguro y entidades coherentes.');
  console.log('Build ficticio aislado en ' + project + '. NO PUBLICAR. Informe: .structured-data-check.local/results.json');
} catch (error) {
  await fs.writeFile(path.join(artifacts, 'failure.json'), JSON.stringify({ project, error: String(error), results, unexpected }, null, 2));
  throw error;
} finally {
  process.removeListener('exit', stopNext);
  if (next && next.exitCode === null) { const stopped = new Promise(resolve => next.once('exit', resolve)); next.kill(); await stopped; }
  fixture.closeAllConnections(); await new Promise(resolve => fixture.close(resolve));
}

async function checkBrowser(attack) {
  const debugPort = await freePort();
  const chrome = spawn('C:/Program Files/Google/Chrome/Application/chrome.exe', [
    // Solo este proceso de pruebas, con perfil vacío y peticiones restringidas a loopback.
    '--headless=new', '--no-sandbox', '--disable-extensions', '--disable-gpu', '--disable-software-rasterizer',
    '--no-first-run', '--no-default-browser-check', '--disable-background-networking',
    '--remote-debugging-port=' + debugPort, '--user-data-dir=' + path.join(artifacts, 'chrome-' + Date.now()), 'about:blank',
  ], { windowsHide: true, stdio: 'ignore' });
  let ws;
  const snapshots = [], exceptions = [], blocked = new Set();
  try {
    let target;
    for (let i = 0; i < 100; i++) { try { target = (await (await fetch(`http://127.0.0.1:${debugPort}/json`)).json()).find(tab => tab.type === 'page'); if (target) break; } catch {} await new Promise(resolve => setTimeout(resolve, 100)); }
    assert.ok(target, 'Chrome disponible');
    ws = new WebSocket(target.webSocketDebuggerUrl);
    await new Promise(resolve => ws.addEventListener('open', resolve, { once: true }));
    let id = 0; const pending = new Map();
    const send = (method, params = {}) => new Promise((resolve, reject) => {
      const number = ++id;
      const timeout = setTimeout(() => { pending.delete(number); reject(new Error('CDP timeout: ' + method)); }, 15000);
      pending.set(number, { resolve: value => { clearTimeout(timeout); resolve(value); }, reject: error => { clearTimeout(timeout); reject(error); } });
      ws.send(JSON.stringify({ id: number, method, params }));
    });
    ws.addEventListener('message', async ({ data }) => {
      const message = JSON.parse(data);
      if (message.id) { const item = pending.get(message.id); pending.delete(message.id); if (item) message.error ? item.reject(message.error) : item.resolve(message.result); }
      if (message.method === 'Runtime.exceptionThrown') exceptions.push(message.params.exceptionDetails.exception?.description ?? message.params.exceptionDetails.text);
      if (message.method === 'Fetch.requestPaused') {
        const { requestId, request } = message.params;
        if (request.url.startsWith(base + '/') && request.method === 'GET') await send('Fetch.continueRequest', { requestId });
        else { blocked.add(new URL(request.url).hostname); await send('Fetch.failRequest', { requestId, errorReason: 'Aborted' }); }
      }
    });
    const evaluate = async expression => {
      const result = await send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true });
      if (result.exceptionDetails) throw new Error(result.exceptionDetails.exception?.description ?? result.exceptionDetails.text);
      return result.result.value;
    };
    await send('Page.enable'); await send('Runtime.enable'); await send('Fetch.enable', { patterns: [{ urlPattern: '*' }] });
    await send('Page.navigate', { url: base + '/tienda/producto/producto-local' });
    for (let i = 0; i < 100; i++) {
      if (await evaluate(`!!document.querySelector('button[aria-pressed="true"]') && document.querySelector('script#product-jsonld')?.textContent.includes('32.50')`)) break;
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    const snapshot = () => evaluate(`(() => ({
      data: JSON.parse(document.querySelector('#product-jsonld').textContent),
      count: document.querySelectorAll('#product-jsonld').length,
      selected: document.querySelector('button[aria-pressed="true"]')?.textContent,
      price: [...document.querySelectorAll('p')].find(el => el.classList.contains('text-3xl'))?.textContent,
      addDisabled: [...document.querySelectorAll('button')].find(el => /Añadir al carrito|^Agotado$/.test(el.textContent))?.disabled,
      injected: !!globalThis.__SEO_INJECTED, url: location.href
    }))()`);
    let current = await snapshot();
    assert.equal(current.data.name, 'Producto ' + attack); assert.equal(current.injected, false);
    assert.equal(current.data.offers.price, '32.50'); assert.equal(current.count, 1); snapshots.push(current);
    for (const [label, price, visible, availability, disabled] of [
      ['Formato menor', '9.75', '9,75', 'InStock', false],
      ['Formato agotado', '21.00', '21,00', 'OutOfStock', true],
      ['Formato inicial', '32.50', '32,50', 'InStock', false],
    ]) {
      await evaluate(`(() => { const button=[...document.querySelectorAll('button[aria-pressed]')].find(el=>el.textContent.startsWith(${JSON.stringify(label)})); button.click(); })()`);
      for (let i = 0; i < 100; i++) {
        current = await snapshot();
        if (current.data.offers.price === price && current.selected.startsWith(label)) break;
        await new Promise(resolve => setTimeout(resolve, 50));
      }
      assert.equal(current.data.offers.price, price); assert.ok(current.price.includes(visible));
      assert.equal(current.data.offers.availability, 'https://schema.org/' + availability);
      assert.equal(current.addDisabled, disabled); assert.equal(current.count, 1);
      assert.equal(current.data.url, productUrl); assert.equal(current.url, base + '/tienda/producto/producto-local');
      assert.equal(current.injected, false); snapshots.push(current);
    }
    assert.deepEqual(exceptions, []);
    await fs.writeFile(path.join(artifacts, 'browser-results.json'), JSON.stringify({ snapshots, exceptions, blocked: [...blocked] }, null, 2));
  } finally {
    ws?.close();
    if (chrome.exitCode === null) { const stopped = new Promise(resolve => chrome.once('exit', resolve)); chrome.kill(); await stopped; }
  }
}
