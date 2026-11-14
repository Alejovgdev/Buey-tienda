// Laboratorio local reproducible; no Lighthouse, INP de campo, pagos ni escrituras remotas.
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { openBrowser, freePort, delay } from './performance-browser.mjs';

const stage = process.argv[2];
assert.ok(['before', 'after'].includes(stage), 'Indica before o after');
const qaOnly = process.argv.includes('--qa-only');
const mediaQaOnly = process.argv.includes('--media-qa-only');
const root = process.cwd(), artifacts = path.join(root, '.media-performance.local');
await fs.mkdir(artifacts, { recursive: true });
const config = { width: 390, height: 844, dpr: 2, cpu: 4, latency: 150, download: 200000, upload: 93750, windowMs: 12000, repeats: 3, seed: 42 };
const routes = [ ['home', '/'], ['contacto', '/contacto'], ['carta', '/carta'], ['tienda', '/tienda'], ['categoria', '/tienda/categoria-local'], ['producto', '/tienda/producto/producto-local'] ];
const category = { id: '11111111-1111-4111-8111-111111111111', slug: 'categoria-local', name: 'Categoría local', description: 'Datos simulados para la medición', is_active: true };
const products = [0, 1, 2].map((index) => ({
  id: `22222222-2222-4222-8222-22222222222${index}`, category_id: category.id,
  slug: index === 0 ? 'producto-local' : 'producto-local-' + index, name: 'Producto local ' + (index + 1),
  description: 'Descripción de producto simulado para comprobar carga e interacción.', is_active: true,
  allergens: [], allergens_notes: null,
  product_images: [
    { url: ['/assets/images/chuleton-corte.webp', '/assets/images/carne6.webp', '/assets/images/cecina.webp'][index], alt_text: 'Foto local de prueba', is_main: true },
    { url: '/assets/images/chuleton-bandeja.webp', alt_text: 'Segunda foto local', is_main: false },
  ],
  product_variants: [
    { id: `33333333-3333-4333-8333-33333333333${index}`, name: 'Formato inicial', price: 3250, stock: 8, is_active: true },
    { id: `44444444-4444-4444-8444-44444444444${index}`, name: 'Formato menor', price: 975, stock: 6, is_active: true },
  ],
}));
const unexpected = [], results = [], qa = [], fixtureTimings = [];
const fixtureControl = { productCount: 3 };
const fixture = http.createServer((req, res) => {
  const started = performance.now();
  res.once('finish', () => fixtureTimings.push({ url: req.url, duration: performance.now() - started, status: res.statusCode }));
  const url = new URL(req.url, 'http://127.0.0.1');
  const table = url.pathname.split('/').at(-1);
  if (!['GET', 'HEAD'].includes(req.method)) { unexpected.push(req.method + ' ' + table); res.writeHead(405); res.end(); return; }
  let rows;
  if (table === 'categories') rows = [category];
  else if (table === 'products') rows = products.slice(0, fixtureControl.productCount).map(product => ({ ...product, categories: category }));
  else if (table === 'shop_settings') rows = [{ accepting_orders: true, notice_message: null, checkout_disabled_message: null }];
  else if (table === 'promotions') rows = [];
  else if (table === 'product_variants') rows = products.flatMap(product => product.product_variants.map(variant => ({ ...variant, product_id: product.id, product: { ...product, categories: category, usual_units_per_package: 1, suggested_package_count: 1 } })));
  else { unexpected.push('GET ' + table); res.writeHead(500); res.end(); return; }
  for (const field of ['slug', 'category_id', 'id']) {
    const value = url.searchParams.get(field);
    if (value?.startsWith('eq.')) rows = rows.filter(row => 'eq.' + row[field] === value);
    if (value?.startsWith('in.(')) rows = rows.filter(row => value.slice(4, -1).split(',').includes(row[field]));
  }
  const total = rows.length, offset = Number(url.searchParams.get('offset') ?? 0);
  rows = rows.slice(offset, offset + Number(url.searchParams.get('limit') ?? total));
  res.writeHead(200, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store', 'Content-Range': rows.length ? `${offset}-${offset + rows.length - 1}/${total}` : `*/${total}` });
  res.end(JSON.stringify(rows));
});
const reused = process.argv.includes('--reuse') ? JSON.parse(await fs.readFile(path.join(artifacts, stage + '-context.json'), 'utf8')) : null;
await new Promise((resolve, reject) => { fixture.once('error', reject); fixture.listen(reused?.fixturePort ?? 0, '127.0.0.1', resolve); });
const fixturePort = fixture.address().port, port = reused?.port ?? await freePort();
const base = `http://127.0.0.1:${port}`;
const project = reused?.project ?? await fs.mkdtemp(path.join(os.tmpdir(), 'buey-mobile-perf-'));
if (!reused) {
  await fs.cp(path.join(root, 'src'), path.join(project, 'src'), { recursive: true });
  for (const name of ['package.json', 'package-lock.json', 'next.config.ts', 'tsconfig.json', 'postcss.config.mjs', 'tailwind.config.ts']) await fs.copyFile(path.join(root, name), path.join(project, name));
  await fs.symlink(path.join(root, 'node_modules'), path.join(project, 'node_modules'), 'junction');
  await fs.symlink(path.join(root, 'public'), path.join(project, 'public'), 'junction');
  await fs.writeFile(path.join(project, 'LOCAL-TEST-BUILD.txt'), 'DATOS FICTICIOS. NO PUBLICAR.\n');
  await fs.writeFile(path.join(artifacts, stage + '-context.json'), JSON.stringify({ project, fixturePort, port, config }, null, 2));
}
const guard = path.join(project, 'network-guard.cjs');
await fs.writeFile(guard, `const original=globalThis.fetch;globalThis.fetch=function(input,init){const url=new URL(typeof input==='string'||input instanceof URL?input:input.url);const method=(init?.method||input?.method||'GET').toUpperCase();if(!['127.0.0.1','localhost','[::1]'].includes(url.hostname)||!['GET','HEAD'].includes(method))throw new Error('External or mutating request blocked');return original.call(this,input,init);};\n`);
const env = {
  ...process.env, NODE_ENV: 'production', NEXT_TELEMETRY_DISABLED: '1',
  NEXT_PUBLIC_SUPABASE_URL: `http://127.0.0.1:${fixturePort}`, NEXT_PUBLIC_SUPABASE_ANON_KEY: 'local-only', SUPABASE_SERVICE_ROLE_KEY: 'local-only', NEXT_PUBLIC_BASE_URL: base,
  ADMIN_PASSWORD: 'local-only', ADMIN_JWT_SECRET: 'local-only-secret-for-isolated-tests',
  REDSYS_ENVIRONMENT: 'test', REDSYS_SECRET_KEY: 'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA', REDSYS_MERCHANT_CODE: '000000000', REDSYS_TERMINAL: '001',
  RESEND_API_KEY: 're_local_only', EMAIL_FROM: 'test@example.invalid', ADMIN_NOTIFICATION_EMAIL: 'test@example.invalid',
  NODE_OPTIONS: `--require "${guard.replaceAll('\\', '/')}"`,
};
const launch = args => spawn(process.execPath, [path.join(root, 'node_modules/next/dist/bin/next'), ...args], { cwd: project, env, stdio: 'inherit', windowsHide: true });
const exited = child => new Promise((resolve, reject) => { child.once('error', reject); child.once('exit', code => code === 0 ? resolve() : reject(new Error('Next exited ' + code))); });
const init = `(() => {
 let seed=42; Math.random=()=>{seed=(seed*1664525+1013904223)>>>0;return seed/4294967296;};
 try { localStorage.setItem('ebm_consent_v1',JSON.stringify({version:'1',date:new Date().toISOString(),decided:true,categories:{funcional:false,analisis:false}}));localStorage.setItem('ebm_pwa_dismissed_at',new Date().toISOString());localStorage.removeItem('ebm_cart_v1'); } catch {}
 const p=window.__perf={lcp:[],shifts:[],longtasks:[],events:[],clickPaint:[],frames:[],label:''};
 const label=el=>el?(el.tagName+'#'+el.id+'.'+String(el.className).slice(0,80)):null;
 for (const type of ['largest-contentful-paint','layout-shift','longtask','event']) {
  if (!PerformanceObserver.supportedEntryTypes.includes(type)) continue;
  new PerformanceObserver(list=>{for(const e of list.getEntries()){
   if(type==='largest-contentful-paint')p.lcp.push({time:e.startTime,size:e.size,url:e.url,element:label(e.element)});
   if(type==='layout-shift')p.shifts.push({time:e.startTime,value:e.value,input:e.hadRecentInput,sources:e.sources.map(s=>({node:label(s.node),from:s.previousRect.toJSON(),to:s.currentRect.toJSON()}))});
   if(type==='longtask')p.longtasks.push({time:e.startTime,duration:e.duration});
   if(type==='event'&&e.interactionId)p.events.push({label:p.label,name:e.name,id:e.interactionId,duration:e.duration,inputDelay:e.processingStart-e.startTime,processing:e.processingEnd-e.processingStart,target:label(e.target)});
  }}).observe({type,buffered:true,...(type==='event'?{durationThreshold:16}:{})});
 }
 document.addEventListener('pointerup',e=>{const name=p.label,start=e.timeStamp;requestAnimationFrame(()=>requestAnimationFrame(()=>p.clickPaint.push({label:name,duration:performance.now()-start})));},true);
 let last=0;function frame(t){if(last)p.frames.push({time:t,gap:t-last});last=t;requestAnimationFrame(frame);}requestAnimationFrame(frame);
})()`;
let next, browser;
const stop = () => { if (next && !next.killed) next.kill(); };
process.once('exit', stop);

async function pageFor({ mobile = true, throttled = true, blockVideo = false, reduced = false } = {}) {
  const page = await browser.page(), requests = new Map(), blocked = [], errors = [];
  await page.send('Page.enable'); await page.send('Runtime.enable'); await page.send('Network.enable');
  await page.send('Network.setCacheDisabled', { cacheDisabled: true });
  await page.send('Emulation.setDeviceMetricsOverride', { width: mobile ? config.width : 1440, height: mobile ? config.height : 1000, deviceScaleFactor: mobile ? config.dpr : 1, mobile });
  await page.send('Emulation.setTouchEmulationEnabled', { enabled: mobile });
  await page.send('Emulation.setUserAgentOverride', { userAgent: mobile ? 'Mozilla/5.0 (Linux; Android 13; Pixel 5) AppleWebKit/537.36 (KHTML, like Gecko) ' + browser.version.Browser + ' Mobile Safari/537.36' : 'Mozilla/5.0 ' + browser.version.Browser });
  await page.send('Emulation.setCPUThrottlingRate', { rate: throttled ? config.cpu : 1 });
  await page.send('Network.emulateNetworkConditions', { offline: false, latency: throttled ? config.latency : 0, downloadThroughput: throttled ? config.download : -1, uploadThroughput: throttled ? config.upload : -1, connectionType: 'cellular4g' });
  if (reduced) await page.send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: 'reduce' }] });
  const { identifier: initScriptIdentifier } = await page.send('Page.addScriptToEvaluateOnNewDocument', { source: init });
  page.on('Network.requestWillBeSent', e => { requests.set(e.requestId, { url: e.request.url, type: e.type, priority: e.request.initialPriority, start: e.timestamp, encoded: 0, done: null }); });
  page.on('Network.responseReceived', e => { const row = requests.get(e.requestId); if (row) Object.assign(row, { status: e.response.status, mime: e.response.mimeType, cache: e.response.fromDiskCache }); });
  page.on('Network.dataReceived', e => { const row = requests.get(e.requestId); if (row) row.encoded += e.encodedDataLength; });
  page.on('Network.loadingFinished', e => { const row = requests.get(e.requestId); if (row) row.done = e.encodedDataLength; });
  page.on('Runtime.exceptionThrown', e => errors.push(e.exceptionDetails.exception?.description ?? e.exceptionDetails.text));
  await page.send('Fetch.enable', { patterns: [{ urlPattern: '*' }] });
  page.on('Fetch.requestPaused', e => {
    const url = new URL(e.request.url);
    const allowed = url.origin === base && (e.request.method === 'GET' || (e.request.method === 'POST' && url.pathname === '/api/checkout/review')) && !(blockVideo && url.pathname.endsWith('.mp4'));
    if (!allowed) blocked.push(e.request.method + ' ' + url.origin + url.pathname);
    page.send(allowed ? 'Fetch.continueRequest' : 'Fetch.failRequest', allowed ? { requestId: e.requestId } : { requestId: e.requestId, errorReason: 'Aborted' }).catch(() => {});
  });
  await page.send('Page.bringToFront');
  return { page, requests, blocked, errors, initScriptIdentifier };
}

