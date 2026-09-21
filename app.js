
const DB_NAME='mammalogy-practical-db', DB_VERSION=4;
const IMG_STORE='customImages', CARD_STORE='studyCards', INFO_STORE='speciesInfo', HOMEIMG_STORE='homeImages', SPECIES_STORE='customSpecies';
const TAGS_KEY='mammalogy-tag-overrides', PROGRESS_KEY='mammalogy-progress', SETTINGS_KEY='mammalogy-settings', HOME_KEY='mammalogy-home-customization', FEATURES_KEY='mammalogy-feature-toggles', FAVORITES_KEY='mammalogy-favorites', HISTORY_KEY='mammalogy-study-history';

const state={
  screen:'home', mode:'full', length:20, current:null, answered:false, editor:null,
  session:{q:0,correct:0,points:0,totalPoints:0}, lastSpecies:null, focusMissed:false,
  customImages:[], customSpecies:[], tagOverrides:{}, cards:[], speciesInfo:{}, homeImages:[], homeConfig:null,
  selectedSpeciesId:null, studyMode:'browse', studyIndex:0, studyFlipped:false, studyTagFilter:'', sessionPlan:null, mystery:false, features:null, favorites:[]
};
function speciesList(){return [...SOURCE_SPECIES,...state.customSpecies]}
function featureDefaults(){return {collection:true,badges:true,streak:true,daily:true,surprise:true,galleries:true,mystery:true,trouble:true,smartReview:true,sessionResults:true,xp:true,themes:true,journal:true,studyThis:true,mastery:true,recent:true,favorites:true,stats:true,history:true,clues:true,studyBuilder:true}}
function loadFeatures(){try{return {...featureDefaults(),...JSON.parse(localStorage.getItem(FEATURES_KEY)||'{}')}}catch{return featureDefaults()}}
function saveFeatures(f){state.features={...featureDefaults(),...f};localStorage.setItem(FEATURES_KEY,JSON.stringify(state.features))}
function featureOn(k){return (state.features||loadFeatures())[k]!==false}
function loadFavorites(){try{return JSON.parse(localStorage.getItem(FAVORITES_KEY)||'[]')}catch{return[]}}
function saveFavorites(){localStorage.setItem(FAVORITES_KEY,JSON.stringify(state.favorites))}
function toggleFavorite(id){state.favorites.includes(id)?state.favorites=state.favorites.filter(x=>x!==id):state.favorites.push(id);saveFavorites();render()}
function loadHistory(){try{return JSON.parse(localStorage.getItem(HISTORY_KEY)||'[]')}catch{return[]}}
function saveHistory(h){localStorage.setItem(HISTORY_KEY,JSON.stringify(h.slice(-1000)))}
function studyStreak(){const days=[...new Set(loadHistory().map(x=>new Date(x.time).toISOString().slice(0,10)))].sort().reverse();if(!days.length)return 0;let streak=1;for(let i=0;i<days.length-1;i++){const a=new Date(days[i]),b=new Date(days[i+1]);if(Math.round((a-b)/86400000)===1)streak++;else break}return streak}
function xpTotal(){const p=loadProgress();return Object.values(p).reduce((n,r)=>n+(r.correct||0)*10,0)+state.cards.length*2+state.customImages.length*3}
function masteryPercent(id){const r=speciesProgress(id);return r.seen?Math.min(100,Math.round(r.correct/r.seen*100)):0}
function badgeList(){const p=loadProgress(),total=speciesList().length,mastered=speciesList().filter(s=>masteryPercent(s.id)>=80).length;return [{icon:'🌱',name:'First Look',ok:Object.keys(p).length>0},{icon:'🔎',name:'Identifier',ok:Object.values(p).some(r=>(r.correct||0)>=5)},{icon:'🦴',name:'Bone Collector',ok:state.cards.some(c=>/skull|teeth|dentition/i.test(c.category||'')||/skull|teeth|dentition/i.test((c.tags||[]).join(' ')))},{icon:'📚',name:'Study Hoarder',ok:state.cards.length>=25},{icon:'🧬',name:'Family Scholar',ok:speciesList().some(s=>s.family&&masteryPercent(s.id)>=80)},{icon:'🏆',name:'Vault Keeper',ok:mastered>0&&mastered===total}]}


const $=id=>document.getElementById(id);
function normalize(s){return(s||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[“”‘’]/g,"'").replace(/\s+/g,' ').trim().toLowerCase()}
function normalizeSci(s){return normalize(s).replace(/[.]/g,'')}
function esc(s){return String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}
function speciesById(id){return speciesList().find(s=>s.id===id)}
function loadProgress(){try{return JSON.parse(localStorage.getItem(PROGRESS_KEY)||'{}')}catch{return{}}}
function saveProgress(p){localStorage.setItem(PROGRESS_KEY,JSON.stringify(p))}
function recordResult(id,ok){const p=loadProgress(),r=p[id]||{seen:0,correct:0,wrong:0};r.seen++;ok?r.correct++:r.wrong++;r.lastSeen=new Date().toISOString();p[id]=r;saveProgress(p);const h=loadHistory();h.push({time:new Date().toISOString(),speciesId:id,ok});saveHistory(h)}
function loadSettings(){try{return JSON.parse(localStorage.getItem(SETTINGS_KEY)||'{}')}catch{return{}}}
function saveSettings(s){localStorage.setItem(SETTINGS_KEY,JSON.stringify(s))}
function loadTags(){try{state.tagOverrides=JSON.parse(localStorage.getItem(TAGS_KEY)||'{}')}catch{state.tagOverrides={}}}
function saveTags(){localStorage.setItem(TAGS_KEY,JSON.stringify(state.tagOverrides))}

function openDb(){
  return new Promise((res,rej)=>{
    const r=indexedDB.open(DB_NAME,DB_VERSION);
    r.onupgradeneeded=()=>{
      const db=r.result;
      if(!db.objectStoreNames.contains(IMG_STORE)) db.createObjectStore(IMG_STORE,{keyPath:'id'});
      if(!db.objectStoreNames.contains(CARD_STORE)) db.createObjectStore(CARD_STORE,{keyPath:'id'});
      if(!db.objectStoreNames.contains(INFO_STORE)) db.createObjectStore(INFO_STORE,{keyPath:'speciesId'});
      if(!db.objectStoreNames.contains(HOMEIMG_STORE)) db.createObjectStore(HOMEIMG_STORE,{keyPath:'id'});
      if(!db.objectStoreNames.contains(SPECIES_STORE)) db.createObjectStore(SPECIES_STORE,{keyPath:'id'});
    };
    r.onsuccess=()=>res(r.result); r.onerror=()=>rej(r.error);
  })
}
async function dbAll(store){
  try{const db=await openDb(); return await new Promise((res,rej)=>{
    const r=db.transaction(store,'readonly').objectStore(store).getAll();
    r.onsuccess=()=>res(r.result||[]); r.onerror=()=>rej(r.error);
  })}catch{return[]}
}
async function dbPut(store,o){
  const db=await openDb(); return new Promise((res,rej)=>{
    const t=db.transaction(store,'readwrite'); t.objectStore(store).put(o);
    t.oncomplete=()=>res(o); t.onerror=()=>rej(t.error);
  })
}
async function dbDelete(store,id){
  const db=await openDb(); return new Promise((res,rej)=>{
    const t=db.transaction(store,'readwrite'); t.objectStore(store).delete(id);
    t.oncomplete=()=>res(); t.onerror=()=>rej(t.error);
  })
}
async function getCustomImages(){return dbAll(IMG_STORE)}
async function putCustomImage(o){return dbPut(IMG_STORE,o)}
async function deleteCustomImage(id){return dbDelete(IMG_STORE,id)}

async function refreshStudyData(){
  state.customImages=await getCustomImages();
  state.cards=await dbAll(CARD_STORE);
  const infos=await dbAll(INFO_STORE);
  state.speciesInfo={}; infos.forEach(x=>state.speciesInfo[x.speciesId]=x);
  state.homeImages=await dbAll(HOMEIMG_STORE);
  state.customSpecies=await dbAll(SPECIES_STORE);
  state.features=loadFeatures(); state.favorites=loadFavorites();
  state.homeConfig=loadHomeConfig();
}

