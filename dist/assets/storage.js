/* Local-only versioned stores. Exclusive Web Locks prevent two same-ID writers. */
(function(root){
  'use strict';
  const C=root.SqueekCore,S=root.SqueekSettings;
  const PREFIX='squeektoshi.sessions.v2.';
  const memory=new Map();let status='saved';
  function read(key) {try {const raw=localStorage.getItem(key);return raw?JSON.parse(raw):memory.get(key)||null;}catch(_){status='memory';return memory.get(key)||null;}}
  function write(key,value) {memory.set(key,S.clone(value));try{localStorage.setItem(key,JSON.stringify(value));status='saved';return true;}catch(_){status='memory';return false;}}
  function loadProfiles(){const x=read('squeektoshi.profiles.v2');return x&&x.version===2&&Array.isArray(x.items)?x.items.filter(p=>p&&typeof p.id==='string'&&typeof p.name==='string'&&p.name.length<=48&&S.validate(p.settings)).slice(0,30):[];}
  function saveProfiles(items){return write('squeektoshi.profiles.v2',{version:2,items});}
  function loadDraft(){const x=read('squeektoshi.draft.v2');return x&&x.version===2&&S.validate(x.settings)?x:null;}
  function saveDraft(settings,ui){return write('squeektoshi.draft.v2',{version:2,settings,ui});}
  function sessions(){
    const result=[];
    try{for(let i=0;i<localStorage.length&&result.length<100;i++){const key=localStorage.key(i);if(key&&key.startsWith(PREFIX)){const x=read(key);if(validRecord(x)&&x.session.startedAt>0)result.push(x);}}}catch(_){status='memory';}
    return result.sort((a,b)=>b.updatedAt-a.updatedAt);
  }
  function validRecord(x){
    const token=v=>typeof v==='string'&&/^[A-Za-z0-9_-]{0,32}$/.test(v);
    const bounded=v=>typeof v==='number'&&Number.isFinite(v)&&v>=0&&v<=Number.MAX_SAFE_INTEGER;
    if(!x||x.version!==2||!token(x.id)||!x.id||!token(x.token)||!bounded(x.updatedAt)||!x.session||x.session.v!==1)return false;
    const s=x.session;if(!token(s.token)||s.token!==x.token)return false;
    for(const k of ['carryMm','runningMs','recordMm','savedAt','gaps','startedAt'])if(!bounded(s[k]))return false;
    for(const k of ['baselineMm','lastMm','runStartMm'])if(s[k]!==null&&!bounded(s[k]))return false;
    if(s.counterEpoch!==null&&(typeof s.counterEpoch!=='string'||s.counterEpoch.length>128))return false;
    return true;
  }
  function report(format){const rows=sessions().map(x=>({sessionId:x.id,resetToken:x.token,distanceMm:C.sessionView(x.session).distanceMm,runningMs:x.session.runningMs,bestMm:C.sessionView(x.session).recordMm,startedAt:new Date(x.session.startedAt||x.updatedAt).toISOString(),updatedAt:new Date(x.updatedAt).toISOString(),gaps:x.session.gaps||0}));
    if(format==='json')return JSON.stringify({version:2,scope:'this-browser-only',units:{distance:'mm',time:'ms'},sessions:rows},null,2);
    const headings=['sessionId','resetToken','distanceMm','runningMs','bestMm','startedAt','updatedAt','gaps'];
    return [headings.join(','),...rows.map(x=>headings.map(k=>'"'+String(x[k]).replaceAll('"','""')+'"').join(','))].join('\r\n');
  }
  function openSession(settings,disabled){
    const token=settings.config.reset==='1'?S.id():settings.config.reset;
    const key=PREFIX+settings.sessionId+'.'+(token||'keep');
    const load=()=>{const old=read(key);const session=C.resolveSession(validRecord(old)?old.session:null,token,Date.now());if(session.baselineMm!==null){C.breakContinuity(session);session.gaps++;}return session;};
    function handle(session,state,release){let closed=false;return {session,state,save(){if(closed||state!=='saved')return false;const ok=write(key,{version:2,id:settings.sessionId,token,updatedAt:Date.now(),session});if(!ok)this.state='memory';return ok;},release(){if(closed)return;closed=true;release();}};}
    if(disabled||!settings.config.persist)return Promise.resolve(handle(C.newSession(token),'ephemeral',()=>{}));
    // Without a locking API, deliberately keep a private in-memory session rather than risk corrupting a shared counter.
    if(!navigator.locks)return Promise.resolve(handle(load(),'memory',()=>{}));
    return new Promise(resolve=>{
      navigator.locks.request(key,{ifAvailable:true},lock=>{
        if(!lock){resolve(handle(C.newSession(token),'conflict',()=>{}));return;}
        return new Promise(release=>resolve(handle(load(),'saved',release)));
      }).catch(()=>resolve(handle(C.newSession(token),'memory',()=>{})));
    });
  }
  root.SqueekStorage={read,write,loadProfiles,saveProfiles,loadDraft,saveDraft,sessions,report,openSession,status:()=>status};
})(globalThis);
