import {createServer} from 'node:http';
import {readFile,mkdir} from 'node:fs/promises';
import {extname,join,resolve,sep} from 'node:path';
const pw=await import(process.env.SQUEEK_PLAYWRIGHT_MODULE||'playwright');
export const CSP="default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; connect-src https://api.squeekchain.com; object-src 'none'; frame-src 'none'; frame-ancestors 'none'; base-uri 'self'";
export async function start(){
  const root=resolve('dist'),types={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.svg':'image/svg+xml','.png':'image/png','.json':'application/json','.zip':'application/zip'};
  const server=createServer(async(req,res)=>{try{let pathname=decodeURIComponent(new URL(req.url,'http://local').pathname);if(!pathname.startsWith('/preview/')){res.writeHead(404).end();return;}pathname=pathname.slice(9)||'index.html';const file=resolve(join(root,pathname));if(!file.startsWith(root+sep)){res.writeHead(403).end();return;}res.setHeader('Content-Security-Policy',CSP);res.setHeader('content-type',types[extname(file)]||'application/octet-stream');res.end(await readFile(file));}catch{res.writeHead(404).end('Not found');}});
  await new Promise(r=>server.listen(0,'127.0.0.1',r));
  const browser=await pw.chromium.launch({headless:true,...(process.env.SQUEEK_BROWSER_EXECUTABLE?{executablePath:process.env.SQUEEK_BROWSER_EXECUTABLE}:{}),args:['--no-sandbox','--disable-background-timer-throttling']});
  await mkdir('artifacts/screenshots',{recursive:true});
  return {browser,base:`http://127.0.0.1:${server.address().port}/preview/`,async close(){await browser.close();await new Promise(r=>server.close(r));}};
}
export function sample(now=Date.now(),distance=1000,mode='SPINNING',epoch='a',options={}){const stamp=new Date(now).toISOString();return {generatedAt:stamp,measurement:{freshness:'online',observedAt:stamp,staleAfterSeconds:120,coreStatus:mode,rpmMilli:mode==='SPINNING'?45000:0,speedMmPerSecond:1000,distanceMm:distance,cumulativeWorkUnits:'9000',counterEpoch:epoch,...options},builder:{anchor:{blockHeight:'9000',blockProgress:'700000000',settledThroughRound:'100'}}};}
export async function painted(page,selector='canvas'){return page.locator(selector).first().evaluate(c=>{const data=c.getContext('2d').getImageData(0,0,c.width,c.height).data;let pixels=0;for(let i=3;i<data.length;i+=4)if(data[i]>0)pixels++;const r=c.getBoundingClientRect();return {pixels,width:r.width,height:r.height,visible:getComputedStyle(c).visibility==='visible'&&r.width>0&&r.height>0};});}
export async function mountTest(page,options={}){
  await page.evaluate(opts=>{
    window.testMount?.destroy();window.dispatchEvent(new PageTransitionEvent('pagehide',{persisted:false}));document.body.replaceChildren();document.body.className='';document.body.style.margin='0';
    const host=document.createElement('div');host.id='harness';host.style.cssText=`position:relative;width:${opts.width||1920}px;height:${opts.height||1080}px`;document.body.append(host);
    const s=SqueekSettings.defaults(opts.page||'scene');s.config.demo=opts.demo!==false;s.config.persist=opts.persist===true;s.config.poll=5;s.config.alertsec=2;
    if(opts.parts)s.config.parts=opts.parts;if(opts.sessionId)s.sessionId=opts.sessionId;if(opts.lang)s.config.lang=opts.lang;
    window.testSettings=s;window.testMount=SqueekRenderer.mount(host,{settings:s});
  },options);
  await page.waitForTimeout(30);
}