function allImages(s){return[
  ...s.images.map((im,i)=>({id:`source:${s.id}:${i}`,speciesId:s.id,file:im.file,data:(SOURCE_IMAGE_DATA[im.file]||`images/${im.file}`),viewTypes:state.tagOverrides[`source:${s.id}:${i}`]||im.viewTypes||['mixed'],custom:false})),
  ...state.customImages.filter(x=>x.speciesId===s.id).map(x=>({...x,custom:true,data:x.dataUrl}))
]}
function eligible(s,filter){const a=allImages(s);return filter==='all'?a:a.filter(x=>(x.viewTypes||[]).includes(filter))}
function modeLabel(){return({full:'Full Practical',scientific:'Scientific Name',family:'Family',skull:'Skull / Teeth Focus',skin:'Skin / Whole Focus'})[state.mode]}
function weightedSpecies(){
  let a=[...speciesList()];
  if(state.mode==='family') a=a.filter(s=>s.family);
  if(state.focusMissed){
    const p=loadProgress(),w=[];
    a.forEach(s=>{const r=p[s.id]||{seen:0,wrong:0};const n=Math.min(6,1+r.wrong*2+(r.seen===0?2:0));for(let i=0;i<n;i++)w.push(s)});
    a=w;
  }
  for(let i=0;i<20;i++){const s=a[Math.floor(Math.random()*a.length)];if(!state.lastSpecies||s.id!==state.lastSpecies.id||a.length===1)return s}
  return a[0]
}
function pickQuestion(){
  const filter=state.mode==='skull'?'skull':state.mode==='skin'?'skin':'all';
  for(let i=0;i<30;i++){const s=weightedSpecies(),a=eligible(s,filter);if(a.length){state.lastSpecies=s;return{species:s,image:a[Math.floor(Math.random()*a.length)]}}}
  return null
}
function setScreen(x){state.screen=x;render()}
function startQuiz(mode){
  const keepPlan=!!state.keepPlan;state.keepPlan=false;if(!keepPlan)state.sessionPlan=null;
  state.mode=mode;state.answered=false;state.session={q:0,correct:0,points:0,totalPoints:0};state.lastSpecies=null;state.mystery=false;
  const s=loadSettings();if(!keepPlan)state.length=Number(s.length||20);if(!keepPlan)state.focusMissed=!!s.focusMissed;
  state.screen='quiz';nextQuestion()
}
function nextQuestion(){
  if(state.session.q>=state.length){state.screen='results';render();return}
  state.current=pickQuestion();state.answered=false;state.session.q++;render();
  setTimeout(()=>{$('scientificInput')?.focus()},30)
}
function checkAnswer(){
  if(!state.current||state.answered)return;
  const s=state.current.species,si=$('scientificInput')?.value||'',fi=$('familyInput')?.value||'';
  const sc=state.mode==='family'?true:normalizeSci(si)===normalizeSci(s.scientific);
  const familyRequired=!!s.family;
  const fc=(!familyRequired || state.mode==='scientific')?true:(normalize(fi)===normalize(s.family));
  const ok=sc&&fc; let pts=0,max=0;
  if(state.mode!=='family'){pts+=sc?1:0;max++}
  if(state.mode!=='scientific'){pts+=fc?1:0;max++}
  state.session.points+=pts;state.session.totalPoints+=max;state.session.correct+=ok?1:0;
  recordResult(s.id,ok);state.answered=true;render()
}
function showAnswer(){
  if(!state.current)return;state.answered=true;recordResult(state.current.species.id,false);render()
}

function progressStats(){
  const p=loadProgress(); let seen=0,correct=0,wrong=0;
  speciesList().forEach(s=>{const r=p[s.id];if(r){seen+=r.seen;correct+=r.correct;wrong+=r.wrong}});
  return {seen,correct,wrong}
}
function speciesProgress(id){return loadProgress()[id]||{seen:0,correct:0,wrong:0}}

function cardsFor(id){return state.cards.filter(c=>c.speciesId===id).sort((a,b)=>(a.order??0)-(b.order??0))}
function selectedSpecies(){return speciesById(state.selectedSpeciesId)||speciesList()[0]}
function setStudySpecies(id){state.selectedSpeciesId=id;state.studyIndex=0;state.studyFlipped=false}
function cardMode(id){
  const cards=cardsFor(id); return cards.length?cards[state.studyIndex%cards.length]:null
}

function render(){
  const app=$('app');
  if(state.screen==='home') return renderHome(app);
  if(state.screen==='quiz') return renderQuiz(app);
  if(state.screen==='results') return renderResults(app);
  if(state.screen==='study') return renderStudy(app);
  if(state.screen==='manage') return renderManage(app);
  if(state.screen==='cardEditor') return renderCardEditor(app);
  if(state.screen==='customize') return renderCustomizer(app);
  if(state.screen==='progress') return renderProgress(app);
  if(state.screen==='settings') return renderSettings(app);
  if(state.screen==='addSpecies') return renderAddSpecies(app);
  if(state.screen==='studyBuilder') return renderStudyBuilder(app);
}

function shell(title,body){
  return `<div class="shell">
    <header class="topbar ${state.screen==='home'?'home-topbar':''}"><button class="brand" onclick="setScreen('home')">The Mammal Vault: Mammalogy Practical Companion</button>
    <nav><button onclick="setScreen('home')">Home</button><button onclick="setScreen('study')">The Mammal Vault</button><button onclick="setScreen('manage')">Images</button><button onclick="setScreen('progress')">Progress</button><button onclick="setScreen('settings')">⚙ Settings</button></nav></header>
    <section class="content"><div class="page-title"><h1>${title}</h1></div>${body}</section>
  </div>`
}