const snapshot = page => page.evaluate(`(() => {
 const p=window.__perf;const shifts=p.shifts.filter(e=>!e.input);let max=0,total=0,start=0,last=0,score=0;
 for(const e of shifts){total+=e.value;if(e.time-last>1000||e.time-start>5000){start=e.time;score=0;}score+=e.value;last=e.time;max=Math.max(max,score);}
 return {time:performance.now(),lcp:p.lcp[p.lcp.length-1]??null,cls:max,clsTotal:total,shifts,longtasks:p.longtasks,events:p.events,clickPaint:p.clickPaint,
 navigation:performance.getEntriesByType('navigation')[0]?.toJSON(), paints:performance.getEntriesByType('paint').map(e=>e.toJSON()),
 videos:[...document.querySelectorAll('video')].map(v=>{const r=v.getBoundingClientRect();return{src:v.currentSrc,hasSource:!!v.querySelector('source[src]'),muted:v.muted,error:v.error?.message??null,poster:v.poster,visible:r.width>0&&r.height>0&&getComputedStyle(v).display!=='none',inViewport:r.bottom>0&&r.top<innerHeight,paused:v.paused,time:v.currentTime,ready:v.readyState,frames:v.getVideoPlaybackQuality?.().totalVideoFrames??null,width:r.width,height:r.height};}),
 images:[...document.images].map(i=>{const r=i.getBoundingClientRect();return{alt:i.alt,url:i.currentSrc,loading:i.loading,priority:i.fetchPriority,sizes:i.sizes,width:r.width,height:r.height,top:r.top,naturalWidth:i.naturalWidth,naturalHeight:i.naturalHeight,complete:i.complete};}),
 overflow:document.documentElement.scrollWidth>innerWidth+1,scrollY,visibility:document.visibilityState,
 frameGaps:p.frames.map(e=>e.gap),jsonld:[...document.querySelectorAll('script[type="application/ld+json"]')].map(el=>JSON.parse(el.textContent))};
})()`);

