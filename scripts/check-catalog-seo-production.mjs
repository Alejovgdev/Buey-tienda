// Producción local aislada: sin .env, credenciales reales, mutaciones o publicación.
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';

const root = process.cwd();
const artifacts = path.join(root, '.catalog-seo-check.local');
await fs.mkdir(artifacts, { recursive: true });
const project = await fs.mkdtemp(path.join(os.tmpdir(), 'buey-catalog-seo-check-'));
await fs.cp(path.join(root, 'src'), path.join(project, 'src'), { recursive: true });
for (const name of ['package.json', 'package-lock.json', 'next.config.ts', 'tsconfig.json', 'postcss.config.mjs', 'tailwind.config.ts']) {
  await fs.copyFile(path.join(root, name), path.join(project, name));
}
await fs.symlink(path.join(root, 'node_modules'), path.join(project, 'node_modules'), 'junction');
await fs.symlink(path.join(root, 'public'), path.join(project, 'public'), 'junction');
await fs.writeFile(path.join(project, 'LOCAL-TEST-BUILD.txt'), 'BUILD CON DATOS FICTICIOS. NO PUBLICAR.\n');
const guard = path.join(project, 'network-guard.cjs');
await fs.writeFile(guard, `const original = globalThis.fetch;
globalThis.fetch = function(input, init) {
  const url = new URL(typeof input === 'string' || input instanceof URL ? input : input.url);
  const method = (init?.method || input?.method || 'GET').toUpperCase();
  if (!['127.0.0.1', 'localhost', '[::1]'].includes(url.hostname) || !['GET', 'HEAD'].includes(method)) {
    throw new Error('Catalog validation blocked request: ' + method + ' ' + url.hostname);
  }
  return original.call(this, input, init);
};\n`);