function defaultHomeConfig(){return {theme:{bg:'#f3f5f7',header:'#172b3a',accent:'#1e5b8c',card:'#ffffff',button:'#ffffff',text:'#17212b',border:'#d7dde3',radius:12,font:'Arial, Helvetica, sans-serif',fontSize:16,dark:false,bgImage:'',bgOpacity:.18,bgFit:'cover',bgPosition:'center'},blocks:[{id:'image-practical',type:'action',title:'Image Practical',subtitle:'Random specimen images with typed answers.',action:'full'},{id:'vault',type:'action',title:'The Mammal Vault',subtitle:'Build and study your species collection.',action:'study'},{id:'progress',type:'progress',title:'Progress'},{id:'missed',type:'missed',title:'Trouble Species'},{id:'quick',type:'quick',title:'Quick Actions'}]}}
function loadHomeConfig(){try{const x=JSON.parse(localStorage.getItem(HOME_KEY)||'null');return x&&x.blocks?x:defaultHomeConfig()}catch{return defaultHomeConfig()}}
function saveHomeConfig(c){state.homeConfig=c;localStorage.setItem(HOME_KEY,JSON.stringify(c));applyHomeTheme()}
function applyHomeTheme(){const c=state.homeConfig||loadHomeConfig(),t=c.theme||{};const root=document.documentElement;root.style.setProperty('--home-bg',t.bg||'#f3f5f7');root.style.setProperty('--home-header',t.header||'#172b3a');root.style.setProperty('--home-accent',t.accent||'#1e5b8c');root.style.setProperty('--home-card',t.card||'#fff');root.style.setProperty('--home-button',t.button||'#fff');root.style.setProperty('--home-text',t.text||'#17212b');root.style.setProperty('--home-border',t.border||'#d7dde3');root.style.setProperty('--home-radius',(t.radius??12)+'px');root.style.setProperty('--home-font',t.font||'Arial, Helvetica, sans-serif');root.style.setProperty('--home-font-size',(t.fontSize??16)+'px');root.style.setProperty('--home-bg-image',t.bgImage?`url(${JSON.stringify(t.bgImage)})`:'none');root.style.setProperty('--home-bg-opacity',String(t.bgOpacity??.18));root.style.setProperty('--home-bg-fit',t.bgFit||'cover');root.style.setProperty('--home-bg-position',t.bgPosition||'center');document.body.classList.toggle('home-dark',!!t.dark)}
function homeBlockStyle(b){return b.type==='image'?`width:${b.width||'100%'};min-height:${b.height||'220px'};opacity:${b.opacity??1};border-radius:${b.radius??12}px;object-fit:${b.fit||'contain'};object-position:${b.position||'center'};`:''}
function homeImageSrc(b){if(!b)return '';if(b.source==='upload')return state.homeImages.find(x=>x.id===b.imageId)?.dataUrl||'';if(b.source==='random'){const all=speciesList().flatMap(s=>allImages(s));return all.length?all[Math.floor(Math.random()*all.length)].data:''}if(b.source==='species'){const s=speciesById(b.speciesId);const all=s?allImages(s):[];return all.length?all[Math.floor(Math.random()*all.length)].data:''}return ''}
function missedSpecies(){const p=loadProgress();return speciesList().map(s=>({s,r:p[s.id]||{seen:0,wrong:0}})).filter(x=>x.r.wrong>0).sort((a,b)=>b.r.wrong-a.r.wrong).slice(0,5)}
function renderHome(app){
  const st=progressStats(),c=state.homeConfig||loadHomeConfig();state.homeConfig=c;applyHomeTheme();
  const access=[];
  if(featureOn('collection'))access.push(`<button class="primary" onclick="setScreen('study')">🐾 Enter Mammal Vault</button>`);
  access.push(`<button onclick="startQuiz('full')">🔎 Image Practical</button>`);
  if(featureOn('studyBuilder'))access.push(`<button onclick="setScreen('studyBuilder')">🧠 Build My Study Session</button>`);
  if(featureOn('daily'))access.push(`<button onclick="startDailyChallenge()">🎯 Daily Challenge</button>`);
  if(featureOn('surprise'))access.push(`<button onclick="startSurprise()">🎲 Surprise Me</button>`);
  if(featureOn('mystery'))access.push(`<button onclick="startMystery()">🔍 Mystery Specimen</button>`);
  if(featureOn('smartReview'))access.push(`<button onclick="startSmartReview()">🧠 Smart Review</button>`);
  if(featureOn('favorites'))access.push(`<button onclick="startFavorites()">⭐ Favorites</button>`);
  const blocks=c.blocks.map(b=>{if(b.type==='action'){const click=b.action==='study'?"setScreen('study')":`startQuiz('${b.action||'full'}')`;return `<section class="home-block panel"><h2>${esc(b.title)}</h2><p>${esc(b.subtitle||'')}</p><button class="primary wide" onclick="${click}">${esc(b.button||b.title)}</button></section>`}if(b.type==='progress')return `<section class="home-block panel"><h3>${esc(b.title||'Progress')}</h3><div class="big">${st.seen}</div><p>${st.correct} correct · ${st.wrong} missed</p><button onclick="setScreen('progress')">View Progress</button></section>`;if(b.type==='missed'){const ms=missedSpecies();return `<section class="home-block panel"><h3>${esc(b.title||'Trouble Species')}</h3>${ms.length?ms.map(x=>`<div class="missed-row"><span>${esc(x.s.common)}</span><b>${x.r.wrong}</b></div>`).join(''):'<p>No missed species yet.</p>'}`}if(b.type==='quick')return `<section class="home-block panel"><h3>${esc(b.title||'Quick Actions')}</h3><div class="button-grid"><button onclick="startQuiz('full')">Full Practical</button><button onclick="startQuiz('skull')">Skull / Teeth</button><button onclick="startQuiz('skin')">Skin / Whole</button><button onclick="setScreen('study')">Enter Mammal Vault</button><button onclick="setScreen('addSpecies')">+ Add Species</button></div></section>`;return ''}).join('');
  const recent=featureOn('recent')?speciesList().filter(s=>s.custom).sort((a,b)=>(b.createdAt||0)-(a.createdAt||0)).slice(0,5):[];
  const favs=featureOn('favorites')?state.favorites.map(speciesById).filter(Boolean).slice(0,5):[];
  const mastery=featureOn('mastery')?speciesList().slice().sort((a,b)=>masteryPercent(b.id)-masteryPercent(a.id)).slice(0,6):[];
  const badges=featureOn('badges')?badgeList():[];
  const extra=`${featureOn('streak')||featureOn('xp')?`<section class="home-block panel"><h3>Vault Stats</h3>${featureOn('streak')?`<div>🔥 <b>${studyStreak()}</b> day streak</div>`:''}${featureOn('xp')?`<div>✨ <b>${xpTotal()}</b> XP</div>`:''}</section>`:''}${featureOn('mastery')?`<section class="home-block panel"><h3>Species Mastery</h3>${mastery.map(s=>`<div class="mastery-row"><span>${esc(s.common)}</span><div class="mastery-bar"><i style="width:${masteryPercent(s.id)}%"></i></div><b>${masteryPercent(s.id)}%</b></div>`).join('')}</section>`:''}${featureOn('recent')?`<section class="home-block panel"><h3>🆕 Recently Added</h3>${recent.length?recent.map(s=>`<div class="missed-row"><span>${esc(s.common)}</span><button onclick="openStudySpecies('${s.id}')">Study</button></div>`).join(''):'<p>No custom species added yet.</p>'}</section>`:''}${featureOn('favorites')?`<section class="home-block panel"><h3>⭐ Favorites</h3>${favs.length?favs.map(s=>`<div class="missed-row"><span>${esc(s.common)}</span><button onclick="openStudySpecies('${s.id}')">Open</button></div>`).join(''):'<p>No favorites yet.</p>'}</section>`:''}${featureOn('badges')?`<section class="home-block panel"><h3>🏆 Badges</h3><div class="badge-grid">${badges.map(b=>`<div class="badge ${b.ok?'earned':''}"><span>${b.icon}</span><small>${esc(b.name)}</small></div>`).join('')}</div></section>`:''}${featureOn('stats')?`<section class="home-block panel"><h3>📊 Study Statistics</h3><div class="stat-grid"><div><b>${st.seen}</b><span>attempts</span></div><div><b>${st.correct}</b><span>correct</span></div><div><b>${st.wrong}</b><span>missed</span></div><div><b>${xpTotal()}</b><span>XP</span></div></div></section>`:''}${featureOn('history')?`<section class="home-block panel"><h3>📅 Study History</h3><div class="history-dots">${[...Array(7)].map((_,i)=>{const d=new Date();d.setDate(d.getDate()-(6-i));const key=d.toISOString().slice(0,10);const has=loadHistory().some(x=>new Date(x.time).toISOString().slice(0,10)===key);return `<span class="history-day ${has?'studied':''}" title="${key}">${d.getDate()}</span>`}).join('')}</div></section>`:''}`;
  app.innerHTML=shell('',`<div class="home-custom-page"><div class="home-bg-layer"></div><div class="home-dashboard"><div class="hero"><div><h2>The Mammal Vault: Mammalogy Practical Companion</h2><p>Build your collection. Study your specimens. Master your practical.</p></div><div class="statbox"><strong>${speciesList().length}</strong><span>species</span><strong>${speciesList().reduce((n,s)=>n+s.images.length,0)+state.customImages.length}</strong><span>images</span></div></div><div class="vault-access-bar">${access.join('')}</div><div class="home-grid" id="homeGrid">${blocks}${extra}</div><div class="home-footer"><button onclick="setScreen('settings')">⚙ Settings</button><button onclick="setScreen('customize')">🎨 Customize Appearance</button><button onclick="exportBackup()">Export Backup</button><button onclick="triggerImportBackup()">Import Backup</button><input id="backupFile" type="file" accept=".json" hidden onchange="importBackup(this.files[0])"></div></div></div>`);
}
function addHomeBlock(type){const c=state.homeConfig||loadHomeConfig();const id='block-'+Date.now();if(type==='image')c.blocks.push({id,type:'image',title:'Custom Image',source:'upload',imageId:state.homeImages[0]?.id||'',width:'100%',height:'240px',opacity:1,radius:12,fit:'contain',position:'center',clickAction:'none'});else if(type==='action')c.blocks.push({id,type:'action',title:'New Quiz',subtitle:'',action:'full'});else if(type==='gallery')c.blocks.push({id,type:'gallery',title:'Image Gallery',count:4,height:'140px',fit:'contain'});else c.blocks.push({id,type,title:type==='quick'?'Quick Actions':type==='missed'?'Missed Species':'Progress'});saveHomeConfig(c);render()}
function removeHomeBlock(id){const c=state.homeConfig||loadHomeConfig();c.blocks=c.blocks.filter(b=>b.id!==id);saveHomeConfig(c);render()}
function updateHomeBlock(id,key,val){const c=state.homeConfig||loadHomeConfig(),b=c.blocks.find(x=>x.id===id);if(!b)return;b[key]=val;saveHomeConfig(c)}
function renderCustomizer(app){
  const c=state.homeConfig||loadHomeConfig();state.homeConfig=c;const t=c.theme||{};const imgOpts=state.homeImages.map(x=>`<option value="${esc(x.id)}">${esc(x.name||x.id)}</option>`).join('');
  app.innerHTML=shell('Customize Home Page',`<div class="customizer-layout"><section class="panel customizer-controls"><h2>Appearance</h2><div class="custom-grid">${[['bg','Background'],['header','Header'],['accent','Accent'],['card','Cards'],['button','Buttons'],['text','Text'],['border','Borders']].map(([k,l])=>`<label>${l}<span class="color-line"><input type="color" id="theme_${k}" value="${esc(t[k]||'#ffffff')}" onchange="changeTheme('${k}',this.value)"><input type="text" value="${esc(t[k]||'#ffffff')}" maxlength="7" oninput="changeTheme('${k}',this.value)"></span></label>`).join('')}<label>Border radius<input type="range" min="0" max="30" value="${t.radius??12}" oninput="changeTheme('radius',Number(this.value));this.nextElementSibling.value=this.value"><output>${t.radius??12}</output></label><label>Font size<input type="range" min="12" max="22" value="${t.fontSize??16}" oninput="changeTheme('fontSize',Number(this.value));this.nextElementSibling.value=this.value"><output>${t.fontSize??16}</output></label><label>Font<select onchange="changeTheme('font',this.value)"><option ${t.font==='Arial, Helvetica, sans-serif'?'selected':''}>Arial, Helvetica, sans-serif</option><option ${t.font==='Georgia, serif'?'selected':''}>Georgia, serif</option><option ${t.font==='Verdana, sans-serif'?'selected':''}>Verdana, sans-serif</option><option ${t.font==='Trebuchet MS, sans-serif'?'selected':''}>Trebuchet MS, sans-serif</option></select></label><label><input type="checkbox" ${t.dark?'checked':''} onchange="changeTheme('dark',this.checked)"> Dark appearance</label></div><h2>Background Image</h2><label>Upload background image<input type="file" accept="image/*" onchange="setHomeBackground(this.files[0])"></label><div class="custom-grid"><label>Opacity<input type="range" min="0" max="1" step=".05" value="${t.bgOpacity??.18}" oninput="changeTheme('bgOpacity',Number(this.value));this.nextElementSibling.value=this.value"><output>${t.bgOpacity??.18}</output></label><label>Fit<select onchange="changeTheme('bgFit',this.value)"><option>cover</option><option ${t.bgFit==='contain'?'selected':''}>contain</option></select></label><label>Position<select onchange="changeTheme('bgPosition',this.value)"><option>center</option><option>top</option><option>bottom</option><option>left</option><option>right</option></select></label></div><button onclick="clearHomeBackground()">Remove Background Image</button><h2>Dashboard Blocks</h2><p class="muted">Drag blocks to reorder them. Add or remove blocks below.</p><div class="block-editor-list">${c.blocks.map((b,i)=>`<div class="block-editor-item" draggable="true" data-block-index="${i}"><span class="drag-handle">☷</span><div class="block-editor-main"><strong>${esc(b.title||b.type)}</strong><small>${esc(b.type)}</small>${b.type==='image'?`<label>Image source<select onchange="updateHomeBlock('${b.id}','source',this.value);render()"><option value="upload" ${b.source==='upload'?'selected':''}>Uploaded home image</option><option value="random" ${b.source==='random'?'selected':''}>Random specimen image</option><option value="species" ${b.source==='species'?'selected':''}>Specific species</option></select></label>${b.source==='upload'?`<label>Image<select onchange="updateHomeBlock('${b.id}','imageId',this.value);render()">${imgOpts}</select></label>`:''}${b.source==='species'?`<label>Species<select onchange="updateHomeBlock('${b.id}','speciesId',this.value);render()">${speciesList().map(s=>`<option value="${s.id}" ${s.id===b.speciesId?'selected':''}>${esc(s.common)}</option>`).join('')}</select></label>`:''}<div class="custom-grid"><label>Width<input value="${esc(b.width||'100%')}" oninput="updateHomeBlock('${b.id}','width',this.value)"></label><label>Height<input value="${esc(b.height||'240px')}" oninput="updateHomeBlock('${b.id}','height',this.value)"></label><label>Opacity<input type="range" min=".1" max="1" step=".05" value="${b.opacity??1}" oninput="updateHomeBlock('${b.id}','opacity',Number(this.value))"></label><label>Fit<select onchange="updateHomeBlock('${b.id}','fit',this.value)"><option>contain</option><option ${b.fit==='cover'?'selected':''}>cover</option><option ${b.fit==='fill'?'selected':''}>fill</option></select></label><label>Position<select onchange="updateHomeBlock('${b.id}','position',this.value)"><option>center</option><option>top</option><option>bottom</option><option>left</option><option>right</option></select></label><label>Click action<select onchange="updateHomeBlock('${b.id}','clickAction',this.value)"><option value="none">None</option><option value="study">Species Study</option><option value="full">Full Practical</option><option value="skull">Skull / Teeth</option><option value="skin">Skin / Whole</option><option value="scientific">Scientific Name</option><option value="family">Family</option></select></label></div>`:''}${b.type==='action'?`<label>Button text<input value="${esc(b.button||b.title||'Start')}" oninput="updateHomeBlock('${b.id}','button',this.value)"></label><label>Action<select onchange="updateHomeBlock('${b.id}','action',this.value)"><option value="full">Full Practical</option><option value="skull">Skull / Teeth</option><option value="skin">Skin / Whole</option><option value="scientific">Scientific Name</option><option value="family">Family</option><option value="study">Species Study</option></select></label><label>Button image<select onchange="updateHomeBlock('${b.id}','buttonImageId',this.value)"><option value="">None</option>${imgOpts}</select></label>`:''}${b.type==='gallery'?`<div class="custom-grid"><label>Number of images<input type="number" min="2" max="6" value="${b.count||4}" oninput="updateHomeBlock('${b.id}','count',Number(this.value))"></label><label>Image height<input value="${esc(b.height||'140px')}" oninput="updateHomeBlock('${b.id}','height',this.value)"></label><label>Fit<select onchange="updateHomeBlock('${b.id}','fit',this.value)"><option>contain</option><option ${b.fit==='cover'?'selected':''}>cover</option></select></label></div>`:''}<label>Title<input value="${esc(b.title||'')}" oninput="updateHomeBlock('${b.id}','title',this.value)"></label><button class="danger" onclick="removeHomeBlock('${b.id}')">Remove block</button></div></div>`).join('')}</div><div class="button-row"><button onclick="addHomeBlock('image')">+ Image Block</button><button onclick="addHomeBlock('action')">+ Button Block</button><button onclick="addHomeBlock('progress')">+ Progress</button><button onclick="addHomeBlock('missed')">+ Missed Species</button><button onclick="addHomeBlock('quick')">+ Quick Actions</button><button onclick="addHomeBlock('gallery')">+ Image Gallery</button></div><h2>Your Home Images</h2><label class="file-button">Add home images<input type="file" accept="image/*" multiple onchange="handleHomeImages(this.files)"></label><div class="home-image-list">${state.homeImages.map(x=>`<div><img src="${esc(x.dataUrl)}"><span>${esc(x.name)}</span><button class="danger" onclick="deleteHomeImage('${x.id}')">Delete</button></div>`).join('')}</div><div class="button-row"><button onclick="resetHomeCustomization()">Reset Home Page</button><button class="primary" onclick="setScreen('home')">Done</button></div></section><section class="panel customizer-preview"><h2>Live Preview</h2><div class="mini-home"><p>Return to Home to see your full layout. Changes are saved automatically.</p><div class="mini-swatch"><span style="background:${esc(t.accent||'#1e5b8c')}"></span><span style="background:${esc(t.card||'#fff')}"></span><span style="background:${esc(t.bg||'#f3f5f7')}"></span></div></div></section></div>`);
  bindBlockDrag();
}
function changeTheme(k,v){const c=state.homeConfig||loadHomeConfig();c.theme=c.theme||defaultHomeConfig().theme;if((k==='bg'||k==='header'||k==='accent'||k==='card'||k==='button'||k==='text'||k==='border')&&!/^#[0-9a-fA-F]{6}$/.test(v))return;c.theme[k]=v;saveHomeConfig(c);applyHomeTheme()}
async function fileDataUrl(file){return new Promise((res,rej)=>{const r=new FileReader();r.onload=()=>res(r.result);r.onerror=rej;r.readAsDataURL(file)})}
async function handleHomeImages(files){for(const f of files){if(!f.type.startsWith('image/'))continue;await dbPut(HOMEIMG_STORE,{id:'homeimg-'+Date.now()+'-'+Math.random().toString(36).slice(2),name:f.name,dataUrl:await fileDataUrl(f)})}await refreshStudyData();renderCustomizer($('app'))}
async function setHomeBackground(file){if(!file)return;const c=state.homeConfig||loadHomeConfig();c.theme=c.theme||defaultHomeConfig().theme;c.theme.bgImage=await fileDataUrl(file);saveHomeConfig(c);renderCustomizer($('app'))}
function clearHomeBackground(){const c=state.homeConfig||loadHomeConfig();c.theme.bgImage='';saveHomeConfig(c);renderCustomizer($('app'))}
async function deleteHomeImage(id){if(!confirm('Delete this home-page image?'))return;await dbDelete(HOMEIMG_STORE,id);state.homeImages=await dbAll(HOMEIMG_STORE);const c=state.homeConfig||loadHomeConfig();c.blocks.forEach(b=>{if(b.imageId===id)b.imageId=''});saveHomeConfig(c);renderCustomizer($('app'))}
function resetHomeCustomization(){if(!confirm('Reset your home-page appearance and layout? Your flashcards and specimen images will not be affected.'))return;state.homeConfig=defaultHomeConfig();saveHomeConfig(state.homeConfig);renderCustomizer($('app'))}
function bindBlockDrag(){document.querySelectorAll('.block-editor-item').forEach(el=>{el.addEventListener('dragstart',e=>e.dataTransfer.setData('text/plain',el.dataset.blockIndex));el.addEventListener('dragover',e=>e.preventDefault());el.addEventListener('drop',e=>{e.preventDefault();const from=Number(e.dataTransfer.getData('text/plain')),to=Number(el.dataset.blockIndex);if(from===to)return;const c=state.homeConfig||loadHomeConfig();const [m]=c.blocks.splice(from,1);c.blocks.splice(to,0,m);saveHomeConfig(c);renderCustomizer($('app'))})})}
function saveQuizSetting(){
  saveSettings({length:Number($('quizLength')?.value||20),focusMissed:!!$('focusMissed')?.checked});
}

function renderQuiz(app){
  const c=state.current,s=c?.species,i=c?.image;
  if(!s||!i){app.innerHTML=shell('Quiz','<div class="panel"><p>No question could be created.</p><button onclick="setScreen(\'home\')">Home</button></div>');return}
  const pct=Math.round((state.session.q/state.length)*100);
  const disabled=state.answered?'disabled':'';
  const imageSrc=i.data;
  const result=state.answered?`
    <div class="answer-result ${(() => {
      const sc=normalizeSci($('scientificInput')?.value||'')===normalizeSci(s.scientific);
      const fc=!s.family || normalize($('familyInput')?.value||'')===normalize(s.family);
      return (state.mode==='scientific'?fc:state.mode==='family'?sc:(sc&&fc))?'correct':'incorrect'
    })()}">
      <strong>${(() => {
        const sc=normalizeSci($('scientificInput')?.value||'')===normalizeSci(s.scientific);
        const fc=!s.family || normalize($('familyInput')?.value||'')===normalize(s.family);
        return (state.mode==='scientific'?sc:state.mode==='family'?fc:(sc&&fc))?'Correct':'Check the answer'
      })()}</strong>
      <div><b>Species:</b> ${esc(s.common)} — <i>${esc(s.scientific)}</i></div><div><b>Family:</b> ${s.family?esc(s.family):'Not required for this practical'}</div>
    </div>`:'';
  app.innerHTML=shell(`${state.mystery?'Mystery Specimen':modeLabel()} — Question ${state.session.q} of ${state.length}`,`
    <div class="progressbar"><span style="width:${pct}%"></span></div>
    <div class="quiz-card">
      <div class="image-wrap"><img src="${esc(imageSrc)}" alt="${esc(s.common)} specimen" onclick="openLightbox('${esc(imageSrc)}')"></div>
      <div class="quiz-side">
        <div class="image-meta">${i.custom?'Your added image':'Course image'} · ${(i.viewTypes||['mixed']).join(', ')}</div>
        ${state.mode!=='family'?`<label>Scientific name<input id="scientificInput" ${disabled} autocomplete="off" spellcheck="false" placeholder="Genus species"></label>`:''}
        ${state.mode!=='scientific' && s.family?`<label>Family<input id="familyInput" ${disabled} autocomplete="off" spellcheck="false" placeholder="Family"></label>`:state.mode!=='scientific'?`<div class="not-required"><b>Family:</b> Not required for this practical.</div>`:''}
        <div class="button-row">${!state.answered?`<button class="primary" onclick="checkAnswer()">Check Answer</button><button onclick="showAnswer()">Show Answer</button>`:`<button class="primary" onclick="nextQuestion()">Next Question</button>`}<button onclick="setScreen('home')">Exit</button></div>
        ${result}
        <div class="tip">Press Enter to check/continue.</div>
      </div>
    </div>
  `);
  ['scientificInput','familyInput'].forEach(id=>$(id)?.addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();state.answered?nextQuestion():checkAnswer()}}));
}

