// Regressions for the 2.0.2 review findings, each following the reviewer's reproduce path in a real browser.
import {start} from './browser-support.mjs';import {writeFile,readFile} from 'node:fs/promises';import assert from 'node:assert/strict';
const env=await start(),results={};
const draft=page=>page.evaluate(()=>{const raw=Object.entries(localStorage).find(([k])=>/draft/.test(k));if(!raw)return null;const d=JSON.parse(raw[1]);return d.settings||d;});
async function fresh(ctx,width,height){const page=await ctx.newPage();await page.setViewportSize({width,height});const errors=[];page.on('pageerror',e=>errors.push(e.message));await page.route('https://api.squeekchain.com/**',r=>r.abort());await page.goto(env.base+'index.html');await page.evaluate(()=>localStorage.clear());await page.reload();await page.waitForTimeout(400);return {page,errors};}
try{
  const ctx=await env.browser.newContext({permissions:['clipboard-read','clipboard-write']});

  // 1. Every scale step keeps the URL, preview, draft and Copy OBS URL working.
  {const {page,errors}=await fresh(ctx,1440,900);await page.locator('#look').evaluate(d=>d.open=true);
    await page.locator('#scale').focus();await page.keyboard.press('Home');await page.waitForTimeout(50);const steps=[];
    for(let i=0;i<=50;i++){if(i){await page.locator('#scale').focus();await page.keyboard.press('ArrowRight');}const expected=Number((.5+i*.05).toFixed(2));
      await page.evaluate(()=>navigator.clipboard.writeText('SENTINEL'));await page.locator('#copy').first().click();await page.waitForTimeout(30);
      const url=await page.locator('#url').inputValue(),clip=await page.evaluate(()=>navigator.clipboard.readText()),scale=new URL(url).searchParams.get('scale');
      assert.equal(scale===null?1:Number(scale),expected,'URL follows scale '+expected);assert.equal(clip,url,'Copy OBS URL works at scale '+expected);
      assert.equal((await draft(page)).config.scale,expected,'draft saved at scale '+expected);steps.push(expected);}
    await page.locator('#scale').evaluate(n=>{n.value='1.65';n.dispatchEvent(new Event('input'));n.dispatchEvent(new Event('change'));});
    await page.selectOption('#theme','paper');await page.waitForTimeout(100);
    const url=await page.locator('#url').inputValue();assert.match(url,/theme=paper/);assert.match(url,/scale=1\.65/);assert.equal((await draft(page)).config.theme,'paper');
    await page.reload();await page.waitForTimeout(300);assert.equal(await page.locator('#theme').inputValue(),'paper','edit survives reload');
    assert.deepEqual(errors,[]);results.scale={steps:steps.length,copyChecks:steps.length};await page.close();}

  // 2. Alert tests are visible in the default close-up preview at phone and desktop widths, then it returns to the rig.
  results.alertCloseUp=[];
  for(const [w,h] of [[390,844],[1440,900]]){const {page,errors}=await fresh(ctx,w,h);await page.evaluate(()=>document.querySelectorAll('details').forEach(d=>d.open=true));await page.waitForTimeout(200);
    await page.locator('#test-wake').click();await page.waitForSelector('#preview .sq-alert.is-on');await page.waitForTimeout(300);
    const seen=await page.evaluate(()=>{const a=document.querySelector('#preview .sq-alert.is-on').getBoundingClientRect(),f=document.querySelector('#preview-frame').getBoundingClientRect();const ix=Math.max(0,Math.min(a.right,f.right)-Math.max(a.left,f.left)),iy=Math.max(0,Math.min(a.bottom,f.bottom)-Math.max(a.top,f.top));return ix*iy/(a.width*a.height);});
    assert.ok(seen>.9,`alert visible in close-up at ${w}: ${seen}`);
    await page.waitForFunction(()=>!document.querySelector('#preview .sq-alert.is-on'),null,{timeout:20000});await page.waitForTimeout(300);
    const rig=await page.evaluate(()=>{const a=document.querySelector('#preview .sq-rig').getBoundingClientRect(),f=document.querySelector('#preview-frame').getBoundingClientRect();return Math.abs(a.left+a.width/2-(f.left+f.width/2))<f.width/2&&a.bottom>f.top&&a.top<f.bottom;});
    assert.ok(rig,'close-up returns to the rig at '+w);assert.deepEqual(errors,[]);results.alertCloseUp.push({width:w,visibleFraction:Number(seen.toFixed(3))});await page.close();}

  // 3. Stream language switch: template fields show and write the selected language.
  {const {page,errors}=await fresh(ctx,1440,900);await page.evaluate(()=>document.querySelectorAll('details').forEach(d=>d.open=true));
    await page.locator('#lang').focus();await page.selectOption('#lang','tr');await page.waitForTimeout(150);
    assert.equal(await page.locator('label[for=template-wake-title]').innerText(),'Title · TR');assert.equal(await page.locator('#template-wake-title').inputValue(),'Squeektoshi uyandı');
    assert.equal(await page.evaluate(()=>document.activeElement?.id),'lang','focus stays on the language select');
    await page.fill('#template-wake-body','Hello edit');await page.locator('#template-wake-body').blur();await page.waitForTimeout(100);
    const d=await draft(page);assert.equal(d.presentation.templates.tr.wake.body,'Hello edit');assert.notEqual(d.presentation.templates.en.wake.body,'Hello edit');
    assert.deepEqual(errors,[]);results.language={label:'Title · TR'};await page.close();}

  // 4. Selecting by drag or keyboard moves the numeric fields to that part.
  {const {page,errors}=await fresh(ctx,1440,900);await page.locator('#arrange').evaluate(d=>d.open=true);
    await page.selectOption('#layout','custom');await page.check('#edit-layout');await page.waitForTimeout(300);
    const before=await draft(page),hb=await page.locator('#handle-stats').boundingBox();
    await page.mouse.move(hb.x+5,hb.y+5);await page.mouse.down();await page.mouse.move(hb.x+60,hb.y+30,{steps:5});await page.mouse.up();await page.waitForTimeout(300);
    const afterDrag=await draft(page);assert.equal(await page.locator('#selected-part').inputValue(),'stats');assert.equal(await page.locator('#box-x').inputValue(),String(afterDrag.presentation.boxes.stats.x));
    assert.notEqual(afterDrag.presentation.boxes.stats.x,before.presentation.boxes.stats.x,'drag moved stats');
    assert.equal(String(afterDrag.presentation.boxes.stats.x),String(Number(afterDrag.presentation.boxes.stats.x.toFixed(1))),'drag values carry no float residue');
    await page.fill('#box-x','11');await page.locator('#box-x').blur();await page.waitForTimeout(100);
    const d=await draft(page);assert.equal(d.presentation.boxes.stats.x,11);assert.equal(d.presentation.boxes.hamster.x,before.presentation.boxes.hamster.x);
    await page.locator('#handle-progress').focus();await page.keyboard.press('ArrowRight');await page.waitForTimeout(200);
    assert.equal(await page.locator('#selected-part').inputValue(),'progress');assert.equal(await page.evaluate(()=>document.activeElement?.id),'handle-progress');
    const k=await draft(page);assert.equal(await page.locator('#box-x').inputValue(),String(k.presentation.boxes.progress.x));
    assert.deepEqual(errors,[]);results.selection={dragged:'stats',numericEdit:11,keyboard:'progress'};await page.close();}

  // 5. The visible version label equals build.json.
  {const {page}=await fresh(ctx,1440,900);await page.locator('#downloads').evaluate(d=>d.open=true);const build=JSON.parse(await readFile('dist/build.json','utf8'));
    assert.ok((await page.locator('#downloads').innerText()).includes('Version '+build.version+' · '));results.version=build.version;await page.close();}

  // 6. A custom panel colour: the labels use the colour the contrast hint measured.
  {const {page}=await fresh(ctx,1440,900);await page.locator('#look').evaluate(d=>d.open=true);await page.fill('#color-panel','#6b5a4a');await page.locator('#color-panel').blur();await page.waitForTimeout(150);
    const r=await page.evaluate(()=>{const hex=c=>'#'+c.match(/\d+/g).slice(0,3).map(n=>Number(n).toString(16).padStart(2,'0')).join('');const label=document.querySelector('#preview .sq-label');const root=document.querySelector('#preview');const panel=getComputedStyle(root).getPropertyValue('--panel').trim();return {ratio:SqueekSettings.contrast(hex(getComputedStyle(label).color),panel),hint:[...document.querySelectorAll('#look p.hint')].map(n=>n.textContent).find(x=>/contrast/.test(x))};});
    assert.ok(r.ratio>=4.5,'label contrast '+r.ratio);assert.match(r.hint,/Meets 4\.5:1/);results.contrast=Number(r.ratio.toFixed(2));await page.close();}

  // 7. Standalone page sizing does not depend on :has().
  {const css=await readFile('dist/assets/overlay.css','utf8');assert.ok(!css.includes(':has('),'overlay.css uses no :has()');
    for(const [file,w,h] of [['overlay.html',1920,1080],['widget.html',480,270]]){const page=await ctx.newPage();await page.setViewportSize({width:w,height:h});await page.route('https://api.squeekchain.com/**',r=>r.abort());await page.goto(env.base+file+'?demo=1');await page.waitForTimeout(400);
      const m=await page.evaluate(()=>({cls:document.documentElement.className,root:document.querySelector('.sq-root').clientHeight,margin:getComputedStyle(document.body).margin}));
      assert.equal(m.cls,'standalone-doc');assert.equal(m.root,h);assert.equal(m.margin,'0px');await page.close();}
    results.standalone='sized by class, no :has()';}

  await writeFile('artifacts/browser-revision-results.json',JSON.stringify({passed:true,results},null,2));console.log(JSON.stringify({passed:true,results}));
}catch(e){await writeFile('artifacts/browser-revision-results.json',JSON.stringify({passed:false,error:e.message,results},null,2));console.log(e.stack);process.exitCode=1;}finally{await env.close();}
