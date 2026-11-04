import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { spawn } from 'node:child_process';
import assert from 'node:assert/strict';
import { createServer as createNetServer } from 'node:net';
import { createServer } from 'vite';
import { boxLabelPdfMetrics } from './box-label-pdf-metrics.mjs';

// Prueba opcional con Chrome real y datos ficticios. Solo levanta un servidor
// efímero de fixtures; no carga .env, no accede a Supabase ni imprime en hardware.
const cwd = process.cwd();
const dir = path.join(cwd, '.next/box-label-browser');
await fs.mkdir(dir, { recursive: true });
const artifacts = await fs.mkdtemp(path.join(os.tmpdir(), 'buey-box-label-check-'));
const debugPort = await new Promise((resolve, reject) => {
  const listener = createNetServer();
  listener.once('error', reject);
  listener.listen(0, '127.0.0.1', () => {
    const port = listener.address().port;
    listener.close(() => resolve(port));
  });
});
const logo = 'data:image/png;base64,' + (await fs.readFile(path.join(cwd, 'public/assets/images/logo-buey-ticket.png'))).toString('base64');
const thermalLogo = 'data:image/png;base64,' + (await fs.readFile(path.join(cwd, 'public/assets/images/logo-buey-thermal.png'))).toString('base64');
const source = `
import React from 'react';
import {createRoot} from 'react-dom/client';
import BoxLabelClient from '@/components/Admin/BoxLabel/BoxLabelClient';
const mode = new URLSearchParams(location.search).get('case') || 'simple';
const line = {id:'11111111-1111-4111-8111-111111111111',productName:'Chuletón madurado',variantName:'1 kg',quantity:2,isGift:false};
const lines = ['long','fixed-long'].includes(mode) ? Array.from({length:90}, (_,i)=>({...line,id:String(i),productName:i===40 ? 'Vacuno 🐂 especial con descripción extensa '.repeat(180) : 'Producto histórico '+i+' '+('muy largo '.repeat(i%5)),variantName:'Formato '+i,quantity:i+1}))
  : mode === 'simple' ? [line,{...line,id:'33333333-3333-4333-8333-333333333333',productName:'Tomahawk madurado',variantName:'Unidad ~1,2 kg',quantity:1}] : [line];
const gift={...line,id:'22222222-2222-4222-8222-222222222222',productName:'Salsa de regalo',variantName:'Tarro',isGift:true,quantity:1};
const snapshot={version:1,orderNumber:'BM-DEMO-123',preparedBy:mode==='worker-long'?'Trabajador de nombre muy largo '.repeat(3).slice(0,80):'Ana García',logoDataUrl:mode==='saved'?${JSON.stringify(logo)}:${JSON.stringify(thermalLogo)},lines};
window.__snapshot=snapshot;
window.__apiCalls=[];
window.fetch=async (url,options)=>{window.__apiCalls.push({url,body:JSON.parse(options.body)});return {ok:true,json:async()=>url.endsWith('/confirmar') ? {confirmedAt:'2026-11-04T12:00:00Z'} : {snapshot:{...snapshot,lines:[...lines,gift]},draftToken:'draft-updated',confirmedAt:null,gifts:[{...gift,pendingStock:true,included:true}]}};};
const initial={snapshot,draftToken:mode==='saved'?null:'draft-initial',confirmedAt:mode==='saved'?'2026-11-04T12:00:00Z':null,gifts:mode==='gift'?[{...gift,pendingStock:true,included:false}]:[]};
createRoot(document.getElementById('root')).render(<BoxLabelClient orderId={line.id} initial={initial}/>);
`;
await fs.writeFile(path.join(dir,'main.tsx'),source);
await fs.writeFile(path.join(dir,'link.tsx'),`import React from 'react'; export default function Link(props){return <a {...props}/>}`);
let ticketHtml = '';
const server = await createServer({
  configFile:false, root:cwd,
  resolve:{alias:{'@':path.join(cwd,'src'),'next/link':path.join(dir,'link.tsx')}},
  server:{host:'127.0.0.1',port:3108,strictPort:true},
});
server.middlewares.use(async (req,res,next)=>{
  if(req.url.startsWith('/__box-label')){
    const html=await server.transformIndexHtml(req.url,'<!doctype html><html><head><meta charset="utf-8"></head><body><div id="root"></div><script type="module" src="/.next/box-label-browser/main.tsx"></script></body></html>');
    res.setHeader('Content-Type','text/html; charset=utf-8');res.end(html);
  }else if(req.url==='/__ticket'){
    res.setHeader('Content-Type','text/html; charset=utf-8');res.end(ticketHtml);
  }else next();
});
server.middlewares.stack.unshift(server.middlewares.stack.pop());
await server.listen();
const chrome=spawn(process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe',[
  '--headless=new','--disable-gpu','--no-first-run','--no-default-browser-check',
  `--remote-debugging-port=${debugPort}`,`--user-data-dir=${path.join(artifacts,'profile')}`,'about:blank'
],{windowsHide:true,stdio:'ignore'});
let ws;
let launchError;
chrome.on('error', error => { launchError = error; });
try{
  let targets;
  for(let i=0;i<100;i++){
    if (launchError) throw launchError;
    try{targets=await (await fetch(`http://127.0.0.1:${debugPort}/json`)).json();if(targets.length)break;}catch{}
    await new Promise(r=>setTimeout(r,100));
  }
  assert.ok(targets?.length,'Chrome no disponible');
  ws=new WebSocket(targets.find(t=>t.type==='page').webSocketDebuggerUrl);
  await new Promise(r=>ws.addEventListener('open',r,{once:true}));
  let id=0;const pending=new Map();const errors=[];
  ws.addEventListener('message',({data})=>{
    const message=JSON.parse(data);
    if(message.id){const p=pending.get(message.id);pending.delete(message.id);message.error?p.reject(message.error):p.resolve(message.result);}
    if(message.method==='Runtime.exceptionThrown')errors.push(message.params.exceptionDetails.text);
  });
  const send=(method,params={})=>new Promise((resolve,reject)=>{const call=++id;pending.set(call,{resolve,reject});ws.send(JSON.stringify({id:call,method,params}));});
  const evaluate=async expression=>{
    const result=await send('Runtime.evaluate',{expression,awaitPromise:true,returnByValue:true});
    if(result.exceptionDetails)throw new Error(result.exceptionDetails.exception?.description||result.exceptionDetails.text);
    return result.result.value;
  };
  const wait=async expression=>{for(let i=0;i<200;i++){if(await evaluate(expression))return;await new Promise(r=>setTimeout(r,50));}throw new Error('Timeout: '+expression+' '+JSON.stringify({errors,body:await evaluate('document.body.innerText.slice(0,2000)'),frame:await evaluate("document.querySelector('iframe')?.contentDocument?.body?.innerText.slice(0,1000)")}));};
  const click=async label=>evaluate(`Array.from(document.querySelectorAll('button')).find(b=>b.textContent.trim()===${JSON.stringify(label)}).click()`);
  await send('Page.enable');await send('Runtime.enable');
  const summaries=[];
  for(const scenario of ['simple','long','fixed','fixed-long','gift','saved','worker-long']){
    await send('Page.navigate',{url:'http://127.0.0.1:3108/__box-label?case='+scenario});
    await wait(`!!document.querySelector('iframe')?.contentDocument?.querySelector('.box-row') && Array.from(document.querySelectorAll('button')).some(b=>['Imprimir','Reimprimir'].includes(b.textContent.trim())&&!b.disabled)`);
    assert.equal(await evaluate('window.__apiCalls.length'),0,'Abrir no debe guardar');
    if(scenario.startsWith('fixed')){
      await evaluate(`(()=>{const select=document.querySelector('select');select.value='fixed';select.dispatchEvent(new Event('change',{bubbles:true}));})()`);
      await wait(`Array.from(document.querySelectorAll('p')).some(p=>p.textContent.includes('página(s): 210 mm')) && !Array.from(document.querySelectorAll('button')).find(b=>b.textContent.trim()==='Imprimir').disabled`);
    }
    if(scenario==='gift'){
      await evaluate(`document.querySelector('input[type=checkbox]').click()`);
      assert.equal(await evaluate(`Array.from(document.querySelectorAll('button')).find(b=>b.textContent.trim()==='Imprimir').disabled`),true);
      await click('Actualizar vista previa');
      await wait(`document.querySelector('iframe').contentDocument.body.textContent.includes('Salsa de regalo') && !Array.from(document.querySelectorAll('button')).find(b=>b.textContent.trim()==='Imprimir').disabled`);
    }
    const layout=await evaluate(`(()=>{
      const d=document.querySelector('iframe').contentDocument;
      const sheets=Array.from(d.querySelectorAll('.box-sheet'));
      const texts={};for(const row of d.querySelectorAll('.box-row'))texts[row.dataset.lineId]=(texts[row.dataset.lineId]||'')+row.querySelector('.box-description').textContent;
      return {pages:sheets.length,texts,heights:sheets.map(s=>Number(s.dataset.heightMm)),
        fits:sheets.every(s=>s.querySelector('.box-footer').getBoundingClientRect().bottom<s.getBoundingClientRect().bottom),
        horizontal:Array.from(d.querySelectorAll('.box-description')).every(e=>e.scrollWidth<=e.clientWidth+1),
        resources:Array.from(d.images).every(i=>i.complete&&i.naturalWidth>0),
        onlyTicket:!d.querySelector('button,nav,a'),
        numbers:sheets.map(s=>s.querySelector('.box-number')?.textContent??null),
        number:sheets.every((s,i)=>sheets.length===1?!s.querySelector('.box-number'):s.querySelector('.box-number')?.textContent==='Página '+(i+1)+' de '+sheets.length),
        originalWorker:d.querySelector('.box-footer > div').textContent==='Preparado por: '+window.__snapshot.preparedBy};
    })()`);
    assert.ok(layout.fits,'Recorte vertical');assert.ok(layout.horizontal,'Recorte horizontal');assert.ok(layout.resources);
    assert.ok(layout.onlyTicket);assert.ok(layout.number,JSON.stringify(layout.numbers));assert.ok(layout.originalWorker);
    const ink=await evaluate(`(()=>{
      const d=document.querySelector('iframe').contentDocument,img=d.querySelector('img'),c=d.createElement('canvas');
      c.width=img.naturalWidth;c.height=img.naturalHeight;const ctx=c.getContext('2d');ctx.drawImage(img,0,0);
      const data=ctx.getImageData(0,0,c.width,c.height).data;let gray=0,transparent=0,black=0;
      for(let i=0;i<data.length;i+=4){if(data[i]!==0&&data[i]!==255)gray++;if(data[i+3]!==255)transparent++;if(data[i]===0)black++;}
      return {width:c.width,height:c.height,gray,transparent,black,filter:d.defaultView.getComputedStyle(img).filter};
    })()`);
    assert.equal(ink.width,224);assert.equal(ink.gray,0);assert.equal(ink.transparent,0);assert.ok(ink.black>2000);assert.equal(ink.filter,'none');
    const expected=await evaluate(`window.__snapshot.lines.map(l=>({id:l.id,text:l.productName+(l.variantName?'\\n'+l.variantName:'')}))`);
    for(const line of expected)assert.equal(layout.texts[line.id],line.text,'Contenido omitido');
    if(scenario.includes('long')&&scenario!=='worker-long')assert.ok(layout.pages>5);
    await evaluate(`document.querySelector('iframe').contentWindow.print=()=>{
      const d=document.querySelector('iframe').contentDocument;
      window.__printedPages=d.querySelectorAll('.box-sheet').length;
      window.__printedResourcesReady=d.fonts.status==='loaded'&&Array.from(d.images).every(i=>i.complete&&i.naturalWidth===224);
      window.__printCalled=true;document.querySelector('iframe').contentWindow.dispatchEvent(new Event('afterprint'));
    }`);
    await click(scenario==='saved'?'Reimprimir':'Imprimir');
    await wait(`window.__printCalled===true && Array.from(document.querySelectorAll('button')).some(b=>b.textContent==='No confirmar')`);
    assert.equal(await evaluate('window.__printedPages'),layout.pages,'Se imprimió una paginación anterior');
    assert.equal(await evaluate('window.__printedResourcesReady'),true,'Se imprimió antes de cargar recursos');
    const writesBefore=await evaluate(`window.__apiCalls.filter(c=>c.url.endsWith('/confirmar')).length`);
    assert.equal(writesBefore,0,'Cerrar el diálogo no confirma');
    await click('No confirmar');
    assert.equal(await evaluate(`window.__apiCalls.filter(c=>c.url.endsWith('/confirmar')).length`),0);
    await click(scenario==='saved'?'Reimprimir':'Imprimir');
    await wait(`Array.from(document.querySelectorAll('button')).some(b=>b.textContent==='Sí, confirmar impresión')`);
    await click('Sí, confirmar impresión');
    await wait(`document.querySelector('[role=status]')?.textContent.includes('confirmada')===true`);
    const calls=await evaluate('window.__apiCalls');
    const confirms=calls.filter(c=>c.url.endsWith('/confirmar'));
    assert.equal(confirms.length,scenario==='saved'?0:1);
    if(confirms.length)assert.equal(confirms[0].body.draftToken,scenario==='gift'?'draft-updated':'draft-initial');
    const screenshot=await send('Page.captureScreenshot',{format:'png',captureBeyondViewport:false});
    await fs.writeFile(path.join(artifacts,scenario+'.png'),Buffer.from(screenshot.data,'base64'));
    ticketHtml=await evaluate(`'<!doctype html>'+document.querySelector('iframe').contentDocument.documentElement.outerHTML`);
    await send('Page.navigate',{url:'http://127.0.0.1:3108/__ticket'});
    await wait(`document.readyState==='complete' && document.images.length>0 && Array.from(document.images).every(i=>i.complete&&i.naturalWidth)`);
    const pdf=await send('Page.printToPDF',{paperWidth:80/25.4,paperHeight:Math.max(...layout.heights)/25.4,
      marginTop:0,marginBottom:0,marginLeft:0,marginRight:0,scale:1,
      preferCSSPageSize:false,displayHeaderFooter:false,printBackground:false});
    const bytes=Buffer.from(pdf.data,'base64');await fs.writeFile(path.join(artifacts,scenario+'.pdf'),bytes);
    {
      const physical=await send('Page.printToPDF',{paperWidth:80/25.4,paperHeight:210/25.4,
        marginTop:0,marginBottom:0,marginLeft:0,marginRight:0,scale:1,preferCSSPageSize:false,
        displayHeaderFooter:false,printBackground:false});
      const physicalBytes=Buffer.from(physical.data,'base64');
      await fs.writeFile(path.join(artifacts,scenario+'-pos-80-210.pdf'),physicalBytes);
      const metrics=boxLabelPdfMetrics(physicalBytes);
      assert.equal(metrics.length,layout.pages,'Páginas extra en papel 80 × 210');
      assert.ok(metrics.every(page=>Math.abs(page.widthMm-80)<0.3&&Math.abs(page.heightMm-210)<0.3),'Papel 80 × 210 alterado');
      assert.ok(metrics.every(page=>page.logoTopMm>=1&&page.logoTopMm<4),'El contenido no empieza junto al margen superior de 2mm');
    }
    // El formulario del POS-80-Series instalado se llama "80 x 210",
    // pero anuncia 72,1 mm de ancho lógico a Windows. Probar ese ancho
    // además de 80 mm físicos, sin escala ni recortes de texto/cantidades.
    {
      const logical=await send('Page.printToPDF',{paperWidth:72.1/25.4,paperHeight:210/25.4,
        marginTop:0,marginBottom:0,marginLeft:0,marginRight:0,scale:1,preferCSSPageSize:false,
        displayHeaderFooter:false,printBackground:false});
      const logicalBytes=Buffer.from(logical.data,'base64');
      await fs.writeFile(path.join(artifacts,scenario+'-pos-logical-72.pdf'),logicalBytes);
      const metrics=boxLabelPdfMetrics(logicalBytes);
      assert.equal(metrics.length,layout.pages,'Páginas extra con el ancho lógico del controlador');
      assert.ok(metrics.every(page=>Math.abs(page.widthMm-72.1)<0.3&&page.logoTopMm>=1&&page.logoTopMm<4),'Ancho lógico o posición vertical incorrectos');
      assert.ok(metrics.every(page=>page.logoLeftMm>=0&&page.logoRightMm<72.1),'Logo recortado con el ancho lógico');
      await send('Emulation.setDeviceMetricsOverride',{width:272,height:1000,deviceScaleFactor:1,mobile:false});
      await send('Emulation.setEmulatedMedia',{media:'print'});
      // La emulación CSS puede conservar la barra de scroll de pantalla;
      // el PDF no la imprime. Comparar con la anchura completa de la hoja.
      const fits=await evaluate(`Array.from(document.querySelectorAll('.box-header,.box-row,.box-footer')).every(e=>{
        const r=e.getBoundingClientRect();return r.left>=0&&r.right<=window.innerWidth+0.5;
      })`);
      assert.ok(fits,'Texto o cantidades fuera de la zona lógica imprimible: '+JSON.stringify(await evaluate(`({
        client:document.documentElement.clientWidth,inner:window.innerWidth,
        rects:Array.from(document.querySelectorAll('.box-header,.box-row,.box-footer')).slice(0,4).map(e=>({left:e.getBoundingClientRect().left,right:e.getBoundingClientRect().right}))
      })`)));
      await send('Emulation.clearDeviceMetricsOverride');
      await send('Emulation.setEmulatedMedia',{media:''});
    }
    const ticketImage=await send('Page.captureScreenshot',{format:'png',captureBeyondViewport:false,clip:{x:0,y:0,width:304,height:Math.min(800,layout.heights[0]*96/25.4),scale:1}});
    await fs.writeFile(path.join(artifacts,scenario+'-ticket.png'),Buffer.from(ticketImage.data,'base64'));
    const pageCount=(bytes.toString('latin1').match(/\/Type\s*\/Page\b/g)||[]).length;
    assert.equal(pageCount,layout.pages,'Páginas PDF inesperadas');
    const sizes=Array.from(bytes.toString('latin1').matchAll(/\/MediaBox\s*\[([^\]]+)\]/g),m=>m[1].trim().split(/\s+/).map(Number));
    assert.ok(sizes.every(size=>Math.abs(size[2]-80*72/25.4)<1),'Ancho PDF distinto de 80mm');
    if(scenario.startsWith('fixed'))assert.ok(sizes.every(size=>Math.abs(size[3]-210*72/25.4)<1),'Longitud fija incorrecta');
    summaries.push({scenario,pages:layout.pages,heights:layout.heights,pdfPages:pageCount,solidBlackPixels:ink.black});
  }
  assert.deepEqual(errors,[]);
  console.log(JSON.stringify({artifacts,summaries}));
}finally{
  ws?.close();chrome.kill();await server.close();
}