function renderResults(app){
  if(!featureOn('sessionResults')){setScreen('home');return}
  const pct=state.session.totalPoints?Math.round(state.session.points/state.session.totalPoints*100):0;
  app.innerHTML=shell('Quiz Results',`
    <div class="results panel"><div class="score">${pct}%</div><h2>${state.session.correct} / ${state.length} questions fully correct</h2><p>${state.session.points} / ${state.session.totalPoints} requested fields correct.</p>
    <div class="button-row"><button class="primary" onclick="startQuiz(state.mode)">Try Again</button><button onclick="setScreen('home')">Home</button><button onclick="setScreen('progress')">Review Progress</button></div></div>
  `);
}

function renderStudy(app){
  if(!state.selectedSpeciesId) state.selectedSpeciesId=speciesList()[0].id;
  const s=selectedSpecies(), cards=cardsFor(s.id), info=state.speciesInfo[s.id]||{};
  const list=speciesList().map(x=>`<button class="species-list-btn ${x.id===s.id?'selected':''}" onclick="setStudySpecies('${x.id}');render()">${esc(x.common)}<small><i>${esc(x.scientific)}</i></small></button>`).join('');
  const allStudyCards=cardsFor(s.id);
  const activeTag=state.studyTagFilter||'';
  const filteredCards=activeTag?allStudyCards.filter(x=>(x.tags||[]).includes(activeTag)):allStudyCards;
  const c=filteredCards.length?filteredCards[state.studyIndex%filteredCards.length]:null;
  const cardPanel=state.studyMode==='flash' && c ? `
    <div class="flashcard" onclick="state.studyFlipped=!state.studyFlipped;render()">
      <div class="flash-label">${state.studyFlipped?'ANSWER':'QUESTION'}</div>
      <div class="flash-text">${esc(state.studyFlipped?c.back:c.front)}</div>
      <div class="flash-tags">${(c.tags||[]).map(t=>`<span class="tag">${esc(t)}</span>`).join('')}</div>
      <div class="flash-hint">Click card to flip</div>
    </div>
    <div class="flash-controls"><button onclick="studyPrev()">← Previous</button><span>${state.studyIndex+1} / ${filteredCards.length}</span><button onclick="studyNext()">Next →</button></div>
  ` : filteredCards.length ? filteredCards.map(c=>`<div class="study-card"><div><span class="tag">${esc(c.category||'General')}</span><h4>${esc(c.front)}</h4><div class="tag-row">${(c.tags||[]).map(t=>`<span class="tag secondary">${esc(t)}</span>`).join('')}</div></div><div class="card-answer">${esc(c.back)}</div><div class="card-actions"><button onclick="openStudyEditCard('${c.id}')">Edit</button><button class="danger" onclick="deleteCard('${c.id}')">Delete</button></div></div>`).join('') : `<div class="empty">${activeTag?`No cards tagged “${esc(activeTag)}”.`:`No study cards yet. Add your first card for ${esc(s.common)}.`}</div>`;
  app.innerHTML=shell('The Mammal Vault',`
    <div class="study-layout">
      <aside class="species-sidebar"><input class="search" id="speciesSearch" placeholder="Search species..." oninput="filterSpeciesList()"><div id="speciesList">${list}</div></aside>
      <section class="study-main">
        <div class="species-heading"><div><h2>${esc(s.common)} ${state.favorites.includes(s.id)?'⭐':''}</h2><p><i>${esc(s.scientific)}</i> · ${s.family?esc(s.family):'Family not specified'}</p><div class="mastery-ring" style="--p:${masteryPercent(s.id)}%"><span>${masteryPercent(s.id)}%</span></div></div><div class="button-row"><button onclick="openStudyNewCard()">+ Add Card</button><button onclick="toggleFavorite('${s.id}')">${state.favorites.includes(s.id)?'★ Unfavorite':'☆ Favorite'}</button><button onclick="editSpeciesInfo()">Edit Notes / Clues</button><button onclick="setScreen('manage')">Manage Images</button><button onclick="setScreen('addSpecies')">+ Add Species</button></div></div>
        ${featureOn('galleries')?`<div class="species-gallery panel"><div class="gallery-head"><h3>🖼️ Specimen Gallery</h3><button onclick="setScreen('manage')">Manage Images</button></div><div class="vault-gallery">${allImages(s).slice(0,6).map(i=>`<img src="${esc(i.data)}" alt="${esc(s.common)}" onclick="openLightbox('${esc(i.data)}')">`).join('')}</div>${allImages(s).length?`<small>${allImages(s).length} image${allImages(s).length===1?'':'s'} in this species collection.</small>`:'<p class="muted">Add specimen images in Images.</p>'}</div>`:''}<div class="study-tabs"><button class="${state.studyMode==='browse'?'active':''}" onclick="state.studyMode='browse';render()">Browse Cards</button><button class="${state.studyMode==='flash'?'active':''}" onclick="state.studyMode='flash';state.studyIndex=0;state.studyFlipped=false;render()">Flashcard Mode</button></div>
        ${info.notes?`<div class="notes panel"><h3>My Species Notes</h3><div>${esc(info.notes).replace(/\n/g,'<br>')}</div></div>`:''}${info.clues&&featureOn('clues')?`<div class="notes panel clue-panel"><h3>🔎 My Identification Clues</h3><div>${esc(info.clues).replace(/\n/g,'<br>')}</div></div>`:''}
        <div class="cards-header"><h3>${state.studyMode==='flash'?'Flashcards':'Study Cards'} <span>${filteredCards.length}${activeTag?` / ${cards.length}`:''}</span></h3><div class="filter-row"><label>Filter by tag<select id="studyTagFilter" onchange="state.studyTagFilter=this.value;state.studyIndex=0;state.studyFlipped=false;render()"><option value="">All tags</option>${[...new Set(state.cards.flatMap(x=>x.tags||[]))].sort().map(t=>`<option value="${esc(t)}" ${t===activeTag?'selected':''}>${esc(t)}</option>`).join('')}</select></label>${state.studyMode==='flash'&&filteredCards.length?`<button onclick="shuffleStudyCards()">Shuffle</button>`:''}</div></div>
        ${cardPanel}
      </section>
    </div>
  `);
}
function filterSpeciesList(){
  const q=normalize($('speciesSearch')?.value||'');
  document.querySelectorAll('.species-list-btn').forEach(b=>b.style.display=normalize(b.textContent).includes(q)?'':'none')
}
function filteredStudyCards(){const all=cardsFor(selectedSpecies().id),tag=state.studyTagFilter||'';return tag?all.filter(x=>(x.tags||[]).includes(tag)):all}
function studyNext(){const cards=filteredStudyCards();if(cards.length){state.studyIndex=(state.studyIndex+1)%cards.length;state.studyFlipped=false;render()}}
function studyPrev(){const cards=filteredStudyCards();if(cards.length){state.studyIndex=(state.studyIndex-1+cards.length)%cards.length;state.studyFlipped=false;render()}}
function shuffleStudyCards(){const cards=filteredStudyCards();if(cards.length){state.studyIndex=Math.floor(Math.random()*cards.length);state.studyFlipped=false;render()}}

