// Diagnostic only: run via check-mobile-performance.mjs after --reuse --trace-pending.
import fs from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { delay } from './performance-browser.mjs';

const instrumentation = `(() => {
  const d=window.__diag={lcp:[],events:[],longtasks:[],loaf:[],styles:[],io:[],animations:[],storage:[],feedback:[],inputs:[]};
  const desc=el=>el?el.tagName+'.'+String(el.className).slice(0,100):null;
  const mark=(name,data)=>{performance.mark('diag:'+name,{detail:data});};
  for(const type of ['largest-contentful-paint','event','longtask','long-animation-frame']) {
    if(!PerformanceObserver.supportedEntryTypes.includes(type))continue;
    new PerformanceObserver(list=>{for(const e of list.getEntries()){
      if(type==='largest-contentful-paint')d.lcp.push({...e.toJSON(),element:desc(e.element),html:e.element?.outerHTML});
      if(type==='event'&&e.interactionId)d.events.push({...e.toJSON(),interactionId:e.interactionId,target:desc(e.target),observed:performance.now()});
      if(type==='longtask')d.longtasks.push(e.toJSON());
      if(type==='long-animation-frame')d.loaf.push(e.toJSON());
    }}).observe({type,buffered:true,...(type==='event'?{durationThreshold:16}:{})});
  }
  const OriginalIO=window.IntersectionObserver;
  window.IntersectionObserver=class extends OriginalIO {constructor(callback,options){super((entries,observer)=>{
    for(const e of entries)if(e.target.querySelector?.('a[href*="/tienda/producto/"]')){
      const data={time:performance.now(),entryTime:e.time,intersecting:e.isIntersecting,ratio:e.intersectionRatio,rect:e.boundingClientRect.toJSON(),margin:options?.rootMargin};d.io.push(data);mark('intersection',data);
    }callback(entries,observer);
  },options)}};
  const animate=Element.prototype.animate;
  Element.prototype.animate=function(frames,options){
    const anim=animate.call(this,frames,options);
    const data={time:performance.now(),element:desc(this),frames,options};d.animations.push(data);mark('animation-start',data);
    anim.finished.then(()=>{data.finished=performance.now();mark('animation-finished',data)}).catch(()=>{data.cancelled=performance.now()});return anim;
  };
  const setItem=Storage.prototype.setItem;
  Storage.prototype.setItem=function(key,value){const start=performance.now();const result=setItem.call(this,key,value);if(key==='ebm_cart_v1'){const data={start,end:performance.now(),length:value.length};d.storage.push(data);mark('cart-storage',data)}return result;};
  for(const name of ['pointerdown','pointerup','click'])document.addEventListener(name,e=>{
    const el=e.target.closest?.('button');if(!el)return;const data={name,time:performance.now(),eventTime:e.timeStamp,text:el.textContent,rect:el.getBoundingClientRect().toJSON()};d.inputs.push(data);mark('input-'+name,data);
  },true);
  let card,button,seenAdded=false;
  const attach=()=>{
    if(!card){const image=document.querySelector('img[alt="Foto local de prueba"]');card=image?.closest('a')?.parentElement;
      if(card){const save=()=>{const data={time:performance.now(),style:card.getAttribute('style'),imageComplete:image.complete};d.styles.push(data);mark('card-style',data)};save();new MutationObserver(save).observe(card,{attributes:true,attributeFilter:['style']});image.addEventListener('load',()=>mark('lcp-image-load',{time:performance.now()}));}}
    button??=[...document.querySelectorAll('button')].find(b=>b.textContent.includes('Añadir al carrito'));
    if(button&&!seenAdded&&button.textContent.includes('Añadido')){seenAdded=true;const data={time:performance.now(),text:button.textContent};d.feedback.push(data);mark('added-dom',data);requestAnimationFrame(()=>requestAnimationFrame(()=>mark('added-two-raf',{time:performance.now()})));}
  };
  new MutationObserver(attach).observe(document,{childList:true,subtree:true,characterData:true});
  document.addEventListener('DOMContentLoaded',()=>{mark('dom-ready',{time:performance.now()});attach()});
})()`;

async function startTrace(page) {
  let complete;
  const ended = new Promise(resolve => { complete = resolve; });
  page.on('Tracing.tracingComplete', complete);
  await page.send('Tracing.start', {
    categories: 'toplevel,devtools.timeline,disabled-by-default-devtools.timeline,disabled-by-default-devtools.timeline.frame,blink.user_timing,loading,latencyInfo,cc,benchmark,v8.execute,disabled-by-default-v8.cpu_profiler',
    transferMode: 'ReturnAsStream',
  });
  return async file => {
    await page.send('Tracing.end');
    const { stream, ...metadata } = await ended;
    const chunks = [];
    while (true) {
      const part = await page.send('IO.read', { handle: stream, size: 1000000 });
      chunks.push(part.base64Encoded ? Buffer.from(part.data, 'base64').toString() : part.data);
      if (part.eof) break;
    }
    await page.send('IO.close', { handle: stream });
    const contents = chunks.join('');
    await fs.writeFile(file, contents);
    return { ...metadata, bytes: Buffer.byteLength(contents), sha256: createHash('sha256').update(contents).digest('hex') };
  };
}