const origin = 'https://www.restauranteelbueymadurado.com';
const categories = [
  { id: 'cat-1', slug: 'categoria-local', name: 'Categoría local', is_active: true },
  { id: 'cat-2', slug: 'vacia', name: 'Categoría vacía', is_active: true },
  { id: 'cat-3', slug: 'inactiva', name: 'Categoría inactiva', is_active: false },
  { id: 'cat-4', slug: 'solo-inactivos', name: 'Solo productos inactivos', is_active: true },
  { id: 'cat-5', slug: 'agotados', name: 'Agotados temporalmente', is_active: true },
];
const makeProduct = (id, slug, categoryId, stock = 5, active = true) => ({
  id, slug, category_id: categoryId, name: 'Producto ' + slug,
  description: 'Descripción comercial de ' + slug, is_active: active,
  allergens: [], allergens_notes: null, product_images: [],
  product_variants: [{ id: 'variant-' + id, name: 'Formato local', price: 2500, stock, is_active: true }],
});
const products = [
  makeProduct('product-1', 'producto-local', 'cat-1'),
  makeProduct('product-2', 'agotado', 'cat-5', 0),
  makeProduct('product-3', 'retirado', 'cat-4', 5, false),
  makeProduct('product-4', 'categoria-inactiva', 'cat-3'),
];
const state = { categories, products, fail: null, cap: 1000, delay: 0 };
const requests = [], unexpected = [], results = [];
const fixture = http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://127.0.0.1');
  const table = url.pathname.split('/').at(-1);
  const offset = Number(url.searchParams.get('offset') ?? 0);
  const select = url.searchParams.get('select') ?? '';
  const scan = req.headers.prefer?.includes('count=exact') ?? false;
  requests.push({ table, offset, scan, slug: url.searchParams.get('slug') });
  if (!['GET', 'HEAD'].includes(req.method)) {
    unexpected.push(req.method + ' ' + table); res.writeHead(405); res.end(); return;
  }
  const failure = state.fail;
  if (failure && failure.table === table && (!failure.scanOnly || scan) && offset >= (failure.from ?? 0)
    && (!failure.listOnly || !url.searchParams.has('slug'))) {
    if (state.delay) await new Promise(resolve => setTimeout(resolve, state.delay));
    if (failure.transport) { req.socket.destroy(); return; }
    res.writeHead(503, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ message: 'Bearer private-provider-sentinel', code: '08006' })); return;
  }
  let rows;
  if (table === 'categories') rows = state.categories;
  else if (table === 'products') rows = state.products.map(product => ({
    ...product,
    categories: state.categories.find(category => category.id === product.category_id) ?? null,
    product_variants: product.product_variants.filter(variant => !url.searchParams.has('product_variants.is_active') || variant.is_active),
  }));
  else if (table === 'shop_settings') rows = [{ accepting_orders: true, notice_message: 'VALIDACIÓN LOCAL', checkout_disabled_message: null }];
  else { unexpected.push('GET ' + table); res.writeHead(500); res.end(); return; }
  for (const field of ['id', 'slug', 'category_id', 'is_active']) {
    if (url.searchParams.has(field)) rows = rows.filter(row => 'eq.' + row[field] === url.searchParams.get(field));
  }
  if (table === 'products' && (url.searchParams.has('categories.is_active') || select.includes('categories!inner'))) {
    rows = rows.filter(row => row.categories && (!url.searchParams.has('categories.is_active') || row.categories.is_active));
  }
  rows = [...rows];
  if (url.searchParams.get('order')?.startsWith('id.')) rows.sort((a, b) => a.id.localeCompare(b.id));
  const total = rows.length;
  const limit = Math.min(Number(url.searchParams.get('limit') ?? total), state.cap);
  rows = rows.slice(offset, offset + limit);
  res.writeHead(200, {
    'Content-Type': 'application/json', 'Cache-Control': 'no-store',
    'Content-Range': rows.length ? `${offset}-${offset + rows.length - 1}/${total}` : `*/${total}`,
  });
  res.end(JSON.stringify(rows));
});
const listen = server => new Promise((resolve, reject) => {
  server.once('error', reject); server.listen(0, '127.0.0.1', () => resolve(server.address().port));
});
const fixturePort = await listen(fixture);
const listener = http.createServer();
const port = await listen(listener);
await new Promise(resolve => listener.close(resolve));
const base = `http://127.0.0.1:${port}`;
const env = {
  ...process.env, NODE_ENV: 'production', NEXT_TELEMETRY_DISABLED: '1',
  NEXT_PUBLIC_SUPABASE_URL: `http://127.0.0.1:${fixturePort}`, NEXT_PUBLIC_SUPABASE_ANON_KEY: 'local-only', SUPABASE_SERVICE_ROLE_KEY: 'local-only',
  NEXT_PUBLIC_BASE_URL: base,
  ADMIN_PASSWORD: 'local-only', ADMIN_JWT_SECRET: 'local-only-secret-for-isolated-tests',
  REDSYS_ENVIRONMENT: 'test', REDSYS_SECRET_KEY: 'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA', REDSYS_MERCHANT_CODE: '000000000', REDSYS_TERMINAL: '001',
  RESEND_API_KEY: 're_local_only', EMAIL_FROM: 'test@example.invalid', ADMIN_NOTIFICATION_EMAIL: 'test@example.invalid',
  NODE_OPTIONS: `--require "${guard.replaceAll('\\', '/')}"`,
};
const launch = args => spawn(process.execPath, [path.join(root, 'node_modules/next/dist/bin/next'), ...args], { cwd: project, env, stdio: 'inherit', windowsHide: true });
const exited = child => new Promise((resolve, reject) => {
  child.once('error', reject); child.once('exit', code => code === 0 ? resolve() : reject(new Error('Next exited ' + code)));
});
const get = async (route, status = 200, agent = 'Mozilla/5.0') => {
  const response = await fetch(base + route, { headers: { 'User-Agent': agent }, redirect: 'manual', signal: AbortSignal.timeout(20000) });
  const body = await response.text();
  results.push({ route, status: response.status, agent, scenario: state.fail ?? 'valid' });
  assert.equal(response.status, status, route + ': ' + body.slice(0, 180));
  assert.ok(!body.includes('private-provider-sentinel'), route + ' no filtra errores del proveedor');
  return { response, body };
};
const decodeXml = value => value.replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'");
async function sitemap(name, route = '/sitemap.xml') {
  const { response, body } = await get(route);
  assert.match(response.headers.get('content-type'), /application\/xml/);
  assert.equal(response.headers.get('cache-control'), 'no-store');
  assert.match(body, /^<\?xml version="1.0" encoding="UTF-8"\?>/);
  assert.ok(body.includes('<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">'));
  assert.ok(!body.includes('<lastmod>'));
  const urls = [...body.matchAll(/<loc>(.*?)<\/loc>/g)].map(match => decodeXml(match[1]));
  assert.equal(new Set(urls).size, urls.length);
  for (const url of urls) {
    const parsed = new URL(url);
    assert.equal(parsed.origin, origin); assert.equal(parsed.search, ''); assert.equal(parsed.hash, '');
    assert.ok(!/^\/(?:admin|api|carrito|checkout|pedido)(?:\/|$)/.test(parsed.pathname));
  }
  await fs.writeFile(path.join(artifacts, name + '.xml'), body);
  return urls;
}
let next;
const stopNext = () => { if (next && !next.killed) next.kill(); };
process.once('exit', stopNext);
try {
  await exited(launch(['build', '--webpack']));
  next = launch(['start', '--hostname', '127.0.0.1', '--port', String(port)]);
  let ready = false;
  for (let i = 0; i < 100; i++) {
    try { await get('/'); ready = true; break; } catch {}
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  assert.ok(ready);
  const initial = await sitemap('initial');
  const staticPaths = ['', '/carta', '/reservas', '/contacto', '/sobre-nosotros', '/sorteo', '/aviso-legal', '/politica-de-privacidad', '/politica-de-cookies', '/condiciones-de-contratacion', '/tienda'];
  for (const route of staticPaths) assert.ok(initial.includes(origin + route));
  for (const route of ['/tienda/categoria-local', '/tienda/agotados', '/tienda/producto/producto-local', '/tienda/producto/agotado']) assert.ok(initial.includes(origin + route));
  for (const slug of ['vacia', 'inactiva', 'solo-inactivos', 'retirado', 'categoria-inactiva', 'no-existe']) assert.ok(!initial.some(url => url.endsWith('/' + slug)), slug);
  assert.equal(initial.length, 15);
  for (const url of initial) await get(new URL(url).pathname);
  assert.deepEqual(await sitemap('parameters', '/sitemap.xml?utm_source=local'), initial);
  const head = await fetch(base + '/sitemap.xml', { method: 'HEAD' });
  assert.equal(head.status, 200); assert.equal(await head.text(), '');
  await get('/tienda/vacia'); await get('/tienda/solo-inactivos');
  for (const route of ['/tienda/inactiva', '/tienda/no-existe', '/tienda/producto/no-existe', '/tienda/producto/retirado', '/tienda/producto/categoria-inactiva']) {
    await get(route, 404, 'Twitterbot/1.0');
  }
  assert.ok((await get('/tienda/producto/agotado')).body.includes('Agotado'));

  const robots = (await get('/robots.txt')).body;
  assert.ok(robots.includes('User-Agent: *') && robots.includes('Allow: /'));
  assert.ok(robots.includes('Disallow: /api/'));
  assert.ok(robots.includes('Sitemap: ' + origin + '/sitemap.xml'));
  assert.deepEqual([...robots.matchAll(/^Disallow:\s*(.+)$/gm)].map(match => match[1].trim()), ['/api/']);
  for (const route of ['/carrito', '/carrito?pago=fallido', '/checkout', '/pedido/confirmacion?order=BM-LOCAL', '/admin/login']) {
    assert.match((await get(route)).body, /<meta name="robots" content="noindex, (?:follow|nofollow)"/);
  }
  const admin = await get('/admin/pedidos', 307);
  assert.equal(new URL(admin.response.headers.get('location'), base).pathname, '/admin/login');

  // Cambios de publicación y stock en la misma instancia, sin recompilar.
  state.products.push(makeProduct('product-new', 'nuevo-local', 'cat-2'));
  let updated = await sitemap('updated');
  assert.ok(updated.includes(origin + '/tienda/vacia') && updated.includes(origin + '/tienda/producto/nuevo-local'));
  await get('/tienda/producto/nuevo-local');
  state.products[0].product_variants[0].stock = 0;
  assert.ok((await get('/tienda/producto/producto-local')).body.includes('Agotado'));
  assert.ok((await sitemap('stock-zero')).includes(origin + '/tienda/producto/producto-local'));
  state.products.at(-1).is_active = false;
  updated = await sitemap('unpublished');
  assert.ok(!updated.includes(origin + '/tienda/vacia') && !updated.includes(origin + '/tienda/producto/nuevo-local'));
  await get('/tienda/producto/nuevo-local', 404, 'Twitterbot/1.0');

  // No se admite 404/200 vacío para fallos de DB, también si llegan con retraso.
  for (const table of ['categories', 'products']) {
    state.fail = { table }; state.delay = 100;
    for (const agent of ['Mozilla/5.0', 'Googlebot', 'Twitterbot/1.0']) {
      for (const route of ['/tienda', '/tienda/categoria-local', '/tienda/producto/producto-local']) {
        if (table === 'categories' && route.includes('/producto/')) continue;
        const failed = await get(route, 500, agent);
        assert.ok(!failed.body.includes('La tienda no tiene categorías disponibles') && !failed.body.includes('Todavía no hay productos disponibles'));
      }
    }
    const failed = await get('/sitemap.xml', 503);
    assert.equal(failed.response.headers.get('retry-after'), '60');
    assert.equal(failed.response.headers.get('cache-control'), 'no-store');
    assert.ok(!failed.body.includes('<urlset') && !failed.body.includes('<loc>'));
    await get('/carta'); await get('/reservas');
    const home = await get('/');
    if (table === 'products') assert.ok(home.body.includes('No se ha podido cargar el catálogo. Inténtalo de nuevo más tarde.'));
    state.fail = null; state.delay = 0;
    await sitemap('recovered-' + table);
  }
  state.fail = { table: 'categories', listOnly: true };
  await get('/tienda/categoria-local', 500);
  state.fail = { table: 'products', transport: true };
  await get('/tienda/producto/producto-local', 500);
  await get('/sitemap.xml', 503);
  state.fail = null;

  // Más filas que el límite de respuesta: ni truncado ni sitemap parcial.
  state.products = Array.from({ length: 1001 }, (_, i) => makeProduct('page-' + String(i).padStart(4, '0'), 'paginado-' + i, 'cat-1'));
  state.cap = 100;
  const large = await sitemap('paginated');
  assert.equal(large.length, staticPaths.length + 1 + 1001);
  assert.ok(large.includes(origin + '/tienda/producto/paginado-1000'));
  state.fail = { table: 'products', scanOnly: true, from: 100 };
  const failedPage = await get('/sitemap.xml', 503);
  assert.ok(!failedPage.body.includes('<urlset'));
  state.fail = null;
  state.categories = []; state.products = [];
  assert.equal((await sitemap('empty')).length, staticPaths.length);
  assert.ok((await get('/tienda')).body.includes('La tienda no tiene categorías disponibles'));
  assert.deepEqual(unexpected, []);
  await fs.writeFile(path.join(artifacts, 'results.json'), JSON.stringify({ project, checkedResponses: results.length, results, requests, unexpected }, null, 2));
  console.log('PASS catálogo/sitemap/robots: ' + results.length + ' respuestas HTTP, datos cambiantes, fallos temporales, recuperación y paginación completa.');
  console.log('Build ficticio aislado en ' + project + '. NO PUBLICAR. Informe: .catalog-seo-check.local/results.json');
} catch (error) {
  await fs.writeFile(path.join(artifacts, 'failure.json'), JSON.stringify({ project, error: String(error), results, requests }, null, 2));
  throw error;
} finally {
  process.removeListener('exit', stopNext);
  if (next && next.exitCode === null) {
    const stopped = new Promise(resolve => next.once('exit', resolve)); next.kill(); await stopped;
  }
  fixture.closeAllConnections(); await new Promise(resolve => fixture.close(resolve));
}