function openStudyNewCard(){
  state.editor={id:null,speciesId:selectedSpecies().id,front:'',back:'',category:'General',customCategory:'',tags:[]};
  state.screen='cardEditor';render();
}
function openStudyEditCard(id){
  const c=state.cards.find(x=>x.id===id);if(!c)return;
  state.editor={...c};state.screen='cardEditor';render();
}
function editorValue(id){return $(id)?.value||''}
function parseTags(raw){return [...new Set(String(raw||'').split(',').map(x=>x.trim()).filter(Boolean))]}
function selectedEditorTags(){return [...document.querySelectorAll('#editorTags .tag-chip')].map(x=>x.dataset.tag).filter(Boolean)}
async function submitCardEditor(){
  const speciesId=editorValue('cardSpecies');
  const front=editorValue('cardFront').trim();
  const back=editorValue('cardBack').trim();
  const categoryChoice=editorValue('cardCategory')||'General';
  const customCategory=editorValue('customCategory').trim();
  const category=categoryChoice==='__custom__'?(customCategory||'Custom'):categoryChoice;
  const tags=selectedEditorTags();
  if(!speciesId||!front||!back){$('editorError').textContent='Please fill in the species, front, and back.';return}
  if(categoryChoice==='__custom__'&&!customCategory){$('editorError').textContent='Enter a custom category or choose an existing category.';return}
  await saveCard({...state.editor,speciesId,front,back,category,customCategory,tags,order:state.editor.order??cardsFor(speciesId).length});
  state.editor=null;state.selectedSpeciesId=speciesId;state.screen='study';
}
function cancelCardEditor(){state.editor=null;state.screen='study';render()}
async function saveCard(o){
  const card={id:o.id||('card-'+Date.now()+'-'+Math.random().toString(36).slice(2)),speciesId:o.speciesId,front:o.front,back:o.back,category:o.category||'General',customCategory:o.customCategory||'',tags:Array.isArray(o.tags)?o.tags:parseTags(o.tags),order:o.order??0};
  await dbPut(CARD_STORE,card);await refreshStudyData();
}
function editCard(id){openStudyEditCard(id)}
async function deleteCard(id){if(!confirm('Delete this study card?'))return;await dbDelete(CARD_STORE,id);await refreshStudyData();render()}