const takeSnapshot = page => page.evaluate(`(() => {
  const img=document.querySelector('img[alt="Foto local de prueba"]');const button=[...document.querySelectorAll('button')].find(b=>/Añadir al carrito|Añadido/.test(b.textContent));
  return {diag:window.__diag,navigation:performance.getEntriesByType('navigation')[0].toJSON(),resources:performance.getEntriesByType('resource').map(r=>r.toJSON()),
    image:img?{src:img.currentSrc,naturalWidth:img.naturalWidth,naturalHeight:img.naturalHeight,rect:img.getBoundingClientRect().toJSON()}:null,
    button:button?{text:button.textContent,rect:button.getBoundingClientRect().toJSON(),willChange:getComputedStyle(button).willChange}:null,
    cart:localStorage.getItem('ebm_cart_v1'),visibility:document.visibilityState,scrollY,
    scripts:[...document.scripts].filter(s=>s.src).map(s=>s.src)};
})()`);

export async function diagnosePendingPerformance({ base, browser, pageFor, interactions, fixtureTimings, fixtureControl, config }, overrides = {}) {
  const option = (name, fallback) => process.argv.find(a=>a.startsWith('--'+name+'='))?.split('=').slice(1).join('=') ?? fallback;
  const condition = overrides.condition ?? option('diag-condition', 'baseline');
  assert.ok(['baseline','cpu1','network-fast','desktop-metrics','two-products','cart-centered','cart-no-animation','original-centered','will-change'].includes(condition));
  fixtureControl.productCount = condition === 'two-products' ? 2 : 3;
  const cases = (overrides.cases ?? option('diag-cases', 'tienda,categoria,carrito')).split(',');
  const repeats = Number(option('diag-repeat', '3'));
  const settleMs = Number(overrides.settleMs ?? option('diag-settle-ms', '500'));
  const artifacts = path.join(process.cwd(), '.pending-performance.local');
  await fs.mkdir(artifacts, { recursive: true });
  const results = [];
  const applied = { ...config, cpu: condition === 'cpu1' ? 1 : config.cpu, latency: condition === 'network-fast' ? 0 : config.latency, download: condition === 'network-fast' ? -1 : config.download, mobile: condition !== 'desktop-metrics' };
  const report = { condition, config, applied, settleMs, fixtureCount: fixtureControl.productCount, chrome: browser.version, results };
  const label = condition + (browser.version.rendering === 'legacy' ? '' : '-' + browser.version.rendering) + (settleMs > 500 ? '-settled' : '');
  // Warm only the image optimizer/server, retaining disabled browser cache for every sample.
  for (const route of ['/tienda','/tienda/categoria-local','/tienda/producto/producto-local']) {
    const {page}=await pageFor({throttled:false});await page.send('Page.navigate',{url:base+route});await delay(1600);await page.close();
  }
  for (let repeat=0;repeat<repeats;repeat++) for (const name of cases) {
    const session = await pageFor(); const {page}=session;
    if(condition==='cpu1')await page.send('Emulation.setCPUThrottlingRate',{rate:1});
    if(condition==='desktop-metrics')await page.send('Emulation.setDeviceMetricsOverride',{width:config.width,height:config.height,deviceScaleFactor:config.dpr,mobile:false});
    if(condition==='network-fast')await page.send('Network.emulateNetworkConditions',{offline:false,latency:0,downloadThroughput:-1,uploadThroughput:-1});
    await page.send('Page.addScriptToEvaluateOnNewDocument',{source:instrumentation});
    const traced = repeat===0;
    const endTrace = traced ? await startTrace(page) : null;
    fixtureTimings.length=0;
    const route = {tienda:'/tienda',categoria:'/tienda/categoria-local',carrito:'/tienda/producto/producto-local'}[name];
    assert.ok(route);
    await page.send('Page.navigate',{url:base+route});await delay(config.windowMs);
    const initial=await takeSnapshot(page);
    if(name==='carrito') {
      if(condition==='will-change')await page.evaluate(`(()=>{const style=document.createElement('style');style.textContent='button.inline-flex.w-full {will-change:transform!important}';document.head.append(style)})()`);
      if(condition.startsWith('cart-')) {
        await page.evaluate(`[...document.querySelectorAll('button[aria-pressed]')].find(b=>b.textContent==='Formato menor').click()`);await delay(300);
        const point=await page.evaluate(`(()=>{const b=[...document.querySelectorAll('button')].find(b=>b.textContent==='Añadir al carrito');b.scrollIntoView({block:'center',behavior:'instant'});return true})()`);
        assert.equal(point,true);await delay(700);
        // Diagnostic counterfactual only. No application stylesheet or source is changed.
        if(condition==='cart-no-animation')await page.evaluate(`(()=>{const style=document.createElement('style');style.textContent='button.inline-flex.w-full {transform:none!important;transition:none!important}';document.head.append(style)})()`);
        {
          const p=await page.evaluate(`(()=>{const b=[...document.querySelectorAll('button')].find(b=>b.textContent==='Añadir al carrito'),r=b.getBoundingClientRect();return{x:r.x+r.width/2,y:r.y+r.height/2}})()`);
          await page.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:p.x,y:p.y,radiusX:3,radiusY:3}]});await delay(60);
          await page.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});await delay(1000);
        }
      } else await interactions(page,'producto',{centerCart:condition==='original-centered'});
      await delay(settleMs);
    }
    const final=await takeSnapshot(page);
    assert.equal(final.visibility,'visible');
    if(name==='carrito') {
      const cart=JSON.parse(final.cart);
      assert.equal(cart.length,1);assert.equal(cart[0].unitPrice,975);assert.equal(cart[0].quantity,1);
      assert.equal(await page.evaluate(`JSON.parse(document.querySelector('#product-jsonld').textContent).offers.price`),'9.75');
    }
    assert.deepEqual(session.errors,[]);assert.deepEqual(session.blocked,[]);
    const trace = traced ? path.join(artifacts, `${label}-${name}.trace.json`) : null;
    const traceMetadata = endTrace ? await endTrace(trace) : null;
    const row={name,repeat,trace,traceMetadata,initial,final,fixtureTimings:[...fixtureTimings],requests:[...session.requests.values()]};results.push(row);
    await fs.writeFile(path.join(artifacts,label+'.json'),JSON.stringify(report,null,2));
    console.log(JSON.stringify({condition,name,repeat,lcp:initial.diag.lcp.at(-1)?.startTime,events:final.diag.events.filter(e=>e.target?.includes('inline-flex w-full')).map(e=>({name:e.name,duration:e.duration,input:e.processingStart-e.startTime,processing:e.processingEnd-e.processingStart,presentation:e.startTime+e.duration-e.processingEnd}))}));
    await page.close();
  }
}