async function tap(page, expression, label) {
  await page.evaluate(`window.__perf.label=${JSON.stringify(label)};`);
  const point = await page.evaluate(`(() => {const el=${expression};if(!el)throw new Error('No existe control: '+${JSON.stringify(label)});const r=el.getBoundingClientRect();return{x:r.x+r.width/2,y:r.y+r.height/2};})()`);
  await page.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: point.x, y: point.y, radiusX: 3, radiusY: 3 }] });
  await delay(60);
  await page.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await delay(700);
}

async function interactions(page, name, { centerCart = false } = {}) {
  await page.evaluate(`scrollTo({top:0,behavior:'instant'});`); await delay(500);
  for (let i = 0; i < 100; i++) {
    if (await page.evaluate(`Object.keys(document.querySelector('button[aria-controls="mobile-navigation"]')??{}).some(key=>key.startsWith('__reactProps$'))`)) break;
    await delay(100);
  }
  await tap(page, `document.querySelector('button[aria-controls="mobile-navigation"]')`, 'menu-open');
  if (await page.evaluate(`document.querySelector('button[aria-controls="mobile-navigation"]').getAttribute('aria-expanded')`) !== 'true') {
    await fs.writeFile(path.join(artifacts, stage + '-interaction-debug.json'), JSON.stringify(await page.evaluate(`(() => {const b=document.querySelector('button[aria-controls="mobile-navigation"]'),r=b.getBoundingClientRect();return {button:b.outerHTML,rect:r.toJSON(),target:document.elementFromPoint(r.x+r.width/2,r.y+r.height/2)?.outerHTML,perf:window.__perf,storage:localStorage.getItem('ebm_consent_v1'),innerWidth,innerHeight,scrollY};})()`), null, 2));
  }
  assert.equal(await page.evaluate(`document.querySelector('button[aria-controls="mobile-navigation"]').getAttribute('aria-expanded')`), 'true');
  await tap(page, `document.querySelector('button[aria-controls="mobile-navigation"]')`, 'menu-close');
  assert.equal(await page.evaluate(`document.querySelector('button[aria-controls="mobile-navigation"]').getAttribute('aria-expanded')`), 'false');
  if (name === 'carta') {
    await tap(page, `[...document.querySelectorAll('.carta-nav-categorias button')].find(el=>el.textContent==='Carnes')`, 'carta-carnes');
    await delay(700);
  }
  if (name === 'producto') {
    await page.evaluate(`document.querySelector('button[aria-pressed]')?.scrollIntoView({block:'center',behavior:'instant'});`); await delay(300);
    await tap(page, `[...document.querySelectorAll('button[aria-pressed]')].find(el=>el.textContent==='Formato menor')`, 'variant-change');
    assert.equal(await page.evaluate(`JSON.parse(document.querySelector('#product-jsonld').textContent).offers.price`), '9.75');
    if (centerCart) {
      await page.evaluate(`[...document.querySelectorAll('button')].find(el=>el.textContent.includes('Añadir al carrito')).scrollIntoView({block:'center',behavior:'instant'})`);
      await delay(700);
    }
    await tap(page, `[...document.querySelectorAll('button')].find(el=>el.textContent.includes('Añadir al carrito'))`, 'cart-add');
    assert.equal(await page.evaluate(`JSON.parse(localStorage.getItem('ebm_cart_v1'))[0].unitPrice`), 975);
  }
}