async function editSpeciesInfo(){const s=selectedSpecies(),old=state.speciesInfo[s.id]||{};const notes=prompt(`Your notes for ${s.common}:`,old.notes||'');if(notes===null)return;const clues=prompt(`Your identification clues for ${s.common}:`,old.clues||'');if(clues===null)return;await dbPut(INFO_STORE,{speciesId:s.id,notes,clues});await refreshStudyData();render()}

function renderCardEditor(app){
  const e=state.editor||{speciesId:selectedSpecies().id,front:'',back:'',category:'General',customCategory:'',tags:[]};
  const speciesOptions=speciesList().map(x=>`<option value="${x.id}" ${x.id===e.speciesId?'selected':''}>${esc(x.common)} — ${esc(x.scientific)}</option>`).join('');
  const cats=['General','Identification','Anatomy','Skull / Teeth','Dentition','Pelage / Skin','Habitat','Diet','Behavior','Taxonomy','Other'];
  const isCustomCat=!!e.customCategory || !cats.includes(e.category||'General');
  const catOptions=cats.map(x=>`<option value="${esc(x)}" ${!isCustomCat&&x===(e.category||'General')?'selected':''}>${esc(x)}</option>`).join('')+`<option value="__custom__" ${isCustomCat?'selected':''}>Custom…</option>`;
  const tags=Array.isArray(e.tags)?e.tags:parseTags(e.tags);
  const suggested=[...new Set(state.cards.flatMap(x=>x.tags||[]))].sort();
  const previewFront=esc(e.front||'Your question will appear here.');
  const previewBack=esc(e.back||'Your answer will appear here.');
  app.innerHTML=shell(e.id?'Edit Study Card':'Create Study Card',`
    <div class="editor-layout">
      <section class="panel editor-form">
        <div class="form-grid">
          <label>Species<select id="cardSpecies">${speciesOptions}</select></label>
          <label>Category<select id="cardCategory">${catOptions}</select></label>
        </div>
        <div id="customCategoryWrap" class="custom-field" style="display:${isCustomCat?'block':'none'}">
          <label>Custom category<input id="customCategory" value="${esc(e.customCategory||(!cats.includes(e.category||'General')?e.category:'')||'')}" placeholder="e.g., Exam Review, Measurements, Comparison"></label>
        </div>
        <label>Front / Question<textarea id="cardFront" rows=8 placeholder="Example: What family does the eastern wood rat belong to?">${esc(e.front)}</textarea></label>
        <label>Back / Answer<textarea id="cardBack" rows=8 placeholder="Example: Cricetidae">${esc(e.back)}</textarea></label>
        <div class="tag-editor">
          <div class="tag-editor-title">Tags</div>
          <div class="tag-input-row"><input id="tagInput" list="tagSuggestions" placeholder="Type a tag, then click Add (or press Enter)"><datalist id="tagSuggestions">${suggested.map(t=>`<option value="${esc(t)}">`).join('')}</datalist><button type="button" onclick="addEditorTag()">Add tag</button></div>
          <div id="editorTags" class="tag-chip-list">${tags.map(t=>`<span class="tag-chip" data-tag="${esc(t)}">${esc(t)} <button type="button" aria-label="Remove ${esc(t)}" onclick="removeEditorTag(this)">×</button></span>`).join('')}</div>
          <div class="muted">Use tags to organize cards such as <b>skull</b>, <b>dentition</b>, <b>family</b>, <b>exam</b>, or any custom label you want. Tags are saved with the card.</div>
        </div>
        <div id="editorError" class="editor-error"></div>
        <div class="button-row"><button class="primary" onclick="submitCardEditor()">Save Card</button><button onclick="cancelCardEditor()">Cancel</button></div>
      </section>
      <section class="panel live-preview"><h2>Full Card Preview</h2>
        <div class="preview-card"><div class="preview-label">FRONT</div><div id="previewFront" class="preview-text">${previewFront}</div><div class="preview-divider"></div><div class="preview-label">BACK</div><div id="previewBack" class="preview-text">${previewBack}</div><div class="preview-species"><span class="preview-base-species">${esc(speciesById(e.speciesId)?.common||'')} ·</span> <span id="previewCategory">${esc(e.category||'General')}</span><div id="previewTags" class="tag-row">${tags.map(t=>`<span class="tag secondary">${esc(t)}</span>`).join('')}</div></div></div>
        <p class="muted">The preview updates as you type. The front and back stay visible together while you build the card.</p>
      </section>
    </div>
  `);
  ['cardFront','cardBack','cardSpecies','cardCategory','customCategory'].forEach(id=>$(id)?.addEventListener('input',updateCardPreview));
  $('cardCategory')?.addEventListener('change',toggleCustomCategory);
  $('tagInput')?.addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();addEditorTag()}});
}
function toggleCustomCategory(){
  const custom=$('cardCategory')?.value==='__custom__';
  const wrap=$('customCategoryWrap');if(wrap)wrap.style.display=custom?'block':'none';
  updateCardPreview();
}
function addEditorTag(){
  const input=$('tagInput');if(!input)return;
  const values=parseTags(input.value);if(!values.length)return;
  const current=selectedEditorTags();
  values.forEach(t=>{if(!current.some(x=>x.toLowerCase()===t.toLowerCase()))current.push(t)});
  renderEditorTags(current);input.value='';input.focus();updateCardPreview();
}
function removeEditorTag(btn){
  const chip=btn.closest('.tag-chip');if(!chip)return;
  chip.remove();updateCardPreview();
}
function renderEditorTags(tags){
  const wrap=$('editorTags');if(!wrap)return;
  wrap.innerHTML=tags.map(t=>`<span class="tag-chip" data-tag="${esc(t)}">${esc(t)} <button type="button" aria-label="Remove ${esc(t)}" onclick="removeEditorTag(this)">×</button></span>`).join('');
}
function updateCardPreview(){
  const f=editorValue('cardFront'),b=editorValue('cardBack'),sid=editorValue('cardSpecies'),choice=editorValue('cardCategory');
  const custom=editorValue('customCategory');
  const cat=choice==='__custom__'?(custom||'Custom'):choice||'General';
  if($('previewFront'))$('previewFront').textContent=f||'Your question will appear here.';
  if($('previewBack'))$('previewBack').textContent=b||'Your answer will appear here.';
  const sp=speciesById(sid);
  const ps=document.querySelector('.preview-species');if(ps){const base=ps.querySelector('.preview-base-species');if(base)base.textContent=`${sp?.common||''} ·`; }
  const pc=$('previewCategory');if(pc)pc.textContent=cat;
  const pt=$('previewTags');if(pt)pt.innerHTML=selectedEditorTags().map(t=>`<span class="tag secondary">${esc(t)}</span>`).join('');
}
function renderManage(app){
  if(!state.selectedSpeciesId)state.selectedSpeciesId=speciesList()[0].id;
  const s=selectedSpecies(),imgs=allImages(s);
  const list=speciesList().map(x=>`<button class="species-list-btn ${x.id===s.id?'selected':''}" onclick="setStudySpecies('${x.id}');render()">${esc(x.common)}<small><i>${esc(x.scientific)}</i></small></button>`).join('');
  app.innerHTML=shell('Manage Species & Images',`
    <div class="manage-layout">
      <aside class="species-sidebar"><input class="search" placeholder="Search species..." oninput="filterSpeciesList()"><div>${list}</div></aside>
      <section class="study-main">
        <div class="species-heading"><div><h2>${esc(s.common)}</h2><p><i>${esc(s.scientific)}</i> · ${esc(s.family)}</p></div><div class="button-row"><button onclick="setScreen('study')">Study this species</button><button onclick="setScreen('addSpecies')">+ Add Species</button></div></div>
        <div class="paste-box" id="pasteBox" tabindex="0"><strong>Paste an image here</strong><span>Copy an image anywhere, then click here and press <b>Ctrl + V</b>.</span></div>
        <div class="upload-row"><label class="file-button">Add image files<input id="imageFiles" type="file" accept="image/*" multiple onchange="handleFiles(this.files)"></label><select id="newImageType"><option value="mixed">Mixed / Other</option><option value="skull">Skull / Teeth</option><option value="skin">Skin / Whole</option></select></div>
        <div class="image-grid">${imgs.map(i=>`<div class="image-admin"><img src="${esc(i.data)}" onclick="openLightbox('${esc(i.data)}')"><div class="image-admin-meta">${i.custom?'Your image':'Course image'}<select onchange="setImageTag('${esc(i.id)}',this.value)"><option value="mixed" ${(i.viewTypes||[]).includes('mixed')?'selected':''}>Mixed / Other</option><option value="skull" ${(i.viewTypes||[]).includes('skull')?'selected':''}>Skull / Teeth</option><option value="skin" ${(i.viewTypes||[]).includes('skin')?'selected':''}>Skin / Whole</option></select>${i.custom?`<button class="danger" onclick="removeCustomImage('${esc(i.id)}')">Delete</button>`:''}</div></div>`).join('')}</div>
      </section>
    </div>
  `);
  setTimeout(()=>{$('pasteBox')?.focus();$('pasteBox')?.addEventListener('paste',handlePaste)},0)
}
function currentImageType(){return $('newImageType')?.value||'mixed'}
async function handlePaste(e){
  const items=[...(e.clipboardData?.items||[])];
  const item=items.find(x=>x.type.startsWith('image/'));
  if(!item)return;
  const file=item.getAsFile(); if(file)await saveImageFile(file,currentImageType());
}
async function handleFiles(files){for(const f of files)await saveImageFile(f,currentImageType())}
async function saveImageFile(file,viewType){
  if(!file.type.startsWith('image/'))return;
  const dataUrl=await new Promise((res,rej)=>{const r=new FileReader();r.onload=()=>res(r.result);r.onerror=rej;r.readAsDataURL(file)});
  await putCustomImage({id:'custom-'+Date.now()+'-'+Math.random().toString(36).slice(2),speciesId:selectedSpecies().id,name:file.name||'Pasted image',dataUrl,viewTypes:[viewType,'mixed'].filter((x,i,a)=>a.indexOf(x)===i),createdAt:Date.now()});
  await refreshStudyData();render();
}
async function removeCustomImage(id){if(!confirm('Delete this image from your trainer?'))return;await deleteCustomImage(id);await refreshStudyData();render()}
async function setImageTag(id,type){
  if(id.startsWith('custom:'))return;
  state.tagOverrides[id]=[type,'mixed'].filter((x,i,a)=>a.indexOf(x)===i);saveTags();render()
}


