// Compila una copia temporal sin .env y sirve solo en loopback con datos ficticios.
// No publica el build ni reutiliza .next del proyecto. No permite mutaciones ni red externa.
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';

const root = process.cwd();
const artifacts = path.join(root, '.seo-check.local');
await fs.mkdir(artifacts, { recursive: true });
const project = await fs.mkdtemp(path.join(os.tmpdir(), 'buey-seo-check-'));
await fs.cp(path.join(root, 'src'), path.join(project, 'src'), { recursive: true });
for (const name of ['package.json', 'package-lock.json', 'next.config.ts', 'tsconfig.json', 'postcss.config.mjs', 'tailwind.config.ts']) {
  await fs.copyFile(path.join(root, name), path.join(project, name));
}
await fs.symlink(path.join(root, 'node_modules'), path.join(project, 'node_modules'), 'junction');
await fs.symlink(path.join(root, 'public'), path.join(project, 'public'), 'junction');
await fs.writeFile(path.join(project, 'LOCAL-TEST-BUILD.txt'), 'SOLO VALIDACION LOCAL CON DATOS FICTICIOS. NO PUBLICAR.\n');
const guard = path.join(project, 'network-guard.cjs');
await fs.writeFile(guard, `const original = globalThis.fetch;
globalThis.fetch = function(input, init) {
  const url = new URL(typeof input === 'string' || input instanceof URL ? input : input.url);
  const method = (init?.method || input?.method || 'GET').toUpperCase();
  if (!['127.0.0.1', 'localhost', '[::1]'].includes(url.hostname) || !['GET', 'HEAD'].includes(method)) {
    throw new Error('SEO validation blocked request: ' + method + ' ' + url.hostname);
  }
  return original.call(this, input, init);
};\n`);

