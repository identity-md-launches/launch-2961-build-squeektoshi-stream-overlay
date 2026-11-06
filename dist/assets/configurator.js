/* Local configurator. The stream renderer receives presentation only; editor chrome stays outside its root. */
(function(){
  'use strict';
  const C=window.SqueekCore,S=window.SqueekSettings,Store=window.SqueekStorage,R=window.SqueekRenderer;
  const app=document.getElementById('app');
  /** @type {import('../../types/model').Settings} */ let state;
  const qs=new URLSearchParams(location.search),draft=Store.loadDraft();
  let ui=qs.get('ui')==='tr'?'tr':draft&&draft.ui==='tr'?'tr':'en',initialError=false;
  try{state=location.search?S.parse(location.search,qs.get('page')==='widget'?'widget':'scene').settings:draft?draft.settings:S.defaults();}catch(_){state=draft?S.clone(draft.settings):S.defaults();initialError=true;}
  if(!location.search&&!draft)state.sessionId=S.id();
  let profiles=Store.loadProfiles(),profileId='',renderer=null,livePreview=false,previewMode='close',previewBg='checker',safe=false,grid=false,edit=false,selected='hamster',demoMode='automatic',demoRPM=48;
  let history=S.history({settings:state,profiles,profileId}),gesture=false,diagnostic=null,previewScale=1,layoutObserver=null,alertObserver=null,alertShown=false,fitRAF=0;
  let refs={},openSections=new Set(),pageStarted=performance.now();
  const t=(en,tr)=>ui==='tr'?tr:en;
  /** @template {keyof HTMLElementTagNameMap} K @param {K} tag @param {string} [cls] @param {string} [text] @returns {HTMLElementTagNameMap[K]} */
  function el(tag,cls='',text){const n=document.createElement(tag);n.className=cls;if(text!==undefined)n.textContent=text;return n;}
  function button(label,id,fn,cls=''){const b=el('button',cls,label);b.type='button';if(id)b.id=id;b.addEventListener('click',fn);return b;}
  function link(label,url,cls=''){const a=el('a',cls,label);a.href=url;return a;}
  function hint(parent,text){const n=el('p','hint',text);parent.append(n);return n;}
  function row(parent,...nodes){const n=el('div','actions');n.append(...nodes);parent.append(n);return n;}
  function get(path){return path.split('.').reduce((a,k)=>a[k],state);}
  function put(path,value){const keys=path.split('.'),last=keys.pop();let dest=state;keys.forEach(k=>{dest=dest[k];});dest[last]=value;}
  function record(){history.push({settings:state,profiles,profileId});}
  function msg(text,error=false){if(refs.message){refs.message.textContent=text;refs.message.classList.toggle('error',error);}}
  function apply(next,rebuild=false){if(!S.validate(next)){msg(t('Use values within the limits shown. Settings were kept.','Gösterilen sınırlar içinde değerler kullanın. Ayarlar korundu.'),true);return;}state=S.clone(next);record();if(rebuild)build();else refresh();}
  function field(parent,label,id,type,value,change,options){
    const wrap=el('div','field'),lab=el('label','field-label',label);lab.htmlFor=id;wrap.append(lab);
    const input=type==='select'?el('select'):type==='textarea'?el('textarea'):el('input');input.id=id;
    if(input instanceof HTMLInputElement)input.type=type;
    if(type==='select')options.forEach(([v,l])=>{const opt=el('option','',l);opt.value=String(v);input.append(opt);});
    input.value=String(value);wrap.append(input);parent.append(wrap);
    if(change)input.addEventListener('change',()=>change(input.value,input));
    return input;
  }
  /** Snap to a step and drop binary float residue, so 0.05 steps give 1.65 rather than 1.6500000000000001. */
  function snap(n,step){const places=(String(step).split('.')[1]||'').length;return Number((Math.round(n/step)*step).toFixed(places));}
  function bound(parent,label,id,path,min,max,step=1,range=false){
    const input=field(parent,label,id,range?'range':'number',get(path),(v,node)=>{
      const n=Number(v);if(v===''||!Number.isFinite(n)||n<min||n>max){node.setAttribute('aria-invalid','true');msg(t(`Use a number from ${min} to ${max}.`,` ${min} ile ${max} arasında bir sayı kullanın.`),true);return;}
      node.removeAttribute('aria-invalid');put(path,snap(n,step));record();refresh();
    });
    input.setAttribute('min',String(min));input.setAttribute('max',String(max));input.setAttribute('step',String(step));
    input.setAttribute('aria-describedby',id+'-hint');const info=el('span','hint',`${min}–${max}`);info.id=id+'-hint';input.parentElement.append(info);
    if(range){input.addEventListener('input',()=>{put(path,snap(Number(input.value),step));refresh(false);info.textContent=input.value;});}
    return input;
  }
  function choice(parent,label,id,path,options){return field(parent,label,id,'select',get(path),(v)=>{put(path,v);record();refresh();},options);}
  function check(parent,label,id,value,change){const wrap=el('label','check'),input=el('input');input.type='checkbox';input.id=id;input.checked=value;input.addEventListener('change',()=>change(input.checked));wrap.append(input,el('span','',label));parent.append(wrap);return input;}
  function checkPath(parent,label,id,path){return check(parent,label,id,get(path),v=>{put(path,v);record();refresh();});}
  function section(parent,label,id){const d=el('details');d.id=id;d.open=openSections.has(id);d.append(el('summary','',label));const body=el('div','section-body');d.append(body);parent.append(d);d.addEventListener('toggle',()=>{if(d.open)openSections.add(id);else openSections.delete(id);});return body;}
  function fields(parent){const n=el('div','fields');parent.append(n);return n;}
  const partName=part=>({hamster:t('Hamster / status','Hamster / durum'),stats:t('Stats','İstatistikler'),progress:t('Progress','İlerleme'),session:t('Session','Oturum'),supply:t('Supply','Arz'),alerts:t('Alerts','Uyarılar')})[part];
  const kindName=kind=>({wake:t('Wake-up','Uyanma'),sleep:t('Sleep','Uyku'),block:t('Block','Blok'),round:t('Round','Tur'),record:t('Record','Rekor')})[kind];
  const positions=()=>[['top-left',t('Top left','Sol üst')],['top',t('Top','Üst')],['top-right',t('Top right','Sağ üst')],['left',t('Left','Sol')],['right',t('Right','Sağ')],['bottom-left',t('Bottom left','Sol alt')],['bottom',t('Bottom','Alt')],['bottom-right',t('Bottom right','Sağ alt')]];
  function resetSection(keys){const base=S.defaults(state.page);keys.forEach(k=>{put(k,k.split('.').reduce((v,key)=>v[key],base));});record();build();}
  function build(){
    const focusedId=document.activeElement instanceof HTMLElement?document.activeElement.id:'';
    if(renderer){renderer.destroy();renderer=null;}if(layoutObserver)layoutObserver.disconnect();if(alertObserver)alertObserver.disconnect();alertShown=false;if(fitRAF)cancelAnimationFrame(fitRAF);
    app.replaceChildren();refs={};document.documentElement.lang=ui;
    app.append(link(t('Skip to settings','Ayarlara geç'),'#settings','skip'));
    const header=el('header','top'),brand=el('div','brand'),icon=el('img');icon.src='assets/favicon.svg';icon.alt='';brand.append(icon,el('h1','','Squeektoshi Stream Overlay'));header.append(brand);
    const utilities=el('div','utilities');utilities.append(link(t('Setup guide','Kurulum rehberi'),'#setup'));
    const language=field(utilities,t('Interface','Arayüz'),'ui-lang','select',ui,v=>{ui=v;Store.saveDraft(state,ui);build();},[['en','English'],['tr','Türkçe']]);header.append(utilities);app.append(header);
    const main=el('main','layout'),left=el('section','stagearea');left.setAttribute('aria-label',t('Preview and browser source','Önizleme ve tarayıcı kaynağı'));main.append(left);app.append(main);
    left.append(el('p','intro',t('A live hamster companion. Rest is healthy, too.','Canlı hamster arkadaşınız. Dinlenmek de sağlıklıdır.')));
    const quick=el('div','quick');quick.setAttribute('aria-label',t('Choose what appears','Görünümü seçin'));
    [['hamster',t('Hamster only','Yalnız hamster')],['essentials',t('Hamster + essentials','Hamster + temel')],['full',t('Full scene','Tam sahne')]].forEach(([key,label])=>{
      quick.append(button(label,'quick-'+key,()=>{const next=S.clone(state);if(key==='hamster'){next.page='widget';next.presentation=S.presentation('widget');next.config.parts=['hamster','alerts'];next.config.pos='bottom-right';}else{next.page='scene';next.presentation=S.presentation('scene');next.config.parts=key==='full'?C.DEFAULT_PARTS.slice():['hamster','progress','alerts'];next.config.pos='bottom-left';}apply(next,true);}));
    });left.append(quick);
    const ph=el('div','preview-head');ph.append(el('h2','',t('Preview','Önizleme')));refs.previewLabel=el('span');ph.append(refs.previewLabel);left.append(ph);
    const preview=el('div','preview');preview.id='preview-frame';preview.tabIndex=0;preview.setAttribute('aria-label',t('Overlay preview; scroll when enlarged','Kaplama önizlemesi; büyütüldüğünde kaydırın'));refs.preview=preview;
    const space=el('div');space.style.position='relative';refs.space=space;const inner=el('div','preview-inner');refs.inner=inner;const host=el('div','preview-output');host.id='preview';refs.host=host;const editor=el('div','editor-layer');refs.editor=editor;inner.append(host,editor);space.append(inner);preview.append(space);
    refs.empty=el('div','empty-state');refs.empty.hidden=true;preview.append(refs.empty);left.append(preview);
    const actions=el('div','preview-tools');['running','sleeping','lost','restore','automatic'].forEach(mode=>{
      const label={running:t('Try running','Koşmayı dene'),sleeping:t('Try sleeping','Uykuyu dene'),lost:t('Lose signal','Sinyali kes'),restore:t('Restore','Geri getir'),automatic:t('Automatic','Otomatik')}[mode];
      const b=button(label,mode==='lost'?'cut':'demo-'+mode,()=>{demoMode=mode;renderer.demo(mode,demoRPM);syncDemoButtons();});b.dataset.demo=mode;actions.append(b);
    });left.append(actions);
    const output=el('div','output');row(output,button(t('Copy OBS URL','OBS URL’sini kopyala'),'copy',()=>copy(false),'primary'),link(t('Open overlay','Kaplamayı aç'),'#','btn'));refs.open=output.querySelector('a');refs.open.id='open';refs.open.target='_blank';refs.open.rel='noopener';
    refs.size=el('p','hint');refs.size.id='size-hint';output.append(refs.size);refs.message=el('p','notice');refs.message.id='copy-status';refs.message.setAttribute('role','status');output.append(refs.message);left.append(output);
    const linkSection=section(left,t('Links and preview options','Bağlantılar ve önizleme seçenekleri'),'preview-options');
    refs.url=field(linkSection,t('OBS browser-source URL','OBS tarayıcı kaynağı URL’si'),'url','textarea','',null);refs.url.readOnly=true;refs.url.rows=3;refs.url.classList.add('url-output');
    row(linkSection,button(t('Copy setup link','Kurulum bağlantısını kopyala'),'copy-setup',()=>copy(true)));
    const previewFields=fields(linkSection);
    field(previewFields,t('View','Görünüm'),'preview-view','select',previewMode,v=>{previewMode=v;fitPreview();},[['fit',t('Fit full output','Tüm çıktıyı sığdır')],['close',t('Close-up','Yakın görünüm')],['scroll',t('Actual size / scroll','Gerçek boyut / kaydır')]]);
    field(previewFields,t('Background','Arka plan'),'preview-bg','select',previewBg,v=>{previewBg=v;refresh(false);},[['checker',t('Checkerboard','Dama')],['light',t('Light','Açık')],['dark',t('Dark','Koyu')]]);
    check(linkSection,t('Show safe guides (preview only)','Güvenli alanı göster (yalnız önizleme)'),'safe',safe,v=>{safe=v;refresh(false);});
    check(linkSection,t('Preview live API data','Canlı API verilerini önizle'),'preview-live',livePreview,v=>{livePreview=v;demoMode='automatic';refresh();});
    hint(linkSection,t('Preview demo never changes the output URL or a saved session. Close-up and guides are editor-only.','Önizleme demosu çıktı URL’sini veya kayıtlı oturumu değiştirmez. Yakın görünüm ve kılavuzlar yalnız düzenleyicidedir.'));
    const rpm=field(linkSection,t('Demo RPM (0–120)','Demo RPM (0–120)'),'demo-rpm','range',demoRPM,(v)=>{demoRPM=Number(v);renderer.demo(demoMode==='sleeping'?'sleeping':'running',demoRPM);});rpm.setAttribute('min','0');rpm.setAttribute('max','120');rpm.addEventListener('input',()=>{demoRPM=Number(rpm.value);demoMode='running';renderer.demo('running',demoRPM);});refs.rpm=rpm;
    refs.fit=el('p','hint');linkSection.append(refs.fit);
    const tests=section(left,t('Test alerts and sound','Uyarıları ve sesi dene'),'test-section');const testButtons=el('div','actions');testButtons.id='test-buttons';
    C.ALERT_KINDS.forEach(k=>{const b=button(t('Test ','Dene: ')+kindName(k),'test-'+k,()=>{renderer.alert(k);});b.dataset.alert=k;testButtons.append(b);});tests.append(testButtons);
    row(tests,button(t('Run all five','Beşini de çalıştır'),'run-all',()=>{C.ALERT_KINDS.forEach(k=>renderer.alert(k));}),button(t('Clear queue','Kuyruğu temizle'),'clear-queue',()=>renderer.clear()));
    row(tests,...['bell','soft','arcade'].map(tone=>button(t('Test ','Dene: ')+({bell:t('bell','çan'),soft:t('soft tone','yumuşak ses'),arcade:t('arcade tone','oyun sesi')})[tone],'sound-'+tone,async()=>{const ok=await renderer.soundTest(tone);msg(ok?t('Sound played.','Ses çalındı.'):t('Enable master sound, then test while the preview is connected. Browser audio permission may also be needed.','Ana sesi açın, ardından önizleme bağlıyken deneyin. Tarayıcı ses izni de gerekebilir.'),!ok);}))); 
    hint(tests,t('Manual tests pause automatic demo alerts. Event switches and master sound apply. First load and recovery are silent.','Manuel testler otomatik demo uyarılarını duraklatır. Olay anahtarları ve ana ses geçerlidir. İlk yükleme ve bağlantının dönüşü sessizdir.'));
    const settings=el('form','settings');settings.id='settings';settings.tabIndex=-1;settings.addEventListener('submit',e=>e.preventDefault());main.append(settings);settings.append(el('h2','',t('Make it yours','Kendinize göre ayarlayın')));
    const hist=el('div','history');refs.undo=button(t('Undo','Geri al'),'undo',()=>restore(history.undo()));refs.redo=button(t('Redo','Yinele'),'redo',()=>restore(history.redo()));hist.append(refs.undo,refs.redo,button(t('Reset settings','Ayarları sıfırla'),'reset-all',()=>{const next=S.defaults(state.page);next.sessionId=state.sessionId;next.config.reset=state.config.reset;next.config.persist=state.config.persist;apply(next,true);}));settings.append(hist);
    buildLook(settings);buildLayout(settings);buildAlerts(settings);buildProfiles(settings);buildSession(settings);buildTransfer(settings);
    const below=el('section','below');app.append(below);buildGuide(below);buildDiagnostics(below);buildDownloads(below);
    const footer=el('footer');footer.append(el('span','',t('Squeekchain · WHEELY9000 · No accounts or tracking','Squeekchain · WHEELY9000 · Hesap veya izleme yok')),link(t('Project source','Proje kaynağı'),'https://github.com/identity-md-launches/launch-2961-build-squeektoshi-stream-overlay'));app.append(footer);
    renderer=R.mount(host,{settings:previewSettings(),preview:true,onDiagnostics:d=>{diagnostic=d;updateDiagnostics();if(!refs.editor.contains(document.activeElement))positionHandles();}});
    layoutObserver=new ResizeObserver(()=>fitPreview());layoutObserver.observe(preview);
    alertObserver=new MutationObserver(()=>{const on=!!host.querySelector('.sq-alert.is-on');if(on!==alertShown){alertShown=on;if(previewMode==='close')fitPreview();}});alertObserver.observe(host,{subtree:true,attributes:true,attributeFilter:['class']});
    refresh(false);fitPreview();if(focusedId){const target=document.getElementById(focusedId);if(target)target.focus({preventScroll:true});}if(initialError){msg(t('This link is oversized or unsupported. Defaults are shown; no saved settings were changed.','Bu bağlantı çok büyük veya desteklenmiyor. Varsayılanlar gösteriliyor; kayıtlı ayarlar değiştirilmedi.'),true);initialError=false;}
  }
  function buildLook(parent){
    const body=section(parent,t('Look, format and data','Görünüm, biçim ve veri'),'look');
    field(body,t('Editable preset','Düzenlenebilir hazır ayar'),'preset','select','',v=>{if(v)apply(S.preset(v,state),true);},[['',t('Choose a starting point','Başlangıç noktası seçin')],['minimal',t('Minimal · hamster + alerts','Minimal · hamster + uyarı')],['broadcast',t('Broadcast · full scene','Yayın · tam sahne')],['night',t('Night · arcade + progress','Gece · oyun + ilerleme')],['contrast',t('High contrast','Yüksek kontrast')],['data',t('Data · no hamster','Veri · hamstersız')]]);
    const a=fields(body);
    field(a,t('Output size','Çıktı boyutu'),'format','select',state.presentation.format,v=>{const next=S.clone(state);const newPage=v==='480x270'?'widget':'scene';if(newPage!==next.page){next.presentation=S.presentation(newPage);next.config.pos=newPage==='widget'?'bottom-right':'bottom-left';}next.page=newPage;next.presentation.format=v;apply(next,true);},Object.keys(S.FORMATS).map(k=>[k,k.replace('x',' × ')]));
    field(a,t('Stream language','Yayın dili'),'lang','select',state.config.lang,v=>{state.config.lang=v;record();build();},[['en','English'],['tr','Türkçe']]);
    choice(a,t('Theme','Tema'),'theme','config.theme',[['burrow',t('Burrow','Yuva')],['arcade',t('Arcade','Oyun')],['paper',t('Paper','Kağıt')],['contrast',t('High contrast','Yüksek kontrast')]]);
    field(a,t('Frame rate','Kare hızı'),'fps','select',state.presentation.fps,v=>{state.presentation.fps=v==='15'?15:30;record();refresh();},[[15,'15 FPS'],[30,'30 FPS']]);
    const partSet=el('fieldset');partSet.append(el('legend','',t('Parts to show','Gösterilecek parçalar')));const partChecks=el('div','checks');C.PARTS.forEach(k=>check(partChecks,partName(k),'part-'+k,state.config.parts.includes(k),v=>{state.config.parts=v?[...state.config.parts,k]:state.config.parts.filter(x=>x!==k);record();refresh();}));partSet.append(partChecks);body.append(partSet);
    const metrics=el('fieldset');metrics.append(el('legend','',t('Individual stats','Tek tek istatistikler')));const mc=el('div','checks');S.METRICS.forEach(k=>check(mc,C.strings(ui)[k],'metric-'+k,state.presentation.metrics.includes(k),v=>{state.presentation.metrics=v?[...state.presentation.metrics,k]:state.presentation.metrics.filter(x=>x!==k);record();refresh();}));metrics.append(mc);body.append(metrics);
    const units=fields(body);choice(units,t('Distance unit','Mesafe birimi'),'distance-unit','presentation.distance',[['auto',t('Automatic','Otomatik')],['m','m'],['km','km']]);choice(units,t('Speed unit','Hız birimi'),'speed-unit','presentation.speed',[['m/s','m/s'],['km/h','km/h']]);
    const ranges=fields(body);bound(ranges,t('Requested scale','İstenen ölçek'),'scale','config.scale',.5,3,.05,true);bound(ranges,t('Inset in output pixels','Çıktı pikselinde kenar boşluğu'),'inset','presentation.inset',0,120);bound(ranges,t('Text size (%)','Metin boyutu (%)'),'font','presentation.font',75,150);bound(ranges,t('Panel opacity (%)','Panel opaklığı (%)'),'opacity','presentation.opacity',0,100);
    checkPath(body,t('Animate the hamster','Hamsteri hareketlendir'),'motion','config.motion');
    hint(body,t('Reduced motion freezes decoration while values keep updating. Transparent panels depend on the video behind them. Text and art remain opaque.','Azaltılmış hareket süslemeyi durdurur, veriler güncellenir. Saydam paneller arkadaki videoya bağlıdır. Metin ve çizim opak kalır.'));
    const colors=fields(body);['panel','text','accent'].forEach(k=>field(colors,({panel:t('Panel HEX','Panel HEX'),text:t('Text HEX','Metin HEX'),accent:t('Accent HEX','Vurgu HEX')})[k],'color-'+k,'text',state.presentation.colors[k],(v,input)=>{if(v!==''&&!/^#[0-9a-fA-F]{6}$/.test(v)){input.setAttribute('aria-invalid','true');msg(t('Use # plus six HEX digits, or leave empty for the theme.','# ve altı HEX hanesi kullanın veya tema için boş bırakın.'),true);return;}input.removeAttribute('aria-invalid');state.presentation.colors[k]=v;record();refresh();}));
    refs.contrast=el('p','hint');body.append(refs.contrast);row(body,button(t('Reset colors','Renkleri sıfırla'),'reset-colors',()=>resetSection(['presentation.colors'])),button(t('Reset look','Görünümü sıfırla'),'reset-look',()=>resetSection(['config.theme','config.scale','config.parts','presentation.font','presentation.inset','presentation.opacity','presentation.metrics'])));
  }
  function buildLayout(parent){
    const body=section(parent,t('Arrange the overlay','Kaplamayı düzenle'),'arrange');
    field(body,t('Grouped position','Grup konumu'),'pos','select',state.config.pos,v=>{state.config.pos=v;state.presentation.layout='legacy';record();build();},positions());
    field(body,t('Layout','Düzen'),'layout','select',state.presentation.layout,v=>{state.presentation.layout=v;record();refresh();},[['legacy',t('Original grouped layout','Orijinal grup düzeni')],['horizontal',t('Horizontal group','Yatay grup')],['vertical',t('Vertical group','Dikey grup')],['custom',t('Custom positions','Özel konumlar')]]);
    check(body,t('Drag parts in the preview','Önizlemede parçaları sürükle'),'edit-layout',edit,v=>{edit=v;refresh(false);});
    checkPath(body,t('Lock layout','Düzeni kilitle'),'layout-lock','presentation.locked');checkPath(body,t('Snap to a 5% grid','%5 ızgaraya yasla'),'snap','presentation.snap');check(body,t('Show preview grid','Önizleme ızgarasını göster'),'grid',grid,v=>{grid=v;refresh(false);});
    field(body,t('Selected part','Seçili parça'),'selected-part','select',selected,v=>{selected=v;build();},C.PARTS.map(k=>[k,partName(k)]));
    const a=fields(body);bound(a,t('Horizontal position (%)','Yatay konum (%)'),'box-x','presentation.boxes.'+selected+'.x',0,100);bound(a,t('Vertical position (%)','Dikey konum (%)'),'box-y','presentation.boxes.'+selected+'.y',0,100);bound(a,t('Width (%)','Genişlik (%)'),'box-w',selected==='alerts'?'presentation.alert.width':'presentation.boxes.'+selected+'.w',selected==='alerts'?20:10,100);bound(a,t('Part scale','Parça ölçeği'),'box-scale',selected==='alerts'?'presentation.alert.scale':'presentation.boxes.'+selected+'.scale',selected==='alerts'?75:.5,selected==='alerts'?150:2,selected==='alerts'?1:.05);
    hint(body,t('Choose Custom positions for numeric edits. Drag handles also work with arrow keys (Shift: 5%). Test an alert to show its drag handle. Alerts reserve separate space. Position presets restore the group.','Sayısal düzenleme için Özel konumları seçin. Sürükleme tutamaçları ok tuşlarıyla da çalışır (Shift: %5). Uyarı tutamacını görmek için bir uyarıyı deneyin. Uyarılar ayrı alan ayırır. Konum hazır ayarları grubu geri getirir.'));
    row(body,...[['left',0],['center',50],['right',100]].map(([name,n])=>button(({left:t('Align left','Sola hizala'),center:t('Center','Ortala'),right:t('Align right','Sağa hizala')})[name],'align-'+name,()=>{if(state.presentation.locked)return;state.presentation.layout='custom';state.presentation.boxes[selected].x=n;record();build();})));
    row(body,button(t('Reset placement','Yerleşimi sıfırla'),'reset-layout',()=>resetSection(['presentation.layout','presentation.boxes','config.pos','presentation.alert'])));
  }
  function buildAlerts(parent){
    const body=section(parent,t('Alerts, text and sound','Uyarılar, metin ve ses'),'alerts');
    const a=fields(body);bound(a,t('Alert duration (seconds)','Uyarı süresi (saniye)'),'alertsec','config.alertsec',2,15);choice(a,t('Alert position','Uyarı konumu'),'alert-pos','presentation.alert.pos',[['auto',t('Opposite the group','Grubun karşısı')],...positions(),['custom',t('Custom / drag','Özel / sürükle')]]);bound(a,t('Alert width (%)','Uyarı genişliği (%)'),'alert-width','presentation.alert.width',20,100);bound(a,t('Alert text size (%)','Uyarı metni boyutu (%)'),'alert-scale','presentation.alert.scale',75,150);
    hint(body,t('Widget alerts widen and reduce text to at least 12 px when needed to keep long messages readable.','Uzun mesajları okunabilir tutmak için bileşen uyarıları gerektiğinde genişler; metin en az 12 piksel kalır.'));
    checkPath(body,t('Master sound on','Ana ses açık'),'sound','config.sound');bound(body,t('Master volume (%)','Ana ses düzeyi (%)'),'volume','config.volume',0,100,1,true);
    hint(body,t('Sound starts off. Use a sound test to grant browser audio permission. Master off always means silence.','Ses kapalı başlar. Tarayıcı ses izni için ses testini kullanın. Ana ses kapalıysa daima sessizdir.'));
    C.ALERT_KINDS.forEach(k=>{
      const group=el('fieldset');group.append(el('legend','',kindName(k)));checkPath(group,t('Show this event','Bu olayı göster'),'alert_'+k,'config.alert_'+k);
      const f=fields(group);choice(f,t('Tone','Ses'),'tone-'+k,'presentation.sounds.'+k+'.tone',[['bell',t('Bell','Çan')],['soft',t('Soft','Yumuşak')],['arcade',t('Arcade','Oyun')],['off',t('Silent','Sessiz')]]);bound(f,t('Event level (%)','Olay düzeyi (%)'),'level-'+k,'presentation.sounds.'+k+'.level',0,100);
      ['title','body'].forEach(key=>{
        const input=field(group,(key==='title'?t('Title','Başlık'):t('Message','Mesaj'))+' · '+state.config.lang.toUpperCase(),'template-'+k+'-'+key,'text',state.presentation.templates[state.config.lang][k][key],(v,node)=>{const next=S.clone(state);next.presentation.templates[state.config.lang][k][key]=v;if(!S.validate(next)){node.setAttribute('aria-invalid','true');msg(t('Use plain text, up to 80 title / 160 message characters. Only {value} is allowed as a placeholder.','Düz metin kullanın: başlık en çok 80, mesaj 160 karakter. Yalnız {value} yer tutucusuna izin verilir.'),true);return;}node.removeAttribute('aria-invalid');apply(next);});input.setAttribute('maxlength',key==='title'?'80':'160');
      });body.append(group);
    });
    hint(body,t('Edit templates in the stream language. {value} becomes the event value; missing values show a dash. Rest is healthy.','Şablonları yayın dilinde düzenleyin. {value} olay değerine dönüşür; eksik değerlerde çizgi gösterilir. Dinlenmek sağlıklıdır.'));
    row(body,button(t('Reset alert settings','Uyarı ayarlarını sıfırla'),'reset-alerts',()=>resetSection(['presentation.templates','presentation.sounds','presentation.alert','config.alertsec','config.sound','config.volume','config.alert_wake','config.alert_sleep','config.alert_block','config.alert_round','config.alert_record'])));
  }
  function buildProfiles(parent){
    const body=section(parent,t('Profiles saved in this browser','Bu tarayıcıda kayıtlı profiller'),'profiles');
    field(body,t('Profile','Profil'),'profile','select',profileId,v=>{const profile=profiles.find(p=>p.id===v);if(profile){profileId=v;apply(profile.settings,true);}},[['',t('Current draft','Geçerli taslak')],...profiles.map(p=>[p.id,p.name])]);
    refs.profileName=field(body,t('Profile name','Profil adı'),'profile-name','text',profiles.find(p=>p.id===profileId)?.name||'',null);refs.profileName.maxLength=48;
    const name=()=>refs.profileName.value.trim().slice(0,48);
    row(body,button(t('Create profile','Profil oluştur'),'profile-create',()=>{if(!name()){msg(t('Enter a profile name.','Bir profil adı girin.'),true);return;}if(profiles.length>=30){msg(t('Keep up to 30 profiles. Delete one to add another.','En çok 30 profil tutulabilir. Yenisi için birini silin.'),true);return;}const next=S.clone(state);next.sessionId=S.id();profileId=S.id();profiles.push({id:profileId,name:name(),settings:next});apply(next,true);}),button(t('Save','Kaydet'),'profile-save',()=>{const profile=profiles.find(p=>p.id===profileId);if(!profile){msg(t('Create a profile first.','Önce bir profil oluşturun.'),true);return;}profile.settings=S.clone(state);record();refresh();msg(t('Profile saved in this browser.','Profil bu tarayıcıya kaydedildi.'));}));
    row(body,button(t('Copy profile','Profili kopyala'),'profile-copy',()=>{if(profiles.length>=30)return;const next=S.clone(state);next.sessionId=S.id();profileId=S.id();profiles.push({id:profileId,name:((name()||t('Profile','Profil'))+t(' copy',' kopya')).slice(0,48),settings:next});apply(next,true);}),button(t('Rename','Yeniden adlandır'),'profile-rename',()=>{const profile=profiles.find(p=>p.id===profileId);if(profile&&name()){profile.name=name();record();build();}}),button(t('Delete profile','Profili sil'),'profile-delete',()=>{if(!profileId)return;if(!confirm(t('Delete this profile? Undo can restore it. Saved sessions remain.','Bu profil silinsin mi? Geri al ile kurtarabilirsiniz. Kayıtlı oturumlar korunur.')))return;profiles=profiles.filter(p=>p.id!==profileId);profileId='';record();build();}));
    hint(body,t('Visual edits keep the session ID. Profile copies get a new one. The valid draft restores after reload; undo keeps 50 changes.','Görsel düzenlemeler oturum kimliğini korur. Profil kopyaları yeni kimlik alır. Geçerli taslak yeniden yüklenince geri gelir; geri alma 50 değişiklik tutar.'));
  }
  function buildSession(parent){
    const body=section(parent,t('Data, sessions and reports','Veri, oturumlar ve raporlar'),'session-data');
    bound(body,t('Poll interval (seconds)','Sorgu aralığı (saniye)'),'poll','config.poll',5,10);
    field(body,t('Session ID','Oturum kimliği'),'session-id','text',state.sessionId,(v,node)=>{if(!/^[A-Za-z0-9_-]{1,32}$/.test(v)){node.setAttribute('aria-invalid','true');msg(t('Use 1–32 letters, digits, dashes or underscores.','1–32 harf, rakam, tire veya alt çizgi kullanın.'),true);return;}node.removeAttribute('aria-invalid');state.sessionId=v;record();refresh();});
    field(body,t('Reset token','Sıfırlama belirteci'),'reset','text',state.config.reset,(v,node)=>{const parsed=C.parseParam('reset',v,state.page);if(parsed.issue){node.setAttribute('aria-invalid','true');msg(t('Use up to 32 letters, digits, dashes or underscores.','En çok 32 harf, rakam, tire veya alt çizgi kullanın.'),true);return;}node.removeAttribute('aria-invalid');state.config.reset=parsed.value;record();refresh();});
    row(body,button(t('Create reset URL','Sıfırlama URL’si oluştur'),'new-token',()=>{state.config.reset=S.id();record();build();msg(t('New reset token added to the URL. Copy it into OBS and reload the source to apply.','URL’ye yeni belirteç eklendi. Uygulamak için OBS’ye kopyalayıp kaynağı yeniden yükleyin.'));}),button(t('New session ID','Yeni oturum kimliği'),'new-session',()=>{state.sessionId=S.id();record();build();}));
    checkPath(body,t('Save measured sessions locally','Ölçülen oturumları yerel kaydet'),'persist','config.persist');
    checkPath(body,t('Use demo data in the OUTPUT URL','ÇIKTI URL’sinde demo verisi kullan'),'demo','config.demo');
    hint(body,t('Only this browser’s saved live sessions appear below. OBS and this browser may have separate storage. A new URL never remotely resets OBS. Identical IDs allow one writer; conflicting sources stay in memory.','Aşağıda yalnız bu tarayıcının kayıtlı canlı oturumları görünür. OBS ile bu tarayıcının depolaması ayrı olabilir. Yeni URL, OBS’yi uzaktan sıfırlamaz. Aynı kimlikte tek yazıcı olur; çakışan kaynaklar bellekte kalır.'));
    refs.report=el('div','report');body.append(refs.report);row(body,button(t('Refresh report','Raporu yenile'),'report-refresh',renderReport),button(t('Download JSON report','JSON raporunu indir'),'report-json',()=>download(Store.report('json'),'squeektoshi-sessions.json','application/json')),button(t('Download CSV report','CSV raporunu indir'),'report-csv',()=>download(Store.report('csv'),'squeektoshi-sessions.csv','text/csv')));renderReport();
  }
  function buildTransfer(parent){
    const body=section(parent,t('Import, export and URL check','İçe / dışa aktarma ve URL denetimi'),'transfer');
    const input=field(body,t('Version 2 settings JSON (32 KiB maximum)','Sürüm 2 ayar JSON’u (en çok 32 KiB)'),'import-json','textarea','',null);input.setAttribute('rows','4');
    row(body,button(t('Export settings JSON','Ayar JSON’unu indir'),'export-settings',()=>download(S.exportJSON(state),'squeektoshi-settings-v2.json','application/json')),button(t('Import settings','Ayarları içe aktar'),'import-settings',()=>{try{const next=S.importJSON(input.value);apply(next,true);msg(t('Settings imported. Copy the updated URL to your source.','Ayarlar alındı. Güncel URL’yi kaynağınıza kopyalayın.'));}catch(_){input.setAttribute('aria-invalid','true');msg(t('Import rejected. Use an exported version 2 settings file under 32 KiB. Current settings are unchanged.','İçe aktarma reddedildi. 32 KiB altında dışa aktarılmış sürüm 2 dosyası kullanın. Geçerli ayarlar değişmedi.'),true);}}));
    const file=field(body,t('Or choose a settings file','Veya bir ayar dosyası seçin'),'import-file','file','',null);file.setAttribute('accept','.json,application/json');file.addEventListener('change',async()=>{const f=file instanceof HTMLInputElement && file.files&&file.files[0];if(!f)return;if(f.size>S.JSON_LIMIT){msg(t('File exceeds 32 KiB.','Dosya 32 KiB sınırını aşıyor.'),true);return;}input.value=await f.text();});
    hint(body,t('Settings contain no endpoints, code or session counters. Imports and URL checks apply atomically.','Ayarlar uç nokta, kod veya oturum sayacı içermez. İçe aktarma ve URL denetimi bütünüyle uygulanır.'));
    refs.paste=field(body,t('Existing overlay or setup URL','Mevcut kaplama veya kurulum URL’si'),'paste','textarea','',null);refs.paste.rows=3;
    row(body,button(t('Check and load URL','URL’yi denetle ve yükle'),'load',()=>{try{const next=S.readURL(refs.paste.value,location.href);apply(next,true);msg(t('URL checked and loaded.','URL denetlendi ve yüklendi.'));}catch(_){refs.paste.setAttribute('aria-invalid','true');msg(t('URL rejected. Use a supported overlay, widget or setup link under 16 KiB. Current settings are unchanged.','URL reddedildi. 16 KiB altında desteklenen kaplama, bileşen veya kurulum bağlantısı kullanın. Ayarlar değişmedi.'),true);}}));
  }
  function buildGuide(parent){
    const body=section(parent,t('Setup guide and troubleshooting','Kurulum rehberi ve sorun giderme'),'setup');
    const guide=el('div','guide');body.append(guide);
    [['OBS Studio',[
      t('Copy the OBS URL and the width × height shown below it.','OBS URL’sini ve altında gösterilen genişlik × yüksekliği kopyalayın.'),
      t('In Sources, choose + → Browser. Paste the URL and enter those dimensions.','Kaynaklar’da + → Tarayıcı seçin. URL’yi yapıştırın ve boyutları girin.'),
      t('Keep the default transparent background CSS. The checkerboard belongs only to the preview.','Varsayılan saydam arka plan CSS’ini koruyun. Dama yalnızca önizlemededir.'),
      t('For audio, enable master sound here and Control audio via OBS in the source. Check the mixer and monitoring output.','Ses için burada ana sesi ve kaynakta OBS üzerinden ses kontrolünü açın. Mikseri ve izleme çıkışını denetleyin.')]],
      ['Streamlabs Desktop',[
        t('In Sources, choose + → Browser Source. Paste the OBS URL.','Kaynaklar’da + → Tarayıcı Kaynağı seçin. OBS URL’sini yapıştırın.'),
        t('Set the exact width and height shown by the configurator, then save the source.','Düzenleyicide gösterilen tam genişlik ve yüksekliği ayarlayın, sonra kaynağı kaydedin.'),
        t('Check source audio in the mixer. Allow browser audio if prompted.','Mikserde kaynak sesini denetleyin. İstenirse tarayıcı sesine izin verin.'),
        t('After any setting change, paste the new URL into the source. This page cannot update a remote source.','Her ayar değişikliğinde yeni URL’yi kaynağa yapıştırın. Bu sayfa uzaktaki kaynağı güncelleyemez.')]]].forEach(([title,steps])=>{const box=el('div');box.append(el('h3','',String(title)));const ol=el('ol');/** @type {string[]} */ (steps).forEach(text=>ol.append(el('li','',text)));box.append(ol);guide.append(box);});
    hint(body,t('Shutdown when hidden stops observation. On refresh or recovery, the first sample is silent and rebaselines continuous records; saved measured totals remain with the same ID/token. Use a fresh reset URL for a new session.','Gizliyken kapatma gözlemi durdurur. Yenileme veya bağlantının dönüşünde ilk örnek sessizdir ve kesintisiz rekorlar yeniden başlar; aynı kimlik/belirteçte ölçülen toplamlar korunur. Yeni oturum için yeni sıfırlama URL’si kullanın.'));
    hint(body,t('Lost signal: live data needs internet and api.squeekchain.com. Values marked last-known are frozen; retries happen automatically. Supply can fail independently. Blank source: check Parts, dimensions and the complete URL. Silent source: test audio after enabling master sound.','Sinyal yok: canlı veri için internet ve api.squeekchain.com gerekir. Son bilinen değerler donar; yeniden deneme otomatiktir. Arz bağımsız olarak başarısız olabilir. Boş kaynak: Parçalar, boyutlar ve tam URL’yi denetleyin. Sessiz kaynak: ana sesi açıp test edin.'));
    hint(body,t('No accounts, wallets, backend, tracking, adoption or invented live numbers. Demo data is labeled. OBS Studio and Streamlabs integration still require verification in those desktop apps.','Hesap, cüzdan, sunucu, izleme, sahiplenme veya uydurulmuş canlı sayı yoktur. Demo verisi etiketlidir. OBS Studio ve Streamlabs bütünleştirmesi bu masaüstü uygulamalarında doğrulanmalıdır.'));
  }
  function buildDiagnostics(parent){const body=section(parent,t('Connection diagnostics','Bağlantı tanılaması'),'diagnostics');refs.diagnostics=el('dl','diagnostics');body.append(refs.diagnostics);refs.eventLog=el('ol','event-log');body.append(refs.eventLog);hint(body,t('Diagnostics stay here, never on stream. Failed retries do not change the last successful observation. Events are bounded to 40 entries; no telemetry is sent.','Tanılama burada kalır, yayında görünmez. Başarısız denemeler son başarılı gözlemi değiştirmez. Olaylar 40 kayıtla sınırlıdır; telemetri gönderilmez.'));}
  function buildDownloads(parent){const body=section(parent,t('Download and version','İndir ve sürüm'),'downloads');row(body,button(t('Download transparent hamster canvas PNG','Saydam hamster tuvali PNG indir'),'download-png',()=>{const canvas=renderer.canvas();if(!canvas){msg(t('Enable the hamster part to download its canvas.','Tuvali indirmek için hamster parçasını açın.'),true);return;}canvas.toBlob(blob=>{if(blob)download(blob,'squeektoshi-transparent-canvas.png','image/png');});}),link(t('Original project art PNG','Orijinal proje çizimi PNG'),'assets/original-project.png','btn'));
    row(body,link(t('Static export ZIP','Statik çıktı ZIP'),'downloads/squeektoshi-static.zip','btn'),link(t('Source ZIP','Kaynak ZIP'),'downloads/squeektoshi-source.zip','btn'));hint(body,t('Version 2.0.2 · build details in build.json. Original canvas art is preserved; the PNG is a transparent render of that art.','Sürüm 2.0.2 · derleme ayrıntıları build.json içinde. Orijinal tuval çizimi korundu; PNG, bu çizimin saydam çıktısıdır.'));body.append(link(t('Build identity','Derleme kimliği'),'build.json'));}
  function renderReport(){if(!refs.report)return;refs.report.replaceChildren();const rows=Store.sessions();if(!rows.length){hint(refs.report,t('No measured sessions saved in this browser. Open a live overlay with local saving enabled; demo previews never create reports.','Bu tarayıcıda ölçülen oturum kaydı yok. Yerel kayıt açıkken canlı kaplamayı açın; demo önizlemeleri rapor oluşturmaz.'));return;}
    const table=el('table'),thead=el('thead'),head=el('tr');[t('Session','Oturum'),t('Distance','Mesafe'),t('Running','Koşu'),t('Best','En iyi'),t('Gaps','Kesinti')].forEach(x=>head.append(el('th','',x)));thead.append(head);table.append(thead);const tbody=el('tbody');rows.forEach(x=>{const tr=el('tr'),v=C.sessionView(x.session);[x.id,C.formatDistance(v.distanceMm,ui),C.formatDuration(v.runningMs),C.formatDistance(v.recordMm,ui),String(x.session.gaps||0)].forEach(text=>tr.append(el('td','',text)));tbody.append(tr);});table.append(tbody);refs.report.append(table);}
  function previewSettings(){const copy=S.clone(state);copy.config.demo=!livePreview;copy.config.persist=false;return copy;}
  function syncDemoButtons(){document.querySelectorAll('button[data-demo]').forEach(node=>{const n=/** @type {HTMLButtonElement} */(node);n.disabled=livePreview;n.setAttribute('aria-pressed',String(n.dataset.demo===demoMode));});if(refs.rpm)refs.rpm.disabled=livePreview;}
  function refresh(updateRenderer=true){
    if(!S.validate(state)){msg(t('A setting is outside its limits. Undo or reset that section; the link was not updated.','Bir ayar sınırların dışında. Geri alın veya o bölümü sıfırlayın; bağlantı güncellenmedi.'),true);return;}
    const url=S.url(state,location.href);refs.url.value=url;refs.open.href=url;
    const [w,h]=S.FORMATS[state.presentation.format];refs.size.textContent=t(`OBS size: ${w} × ${h} px · ${state.config.demo?'Demo output':'Live output'}`,`OBS boyutu: ${w} × ${h} px · ${state.config.demo?'Demo çıktısı':'Canlı çıktı'}`);
    refs.previewLabel.textContent=livePreview?t('Live API preview','Canlı API önizlemesi'):t('Simulated preview','Simüle önizleme');
    refs.preview.dataset.bg=previewBg;refs.preview.classList.toggle('safe',safe);refs.preview.classList.toggle('grid',grid);
    refs.empty.hidden=state.config.parts.length!==0;refs.empty.textContent=t('All parts are hidden. Enable a part in Look, format and data to see output.','Tüm parçalar gizli. Çıktıyı görmek için Görünüm, biçim ve veri bölümünde bir parçayı açın.');
    const colors=S.colors(state),ratio=S.contrast(colors.text,colors.panel);refs.contrast.textContent=t(`Opaque text/panel contrast: ${ratio.toFixed(2)}:1. ${ratio>=4.5?'Meets 4.5:1.':'Below 4.5:1; reset colors for an accessible pair.'} Transparent video backgrounds need a visual check.`,`Opak metin/panel kontrastı: ${ratio.toFixed(2)}:1. ${ratio>=4.5?'4.5:1 sağlanıyor.':'4.5:1 altında; erişilebilir çift için renkleri sıfırlayın.'} Saydam video arka planları görsel denetim gerektirir.`);
    refs.contrast.classList.toggle('error',ratio<4.5);refs.undo.disabled=!history.canUndo();refs.redo.disabled=!history.canRedo();
    document.querySelectorAll('[data-alert]').forEach(node=>{const b=/** @type {HTMLButtonElement} */(node);b.disabled=livePreview||!state.config.parts.includes('alerts')||!C.alertEnabled(state.config,b.dataset.alert);});
    /** @type {HTMLButtonElement} */(document.getElementById('run-all')).disabled=livePreview||!state.config.parts.includes('alerts');syncDemoButtons();
    ['box-x','box-y','box-w','box-scale','align-left','align-center','align-right'].forEach(id=>{const node=/** @type {HTMLInputElement | HTMLButtonElement} */(document.getElementById(id));if(node)node.disabled=state.presentation.locked;});
    const geometry={'box-x':state.presentation.boxes[selected].x,'box-y':state.presentation.boxes[selected].y,'box-w':selected==='alerts'?state.presentation.alert.width:state.presentation.boxes[selected].w,'box-scale':selected==='alerts'?state.presentation.alert.scale:state.presentation.boxes[selected].scale,'layout':state.presentation.layout};Object.entries(geometry).forEach(([id,value])=>{const node=/** @type {HTMLInputElement | HTMLSelectElement} */(document.getElementById(id));if(node&&node!==document.activeElement)node.value=String(value);});
    if(updateRenderer&&renderer){renderer.update(previewSettings());if(!livePreview)renderer.demo(demoMode,demoRPM);}
    Store.saveProfiles(profiles);Store.saveDraft(state,ui);if(Store.status()==='memory')msg(t('Storage unavailable. Your changes work in memory; export a settings file to keep them.','Depolama kullanılamıyor. Değişiklikler bellekte çalışır; korumak için ayar dosyasını dışa aktarın.'),true);
    fitPreview();positionHandles();
  }
  function fitPreview(){if(!refs.preview||!renderer)return;const [w,h]=S.FORMATS[state.presentation.format],box=refs.preview;
    const availableW=box.clientWidth,availableH=box.clientHeight;const fit=Math.min(availableW/w,availableH/h);previewScale=previewMode==='scroll'?1:previewMode==='close'?Math.min(1.5,fit*(state.page==='widget'?1:2.5)):fit;
    refs.inner.style.width=w+'px';refs.inner.style.height=h+'px';refs.inner.style.transform=`scale(${previewScale})`;refs.inner.style.position='absolute';
    refs.space.style.width=Math.max(availableW,w*previewScale)+'px';refs.space.style.height=Math.max(availableH,h*previewScale)+'px';
    if(previewMode==='fit'){refs.inner.style.left=Math.max(0,(availableW-w*previewScale)/2)+'px';refs.inner.style.top=Math.max(0,(availableH-h*previewScale)/2)+'px';box.scrollLeft=0;box.scrollTop=0;}else{refs.inner.style.left='0';refs.inner.style.top='0';if(fitRAF)cancelAnimationFrame(fitRAF);fitRAF=requestAnimationFrame(()=>{fitRAF=0;const node=refs.host.querySelector('.sq-alert.is-on')||refs.host.querySelector('.sq-rig');if(node&&previewMode==='close'){const rect=node.getBoundingClientRect(),outer=box.getBoundingClientRect();box.scrollLeft+=rect.left+rect.width/2-outer.left-availableW/2;box.scrollTop+=rect.top+rect.height/2-outer.top-availableH/2;}positionHandles();});}
  }
  function positionHandles(){if(gesture)return;if(!refs.editor||!renderer)return;if(!edit||state.presentation.locked){refs.editor.replaceChildren();return;}
    const visible=new Set();
    const origin=refs.host.getBoundingClientRect();refs.host.querySelectorAll('[data-part]').forEach(node=>{
      const part=node.dataset.part;if(!state.config.parts.includes(part))return;const rect=node.getBoundingClientRect();if(!rect.width||!rect.height||getComputedStyle(node).visibility==='hidden')return;visible.add('handle-'+part);const existing=refs.editor.querySelector('#handle-'+part);const handle=existing||button(partName(part),'handle-'+part,()=>{if(selected!==part){selected=part;build();}});handle.className='edit-handle';handle.setAttribute('aria-label',t('Move ','Taşı: ')+partName(part));handle.style.left=(rect.left-origin.left)/previewScale+'px';handle.style.top=(rect.top-origin.top)/previewScale+'px';handle.style.transform=`scale(${1/previewScale})`;handle.style.transformOrigin='top left';
      if(existing)return;
      handle.addEventListener('keydown',e=>{if(!['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(e.key))return;e.preventDefault();const changed=selected!==part;selected=part;state.presentation.layout='custom';if(part==='alerts')state.presentation.alert.pos='custom';const b=state.presentation.boxes[part],step=e.shiftKey?5:1;b.x=Math.max(0,Math.min(100,b.x+(e.key==='ArrowRight'?step:e.key==='ArrowLeft'?-step:0)));b.y=Math.max(0,Math.min(100,b.y+(e.key==='ArrowDown'?step:e.key==='ArrowUp'?-step:0)));record();if(changed)build();else{renderer.update(previewSettings());refresh(false);}requestAnimationFrame(()=>document.getElementById('handle-'+part)?.focus());});
      handle.addEventListener('pointerdown',e=>{
        if(e.button!==0)return;e.preventDefault();const changed=selected!==part;selected=part;gesture=true;const startX=e.clientX,startY=e.clientY,original=S.clone(state.presentation.boxes[part]);handle.setPointerCapture(e.pointerId);
        const move=ev=>{state.presentation.layout='custom';if(part==='alerts')state.presentation.alert.pos='custom';const [w,h]=S.FORMATS[state.presentation.format],b=state.presentation.boxes[part],step=state.presentation.snap?5:.1;const round=n=>Math.max(0,Math.min(100,snap(n,step)));b.x=round(original.x+(ev.clientX-startX)/(w*previewScale)*100);b.y=round(original.y+(ev.clientY-startY)/(h*previewScale)*100);renderer.update(previewSettings());};
        const end=()=>{gesture=false;handle.removeEventListener('pointermove',move);handle.removeEventListener('pointerup',end);handle.removeEventListener('pointercancel',end);record();if(changed)build();else refresh(false);};handle.addEventListener('pointermove',move);handle.addEventListener('pointerup',end);handle.addEventListener('pointercancel',end);
      });refs.editor.append(handle);
    });
    refs.editor.querySelectorAll('.edit-handle').forEach(handle=>{if(!visible.has(handle.id))handle.remove();});
  }
  function updateDiagnostics(){if(!diagnostic)return;const d=diagnostic;
    if(refs.fit)refs.fit.textContent=t(`Requested scale ${d.requestedScale.toFixed(2)}× · effective fit ${d.effectiveScale.toFixed(2)}×.`,`İstenen ölçek ${d.requestedScale.toFixed(2)}× · etkin sığdırma ${d.effectiveScale.toFixed(2)}×.`);
    if(!/** @type {HTMLDetailsElement} */(document.getElementById('diagnostics')).open)return;
    const formatTime=n=>n===null?t('No success yet','Henüz başarılı değil'):new Date(n).toLocaleTimeString(ui==='tr'?'tr-TR':'en-US');
    const labels=[[t('Source / state','Kaynak / durum'),(d.source==='demo'?t('Demo','Demo'):t('Live API','Canlı API'))+' / '+({live:t('Live','Canlı'),lost:t('Lost','Bağlantı yok'),connecting:t('Connecting','Bağlanıyor')})[d.state]],
      [t('Last success','Son başarı'),formatTime(d.lastSuccess)],[t('Observation age','Gözlem yaşı'),d.observationAge===null?'–':(d.observationAge/1000).toFixed(1)+' s'],[t('Poll interval','Sorgu aralığı'),d.poll+' s'],[t('Queued events','Bekleyen olay'),String(d.queue)],[t('Audio','Ses'),({off:t('Off','Kapalı'),gesture:t('Test to enable','Açmak için dene'),running:t('Enabled','Açık'),suspended:t('Browser blocked','Tarayıcı engelledi'),closed:t('Closed','Kapalı')})[d.audio]||d.audio],[t('Session storage','Oturum depolaması'),({saved:t('Saved locally','Yerel kayıt'),ephemeral:t('Preview only','Yalnız önizleme'),conflict:t('Another writer; memory only','Başka yazıcı; yalnız bellek'),memory:t('Memory only','Yalnız bellek')})[d.storage]]];
    refs.diagnostics.replaceChildren();labels.forEach(([label,value])=>refs.diagnostics.append(el('dt','',label),el('dd','',value)));
    refs.eventLog.replaceChildren();d.events.slice(-8).reverse().forEach(e=>refs.eventLog.append(el('li','',formatTime(e.at)+' · '+(e.type.startsWith('alert-')?kindName(e.type.slice(6)):({live:t('Observation accepted','Gözlem kabul edildi'),lost:t('Signal unavailable','Sinyal yok'),sound:t('Sound played','Ses çalındı'),'audio-blocked':t('Audio blocked','Ses engellendi')})[e.type]||t('State changed','Durum değişti')))));
  }
  function restore(snapshot){state=snapshot.settings;profiles=snapshot.profiles;profileId=snapshot.profileId;build();}
  async function copy(setup){if(!S.validate(state)){msg(t('A setting is outside its limits. Undo or reset that section, then copy again.','Bir ayar sınırların dışında. Geri alın veya o bölümü sıfırlayın, sonra yeniden kopyalayın.'),true);return;}const value=S.url(state,location.href,setup,ui);try{await navigator.clipboard.writeText(value);copied(setup);}catch(_){refs.url.value=value;openSections.add('preview-options');/** @type {HTMLDetailsElement} */(document.getElementById('preview-options')).open=true;refs.url.focus();refs.url.select();let ok=false;try{ok=document.execCommand('copy');}catch(_e){}if(ok)copied(setup);else msg(t('Link selected. Press Ctrl+C (Mac: Cmd+C), then paste it into your source.','Bağlantı seçildi. Ctrl+C (Mac: Cmd+C) ile kopyalayıp kaynağa yapıştırın.'));}}
  function copied(setup){msg(setup?t('Setup link copied.','Kurulum bağlantısı kopyalandı.'):t(`OBS URL copied. Apply the URL and dimensions in your source. Setup time: ${Math.round((performance.now()-pageStarted)/1000)}s.`,`OBS URL’si kopyalandı. URL ve boyutları kaynağınıza uygulayın. Kurulum süresi: ${Math.round((performance.now()-pageStarted)/1000)} sn.`));}
  function download(data,name,type){const blob=data instanceof Blob?data:new Blob([data],{type});const url=URL.createObjectURL(blob),a=link(name,url);a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
  window.addEventListener('pagehide',()=>{renderer?.destroy();layoutObserver?.disconnect();alertObserver?.disconnect();if(fitRAF)cancelAnimationFrame(fitRAF);},{once:true});
  build();
})();