function startDailyChallenge(){state.sessionPlan=null;state.keepPlan=true;state.length=5;state.focusMissed=true;startQuiz('full')}
function startSurprise(){state.sessionPlan=null;state.keepPlan=true;state.length=1;state.focusMissed=false;startQuiz('full')}
function startMystery(){state.sessionPlan=null;state.length=1;state.focusMissed=false;state.mystery=true;state.mode='full';state.answered=false;state.session={q:0,correct:0,points:0,totalPoints:0};state.lastSpecies=null;state.screen='quiz';nextQuestion()}
function startSmartReview(){const p=loadProgress(),ids=speciesList().filter(s=>(p[s.id]?.wrong||0)>0||!(p[s.id]?.seen)).sort((a,b)=>(p[b.id]?.wrong||0)-(p[a.id]?.wrong||0)).map(s=>s.id);state.sessionPlan=ids.length?ids:null;state.keepPlan=true;state.length=Math.min(10,Math.max(5,ids.length||5));state.focusMissed=false;startQuiz('full')}
function startFavorites(){const ids=state.favorites.filter(id=>speciesById(id));if(!ids.length){alert('Star species in The Mammal Vault first.');return}state.sessionPlan=ids;state.keepPlan=true;state.length=Math.min(10,ids.length);state.focusMissed=false;startQuiz('full')}
function openStudySpecies(id){setStudySpecies(id);setScreen('study')}
function renderStudyBuilder(app){const options=speciesList().map(s=>`<option value="${s.id}">${esc(s.common)} — ${esc(s.scientific)}</option>`).join('');app.innerHTML=shell('Build My Study Session',`<div class="panel session-builder"><h2>Build a study session around what you need most.</h2><div class="form-grid"><label>Session length<select id="builderLength"><option value="5">5 questions</option><option value="10" selected>10 questions</option><option value="15">15 questions</option><option value="20">20 questions</option></select></label><label>Practice mode<select id="builderMode"><option value="full">Full Practical</option><option value="skull">Skull / Teeth</option><option value="skin">Skin / Whole</option><option value="scientific">Scientific Name</option><option value="family">Family</option></select></label></div><h3>Focus</h3><div class="check-grid"><label><input type="checkbox" id="bTrouble" checked> Trouble species</label><label><input type="checkbox" id="bUnmastered" checked> Unmastered species</label><label><input type="checkbox" id="bNew"> New / unseen species</label><label><input type="checkbox" id="bFavorites"> Favorites</label></div><h3>Exact species (optional)</h3><select id="builderSpecies" multiple size="8">${options}</select><p class="muted">Leave exact species empty to let the Vault build the session automatically.</p><div class="button-row"><button class="primary" onclick="buildStudySession()">Build Session</button><button onclick="setScreen('home')">Cancel</button></div></div>`)}
function buildStudySession(){const len=Number($('builderLength').value||10),mode=$('builderMode').value,p=loadProgress();let pool=[];const add=a=>a.forEach(x=>{if(x&&!pool.includes(x.id))pool.push(x.id)});add([...$('builderSpecies').selectedOptions].map(o=>speciesById(o.value)));if($('bTrouble').checked)add(speciesList().filter(s=>(p[s.id]?.wrong||0)>0));if($('bUnmastered').checked)add(speciesList().filter(s=>masteryPercent(s.id)<80));if($('bNew').checked)add(speciesList().filter(s=>!(p[s.id]?.seen)));if($('bFavorites').checked)add(state.favorites.map(speciesById));if(!pool.length)pool=speciesList().map(s=>s.id);pool.sort(()=>Math.random()-.5);state.sessionPlan=pool;state.keepPlan=true;state.length=len;state.focusMissed=false;startQuiz(mode)}
function featureDescription(k){return ({collection:'Your species collection.',badges:'Earn study achievements.',streak:'Track consecutive study days.',daily:'Five-question daily challenge.',surprise:'One random specimen.',galleries:'Use specimen image galleries.',mystery:'Mystery specimen challenge.',trouble:'Surface species you miss.',smartReview:'Automatically review weak areas.',sessionResults:'Show end-of-session results.',xp:'Earn XP for study activity.',themes:'Use custom appearance tools.',journal:'Personal notes for each species.',studyThis:'Quick study access for each species.',mastery:'Show mastery for each species.',recent:'Show recently added species.',favorites:'Star species for quick access.',stats:'Show study statistics.',history:'Show your study history.',clues:'Personal identification clues.',studyBuilder:'Build custom study sessions.'}[k]||'Optional study feature.')}
function renderSettings(app){const f=state.features||loadFeatures(),labels={collection:'Mammal Vault / Collection',badges:'Mastery Badges',streak:'Study Streak',daily:'Daily Challenge',surprise:'Surprise Me',galleries:'Specimen Galleries',mystery:'Mystery Specimen',trouble:'Trouble Species',smartReview:'Smart Review',sessionResults:'Session Results',xp:'XP & Levels',themes:'Custom Themes',journal:'Personal Field Journal',studyThis:'Study This Species',mastery:'Species Mastery',recent:'Recently Added',favorites:'Favorites',stats:'Detailed Statistics',history:'Study History',clues:'Identification Clues',studyBuilder:'Build My Study Session'};const rows=Object.entries(labels).map(([k,l])=>`<label class="toggle-row"><span><b>${esc(l)}</b><small>${featureDescription(k)}</small></span><input type="checkbox" ${f[k]!==false?'checked':''} onchange="setFeature('${k}',this.checked)"><i class="toggle-ui"></i></label>`).join('');const set=loadSettings();app.innerHTML=shell('Settings',`<div class="settings-layout"><section class="panel"><h2>Feature Access</h2><p class="muted">Turn individual features on/off. Disabled features are removed from the homepage access bar and dashboard.</p><div class="toggle-list">${rows}</div><div class="button-row"><button onclick="enableAllFeatures()">Enable All</button><button onclick="disableOptionalFeatures()">Hide Optional Features</button></div></section><section class="panel"><h2>Practical Settings</h2><label>Default practical length<input id="quizLength" type="number" min="1" max="100" value="${Number(set.length||20)}" onchange="saveQuizSetting()"></label><label class="toggle-row"><span><b>Focus missed species by default</b><small>Weight species you've missed more heavily.</small></span><input id="focusMissed" type="checkbox" ${set.focusMissed?'checked':''} onchange="saveQuizSetting()"><i class="toggle-ui"></i></label><h2>Manage</h2><div class="button-row"><button onclick="setScreen('addSpecies')">+ Add Species</button><button onclick="setScreen('customize')">🎨 Customize Home</button><button onclick="exportBackup()">Export Backup</button><button onclick="triggerImportBackup()">Import Backup</button></div><input id="backupFile" type="file" accept=".json" hidden onchange="importBackup(this.files[0])"></section></div>`)}
function setFeature(k,v){state.features=state.features||loadFeatures();state.features[k]=!!v;saveFeatures(state.features);render()}
function enableAllFeatures(){saveFeatures(featureDefaults());render()}
function disableOptionalFeatures(){const f=featureDefaults();['badges','streak','daily','surprise','galleries','mystery','trouble','smartReview','xp','themes','journal','recent','favorites','stats','history','clues'].forEach(k=>f[k]=false);saveFeatures(f);render()}
async function addSpeciesFromForm(){const common=$('newCommon').value.trim(),scientific=$('newScientific').value.trim(),family=$('newFamily').value.trim();if(!common||!scientific){$('speciesError').textContent='Common name and scientific name are required.';return}const id='custom-species-'+Date.now()+'-'+Math.random().toString(36).slice(2);const s={id,common,scientific,family,images:[],custom:true,createdAt:Date.now()};await dbPut(SPECIES_STORE,s);await dbPut(INFO_STORE,{speciesId:id,notes:$('newNotes').value||'',clues:$('newClues').value||''});await refreshStudyData();state.selectedSpeciesId=id;setScreen('manage')}
function renderAddSpecies(app){app.innerHTML=shell('Add Species',`<div class="panel add-species-form"><h2>Add a new mammal to The Mammal Vault</h2><p class="muted">New species automatically appear in your Vault, image manager, study cards, and practical pool.</p><div class="form-grid"><label>Common name<input id="newCommon" placeholder="e.g., Bobcat"></label><label>Scientific name<input id="newScientific" placeholder="e.g., Lynx rufus"></label><label>Family <span class="muted">(optional)</span><input id="newFamily" placeholder="e.g., Felidae"></label></div><label>My species notes<textarea id="newNotes" rows="5" placeholder="Anything you want to remember..."></textarea></label><label>My identification clues<textarea id="newClues" rows="5" placeholder="Diagnostic features you want to remember..."></textarea></label><div id="speciesError" class="editor-error"></div><div class="button-row"><button class="primary" onclick="addSpeciesFromForm()">Add to Mammal Vault</button><button onclick="setScreen('study')">Cancel</button></div></div>`)}
function renderProgress(app){
  const p=loadProgress();
  const rows=speciesList().map(s=>{const r=p[s.id]||{seen:0,correct:0,wrong:0};const pct=r.seen?Math.round(r.correct/r.seen*100):0;return `<tr><td>${esc(s.common)}</td><td><i>${esc(s.scientific)}</i></td><td>${r.seen}</td><td>${r.correct}</td><td>${r.wrong}</td><td>${pct}%</td></tr>`}).join('');
  app.innerHTML=shell('Progress',`<div class="panel"><div class="table-wrap"><table><thead><tr><th>Species</th><th>Scientific name</th><th>Seen</th><th>Correct</th><th>Missed</th><th>Accuracy</th></tr></thead><tbody>${rows}</tbody></table></div><div class="button-row"><button onclick="resetProgress()">Reset Practical Progress</button><button onclick="exportBackup()">Export Full Backup</button></div></div>`)
}
function resetProgress(){if(confirm('Reset practical quiz progress?')){localStorage.removeItem(PROGRESS_KEY);render()}}

