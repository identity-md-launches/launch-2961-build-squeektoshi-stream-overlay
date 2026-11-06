/* Root-scoped renderer shared by the configurator and standalone browser sources. */
(function(root){
  'use strict';
  const C=root.SqueekCore,S=root.SqueekSettings,Art=root.SqueekArt,Store=root.SqueekStorage;
  /** @template {keyof HTMLElementTagNameMap} K @param {K} tag @param {string} [cls] @param {string} [text] @returns {HTMLElementTagNameMap[K]} */
  function el(tag,cls='',text){const n=document.createElement(tag);n.className=cls;if(text!==undefined)n.textContent=text;return n;}
  const set=(n,t)=>{if(n&&n.textContent!==t)n.textContent=t;};
  /** @param {HTMLElement} host @param {import('../../types/model').MountOptions} options @returns {import('../../types/model').Renderer} */
  function mount(host,options){
    let settings=S.clone(options.settings),config=settings.config,p=settings.presentation;
    let destroyed=false,generation=0,raf=0,lastFrame=0,draws=0,requests=0,manualUntil=0,shown=null;
    let engine=C.createEngine({session:C.newSession(config.reset)}),coordinator=null,feed=null;
    let demoMode='automatic',demoRPM=48,demoDistance=7022244,demoAt=Date.now();
    let queue=C.createAlertQueue({durationMs:config.alertsec*1000,gapMs:500});
    let stage=null,canvas=null,rig=null,column=null,status=null,refs={},pieces={},alertBox=null,alertTitle=null,alertBody=null,alertIcon=null,badge=null;
    let effectiveScale=1,supply=null,supplyLost=false,supplyAt=null;
    /** @type {AudioContext | null} */ let audio=null;
    let audioGeneration=0;
    const oscillators=new Set(),controllers=new Set(),timeouts=new Set(),events=[];
    const media=matchMedia('(prefers-reduced-motion: reduce)');
    const source=()=>config.demo?'demo':'live';
    const motion=()=>config.motion&&!media.matches;
    const has=part=>config.parts.includes(part);
    const schedule=(fn,ms)=>{const t=setTimeout(()=>{timeouts.delete(t);if(!destroyed)fn();},ms);timeouts.add(t);return t;};
    function event(type){events.push({at:Date.now(),type});if(events.length>40)events.shift();}
    function stopAudio(){audioGeneration++;oscillators.forEach(o=>{try{o.stop();o.disconnect();}catch(_){}});oscillators.clear();}
    function clear(){queue.clear();shown=null;if(alertBox)alertBox.classList.remove('is-on');stopAudio();}
    function cancelData(){generation++;controllers.forEach(c=>c.abort());controllers.clear();timeouts.forEach(t=>clearTimeout(t));timeouts.clear();if(coordinator){if(engine.signal()==='live')engine.fail('stopped',Date.now());coordinator.save();coordinator.release();coordinator=null;}clear();}
    function audioState(){return !config.sound?'off':audio?audio.state:'gesture';}
    async function tone(kind,forced){
      if(destroyed||!config.sound||config.volume<=0||engine.signal()!=='live')return false;
      const def=p.sounds[kind]||p.sounds.block;if(def.tone==='off'||def.level===0)return false;
      const which=forced||def.tone, audioToken=audioGeneration;
      try{
        const Ctx=window.AudioContext||window.webkitAudioContext;if(!Ctx)return false;
        if(!audio)audio=new Ctx();
        if(audio.state==='suspended')await audio.resume();
        if(destroyed||audioToken!==audioGeneration||!config.sound||engine.signal()!=='live'||audio.state!=='running')return false;
        const notes=which==='soft'?[659,523,392]:which==='arcade'?[523,659,784,1047]:[784,988];
        notes.forEach((frequency,i)=>{
          const osc=audio.createOscillator(),gain=audio.createGain(),start=audio.currentTime+i*.13;
          osc.type=which==='arcade'?'square':which==='soft'?'triangle':'sine';osc.frequency.value=frequency;
          gain.gain.setValueAtTime(0,start);gain.gain.linearRampToValueAtTime(config.volume/100*def.level/100*.18,start+.015);gain.gain.exponentialRampToValueAtTime(.0001,start+.12);
          osc.connect(gain);gain.connect(audio.destination);oscillators.add(osc);osc.onended=()=>{oscillators.delete(osc);osc.disconnect();gain.disconnect();};osc.start(start);osc.stop(start+.13);
        });event('sound');return true;
      }catch(_){event('audio-blocked');return false;}
    }
    function stat(parent,key,label){const wrap=el('div');wrap.append(el('dt','sq-label',label));const value=el('dd','sq-value','–');wrap.append(value);parent.append(wrap);refs[key]=value;}
    function build(){
      clear();host.replaceChildren();host.classList.add('sq-root');host.dataset.page=settings.page;host.lang=config.lang;
      const colors=S.colors(settings);Object.entries(colors).forEach(([k,v])=>host.style.setProperty('--'+k,String(v)));
      const rgb=[1,3,5].map(i=>parseInt(colors.panel.slice(i,i+2),16));host.style.setProperty('--panel-bg',`rgba(${rgb.join(',')},${p.opacity/100})`);host.style.fontSize=(16*p.font/100)+'px';
      rig=el('div','sq-rig sq-'+p.layout);host.append(rig);refs={};pieces={};canvas=null;stage=null;status=null;
      const T=C.strings(config.lang);
      if(has('hamster')){const art=el('div','sq-art sq-piece');art.dataset.part='hamster';canvas=el('canvas','sq-art-canvas');canvas.setAttribute('aria-hidden','true');art.append(canvas);status=el('p','sq-status');art.append(status);pieces.hamster=art;rig.append(art);stage=Art.createStage(canvas,{compact:settings.page==='widget',palette:C.artPalette(config.theme)});}
      column=el('div','sq-column');
      if(has('stats')){const panel=el('div','sq-panel sq-piece');panel.dataset.part='stats';if(!status){status=el('p','sq-status');panel.append(status);}const list=el('dl','sq-stats');p.metrics.forEach(k=>stat(list,k,T[k]));panel.append(list);pieces.stats=panel;column.append(panel);}
      if(has('progress')){const panel=el('div','sq-panel sq-piece');panel.dataset.part='progress';const row=el('div','sq-progress-row');row.append(el('span','sq-label',T.progress));refs.percent=el('span','sq-value','–');row.append(refs.percent);refs.bar=el('div','sq-bar');refs.bar.setAttribute('role','progressbar');refs.bar.setAttribute('aria-label',T.progress);refs.bar.setAttribute('aria-valuemin','0');refs.bar.setAttribute('aria-valuemax','100');refs.fill=el('div','sq-fill');refs.bar.append(refs.fill);panel.append(row,refs.bar);pieces.progress=panel;column.append(panel);}
      if(has('session')){const panel=el('div','sq-panel sq-piece sq-session');panel.dataset.part='session';panel.append(el('p','sq-label',T.session));const list=el('dl','sq-stats');stat(list,'sessionDistance',T.sessionDistance);stat(list,'sessionTime',T.sessionTime);stat(list,'sessionRecord',T.sessionRecord);panel.append(list);pieces.session=panel;column.append(panel);}
      if(has('supply')){const panel=el('dl','sq-panel sq-piece');panel.dataset.part='supply';stat(panel,'supply',T.supply);pieces.supply=panel;column.append(panel);}
      if(column.children.length)rig.append(column);
      if(p.layout==='custom'){Object.values(pieces).forEach(n=>rig.append(n));column.remove();}
      badge=el('div','sq-badge');badge.setAttribute('role','status');host.append(badge);
      alertBox=el('div','sq-alert');alertBox.dataset.part='alerts';alertBox.setAttribute('role','status');alertIcon=el('canvas','sq-alert-icon');alertIcon.setAttribute('aria-hidden','true');const words=el('div','sq-alert-words');alertTitle=el('p','sq-alert-title');alertBody=el('p','sq-alert-body');words.append(alertTitle,alertBody);alertBox.append(alertIcon,words);host.append(alertBox);
      // Measure the longest configured message even while hidden: its reserved area never jumps when an alert arrives.
      const templates=p.templates[config.lang];let largest='';C.ALERT_KINDS.forEach(k=>{const t=templates[k];const str=t.title+' '+t.body;if(str.length>largest.length){largest=str;set(alertTitle,t.title);set(alertBody,t.body.replaceAll('{value}','999,999,999,999'));}});
      fit();render();restartFrames();
    }
    function position(node,pos,w,h,area){const left=pos.includes('right')?area.x+area.w-w:pos.includes('left')?area.x:area.x+(area.w-w)/2;const top=pos.startsWith('top')?area.y:pos.startsWith('bottom')?area.y+area.h-h:area.y+(area.h-h)/2;node.style.left=left+'px';node.style.top=top+'px';return {x:left,y:top,w,h};}
    function fit(){
      if(destroyed||!rig)return;
      const W=host.clientWidth,H=host.clientHeight;if(!W||!H)return;
      const inset=Math.min(p.inset,W/8,H/8),area={x:inset,y:inset,w:W-2*inset,h:H-2*inset};
      const compact=settings.page==='widget';let reserved=0,atTop=true;
      let alertFont=p.alert.scale/100*(compact?14:20);
      alertBox.style.fontSize=alertFont+'px';alertBox.style.width=Math.min(area.w,Math.max(compact?Math.min(360,area.w):120,area.w*p.alert.width/100))+'px';
      // Readability takes precedence over a requested narrow alert: widen before reducing text.
      // Even maximal Turkish templates fit a 480×270 source at 12px or above.
      if(compact && alertBox.offsetHeight>area.h*.7) alertBox.style.width=area.w+'px';
      while(compact && alertBox.offsetHeight>area.h*.7 && alertFont>12){alertFont=Math.max(12,alertFont-.5);alertBox.style.fontSize=alertFont+'px';}
      const aw=alertBox.offsetWidth,ah=alertBox.offsetHeight,as=Math.min(1,area.w/aw,area.h*.7/ah);
      alertBox.style.transform=`scale(${as})`;
      const ap=p.alert.pos==='auto'?(config.pos.startsWith('top')?'bottom':'top'):p.alert.pos;
      let ab;
      if(ap==='custom'){const b=p.boxes.alerts;const x=area.x+(area.w-aw*as)*b.x/100,y=area.y+(area.h-ah*as)*b.y/100;alertBox.style.left=x+'px';alertBox.style.top=y+'px';ab={x,y,w:aw*as,h:ah*as};}
      else ab=position(alertBox,ap,aw*as,ah*as,area);
      if(has('alerts')){
        // Reserve the nearest edge for alerts, including custom placements. All content remains disjoint from the alert.
        atTop=ab.y+ab.h/2<H/2;reserved=atTop?ab.y+ab.h-area.y+10:area.y+area.h-ab.y+10;
        reserved=Math.min(area.h*.8,reserved);
      }
      const content={x:area.x,y:area.y+(atTop?reserved:0),w:area.w,h:Math.max(20,area.h-reserved)};
      if(p.layout==='custom'){
        rig.style.transform='none';rig.style.left='0';rig.style.top='0';effectiveScale=config.scale;
        Object.entries(pieces).forEach(([part,node])=>{
          const b=p.boxes[part];node.style.width=Math.max(100,content.w*b.w/100)+'px';const scale=Math.min(config.scale*b.scale,content.w/node.offsetWidth,content.h/node.offsetHeight);
          effectiveScale=Math.min(effectiveScale,scale);node.style.transform=`scale(${scale})`;node.style.left=(content.x+(content.w-node.offsetWidth*scale)*b.x/100)+'px';node.style.top=(content.y+(content.h-node.offsetHeight*scale)*b.y/100)+'px';
        });
      }else{
        const w=rig.offsetWidth,h=rig.offsetHeight;effectiveScale=w&&h?Math.min(config.scale,content.w/w,content.h/h):config.scale;
        rig.style.transform=`scale(${effectiveScale})`;position(rig,config.pos,w*effectiveScale,h*effectiveScale,content);
      }
      badge.style.left=inset+'px';badge.style.top=Math.max(0,H-inset-badge.offsetHeight)+'px';
    }
    function distance(mm){if(mm===null||mm===undefined)return '–';return p.distance==='auto'?C.formatDistance(mm,config.lang):C.formatNumber(mm/(p.distance==='km'?1e6:1000),config.lang,2)+' '+p.distance;}
    function artState(){const d=engine.display;return {mode:engine.signal()==='lost'?'unknown':d.coreStatus==='SPINNING'?'spinning':d.coreStatus==='IDLE'?'sleeping':'unknown',rpm:d.rpm||0,lost:engine.signal()==='lost',motion:motion(),speed:C.animationSpeed(d.rpm||0)};}
    function render(){
      if(destroyed)return;
      const d=engine.display,T=C.strings(config.lang),signal=engine.signal(),r=engine.reading();
      const last=signal==='lost',known=last?(engine.lastSuccess()!==null?T.lastKnown:T.noData):'';
      let state=signal==='connecting'?T.connecting:signal==='lost'?T.lost:d.coreStatus==='SPINNING'?T.running+' · '+C.formatNumber(d.rpm,config.lang,1)+' RPM':d.coreStatus==='IDLE'?T.resting+' · '+T.healthyRest:T.unknown;
      set(status,(source()==='demo'?T.demo+' · ':signal==='live'?T.live+' · ':'')+state+(known?' · '+known:''));
      // Missing fields are dashes; the previous display is reserved for an explicit lost/last-known state.
      const value=(k)=>last?d[k]:(r?r[k]:null);
      set(refs.rpm,C.formatNumber(value('rpm'),config.lang,1));set(refs.speed,value('speedMmPerSecond')===null?'–':C.formatNumber(value('speedMmPerSecond')/1000*(p.speed==='km/h'?3.6:1),config.lang,2)+' '+p.speed);
      set(refs.distance,distance(value('distanceMm')));set(refs.work,C.formatNumber(value('workUnits'),config.lang));set(refs.block,C.formatNumber(value('blockHeight'),config.lang));set(refs.round,C.formatNumber(value('settledRound'),config.lang));
      if(refs.bar){const n=value('blockProgress');set(refs.percent,C.formatPercent(n,config.lang));refs.fill.style.width=(n===null?0:n*100)+'%';if(n!==null)refs.bar.setAttribute('aria-valuenow',String(n*100));else refs.bar.removeAttribute('aria-valuenow');}
      const view=C.sessionView(engine.session),at=engine.lastReadingAt();
      const extra=engine.isSpinning()&&at!==null?Math.min(30000,Math.max(0,Date.now()-at)):0;
      set(refs.sessionDistance,distance(view.distanceMm));set(refs.sessionTime,C.formatDuration(view.runningMs+extra));set(refs.sessionRecord,distance(view.recordMm));
      set(refs.supply,(supply?C.formatSupply(supply,config.lang):'–')+(supplyLost&&supply?' · '+T.lastKnown:''));
      badge.hidden=!!status||config.parts.length===0;
      set(badge,(source()==='demo'?T.demo+' · ':'')+(last?T.lost+' · '+known:signal==='connecting'?T.connecting:T.live));
      if(stage&&!motion()){const key=JSON.stringify({mode:artState().mode,lost:artState().lost});if(host.dataset.still!==key){host.dataset.still=key;stage.render(artState(),0);draws++;}}
      fit();
    }
    function show(item){shown=item;if(!item){alertBox.classList.remove('is-on');return;}
      const value=item.kind==='record'?distance(item.value):C.formatNumber(item.value,config.lang);
      const t=p.templates[config.lang][item.kind];set(alertTitle,t.title.replaceAll('{value}',value));set(alertBody,t.body.replaceAll('{value}',value));Art.drawIcon(alertIcon,item.kind,S.colors(settings)['on-accent']);alertBox.classList.add('is-on');void tone(item.kind);event('alert-'+item.kind);fit();
    }
    function handle(result,automatic=true){if(destroyed)return;if(result.signal==='lost')clear();else if(!automatic||Date.now()>=manualUntil)result.events.forEach(e=>{if(has('alerts')&&C.alertEnabled(config,e.kind))queue.push(e);});event(result.signal);render();if(coordinator)coordinator.save();}
    async function request(url,gen){const ctrl=new AbortController();controllers.add(ctrl);const t=schedule(()=>ctrl.abort(),(config.poll-1)*1000);requests++;try{const response=await fetch(url,{signal:ctrl.signal,cache:'no-store',credentials:'omit',referrerPolicy:'no-referrer'});if(!response.ok)throw Error('request');const json=await response.json();if(destroyed||generation!==gen)throw Error('cancel');return json;}finally{clearTimeout(t);timeouts.delete(t);controllers.delete(ctrl);}}
    function pollStatus(gen){if(destroyed||gen!==generation)return;const start=Date.now();request(C.STATUS_URL,gen).then(json=>{if(!destroyed&&gen===generation)handle(engine.ingest(json,Date.now()));}).catch(()=>{if(!destroyed&&gen===generation)handle(engine.fail('request-failed',Date.now()));}).finally(()=>{if(!destroyed&&gen===generation)schedule(()=>pollStatus(gen),C.nextPollDelay(config.poll,start,Date.now()));});}
    function pollEconomy(gen){if(destroyed||gen!==generation)return;const start=Date.now();request(C.ECONOMY_URL,gen).then(json=>{if(!destroyed&&gen===generation&&C.formatSupply(json,config.lang)){supply=json;supplyLost=false;supplyAt=Date.now();render();}}).catch(()=>{if(!destroyed&&gen===generation){supplyLost=true;render();}}).finally(()=>{if(!destroyed&&gen===generation)schedule(()=>pollEconomy(gen),Math.max(0,60000-(Date.now()-start)));});}
    function demoTick(){if(!config.demo||destroyed)return;const now=Date.now();let payload=feed.next(now);
      if(demoMode==='lost')payload=null;
      else if(demoMode!=='automatic'){
        const run=demoMode==='running';const elapsed=Math.min(3,(now-demoAt)/1000);demoDistance+=run?demoRPM/60*628*elapsed:0;
        payload.measurement.coreStatus=run?'SPINNING':'IDLE';payload.measurement.rpmMilli=run?demoRPM*1000:0;payload.measurement.speedMmPerSecond=run?demoRPM/60*628:0;payload.measurement.distanceMm=Math.round(demoDistance);
      }
      demoAt=now;handle(payload?engine.ingest(payload,now):engine.fail('demo-cut',now));
    }
    async function startData(){cancelData();const gen=generation;engine=C.createEngine({session:C.newSession(config.reset)});supply=null;supplyLost=false;supplyAt=null;
      const next=await Store.openSession(settings,config.demo||options.preview===true);
      if(destroyed||gen!==generation){next.release();return;}coordinator=next;engine=C.createEngine({session:next.session});
      if(config.demo){feed=C.createDemoFeed(Date.now());demoAt=Date.now();demoTick();supply=feed.economy();const tick=()=>{if(gen!==generation)return;demoTick();schedule(tick,1000);};schedule(tick,1000);}else{pollStatus(gen);if(has('supply'))pollEconomy(gen);}render();
    }
    function frame(time){raf=0;if(destroyed||!stage||!motion())return;if(time-lastFrame>=1000/p.fps){stage.render(artState(),lastFrame?time-lastFrame:0);lastFrame=time;draws++;}raf=requestAnimationFrame(frame);}
    function restartFrames(){if(raf)cancelAnimationFrame(raf);raf=0;lastFrame=0;delete host.dataset.still;if(stage){stage.render(artState(),0);draws++;if(motion())raf=requestAnimationFrame(frame);}}
    function changeMotion(){restartFrames();render();}
    media.addEventListener('change',changeMotion);
    const observer=new ResizeObserver(()=>fit());observer.observe(host);
    const tick=setInterval(()=>{if(destroyed)return;const active=engine.signal()==='live'?queue.tick(Date.now()):null;if(active!==shown)show(active);render();if(options.onDiagnostics)options.onDiagnostics(diagnostics());},250);
    function diagnostics(){const r=engine.reading();return {source:source(),state:engine.signal(),lastSuccess:engine.lastSuccess(),observationAge:r&&r.observedAtMs!==null?Math.max(0,Date.now()-r.observedAtMs):null,poll:config.poll,events:events.slice(),queue:queue.pendingCount(),audio:audioState(),storage:coordinator?coordinator.state:'ephemeral',requestedScale:config.scale,effectiveScale,draws,requests,nodes:host.querySelectorAll('*').length,destroyed};}
    function update(next){if(destroyed||!S.validate(next))return;const restart=next.config.demo!==config.demo||next.config.poll!==config.poll||next.config.persist!==config.persist||next.config.reset!==config.reset||next.sessionId!==settings.sessionId||next.config.parts.includes('supply')!==has('supply');settings=S.clone(next);config=settings.config;p=settings.presentation;queue=C.createAlertQueue({durationMs:config.alertsec*1000,gapMs:500});build();if(restart)void startData();}
    function testAlert(kind){if(destroyed||engine.signal()!=='live'||!config.demo||!has('alerts')||!C.alertEnabled(config,kind))return false;manualUntil=Date.now()+(queue.pendingCount()+2)*(config.alertsec*1000+500);queue.push({kind,value:kind==='record'?4200:kind==='block'?8431:kind==='round'?1266:null});return true;}
    function demo(mode,rpm){if(destroyed||!config.demo)return;if(['automatic','running','sleeping','lost','restore'].includes(mode)){demoMode=mode==='restore'?'automatic':mode;if(mode==='restore'){feed=C.createDemoFeed(Date.now());}}if(Number.isFinite(rpm))demoRPM=Math.max(0,Math.min(120,rpm));demoTick();}
    function destroy(){if(destroyed)return;destroyed=true;cancelData();clearInterval(tick);if(raf)cancelAnimationFrame(raf);raf=0;observer.disconnect();media.removeEventListener('change',changeMotion);stopAudio();if(audio){void audio.close().catch(()=>{});audio=null;}host.replaceChildren();host.classList.remove('sq-root');}
    build();void startData();
    return {update,alert:testAlert,cut:(value=true)=>demo(value?'lost':'restore'),demo,clear:()=>{clear();manualUntil=Date.now()+30000;},soundTest:async(toneName)=>{manualUntil=Date.now()+30000;return tone('block',toneName);},destroy,diagnostics,canvas:()=>canvas};
  }
  root.SqueekRenderer={mount};
  if(document.body.classList.contains('standalone')){
    const host=document.createElement('div');document.body.prepend(host);
    let settings;try{settings=S.parse(location.search,document.body.dataset.page).settings;}catch(_){settings=S.defaults(document.body.dataset.page);settings.config.parts=[];}
    const renderer=mount(host,{settings});window.addEventListener('pagehide',()=>renderer.destroy(),{once:true});
  }
})(globalThis);