async function extendedQa() {
  if (!mediaQaOnly) {
  const click = async (page, selector) => {
    await page.evaluate(`(() => {const el=document.querySelector(${JSON.stringify(selector)});if(!el)throw Error('Missing '+${JSON.stringify(selector)});el.scrollIntoView({block:'center',behavior:'instant'});el.click();})()`);
    await delay(900);
  };
  for (const mobile of [true, false]) {
    const session = await pageFor({ mobile, throttled: false });
    const { page } = session;
    await page.send('Page.navigate', { url: base + '/' }); await delay(2200);
    const start = await snapshot(page);
    if (stage === 'after') {
      assert.equal(start.videos.filter(v => v.hasSource).length, 1);
      assert.ok(start.videos.some(v => v.visible && !v.paused && v.time > 0));
    }
    await page.evaluate(`scrollTo({top:document.body.scrollHeight,behavior:'instant'});`); await delay(700);
    const offscreen = await snapshot(page); await delay(1000); const later = await snapshot(page);
    if (stage === 'after') {
      assert.ok(later.videos.every(v => v.paused && !v.hasSource && v.ready === 0));
      assert.deepEqual(later.videos.map(v=>v.frames), offscreen.videos.map(v=>v.frames));
    }
    await page.evaluate(`scrollTo({top:0,behavior:'instant'});`); await delay(1000);
    const returned = await snapshot(page);
    const other = await browser.page(); await other.send('Page.bringToFront'); await delay(500);
    const hidden = await snapshot(page);
    if (stage === 'after') assert.ok(hidden.videos.every(v=>v.paused && !v.hasSource && v.ready === 0));
    await other.close(); await page.send('Page.bringToFront'); await delay(1000);
    await page.send('Emulation.setDeviceMetricsOverride', { width: mobile ? 1440 : 390, height: mobile ? 1000 : 844, deviceScaleFactor: mobile ? 1 : 2, mobile: !mobile });
    await delay(1500); const resized = await snapshot(page);
    if (stage === 'after') assert.equal(resized.videos.filter(v=>v.hasSource).length, 1);
    await page.send('Emulation.setDeviceMetricsOverride', { width: mobile ? 390 : 1440, height: mobile ? 844 : 1000, deviceScaleFactor: mobile ? 2 : 1, mobile });
    await delay(600);
    qa.push({ test: 'video-visibility', mobile, start, offscreen, later, returned, hidden, resized });

    // Actual Next links: restaurant -> Carta -> shop -> category -> product -> cart -> checkout.
    await click(page, 'a[href="/carta"]');
    assert.equal(await page.evaluate('location.pathname'), '/carta');
    for (let index = 0; index < 6; index++) {
      await page.evaluate(`document.querySelectorAll('.carta-nav-categorias button')[${index}].click()`); await delay(1000);
      assert.equal(await page.evaluate(`document.querySelector('.carta-nav-btn-active')?.textContent`), ['Entrantes','Carnes','Burgers','Kebabs','Postres','Bebidas'][index]);
    }
    await page.evaluate(`scrollTo({top:0,behavior:'instant'})`); await delay(400);
    if (mobile) await tap(page, `document.querySelector('button[aria-controls="mobile-navigation"]')`, 'navigation-menu');
    await click(page, mobile ? '#mobile-navigation a[href="/tienda"]' : 'nav a[href="/tienda"]');
    assert.equal(await page.evaluate('location.pathname'), '/tienda');
    await click(page, 'a[href="/tienda/categoria-local"]');
    assert.equal(await page.evaluate('location.pathname'), '/tienda/categoria-local');
    await click(page, 'a[href="/tienda/producto/producto-local"]');
    assert.equal(await page.evaluate('location.pathname'), '/tienda/producto/producto-local');
    await page.evaluate(`[...document.querySelectorAll('button[aria-pressed]')].find(b=>b.textContent==='Formato menor').click()`); await delay(200);
    await page.evaluate(`[...document.querySelectorAll('button')].find(b=>b.textContent.includes('Añadir al carrito')).click()`); await delay(200);
    assert.equal(await page.evaluate(`JSON.parse(localStorage.getItem('ebm_cart_v1'))[0].unitPrice`), 975);
    await click(page, 'a[aria-label="Ver carrito"]');
    assert.equal(await page.evaluate('location.pathname'), '/carrito');
    await click(page, 'button[aria-label="Aumentar cantidad"]');
    assert.equal(await page.evaluate(`JSON.parse(localStorage.getItem('ebm_cart_v1'))[0].quantity`), 2);
    await click(page, 'button[aria-label="Disminuir cantidad"]');
    await click(page, 'a[href="/checkout"]');
    await delay(1000);
    assert.equal(await page.evaluate('location.pathname'), '/checkout');
    assert.equal(await page.evaluate(`document.querySelector('[role="alert"]')?.textContent??null`), null);
    assert.equal(await page.evaluate(`document.querySelector('button[type="submit"]')?.disabled`), false);
    assert.ok([...session.requests.values()].some(row=>row.url.endsWith('/api/checkout/review') && row.status===200));
    assert.ok(!session.blocked.some(url=>url.includes('create-session')));
    const checkout = await snapshot(page);
    assert.equal(checkout.overflow, false);
    const image = await page.send('Page.captureScreenshot', { format: 'png' });
    await fs.writeFile(path.join(artifacts, `${stage}-${mobile?'mobile':'desktop'}-checkout.png`), Buffer.from(image.data, 'base64'));
    qa.push({ test: 'navigation-and-cart', mobile, checkout, errors: session.errors, blocked: session.blocked });
    assert.deepEqual(session.errors, []);
    await page.close();
  }

  // Exercise the existing consent and installation UI without invoking a native install.
  const { page, blocked } = await pageFor({ throttled: false });
  await page.send('Emulation.setUserAgentOverride', { userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Version/17.0 Mobile/15E148 Safari/604.1' });
  await page.send('Page.addScriptToEvaluateOnNewDocument', { source: `localStorage.removeItem('ebm_consent_v1');localStorage.removeItem('ebm_pwa_dismissed_at');` });
  await page.send('Page.navigate', { url: base + '/' }); await delay(2000);
  assert.ok(await page.evaluate(`!!document.querySelector('[aria-label="Aviso de cookies"]')`));
  await page.evaluate(`[...document.querySelectorAll('button')].find(b=>b.textContent==='Rechazar todo').click()`); await delay(700);
  assert.ok(await page.evaluate(`!!document.querySelector('[role="dialog"][aria-modal="true"]')`));
  await page.evaluate(`[...document.querySelectorAll('button')].find(b=>b.textContent==='Sí, descargar').click()`); await delay(350);
  assert.equal(await page.evaluate(`document.querySelector('[role="dialog"][aria-modal="true"] ol')?.children.length`), 3);
  await page.evaluate(`[...document.querySelectorAll('button')].find(b=>b.textContent==='Entendido').click()`); await delay(400);
  const consent = await page.evaluate(`JSON.parse(localStorage.getItem('ebm_consent_v1'))`);
  assert.equal(consent.decided, true); assert.equal(consent.categories.funcional, false); assert.equal(consent.categories.analisis, false);
  assert.ok(await page.evaluate(`Number.isFinite(Date.parse(localStorage.getItem('ebm_pwa_dismissed_at')))`));
  qa.push({ test: 'consent-and-install-tutorial', consent, blocked });
  await page.close();
  }

  for (const [name, route] of routes.slice(0, 2)) {
    const session = await pageFor({ throttled: false, blockVideo: true });
    await session.page.send('Page.navigate', { url: base + route }); await delay(1600);
    await session.page.evaluate(`scrollTo({top:0,behavior:'instant'})`); await delay(300);
    const state = await snapshot(session.page);
    if (stage === 'after') assert.ok(state.videos.every(v=>v.poster.endsWith('/hero-poster.webp')));
    const image = await session.page.send('Page.captureScreenshot', { format: 'png' });
    await fs.writeFile(path.join(artifacts, stage + '-poster-' + name + '.png'), Buffer.from(image.data, 'base64'));
    qa.push({ test: 'poster-with-video-blocked', name, state });
    await session.page.close();
  }

  // Diagnose late catalogue LCP separately from transfer; this does not change the 3-run comparison.
  const diagnostic = await pageFor();
  await diagnostic.page.send('Page.navigate', { url: base + '/tienda' }); await delay(config.windowMs);
  qa.push({ test: 'shop-resource-timing', state: await snapshot(diagnostic.page), resources: await diagnostic.page.evaluate(`performance.getEntriesByType('resource').filter(r=>r.initiatorType==='img').map(r=>r.toJSON())`) });
  await diagnostic.page.close();
}

try {
  if (!reused) await exited(launch(['build', '--webpack']));
  next = launch(['start', '--hostname', '127.0.0.1', '--port', String(port)]);
  let ready = false;
  for (let i = 0; i < 100; i++) { try { if ((await fetch(base + '/')).ok) { ready = true; break; } } catch {} await delay(100); }
  assert.ok(ready);
  browser = await openBrowser(artifacts, { rendering: process.argv.find(arg=>arg.startsWith('--diag-browser='))?.split('=')[1] ?? 'legacy' });
  const report = { stage, config, project, chrome: browser.version, results, qa };
  if (process.argv.includes('--trace-pending')) {
    const { diagnosePendingPerformance, verifyCartRegression } = await import('./diagnose-shop-performance.mjs');
    const controls = process.argv.includes('--diag-settled-controls') ? [
      { condition: 'baseline', cases: 'carrito', settleMs: 4000 },
      { condition: 'will-change', cases: 'carrito', settleMs: 4000 },
    ] : process.argv.includes('--diag-final-controls') ? [
      { condition: 'original-centered', cases: 'carrito' },
      { condition: 'will-change', cases: 'carrito' },
    ] : process.argv.includes('--diag-controls') ? [
      { condition: 'network-fast', cases: 'tienda,categoria' },
      { condition: 'two-products', cases: 'tienda' },
      { condition: 'cart-centered', cases: 'carrito' },
      { condition: 'cart-no-animation', cases: 'carrito' },
    ] : [{}];
    if (process.argv.includes('--diag-regression')) await verifyCartRegression({ base, pageFor });
    else for (const control of controls) await diagnosePendingPerformance({ base, browser, pageFor, interactions, fixtureTimings, fixtureControl, config }, control);
    assert.deepEqual(unexpected, []);
  } else if (qaOnly) {
    await extendedQa();
    assert.deepEqual(unexpected, []);
    await fs.writeFile(path.join(artifacts, stage + (mediaQaOnly ? '-media-qa.json' : '-qa.json')), JSON.stringify(report, null, 2));
    console.log('PASS QA ampliada ' + stage);
  } else {
  // Precalentar el optimizador del servidor; las mediciones mantienen caché de navegador desactivada.
  for (const [name, route] of routes) {
    const { page } = await pageFor({ throttled: false });
    await page.send('Page.navigate', { url: base + route }); await delay(1800); await page.close();
    console.log('WARM ' + name);
  }
  for (let repeat = 0; repeat < config.repeats; repeat++) {
    for (const [name, route] of routes) {
      const session = await pageFor(); const { page, requests } = session;
      const started = Date.now(); await page.send('Page.navigate', { url: base + route });
      await delay(Math.max(0, config.windowMs - (Date.now() - started)));
      const initial = await snapshot(page);
      const network = [...requests.values()].map(row => ({ ...row, bytes: row.done ?? row.encoded }));
      assert.equal(initial.visibility, 'visible'); assert.equal(initial.overflow, false);
      await interactions(page, name);
      const interacted = await snapshot(page);
      if (name === 'home' || name === 'contacto') {
        await page.evaluate(`scrollTo({top:document.body.scrollHeight,behavior:'instant'});`); await delay(1800);
      }
      const final = await snapshot(page);
      const result = { name, route, repeat, initial, network, interacted, final, errors: session.errors, blocked: session.blocked };
      results.push(result); await fs.writeFile(path.join(artifacts, stage + '.json'), JSON.stringify(report, null, 2));
      console.log(JSON.stringify({ stage, name, repeat, lcp: initial.lcp?.time, cls: initial.cls, bytes: network.reduce((sum, row) => sum + row.bytes, 0), media: network.filter(row=>row.type==='Media').reduce((sum,row)=>sum+row.bytes,0) }));
      await page.close();
    }
  }
  for (const mobile of [true, false]) {
    for (const [name, route] of routes) {
      const { page, errors } = await pageFor({ mobile, throttled: false });
      await page.send('Page.navigate', { url: base + route }); await delay(1800);
      await page.evaluate(`scrollTo({top:0,behavior:'instant'});document.querySelectorAll('video').forEach(v=>v.pause());`); await delay(200);
      const image = await page.send('Page.captureScreenshot', { format: 'png' });
      const screenshot = path.join(artifacts, `${stage}-${mobile?'mobile':'desktop'}-${name}.png`);
      await fs.writeFile(screenshot, Buffer.from(image.data, 'base64'));
      qa.push({ name, mobile, screenshot, state: await snapshot(page), errors });
      await page.close();
    }
  }
  for (const [name, route] of routes.slice(0, 2)) {
    const { page } = await pageFor({ throttled: false, blockVideo: true });
    await page.send('Page.navigate', { url: base + route }); await delay(1800);
    const image = await page.send('Page.captureScreenshot', { format: 'png' });
    const screenshot = path.join(artifacts, `${stage}-blocked-video-${name}.png`);
    await fs.writeFile(screenshot, Buffer.from(image.data, 'base64'));
    qa.push({ name, blockedVideo: true, screenshot, state: await snapshot(page) }); await page.close();
  }
  const { page: reducedPage } = await pageFor({ throttled: false, reduced: true });
  await reducedPage.send('Page.navigate', { url: base + '/' }); await delay(1800);
  qa.push({ name: 'home', reduced: true, state: await snapshot(reducedPage) }); await reducedPage.close();
  assert.deepEqual(unexpected, []);
  report.unexpected = unexpected;
  await fs.writeFile(path.join(artifacts, stage + '.json'), JSON.stringify(report, null, 2));
  console.log('PASS laboratorio ' + stage + ': ' + results.length + ' mediciones; sin publicación.');
  }
} catch (error) {
  await fs.writeFile(path.join(artifacts, stage + '-failure.json'), JSON.stringify({ error: String(error), results, qa }, null, 2));
  throw error;
} finally {
  process.removeListener('exit', stop); await browser?.close();
  if (next && next.exitCode === null) { const stopped = new Promise(resolve => next.once('exit', resolve)); next.kill(); await stopped; }
  fixture.closeAllConnections(); await new Promise(resolve => fixture.close(resolve));
}