function openLightbox(src){$('lightboxImg').src=src;$('lightbox').classList.add('open')}
function closeLightbox(){ $('lightbox').classList.remove('open') }

async function blobToDataUrl(blob){return await new Promise((res,rej)=>{const r=new FileReader();r.onload=()=>res(r.result);r.onerror=rej;r.readAsDataURL(blob)})}
async function exportBackup(){
  const images=state.customImages.map(x=>({id:x.id,speciesId:x.speciesId,name:x.name,dataUrl:x.dataUrl,viewTypes:x.viewTypes,createdAt:x.createdAt}));
  const homeImages=state.homeImages.map(x=>({id:x.id,name:x.name,dataUrl:x.dataUrl}));
  const backup={version:4,createdAt:new Date().toISOString(),customImages:images,studyCards:state.cards,speciesInfo:state.speciesInfo,customSpecies:state.customSpecies,tagOverrides:state.tagOverrides,progress:loadProgress(),settings:loadSettings(),features:state.features||loadFeatures(),favorites:state.favorites,history:loadHistory(),homeConfig:state.homeConfig||loadHomeConfig(),homeImages};
  const blob=new Blob([JSON.stringify(backup)],{type:'application/json'}),url=URL.createObjectURL(blob);
  const a=document.createElement('a');a.href=url;a.download='mammalogy-trainer-backup.json';a.click();URL.revokeObjectURL(url)
}
function triggerImportBackup(){$('backupFile')?.click()}
async function importBackup(file){
  if(!file)return;
  try{
    const b=JSON.parse(await file.text());
    if(!b||!Array.isArray(b.customImages)||!Array.isArray(b.studyCards))throw new Error('Invalid backup');
    for(const x of b.customImages)await dbPut(IMG_STORE,x);
    for(const x of b.studyCards)await dbPut(CARD_STORE,x);
    for(const x of (b.homeImages||[]))await dbPut(HOMEIMG_STORE,x);
    for(const x of (b.customSpecies||[]))await dbPut(SPECIES_STORE,x);
    if(b.homeConfig)localStorage.setItem(HOME_KEY,JSON.stringify(b.homeConfig));
    for(const [id,obj] of Object.entries(b.speciesInfo||{}))await dbPut(INFO_STORE,{speciesId:id,notes:obj.notes||''});
    if(b.tagOverrides)localStorage.setItem(TAGS_KEY,JSON.stringify(b.tagOverrides));
    if(b.progress)localStorage.setItem(PROGRESS_KEY,JSON.stringify(b.progress));
    if(b.settings)localStorage.setItem(SETTINGS_KEY,JSON.stringify(b.settings));
    if(b.features)localStorage.setItem(FEATURES_KEY,JSON.stringify(b.features));
    if(b.favorites)localStorage.setItem(FAVORITES_KEY,JSON.stringify(b.favorites));
    if(b.history)localStorage.setItem(HISTORY_KEY,JSON.stringify(b.history));
    await refreshStudyData();loadTags();alert('Backup imported successfully.');render()
  }catch(e){alert('Could not import that backup.')}
}

function boot(){
  loadTags();state.features=loadFeatures();state.favorites=loadFavorites();state.homeConfig=loadHomeConfig();const s=loadSettings();state.length=Number(s.length||20);state.focusMissed=!!s.focusMissed;
  refreshStudyData().then(()=>{state.selectedSpeciesId=speciesList()[0]?.id;render()});
}
document.addEventListener('keydown',e=>{if(e.key==='Escape')closeLightbox()});
boot();