const category = { id: '11111111-1111-4111-8111-111111111111', slug: 'categoria-local', name: 'Categoría local', description: 'Descripción de la categoría de prueba', is_active: true };
const product = {
  id: '22222222-2222-4222-8222-222222222222', category_id: category.id,
  slug: 'producto-local', name: 'Producto local', description: 'Descripción comercial del producto de prueba',
  is_active: true, allergens: ['leche'], allergens_notes: null,
  product_variants: [{ id: '33333333-3333-4333-8333-333333333333', name: 'Formato local', price: 2500, stock: 5 }],
  product_images: [{ url: '/assets/images/carne6.webp', alt_text: 'Imagen local de prueba', is_main: true }],
};
const unexpected = [];
const fixture = http.createServer((req, res) => {
  const url = new URL(req.url, 'http://127.0.0.1');
  const table = url.pathname.split('/').at(-1);
  let rows;
  if (!['GET', 'HEAD'].includes(req.method)) {
    unexpected.push(req.method + ' ' + table);
    res.writeHead(405); res.end('Read-only fixture'); return;
  }
  if (table === 'categories') rows = [category];
  else if (table === 'products') rows = [{ ...product, categories: category }];
  else if (table === 'shop_settings') rows = [{ accepting_orders: true, notice_message: 'VALIDACIÓN LOCAL', checkout_disabled_message: null }];
  else { unexpected.push('GET ' + table); res.writeHead(500); res.end('Unexpected fixture read'); return; }
  if (url.searchParams.has('slug')) rows = rows.filter(row => 'eq.' + row.slug === url.searchParams.get('slug'));
  res.writeHead(200, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
  res.end(JSON.stringify(rows));
});
const listen = server => new Promise((resolve, reject) => {
  server.once('error', reject);
  server.listen(0, '127.0.0.1', () => resolve(server.address().port));
});
const fixturePort = await listen(fixture);
const listener = http.createServer();
const port = await listen(listener);
await new Promise(resolve => listener.close(resolve));
const base = `http://127.0.0.1:${port}`;
const origin = 'https://www.restauranteelbueymadurado.com';
const env = {
  ...process.env, NODE_ENV: 'production', NEXT_TELEMETRY_DISABLED: '1',
  NEXT_PUBLIC_SUPABASE_URL: `http://127.0.0.1:${fixturePort}`, NEXT_PUBLIC_SUPABASE_ANON_KEY: 'local-only', SUPABASE_SERVICE_ROLE_KEY: 'local-only',
  // El origen operativo se mantiene local y distinto del SEO durante toda la prueba.
  NEXT_PUBLIC_BASE_URL: base, NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME: 'local-only',
  ADMIN_PASSWORD: 'local-only', ADMIN_JWT_SECRET: 'local-only-secret-for-isolated-tests',
  REDSYS_ENVIRONMENT: 'test', REDSYS_SECRET_KEY: 'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA', REDSYS_MERCHANT_CODE: '000000000', REDSYS_TERMINAL: '001',
  RESEND_API_KEY: 're_local_only', EMAIL_FROM: 'test@example.invalid', ADMIN_NOTIFICATION_EMAIL: 'test@example.invalid',
  NODE_OPTIONS: `--require "${guard.replaceAll('\\', '/')}"`,
};
const launch = args => spawn(process.execPath, [path.join(root, 'node_modules/next/dist/bin/next'), ...args], { cwd: project, env, stdio: 'inherit', windowsHide: true });
const exited = child => new Promise((resolve, reject) => {
  child.once('error', reject);
  child.once('exit', code => code === 0 ? resolve() : reject(new Error('Next exited ' + code)));
});
const decode = text => text.replace(/&(?:amp|quot|lt|gt|apos|#\d+|#x[\da-f]+);/gi, entity => {
  const named = { '&amp;': '&', '&quot;': '"', '&lt;': '<', '&gt;': '>', '&apos;': "'" };
  return named[entity] ?? String.fromCodePoint(entity.toLowerCase().startsWith('&#x') ? parseInt(entity.slice(3, -1), 16) : parseInt(entity.slice(2, -1), 10));
});
const textOf = html => decode(html.replace(/<[^>]*>/g, '')).replace(/\s+/g, ' ').trim();
const attributes = tag => Object.fromEntries([...tag.matchAll(/([\w-]+)="([^"]*)"/g)].map(([, name, value]) => [name.toLowerCase(), decode(value)]));
function inspect(html) {
  const document = html.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, '');
  const metas = [...document.matchAll(/<meta\b[^>]*>/gi)].map(match => attributes(match[0]));
  return {
    document,
    titles: [...document.matchAll(/<title\b[^>]*>([\s\S]*?)<\/title>/gi)].map(match => textOf(match[1])),
    descriptions: metas.filter(meta => meta.name === 'description').map(meta => meta.content),
    robots: metas.filter(meta => ['robots', 'googlebot'].includes(meta.name)),
    canonicals: [...document.matchAll(/<link\b[^>]*>/gi)].map(match => attributes(match[0])).filter(link => link.rel === 'canonical').map(link => link.href),
    h1: [...document.matchAll(/<h1\b[^>]*>([\s\S]*?)<\/h1>/gi)].map(match => textOf(match[1])),
  };
}
const results = [];
const get = async (route, agent = 'Mozilla/5.0') => {
  const response = await fetch(base + route, { headers: { 'User-Agent': agent }, redirect: 'manual', signal: AbortSignal.timeout(15000) });
  return { response, ...inspect(await response.text()) };
};
async function check(route, expected, agent) {
  const page = await get(route, agent);
  assert.equal(page.response.status, 200, route);
  assert.deepEqual(page.titles, [expected.title], route + ' title único');
  assert.equal(page.descriptions.length, 1, route + ' description única');
  assert.ok(page.descriptions[0].includes(expected.description), route + ' description propia');
  const canonical = expected.noindex ? [] : [origin + (expected.path === '/' ? '' : expected.path)];
  assert.deepEqual(page.canonicals, canonical, route + ' canonical individual y limpio');
  assert.ok(page.robots.filter(meta => meta.name === 'robots').length <= 1, route + ' robots duplicado');
  assert.ok(page.robots.filter(meta => meta.name === 'googlebot').length <= 1, route + ' googlebot duplicado');
  const directives = page.robots.flatMap(meta => meta.content.split(/,\s*/));
  if (expected.noindex) {
    assert.ok(directives.includes('noindex'), route + ' noindex');
    assert.ok(!directives.includes('index'), route + ' sin index contradictorio');
  } else {
    assert.ok(!directives.some(value => ['noindex', 'none', 'nofollow'].includes(value)), route + ' indexable');
    assert.ok(!/noindex|none/i.test(page.response.headers.get('x-robots-tag') ?? ''), route + ' cabecera indexable');
    assert.deepEqual(page.h1.length, 1, route + ' un H1');
    assert.ok(page.h1[0].includes(expected.heading), route + ' H1 propio');
  }
  for (const content of expected.content ?? []) assert.ok(textOf(page.document).includes(content), route + ' contenido HTML: ' + content);
  results.push({ route, agent: agent ?? 'Mozilla/5.0', title: page.titles[0], description: page.descriptions[0], canonical: page.canonicals[0] ?? null, h1: page.h1, robots: page.robots });
  return page;
}
const pages = [
  { path: '/', title: 'El Buey Madurado | Restaurante de carne madurada en Xàtiva', description: 'Calle Reina, 41, Xàtiva', heading: 'Carne madurada en Xàtiva.', content: ['Calle Reina, 41.', '+34 670 77 57 86', product.name] },
  { path: '/carta', title: 'Carta del restaurante en Xàtiva | El Buey Madurado', description: 'Consulta la carta', heading: 'Carta de El Buey Madurado', content: ['Entrantes', 'Carnes', 'Burgers', 'Kebabs', 'Postres', 'Bebidas'] },
  { path: '/reservas', title: 'Reservar mesa en Xàtiva | El Buey Madurado', description: 'formulario de reservas', heading: 'Reservar mesa' },
  { path: '/contacto', title: 'Contacto y ubicación en Xàtiva | El Buey Madurado', description: 'WhatsApp o correo electrónico', heading: 'Contacto y Localización', content: ['Calle Reina, 41.', 'No hablamos de', 'alta cocina'] },
  { path: '/sobre-nosotros', title: 'Sobre nuestro restaurante en Xàtiva | El Buey Madurado', description: 'historia, los propietarios y la filosofía', heading: 'El bienestar de los animales' },
  { path: '/sorteo', title: 'Newsletter de descuentos | El Buey Madurado', description: 'Suscríbete a la newsletter', heading: 'Recibe descuentos en tu email' },
  { path: '/aviso-legal', title: 'Aviso Legal y Condiciones de Uso | El Buey Madurado', description: 'Aviso legal, condiciones de uso', heading: 'Aviso Legal y Condiciones de Uso' },
  { path: '/politica-de-privacidad', title: 'Política de Privacidad | El Buey Madurado', description: 'Política de privacidad', heading: 'Política de Privacidad' },
  { path: '/politica-de-cookies', title: 'Política de Cookies | El Buey Madurado', description: 'Política de cookies', heading: 'Política de Cookies' },
  { path: '/condiciones-de-contratacion', title: 'Condiciones Generales de Contratación | El Buey Madurado', description: 'Condiciones generales de contratación', heading: 'Condiciones Generales de Contratación' },
  { path: '/tienda', title: 'Comprar carne madurada online | Tienda El Buey Madurado', description: 'Consulta el catálogo', heading: 'La tienda de El Buey Madurado', content: [category.name, product.name, '25,00'] },
  { path: '/tienda/categoria-local', title: category.name + ' | Tienda El Buey Madurado', description: category.description, heading: category.name, content: [category.description, product.name, '25,00'] },
  { path: '/tienda/producto/producto-local', title: product.name + ' | Tienda El Buey Madurado', description: product.description, heading: product.name, content: [product.description, '25,00', 'Añadir al carrito'] },
];
let next;
const stopNext = () => { if (next && !next.killed) next.kill(); };
process.once('exit', stopNext);
try {
  await exited(launch(['build', '--webpack']));
  next = launch(['start', '--hostname', '127.0.0.1', '--port', String(port)]);
  let ready = false;
  for (let i = 0; i < 100; i++) {
    try { if ((await get('/')).response.status === 200) { ready = true; break; } } catch {}
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  assert.ok(ready, 'Servidor de producción local disponible');
  for (const expected of pages) {
    for (const agent of ['Mozilla/5.0', 'Googlebot', 'Twitterbot/1.0']) {
      const clean = await check(expected.path, expected, agent);
      const query = await check(expected.path + '?utm_source=local&orden=sin-efecto', expected, agent);
      assert.deepEqual(query.titles, clean.titles);
      assert.deepEqual(query.descriptions, clean.descriptions);
    }
  }
  const carta = await get('/carta');
  assert.match(carta.document, /<h1 class="sr-only">Carta de El Buey Madurado<\/h1>/);
  const menuSource = await fs.readFile(path.join(root, 'src/data/menu.ts'), 'utf8');
  const names = [...menuSource.matchAll(/\bnombre:\s*("(?:[^"\\]|\\.)*")/g)].map(match => JSON.parse(match[1]));
  assert.ok(names.length > 0);
  for (const name of names) assert.ok(textOf(carta.document).includes(name.replace(/\s+/g, ' ').trim()), 'Carta conserva: ' + name);
  const contact = await get('/contacto');
  assert.match(contact.document, /<h2[^>]*>Hablemos<\/h2>/);
  const categoryPage = await get('/tienda/categoria-local');
  assert.match(categoryPage.document, /<h2[^>]*>Producto local<\/h2>/);

  for (const [route, title, description] of [
    ['/carrito', 'Tu carrito | El Buey Madurado', 'Revisa los productos'],
    ['/carrito?pago=fallido', 'Tu carrito | El Buey Madurado', 'Revisa los productos'],
    ['/checkout', 'Finalizar compra | El Buey Madurado', 'Completa tus datos'],
    ['/checkout?utm_source=local', 'Finalizar compra | El Buey Madurado', 'Completa tus datos'],
    ['/pedido/confirmacion', 'Confirmando tu pedido | El Buey Madurado', 'Estamos confirmando'],
    ['/pedido/confirmacion?order=BM-LOCAL', 'Confirmando tu pedido | El Buey Madurado', 'Estamos confirmando'],
    ['/admin/login', 'Panel admin | El Buey Madurado', 'Restaurante de carne madurada'],
    ['/admin/login?next=/admin/pedidos', 'Panel admin | El Buey Madurado', 'Restaurante de carne madurada'],
  ]) await check(route, { title, description, noindex: true });
  const admin = await get('/admin/pedidos');
  assert.equal(admin.response.status, 307);
  assert.equal(new URL(admin.response.headers.get('location'), base).pathname, '/admin/login');
  assert.equal((await get('/api/pedidos/estado?order=BM-LOCAL')).response.status, 404);

  // Los datos cambian sin recompilar y se escapan correctamente en el HTML servido.
  category.name = 'Categoría "nueva" & local'; category.description = 'Descripción actualizada de categoría';
  product.name = 'Producto "nuevo" & local'; product.description = 'Ficha actualizada con <texto> & detalles';
  product.product_variants[0].price = 3100;
  await check('/tienda/categoria-local', { path: '/tienda/categoria-local', title: category.name + ' | Tienda El Buey Madurado', description: category.description, heading: category.name, content: [product.name, '31,00'] });
  await check('/tienda/producto/producto-local?utm_source=cambio', { path: '/tienda/producto/producto-local', title: product.name + ' | Tienda El Buey Madurado', description: product.description, heading: product.name, content: [product.description, '31,00'] });
  for (const empty of [null, '', ' \n ']) {
    category.description = empty; product.description = empty; product.product_variants[0].stock = 0;
    await check('/tienda/categoria-local', { path: '/tienda/categoria-local', title: category.name + ' | Tienda El Buey Madurado', description: `Consulta los productos de ${category.name}`, heading: category.name });
    await check('/tienda/producto/producto-local', { path: '/tienda/producto/producto-local', title: product.name + ' | Tienda El Buey Madurado', description: `Consulta la ficha de ${product.name}`, heading: product.name, content: ['Agotado'] });
  }
  const missing = await get('/tienda/producto/no-existe', 'Twitterbot/1.0');
  assert.equal(missing.response.status, 404);
  assert.deepEqual(missing.canonicals, []);
  assert.ok(missing.robots.some(meta => meta.content.includes('noindex')));
  assert.deepEqual(unexpected, []);
  await fs.writeFile(path.join(artifacts, 'results.json'), JSON.stringify({ project, base, fixturePort, menuEntries: names.length, checkedResponses: results.length, unexpected, results }, null, 2));
  console.log(`PASS SEO: ${results.length} respuestas HTML, ${names.length} fichas de Carta, metadatos dinámicos, parámetros, noindex y acceso privado.`);
  console.log('Build ficticio aislado en ' + project + '. NO PUBLICAR. Informe: .seo-check.local/results.json');
} finally {
  process.removeListener('exit', stopNext);
  if (next && next.exitCode === null) {
    const stopped = new Promise(resolve => next.once('exit', resolve));
    next.kill();
    await stopped;
  }
  fixture.closeAllConnections();
  await new Promise(resolve => fixture.close(resolve));
}
