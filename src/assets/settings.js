/* Versioned, bounded portable presentation. Imported objects are validated before any state changes. */
(function(root) {
  'use strict';
  const C = typeof module !== 'undefined' && module.exports ? require('./core.js') : root.SqueekCore;
  const VERSION = 2, URL_LIMIT = 16384, JSON_LIMIT = 32768;
  const FORMATS = {'1920x1080':[1920,1080], '1280x720':[1280,720], '1080x1920':[1080,1920], '1080x1080':[1080,1080], '480x270':[480,270]};
  const METRICS = ['rpm','speed','distance','work','block','round'];
  const clone = value => JSON.parse(JSON.stringify(value));
  function id() { return 's-' + crypto.randomUUID().replace(/-/g, '').slice(0, 24); }
  /** @returns {import('../../types/model').Presentation} */
  function presentation(page) {
    const boxes = /** @type {import('../../types/model').Presentation['boxes']} */ ({});
    C.PARTS.forEach((p,i) => { boxes[p] = {x: i === 0 ? 5 : 55, y: i === 0 ? 48 : 15 + i*12, w: i === 0 ? 40 : 36, scale:1}; });
    boxes.alerts = {x:10,y:0,w:80,scale:1};
    const sounds = /** @type {import('../../types/model').Presentation['sounds']} */ ({}), templates = /** @type {import('../../types/model').Presentation['templates']} */ ({en:{},tr:{}});
    C.ALERT_KINDS.forEach(k => {
      sounds[k] = {tone: k === 'sleep' ? 'soft' : k === 'record' ? 'arcade' : 'bell', level:70};
      ['en','tr'].forEach(l => { const t = C.strings(l).alerts[k]; templates[l][k] = {title:t[0],body:t[1]}; });
    });
    return {format:page === 'widget' ? '480x270':'1920x1080',layout:'legacy',inset:page === 'widget'?12:48,
      font:100,opacity:100,fps:30,metrics: page === 'widget' ? ['rpm','distance','block','round'] : METRICS.slice(),
      distance:'auto',speed:'m/s',colors:{panel:'',text:'',accent:''},boxes,
      alert:{pos:'auto',width:page === 'widget'?94:38,scale:100},sounds,templates,locked:false,snap:true};
  }
  /** @returns {import('../../types/model').Settings} */
  function defaults(page = 'scene') {
    return {version:2,page:page === 'widget'?'widget':'scene',sessionId:'legacy-'+page,
      config:C.parseParams('',page).config,presentation:presentation(page)};
  }
  function object(x) { return x && typeof x === 'object' && !Array.isArray(x); }
  function keys(x, allowed) { return object(x) && Object.keys(x).every(k=>allowed.includes(k)); }
  function number(x,min,max) { return typeof x === 'number' && Number.isFinite(x) && x>=min && x<=max; }
  function token(x) {return typeof x === 'string' && /^[A-Za-z0-9_-]{1,32}$/.test(x);}
  function template(x,limit) {
    if(typeof x !== 'string' || x.length>limit || /[\u0000-\u001f<>]/.test(x)) return false;
    return !/[{}]/.test(x.replaceAll('{value}',''));
  }
  function validPresentation(p, page) {
    const base=presentation(page);
    if(!keys(p,Object.keys(base)) || Object.keys(p).length!==Object.keys(base).length) return false;
    if(!Object.prototype.hasOwnProperty.call(FORMATS,p.format) || (page==='widget') !== (p.format==='480x270')) return false;
    if(!['legacy','horizontal','vertical','custom'].includes(p.layout) || !number(p.inset,0,120) || !number(p.font,75,150) || !number(p.opacity,0,100) || ![15,30].includes(p.fps)) return false;
    if(!Array.isArray(p.metrics) || p.metrics.length>6 || new Set(p.metrics).size!==p.metrics.length || p.metrics.some(k=>!METRICS.includes(k))) return false;
    if(!['auto','m','km'].includes(p.distance) || !['m/s','km/h'].includes(p.speed)) return false;
    if(!keys(p.colors,['panel','text','accent']) || Object.keys(p.colors).length!==3 || Object.values(p.colors).some(c=>c!=='' && (typeof c!=='string'||!/^#[0-9a-fA-F]{6}$/.test(c)))) return false;
    if(!keys(p.boxes,C.PARTS) || C.PARTS.some(k=>{
      const b=p.boxes[k]; return !keys(b,['x','y','w','scale']) || !number(b.x,0,100)||!number(b.y,0,100)||!number(b.w,10,100)||!number(b.scale,.5,2);
    })) return false;
    if(!keys(p.alert,['pos','width','scale']) || !['auto','custom',...C.POSITIONS].includes(p.alert.pos) || !number(p.alert.width,20,100)||!number(p.alert.scale,75,150)) return false;
    if(typeof p.locked!=='boolean'||typeof p.snap!=='boolean')return false;
    if(!keys(p.sounds,C.ALERT_KINDS)||C.ALERT_KINDS.some(k=>!keys(p.sounds[k],['tone','level'])||!['bell','soft','arcade','off'].includes(p.sounds[k].tone)||!number(p.sounds[k].level,0,100)))return false;
    if(!keys(p.templates,['en','tr'])||['en','tr'].some(l=>!keys(p.templates[l],C.ALERT_KINDS)||C.ALERT_KINDS.some(k=>{
      const t=p.templates[l][k]; return !keys(t,['title','body'])||!template(t.title,80)||!template(t.body,160);
    })))return false;
    return true;
  }
  function validate(s) {
    if(!keys(s,['version','page','sessionId','config','presentation'])||s.version!==VERSION||!['scene','widget'].includes(s.page)||!token(s.sessionId))return false;
    if(!keys(s.config,C.SPEC.map(x=>x.key))||Object.keys(s.config).length!==C.SPEC.length)return false;
    for(const spec of C.SPEC) {
      const v=s.config[spec.key];
      if(spec.type==='parts') { if(!Array.isArray(v)||v.length>6||new Set(v).size!==v.length||v.some(p=>!C.PARTS.includes(p)))return false; }
      else { const raw=spec.type==='bool'?(v?'1':'0'):String(v); const parsed=C.parseParam(spec.key,raw,s.page); if(parsed.issue||parsed.value!==v)return false; }
    }
    return validPresentation(s.presentation,s.page);
  }
  function encode(value) { return btoa(Array.from(new TextEncoder().encode(JSON.stringify(value)),b=>String.fromCharCode(b)).join('')).replaceAll('+','-').replaceAll('/','_').replace(/=+$/,''); }
  function decode(raw) {
    if(raw.length>URL_LIMIT || !/^[A-Za-z0-9_-]+$/.test(raw))throw Error('schema');
    return JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(Uint8Array.from(atob(raw.replaceAll('-','+').replaceAll('_','/')),c=>c.charCodeAt(0))));
  }
  /** @returns {{settings: import('../../types/model').Settings, issues: any[]}} */
  function parse(search, page='scene') {
    if(search.length>URL_LIMIT)throw Error('size');
    const q=new URLSearchParams(search), version=q.get('v');
    if(version!==null && version!=='2')throw Error('version');
    if(version!==null){const seen=new Set();for(const key of q.keys()){if(seen.has(key))throw Error('schema');seen.add(key);}}
    const s=defaults(page);
    const sid=q.get('sid'), packed=q.get('p');
    ['v','sid','p','page','ui'].forEach(k=>q.delete(k));
    const legacy=C.parseParams(q.toString(),page);if(version!==null&&legacy.issues.length)throw Error('schema');s.config=legacy.config;
    if(sid!==null){if(!token(sid))throw Error('schema');s.sessionId=sid;}
    if(packed!==null){if(version!=='2')throw Error('version');s.presentation=decode(packed);if(!validPresentation(s.presentation,page))throw Error('schema');}
    return {settings:s,issues:legacy.issues};
  }
  function query(s) {
    if(!validate(s))throw Error('schema');
    const q=new URLSearchParams(C.buildQuery(s.config,s.page));
    q.set('v','2');q.set('sid',s.sessionId);
    if(JSON.stringify(s.presentation)!==JSON.stringify(presentation(s.page)))q.set('p',encode(s.presentation));
    const result=q.toString().replaceAll('%2C',',');if(result.length>URL_LIMIT)throw Error('size');return result;
  }
  function url(s,base,setup=false,ui='en') {
    const u=new URL(setup?'index.html':C.PAGES[s.page].file,base);u.hash='';u.search=query(s);
    if(setup){u.searchParams.set('page',s.page);u.searchParams.set('ui',ui);}
    if(u.href.length>URL_LIMIT)throw Error('size');return u.href;
  }
  function readURL(text,base) {
    if(text.length>URL_LIMIT)throw Error('size');
    const u=new URL(text,base);if(!['http:','https:','file:'].includes(u.protocol))throw Error('schema');
    const file=u.pathname.split('/').pop();if(!['overlay.html','widget.html','index.html',''].includes(file))throw Error('schema');
    const page=file==='widget.html'||((file==='index.html'||file==='')&&u.searchParams.get('page')==='widget')?'widget':'scene';
    const result=parse(u.search,page);if(result.issues.length)throw Error('schema');return result.settings;
  }
  function exportJSON(s) {if(!validate(s))throw Error('schema');return JSON.stringify({app:'squeektoshi-overlay',version:2,settings:s},null,2);}
  function importJSON(raw) {
    if(new TextEncoder().encode(raw).length>JSON_LIMIT)throw Error('size');const x=JSON.parse(raw);
    if(!keys(x,['app','version','settings'])||x.app!=='squeektoshi-overlay'||x.version!==2||!validate(x.settings))throw Error('schema');
    return clone(x.settings);
  }
  function preset(name,current) {
    const page=name==='minimal'?'widget':'scene',s=defaults(page);
    s.sessionId=current.sessionId;s.config.reset=current.config.reset;s.config.persist=current.config.persist;
    s.config.sound=current.config.sound;s.config.volume=current.config.volume;s.config.lang=current.config.lang;
    if(name==='minimal')s.config.parts=['hamster','alerts'];
    if(name==='night'){s.config.theme='arcade';s.config.parts=['hamster','progress','alerts'];}
    if(name==='contrast')s.config.theme='contrast';
    if(name==='data')s.config.parts=['stats','progress','session','supply','alerts'];
    return s;
  }
  function luminance(hex) {
    const c=[1,3,5].map(i=>parseInt(hex.slice(i,i+2),16)/255).map(n=>n<=.04045?n/12.92:((n+.055)/1.055)**2.4);
    return c[0]*.2126+c[1]*.7152+c[2]*.0722;
  }
  function contrast(a,b){const x=luminance(a),y=luminance(b);return (Math.max(x,y)+.05)/(Math.min(x,y)+.05);}
  function colors(s) {
    const c=Object.assign({},C.THEMES[s.config.theme].ui);Object.entries(s.presentation.colors).forEach(([k,v])=>{if(v)c[k]=v;});
    if(s.presentation.colors.text)c.muted=c.text;
    c['on-accent']=contrast('#000000',c.accent)>contrast('#ffffff',c.accent)?'#000000':'#ffffff';return c;
  }
  function history(initial) {
    let list=[clone(initial)],index=0;
    return {push(value){if(JSON.stringify(list[index])===JSON.stringify(value))return;list=list.slice(0,index+1);list.push(clone(value));if(list.length>51)list.shift();index=list.length-1;},
      undo(){if(index>0)index--;return clone(list[index]);},redo(){if(index<list.length-1)index++;return clone(list[index]);},canUndo(){return index>0;},canRedo(){return index<list.length-1;}};
  }
  const api={VERSION,URL_LIMIT,JSON_LIMIT,FORMATS,METRICS,clone,id,defaults,presentation,validate,parse,query,url,readURL,exportJSON,importJSON,preset,contrast,colors,history};
  if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.SqueekSettings=api;
})(globalThis);
