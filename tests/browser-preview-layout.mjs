// Regression: the configurator preview lays out the shared renderer exactly like the standalone output,
// and a lost signal with no reading never claims "last-known values".
import {start} from './browser-support.mjs';import {writeFile} from 'node:fs/promises';import assert from 'node:assert/strict';
const env=await start();
// Status text differs between demo preview and an offline output, so pieces may differ in size;
// compare the edge each piece is anchored to (in output pixels), not its raw left/top.
const read=p=>p.evaluate(()=>{const r=document.querySelector('#preview')||document.querySelector('.sq-root');const W=r.clientWidth,H=r.clientHeight;
  const q=c=>{const n=r.querySelector(c);if(!n)return null;const m=/scale\(([\d.]+)\)/.exec(n.style.transform),k=m?Number(m[1]):1,x=parseFloat(n.style.left),y=parseFloat(n.style.top),w=n.offsetWidth*k,h=n.offsetHeight*k,R=W-x-w,B=H-y-h;
    const ax=Math.abs(x-R)<2?'center':x<R?'left:'+Math.round(x):'right:'+Math.round(R),ay=Math.abs(y-B)<2?'middle':y<B?'top:'+Math.round(y):'bottom:'+Math.round(B);return ax+' '+ay;};
  return {W,H,rig:q('.sq-rig'),alert:q('.sq-alert'),badge:q('.sq-badge')};});
const box=(p,sel)=>p.locator(sel).first().evaluate(n=>{const r=n.getBoundingClientRect();return {x:r.x,y:r.y,w:r.width,h:r.height};});
const overlaps=(a,b)=>a.x<b.x+b.w-1&&b.x<a.x+a.w-1&&a.y<b.y+b.h-1&&b.y<a.y+a.h-1;
const results={layouts:[],noData:[]};
try{
  const page=await env.browser.newPage({viewport:{width:390,height:844}});
  await page.route('https://api.squeekchain.com/**',r=>r.abort());
  await page.goto(env.base+'index.html');await page.waitForTimeout(800);
  for(const [name,re] of [['full',/Full scene/],['hamster',/Hamster only/],['essentials',/essentials/]]){
    await page.getByRole('button',{name:re}).first().click();await page.waitForTimeout(700);
    const preview=await read(page);
    assert.ok(preview.W>0&&preview.H>0,name+': preview root has a size');
    const url=await page.evaluate(()=>{const i=[...document.querySelectorAll('input,textarea,output,code')].find(n=>/(overlay|widget)\.html\?/.test(n.value||n.textContent||''));return i?(i.value||i.textContent):null;});
    assert.ok(url,name+': OBS URL present');
    const rel=url.slice(url.search(/(overlay|widget)\.html/));
    const out=await env.browser.newPage({viewport:{width:preview.W,height:preview.H}});await out.route('https://api.squeekchain.com/**',r=>r.abort());
    await out.goto(env.base+rel);await out.waitForTimeout(800);
    const output=await read(out);await out.close();
    assert.deepEqual(preview,output,name+': preview layout equals output layout');
    results.layouts.push({name,rel:rel.split('&sid=')[0],preview,output});
  }
  // Hamster only + Try running: the wake alert must not cover the hamster in the preview.
  await page.getByRole('button',{name:/Hamster only/}).first().click();await page.waitForTimeout(500);
  await page.getByRole('button',{name:/Try sleeping/}).first().click();await page.waitForTimeout(1300);
  await page.getByRole('button',{name:/Try running/}).first().click();
  await page.locator('#preview .sq-alert.is-on').waitFor({timeout:4000});
  const art=await box(page,'#preview .sq-art'),alert=await box(page,'#preview .sq-alert');
  assert.ok(!overlaps(art,alert),'alert does not cover hamster in preview');
  results.hamsterAlert={art,alert};
  await page.close();
  for(const lang of ['en','tr']){
    const w=await env.browser.newPage({viewport:{width:480,height:270}});
    await w.route('https://api.squeekchain.com/**',r=>r.abort());
    await w.goto(env.base+'widget.html?lang='+lang);await w.waitForTimeout(1500);
    const text=await w.locator('.sq-status').innerText();
    assert.ok(!/Last-known|Son bilinen/.test(text),lang+': no last-known claim without data: '+text);
    assert.match(text,lang==='en'?/Lost · No data yet/:/Bağlantı yok · Henüz veri yok/);
    results.noData.push({lang,text});await w.close();
  }
  await writeFile('artifacts/browser-preview-layout-results.json',JSON.stringify({passed:true,...results},null,2));
  console.log(JSON.stringify({passed:true,layouts:results.layouts.length,noData:results.noData}));
}catch(e){await writeFile('artifacts/browser-preview-layout-results.json',JSON.stringify({passed:false,error:e.message},null,2));console.log(e.message);process.exitCode=1;}
finally{await env.close();}