export async function verifyCartRegression({base,pageFor}) {
  const session=await pageFor({throttled:false});const {page}=session;
  const read=()=>page.evaluate(`JSON.parse(localStorage.getItem('ebm_cart_v1'))`);
  const add=()=>page.evaluate(`[...document.querySelectorAll('button')].find(b=>b.textContent.includes('Añadir al carrito')).click()`);
  await page.send('Page.navigate',{url:base+'/tienda/producto/producto-local'});await delay(1800);
  await page.evaluate(`[...document.querySelectorAll('button[aria-pressed]')].find(b=>b.textContent==='Formato menor').click()`);await delay(100);
  await add();await delay(100);assert.equal((await read())[0].unitPrice,975);
  // Stop the test's initial-state reset. The app must recover the actual stored value on reload.
  await page.send('Page.removeScriptToEvaluateOnNewDocument',{identifier:session.initScriptIdentifier});
  await page.send('Page.reload');await delay(1600);
  const persisted=await read();assert.equal(persisted.length,1);assert.equal(persisted[0].quantity,1);assert.equal(persisted[0].unitPrice,975);
  await add();await delay(100);assert.equal((await read()).length,2);
  await delay(1800);
  for(let i=0;i<10;i++)await page.evaluate(`document.querySelector('button[aria-label="Aumentar cantidad"]').click()`);
  await add();await delay(100);
  assert.equal((await read()).find(x=>x.unitPrice===3250).quantity,8);
  await page.evaluate(`document.querySelector('a[aria-label="Ver carrito"]').click()`);await delay(800);
  assert.equal(await page.evaluate('location.pathname'),'/carrito');
  await page.evaluate(`document.querySelector('button[aria-label="Aumentar cantidad"]').click()`);await delay(100);
  assert.equal((await read())[0].quantity,2);
  await page.evaluate(`document.querySelector('button[aria-label="Disminuir cantidad"]').click()`);await delay(100);
  assert.equal((await read())[0].quantity,1);
  await page.evaluate(`document.querySelector('button[aria-label="Eliminar del carrito"]').click()`);await delay(100);
  assert.equal((await read()).length,1);assert.equal((await read())[0].unitPrice,3250);
  await page.send('Page.reload');await delay(1400);assert.equal((await read())[0].quantity,8);
  await page.evaluate(`document.querySelector('a[href="/checkout"]').click()`);await delay(1800);
  assert.equal(await page.evaluate('location.pathname'),'/checkout');
  assert.equal(await page.evaluate(`document.querySelector('[role="alert"]')?.textContent??null`),null);
  assert.equal(await page.evaluate(`document.querySelector('button[type="submit"]')?.disabled`),false);
  assert.ok([...session.requests.values()].some(r=>r.url.endsWith('/api/checkout/review')&&r.status===200));
  assert.deepEqual(session.errors,[]);assert.deepEqual(session.blocked,[]);
  const result={persisted,final:await read(),errors:session.errors,blocked:session.blocked,checkout:'review-only; no submit'};
  await fs.writeFile(path.join(process.cwd(),'.pending-performance.local','cart-regression.json'),JSON.stringify(result,null,2));
  await page.close();console.log('PASS persistencia, formatos, cantidades, límite de stock y checkout local sin crear pedido');
}
