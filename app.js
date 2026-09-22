
const DB_VERSION=4;
const SUBJECTS={mammalogy:{name:'Mammalogy',vault:'The Mammal Vault',icon:'🦌',description:'Mammal species, specimens, skulls, teeth, and practical identification.'},ornithology:{name:'Ornithology',vault:'The Bird Vault',icon:'🦅',description:'Build the same kind of practical trainer for your future ornithology class.'},herpetology:{name:'Herpetology',vault:'The Herp Vault',icon:'🐍',description:'A separate practical workspace for reptiles and amphibians.'}};
function currentSubject(){return SUBJECTS[state.subject]||SUBJECTS.mammalogy}
function dbName(){return state.subject==='mammalogy'?'mammalogy-practical-db':`mammalogy-practical-${state.subject}-db`}
function subjectKey(k){return state.subject==='mammalogy'?k:`${k}-${state.subject}`}
const IMG_STORE='customImages', CARD_STORE='studyCards', INFO_STORE='speciesInfo', HOMEIMG_STORE='homeImages', SPECIES_STORE='customSpecies';
const TAGS_KEY='mammalogy-tag-overrides', MASKS_KEY='mammalogy-quiz-masks', EDITS_KEY='mammalogy-image-edits', PROGRESS_KEY='mammalogy-progress', SETTINGS_KEY='mammalogy-settings', HOME_KEY='mammalogy-home-customization', FEATURES_KEY='mammalogy-feature-toggles', FAVORITES_KEY='mammalogy-favorites', HISTORY_KEY='mammalogy-study-history';
const IMAGE_TYPES_KEY='mammalogy-image-types';
const DEFAULT_IMAGE_TYPES=[{id:'mixed',label:'Mixed / Other'},{id:'skull',label:'Skull / Teeth'},{id:'skin',label:'Skin / Whole'}];
function loadImageTypes(){try{const saved=JSON.parse(localStorage.getItem(subjectKey(IMAGE_TYPES_KEY))||'null');return Array.isArray(saved)&&saved.length?saved:DEFAULT_IMAGE_TYPES.map(x=>({...x}))}catch{return DEFAULT_IMAGE_TYPES.map(x=>({...x}))}}
function saveImageTypes(types){localStorage.setItem(subjectKey(IMAGE_TYPES_KEY),JSON.stringify(types))}
function imageTypes(){return loadImageTypes()}
function imageTypeOptions(selected='mixed'){return imageTypes().map(t=>`<option value="${esc(t.id)}" ${t.id===selected?'selected':''}>${esc(t.label)}</option>`).join('')}
function slugImageType(label){let id=normalize(label).replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'').slice(0,40)||`type-${Date.now()}`;const used=new Set(imageTypes().map(x=>x.id));let base=id,n=2;while(used.has(id)){id=`${base}-${n++}`}return id}
function addImageType(){const input=$('newImageTypeName');const label=input?.value.trim();if(!label)return;const types=imageTypes();if(types.some(x=>normalize(x.label)===normalize(label))){alert('That image category already exists.');return}types.push({id:slugImageType(label),label});saveImageTypes(types);if(input)input.value='';render()}
function removeImageType(id){if(DEFAULT_IMAGE_TYPES.some(x=>x.id===id)){alert('The built-in image categories cannot be deleted.');return}if(!imageTypes().some(x=>x.id===id))return;if(!confirm('Remove this custom image category? Existing images will keep their saved tag.'))return;saveImageTypes(imageTypes().filter(x=>x.id!==id));render()}


const state={
  subject:'mammalogy', screen:'home', mode:'full', length:20, current:null, answered:false, editor:null,
  session:{q:0,correct:0,points:0,totalPoints:0}, lastSpecies:null, focusMissed:false,
  customImages:[], customSpecies:[], pendingSpeciesImages:[], tagOverrides:{}, maskOverrides:{}, imageEdits:{}, cards:[], speciesInfo:{}, homeImages:[], homeConfig:null,
  maskEditor:null, cardBankQuery:'', cardBankSpecies:'', pendingSpeciesForm:{common:'',scientific:'',family:'',notes:'',clues:''}, selectedSpeciesId:null, studyMode:'browse', studyIndex:0, studyFlipped:false, studyTagFilter:'', sessionPlan:null, mystery:false, features:null, favorites:[]
};
function speciesList(){const source=(state.subject==='mammalogy'&&typeof SOURCE_SPECIES!=='undefined'&&Array.isArray(SOURCE_SPECIES))?SOURCE_SPECIES:[];return [...source,...state.customSpecies]}
function featureDefaults(){return {collection:true,badges:true,streak:true,daily:true,surprise:true,galleries:true,mystery:true,trouble:true,smartReview:true,sessionResults:true,xp:true,themes:true,journal:true,studyThis:true,mastery:true,recent:true,favorites:true,stats:true,history:true,clues:true,studyBuilder:true}}
function loadFeatures(){try{return {...featureDefaults(),...JSON.parse(localStorage.getItem(subjectKey(FEATURES_KEY))||'{}')}}catch{return featureDefaults()}}
function saveFeatures(f){state.features={...featureDefaults(),...f};localStorage.setItem(subjectKey(FEATURES_KEY),JSON.stringify(state.features))}
function featureOn(k){return (state.features||loadFeatures())[k]!==false}
function loadFavorites(){try{return JSON.parse(localStorage.getItem(subjectKey(FAVORITES_KEY))||'[]')}catch{return[]}}
function saveFavorites(){localStorage.setItem(subjectKey(FAVORITES_KEY),JSON.stringify(state.favorites))}
function toggleFavorite(id){state.favorites.includes(id)?state.favorites=state.favorites.filter(x=>x!==id):state.favorites.push(id);saveFavorites();render()}
function loadHistory(){try{return JSON.parse(localStorage.getItem(subjectKey(HISTORY_KEY))||'[]')}catch{return[]}}
function saveHistory(h){localStorage.setItem(subjectKey(HISTORY_KEY),JSON.stringify(h.slice(-1000)))}
function studyStreak(){const days=[...new Set(loadHistory().map(x=>new Date(x.time).toISOString().slice(0,10)))].sort().reverse();if(!days.length)return 0;let streak=1;for(let i=0;i<days.length-1;i++){const a=new Date(days[i]),b=new Date(days[i+1]);if(Math.round((a-b)/86400000)===1)streak++;else break}return streak}
function xpTotal(){const p=loadProgress();return Object.values(p).reduce((n,r)=>n+(r.correct||0)*10,0)+state.cards.length*2+state.customImages.length*3}
function masteryPercent(id){const r=speciesProgress(id);return r.seen?Math.min(100,Math.round(r.correct/r.seen*100)):0}
function badgeList(){const p=loadProgress(),total=speciesList().length,mastered=speciesList().filter(s=>masteryPercent(s.id)>=80).length;return [{icon:'🌱',name:'First Look',ok:Object.keys(p).length>0},{icon:'🔎',name:'Identifier',ok:Object.values(p).some(r=>(r.correct||0)>=5)},{icon:'🦴',name:'Bone Collector',ok:state.cards.some(c=>/skull|teeth|dentition/i.test(c.category||'')||/skull|teeth|dentition/i.test((c.tags||[]).join(' ')))},{icon:'📚',name:'Study Hoarder',ok:state.cards.length>=25},{icon:'🧬',name:'Family Scholar',ok:speciesList().some(s=>s.family&&masteryPercent(s.id)>=80)},{icon:'🏆',name:'Vault Keeper',ok:mastered>0&&mastered===total}]}


const $=id=>document.getElementById(id);
function normalize(s){return(s||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[“”‘’]/g,"'").replace(/\s+/g,' ').trim().toLowerCase()}
function normalizeSci(s){return normalize(s).replace(/[.]/g,'')}
function esc(s){return String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}
function sciHtml(s){return `<i class=\"scientific-name\">${esc(s||'')}</i>`}
function subjectTitle(){return currentSubject().vault}
function speciesById(id){return speciesList().find(s=>s.id===id)}
function loadProgress(){try{return JSON.parse(localStorage.getItem(subjectKey(PROGRESS_KEY))||'{}')}catch{return{}}}
function saveProgress(p){localStorage.setItem(subjectKey(PROGRESS_KEY),JSON.stringify(p))}
function recordResult(id,ok){const p=loadProgress(),r=p[id]||{seen:0,correct:0,wrong:0};r.seen++;ok?r.correct++:r.wrong++;r.lastSeen=new Date().toISOString();p[id]=r;saveProgress(p);const h=loadHistory();h.push({time:new Date().toISOString(),speciesId:id,ok});saveHistory(h)}
const DEFAULT_GOOGLE_PHOTOS_CLIENT_ID='104160751458-i5q7crqrmatotollp876nr0avd38nl22.apps.googleusercontent.com';
function loadSettings(){try{return JSON.parse(localStorage.getItem(subjectKey(SETTINGS_KEY))||'{}')}catch{return{}}}
function saveSettings(s){localStorage.setItem(subjectKey(SETTINGS_KEY),JSON.stringify(s))}
function loadTags(){try{state.tagOverrides=JSON.parse(localStorage.getItem(subjectKey(TAGS_KEY))||'{}')}catch{state.tagOverrides={}}}
function saveTags(){localStorage.setItem(subjectKey(TAGS_KEY),JSON.stringify(state.tagOverrides))}
function loadMasks(){try{state.maskOverrides=JSON.parse(localStorage.getItem(subjectKey(MASKS_KEY))||'{}')}catch{state.maskOverrides={}}}
function saveMasks(){localStorage.setItem(subjectKey(MASKS_KEY),JSON.stringify(state.maskOverrides))}
function loadImageEdits(){try{state.imageEdits=JSON.parse(localStorage.getItem(subjectKey(EDITS_KEY))||'{}')}catch{state.imageEdits={}}}
function saveImageEdits(){localStorage.setItem(subjectKey(EDITS_KEY),JSON.stringify(state.imageEdits))}

function openDb(){
  return new Promise((res,rej)=>{
    const r=indexedDB.open(dbName(),DB_VERSION);
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
  state.features=loadFeatures(); state.favorites=loadFavorites(); loadImageEdits();
  state.homeConfig=loadHomeConfig();
}

function allImages(s){return[
  ...s.images.map((im,i)=>{const id=`source:${s.id}:${i}`,base=((typeof SOURCE_IMAGE_DATA!=='undefined'&&SOURCE_IMAGE_DATA&&SOURCE_IMAGE_DATA[im.file])||`images/${im.file}`);return{id,speciesId:s.id,file:im.file,data:state.imageEdits[id]?.dataUrl||base,originalData:base,viewTypes:state.tagOverrides[id]||im.viewTypes||['mixed'],quizMask:state.maskOverrides[id]||null,custom:false,edited:!!state.imageEdits[id]}}),
  ...state.customImages.filter(x=>x.speciesId===s.id).map(x=>({...x,custom:true,data:x.editedDataUrl||x.dataUrl,originalData:x.dataUrl,edited:!!x.editedDataUrl}))
]}
function eligible(s,filter){const a=allImages(s);return filter==='all'?a:a.filter(x=>(x.viewTypes||[]).includes(filter))}
function modeLabel(){return({full:'Full Practical',scientific:'Scientific Name',family:'Family',skull:'Skull / Teeth Focus',skin:'Skin / Whole Focus'})[state.mode]}
function weightedSpecies(){
  let a=state.sessionPlan?.length?state.sessionPlan.map(speciesById).filter(Boolean):[...speciesList()];
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
function openManageLibrary(){state.selectedSpeciesId=null;setScreen('manage')}
function setScreen(x){
  state.screen=x;
  try{render()}
  catch(err){
    console.error('Trainer navigation error:',err);
    const app=$('app');
    if(app) app.innerHTML=shell('Something went wrong',`<div class="panel"><h2>This section could not load.</h2><p>${esc(err?.message||err)}</p><div class="button-row"><button class="primary" onclick="setScreen('home')">Return Home</button><button onclick="location.reload()">Reload Site</button></div></div>`);
  }
}
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
  if(state.screen==='hub') return renderHub(app);
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
    <header class="topbar ${state.screen==='home'?'home-topbar':''}"><button class="brand" onclick="setScreen('hub')">${currentSubject().icon} ${subjectTitle()}</button>
    <nav><button onclick="setScreen('hub')">Classes</button><button onclick="setScreen('home')">Home</button><button onclick="setScreen('study')">${subjectTitle()}</button><button onclick="openManageLibrary()">Images</button><button onclick="setScreen('progress')">Progress</button><button onclick="setScreen('settings')">⚙ Settings</button></nav></header>
    <section class="content"><div class="page-title"><h1>${title}</h1></div>${body}</section>
  </div>`
}

function defaultHomeConfig(){return {theme:{bg:'#f3f5f7',header:'#172b3a',accent:'#1e5b8c',card:'#ffffff',button:'#ffffff',text:'#17212b',border:'#d7dde3',radius:12,font:'Arial, Helvetica, sans-serif',fontSize:16,dark:false,bgImage:'',bgOpacity:.18,bgFit:'cover',bgPosition:'center'},blocks:[{id:'image-practical',type:'action',title:'Image Practical',subtitle:'Random specimen images with typed answers.',action:'full'},{id:'vault',type:'action',title:subjectTitle(),subtitle:'Build and study your species collection.',action:'study'},{id:'progress',type:'progress',title:'Progress'},{id:'missed',type:'missed',title:'Trouble Species'},{id:'quick',type:'quick',title:'Quick Actions'}]}}
function loadHomeConfig(){try{const x=JSON.parse(localStorage.getItem(subjectKey(HOME_KEY))||'null');return x&&x.blocks?x:defaultHomeConfig()}catch{return defaultHomeConfig()}}
function saveHomeConfig(c){state.homeConfig=c;localStorage.setItem(subjectKey(HOME_KEY),JSON.stringify(c));applyHomeTheme()}
function applyHomeTheme(){const c=state.homeConfig||loadHomeConfig(),t=c.theme||{};const root=document.documentElement;root.style.setProperty('--home-bg',t.bg||'#f3f5f7');root.style.setProperty('--home-header',t.header||'#172b3a');root.style.setProperty('--home-accent',t.accent||'#1e5b8c');root.style.setProperty('--home-card',t.card||'#fff');root.style.setProperty('--home-button',t.button||'#fff');root.style.setProperty('--home-text',t.text||'#17212b');root.style.setProperty('--home-border',t.border||'#d7dde3');root.style.setProperty('--home-radius',(t.radius??12)+'px');root.style.setProperty('--home-font',t.font||'Arial, Helvetica, sans-serif');root.style.setProperty('--home-font-size',(t.fontSize??16)+'px');root.style.setProperty('--home-bg-image',t.bgImage?`url(${JSON.stringify(t.bgImage)})`:'none');root.style.setProperty('--home-bg-opacity',String(t.bgOpacity??.18));root.style.setProperty('--home-bg-fit',t.bgFit||'cover');root.style.setProperty('--home-bg-position',t.bgPosition||'center');document.body.classList.toggle('home-dark',!!t.dark)}
function homeBlockStyle(b){return b.type==='image'?`width:${b.width||'100%'};min-height:${b.height||'220px'};opacity:${b.opacity??1};border-radius:${b.radius??12}px;object-fit:${b.fit||'contain'};object-position:${b.position||'center'};`:''}
function homeImageSrc(b){if(!b)return '';if(b.source==='upload')return state.homeImages.find(x=>x.id===b.imageId)?.dataUrl||'';if(b.source==='random'){const all=speciesList().flatMap(s=>allImages(s));return all.length?all[Math.floor(Math.random()*all.length)].data:''}if(b.source==='species'){const s=speciesById(b.speciesId);const all=s?allImages(s):[];return all.length?all[Math.floor(Math.random()*all.length)].data:''}return ''}
function missedSpecies(){const p=loadProgress();return speciesList().map(s=>({s,r:p[s.id]||{seen:0,wrong:0}})).filter(x=>x.r.wrong>0).sort((a,b)=>b.r.wrong-a.r.wrong).slice(0,5)}
function renderHub(app){
  const cards=Object.entries(SUBJECTS).map(([id,x])=>`<section class="panel subject-card"><div class="subject-icon">${x.icon}</div><h2>${esc(x.name)}</h2><p>${esc(x.description)}</p><button class="primary" onclick="switchSubject('${id}')">${id===state.subject?'Open':'Open'} ${esc(x.vault)}</button>${id!=='mammalogy'?'<small class="muted">Starts as a separate empty workspace. Add your species, images, and study cards when the class begins.</small>':''}</section>`).join('');
  app.innerHTML=shell('Class Trainer Hub',`<div class="hub-intro panel"><h2>One trainer for all your identification classes</h2><p>Keep Mammalogy, Ornithology, and Herpetology in separate workspaces while using the same practical, image, study-card, progress, and species-management tools.</p></div><div class="subject-grid">${cards}</div>`);
}
async function switchSubject(id){if(!SUBJECTS[id])return;state.subject=id;state.screen='home';state.current=null;state.sessionPlan=null;state.selectedSpeciesId=null;state.customImages=[];state.customSpecies=[];state.cards=[];state.speciesInfo={};state.homeImages=[];state.homeConfig=null;state.features=null;state.maskOverrides={};state.favorites=[];loadTags();loadMasks();state.features=loadFeatures();state.favorites=loadFavorites();await refreshStudyData();state.selectedSpeciesId=speciesList()[0]?.id;render()}
function renderHome(app){
  const st=progressStats(),c=state.homeConfig||loadHomeConfig();state.homeConfig=c;applyHomeTheme();
  const access=[];
  if(featureOn('collection'))access.push(`<button class="primary" onclick="setScreen('study')">${currentSubject().icon} Enter ${subjectTitle()}</button>`);
  access.push(`<button onclick="startQuiz('full')">🔎 Image Practical</button>`);
  if(featureOn('studyBuilder'))access.push(`<button onclick="setScreen('studyBuilder')">🧠 Build My Study Session</button>`);
  if(featureOn('daily'))access.push(`<button onclick="startDailyChallenge()">🎯 Daily Challenge</button>`);
  if(featureOn('surprise'))access.push(`<button onclick="startSurprise()">🎲 Surprise Me</button>`);
  if(featureOn('mystery'))access.push(`<button onclick="startMystery()">🔍 Mystery Specimen</button>`);
  if(featureOn('smartReview'))access.push(`<button onclick="startSmartReview()">🧠 Smart Review</button>`);
  if(featureOn('favorites'))access.push(`<button onclick="startFavorites()">⭐ Favorites</button>`);
  const blocks=c.blocks.map(b=>{if(b.type==='action'){const click=b.action==='study'?"setScreen('study')":`startQuiz('${b.action||'full'}')`;return `<section class="home-block panel"><h2>${esc(b.title)}</h2><p>${esc(b.subtitle||'')}</p><button class="primary wide" onclick="${click}">${esc(b.button||b.title)}</button></section>`}if(b.type==='progress')return `<section class="home-block panel"><h3>${esc(b.title||'Progress')}</h3><div class="big">${st.seen}</div><p>${st.correct} correct · ${st.wrong} missed</p><button onclick="setScreen('progress')">View Progress</button></section>`;if(b.type==='missed'){const ms=missedSpecies();return `<section class="home-block panel"><h3>${esc(b.title||'Trouble Species')}</h3>${ms.length?ms.map(x=>`<div class="missed-row"><span>${esc(x.s.common)}</span><b>${x.r.wrong}</b></div>`).join(''):'<p>No missed species yet.</p>'}`}if(b.type==='quick')return `<section class="home-block panel"><h3>${esc(b.title||'Quick Actions')}</h3><div class="button-grid"><button onclick="startQuiz('full')">Full Practical</button><button onclick="startQuiz('skull')">Skull / Teeth</button><button onclick="startQuiz('skin')">Skin / Whole</button><button onclick="setScreen('study')">Enter ${subjectTitle()}</button><button onclick="setScreen('addSpecies')">+ Add Species</button></div></section>`;return ''}).join('');
  const recent=featureOn('recent')?speciesList().filter(s=>s.custom).sort((a,b)=>(b.createdAt||0)-(a.createdAt||0)).slice(0,5):[];
  const favs=featureOn('favorites')?state.favorites.map(speciesById).filter(Boolean).slice(0,5):[];
  const mastery=featureOn('mastery')?speciesList().slice().sort((a,b)=>masteryPercent(b.id)-masteryPercent(a.id)).slice(0,6):[];
  const badges=featureOn('badges')?badgeList():[];
  const extra=`${featureOn('streak')||featureOn('xp')?`<section class="home-block panel"><h3>Vault Stats</h3>${featureOn('streak')?`<div>🔥 <b>${studyStreak()}</b> day streak</div>`:''}${featureOn('xp')?`<div>✨ <b>${xpTotal()}</b> XP</div>`:''}</section>`:''}${featureOn('mastery')?`<section class="home-block panel"><h3>Species Mastery</h3>${mastery.map(s=>`<div class="mastery-row"><span>${esc(s.common)}</span><div class="mastery-bar"><i style="width:${masteryPercent(s.id)}%"></i></div><b>${masteryPercent(s.id)}%</b></div>`).join('')}</section>`:''}${featureOn('recent')?`<section class="home-block panel"><h3>🆕 Recently Added</h3>${recent.length?recent.map(s=>`<div class="missed-row"><span>${esc(s.common)}</span><button onclick="openStudySpecies('${s.id}')">Study</button></div>`).join(''):'<p>No custom species added yet.</p>'}</section>`:''}${featureOn('favorites')?`<section class="home-block panel"><h3>⭐ Favorites</h3>${favs.length?favs.map(s=>`<div class="missed-row"><span>${esc(s.common)}</span><button onclick="openStudySpecies('${s.id}')">Open</button></div>`).join(''):'<p>No favorites yet.</p>'}</section>`:''}${featureOn('badges')?`<section class="home-block panel"><h3>🏆 Badges</h3><div class="badge-grid">${badges.map(b=>`<div class="badge ${b.ok?'earned':''}"><span>${b.icon}</span><small>${esc(b.name)}</small></div>`).join('')}</div></section>`:''}${featureOn('stats')?`<section class="home-block panel"><h3>📊 Study Statistics</h3><div class="stat-grid"><div><b>${st.seen}</b><span>attempts</span></div><div><b>${st.correct}</b><span>correct</span></div><div><b>${st.wrong}</b><span>missed</span></div><div><b>${xpTotal()}</b><span>XP</span></div></div></section>`:''}${featureOn('history')?`<section class="home-block panel"><h3>📅 Study History</h3><div class="history-dots">${[...Array(7)].map((_,i)=>{const d=new Date();d.setDate(d.getDate()-(6-i));const key=d.toISOString().slice(0,10);const has=loadHistory().some(x=>new Date(x.time).toISOString().slice(0,10)===key);return `<span class="history-day ${has?'studied':''}" title="${key}">${d.getDate()}</span>`}).join('')}</div></section>`:''}`;
  app.innerHTML=shell('',`<div class="home-custom-page"><div class="home-bg-layer"></div><div class="home-dashboard"><div class="hero"><div><h2>${currentSubject().icon} ${subjectTitle()}</h2><p>${currentSubject().description}</p></div><div class="statbox"><strong>${speciesList().length}</strong><span>species</span><strong>${speciesList().reduce((n,s)=>n+s.images.length,0)+state.customImages.length}</strong><span>images</span></div></div><div class="vault-access-bar">${access.join('')}</div><div class="home-grid" id="homeGrid">${blocks}${extra}</div><div class="home-footer"><button onclick="setScreen('settings')">⚙ Settings</button><button onclick="setScreen('customize')">🎨 Customize Appearance</button><button onclick="exportBackup()">Export Backup</button><button onclick="triggerImportBackup()">Import Backup</button><input id="backupFile" type="file" accept=".json" hidden onchange="importBackup(this.files[0])"></div></div></div>`);
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
function saveQuizSetting(){const current=loadSettings();saveSettings({length:Number($('quizLength')?.value||20),focusMissed:!!$('focusMissed')?.checked,quizImageLabels:$('quizImageLabels')?.value||'blur',quizLabelMaskHeight:Number($('quizLabelMaskHeight')?.value||24),googlePhotosClientId:$('googlePhotosClientId')?.value?.trim()||current.googlePhotosClientId||''});}
function saveGooglePhotosSettings(){const s=loadSettings();s.googlePhotosClientId=$('googlePhotosClientId')?.value?.trim()||'';saveSettings(s);}
function googlePhotosClientId(){return loadSettings().googlePhotosClientId||DEFAULT_GOOGLE_PHOTOS_CLIENT_ID}
function loadGoogleIdentity(){return new Promise((resolve,reject)=>{if(window.google?.accounts?.oauth2){resolve();return}const existing=document.querySelector('script[data-google-identity]');if(existing){existing.addEventListener('load',()=>resolve(),{once:true});existing.addEventListener('error',()=>reject(new Error('Could not load Google sign-in.')),{once:true});return}const script=document.createElement('script');script.src='https://accounts.google.com/gsi/client';script.async=true;script.defer=true;script.dataset.googleIdentity='1';script.onload=()=>resolve();script.onerror=()=>reject(new Error('Could not load Google sign-in.'));document.head.appendChild(script)})}
async function getGooglePhotosToken(){const clientId=googlePhotosClientId();if(!clientId)throw new Error('Add your Google OAuth Client ID in Settings first.');await loadGoogleIdentity();return await new Promise((resolve,reject)=>{const tokenClient=google.accounts.oauth2.initTokenClient({client_id:clientId,scope:'https://www.googleapis.com/auth/photospicker.mediaitems.readonly',callback:(resp)=>{if(resp?.error){reject(new Error(resp.error_description||resp.error));return}resolve(resp.access_token)}});tokenClient.requestAccessToken({prompt:''})})}
async function googlePhotosRequest(url,token,options={}){const r=await fetch(url,{...options,headers:{Authorization:`Bearer ${token}`,...(options.headers||{})}});if(!r.ok)throw new Error(`Google Photos request failed (${r.status}).`);return r.json()}
async function importGooglePhotosToSpecies(){const sp=selectedSpecies();if(!sp){alert('Add a species first.');return}if(window.__googlePhotosBusy)return;window.__googlePhotosBusy=true;let sessionId='',token='';try{token=await getGooglePhotosToken();const session=await googlePhotosRequest('https://photospicker.googleapis.com/v1/sessions',token,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({pickingConfig:{maxItemCount:2}})});if(!session.id||!session.pickerUri)throw new Error('Google Photos did not return a picker session.');sessionId=session.id;const picker=window.open(session.pickerUri+'/autoclose','_blank');if(!picker)throw new Error('Your browser blocked the Google Photos window. Allow pop-ups for this site.');let status=await googlePhotosRequest(`https://photospicker.googleapis.com/v1/sessions/${encodeURIComponent(sessionId)}`,token);let cfg=status.pollingConfig||session.pollingConfig||{};let expireTime=status.expireTime||session.expireTime||'';let ready=!!status.mediaItemsSet;while(!ready){if(expireTime&&Date.now()>=Date.parse(expireTime))throw new Error('Google Photos selection expired. Click “Add from Google Photos” again to start a fresh selection.');const raw=String(cfg.pollInterval||'3').replace(/s$/,'');await new Promise(r=>setTimeout(r,Math.max(1500,Number(raw)*1000||3000)));status=await googlePhotosRequest(`https://photospicker.googleapis.com/v1/sessions/${encodeURIComponent(sessionId)}`,token);cfg=status.pollingConfig||cfg;expireTime=status.expireTime||expireTime;ready=!!status.mediaItemsSet}let pageToken='',items=[];do{const u=new URL('https://photospicker.googleapis.com/v1/mediaItems');u.searchParams.set('sessionId',sessionId);if(pageToken)u.searchParams.set('pageToken',pageToken);const page=await googlePhotosRequest(u.toString(),token);items=items.concat(page.mediaItems||[]);pageToken=page.nextPageToken||''}while(pageToken);let added=0;for(const item of items){const mf=item.mediaFile||{};if(!mf.baseUrl||!String(mf.mimeType||'').startsWith('image/'))continue;const rr=await fetch(mf.baseUrl+'=w2048-h2048',{headers:{Authorization:`Bearer ${token}`}});if(!rr.ok)continue;const blob=await rr.blob();if(!blob.type.startsWith('image/'))continue;const dataUrl=await blobToDataUrl(blob);await putCustomImage({id:`google-photos-${item.id}`,speciesId:sp.id,name:item.mediaMetadata?.creationTime?`Google Photos — ${new Date(item.mediaMetadata.creationTime).toLocaleDateString()}`:'Google Photos image',dataUrl,viewTypes:[currentImageType(),'mixed'].filter((x,i,a)=>a.indexOf(x)===i),createdAt:Date.now(),source:'google-photos',sourceId:item.id});added++}try{await fetch(`https://photospicker.googleapis.com/v1/sessions/${encodeURIComponent(sessionId)}`,{method:'DELETE',headers:{Authorization:`Bearer ${token}`}})}catch(e){}await refreshStudyData();render();alert(added?`Imported ${added} image${added===1?'':'s'} from Google Photos into ${sp.common}.`:'No image photos were selected.')}catch(e){console.error(e);alert(e?.message||'Google Photos import failed.')}finally{window.__googlePhotosBusy=false}}

function renderQuiz(app){
  const c=state.current,s=c?.species,i=c?.image;
  if(!s||!i){app.innerHTML=shell(`${subjectTitle()} Practical`,`<div class="panel empty-workspace"><h2>No usable specimen images yet.</h2><p>Add at least one image to a species before starting an image practical.</p><div class="button-row"><button class="primary" onclick="openManageLibrary()">Manage Images</button><button onclick="setScreen('home')">Home</button></div></div>`);return}
  const pct=Math.round((state.session.q/state.length)*100);
  const disabled=state.answered?'disabled':'';
  const imageSrc=i.data;
  const qs=loadSettings();
  const labelMode=qs.quizImageLabels||'blur';
  const maskHeight=Math.max(10,Math.min(40,Number(qs.quizLabelMaskHeight||24)));
  const hasCustomMask=!!i.quizMask;
  const imageClass=hasCustomMask?'quiz-image-custom':`quiz-image-${labelMode}`;
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
      <div><b>Species:</b> ${esc(s.common)} — ${sciHtml(s.scientific)}</div><div><b>Family:</b> ${s.family?esc(s.family):'Not required for this practical'}</div>
    </div>`:'';
  app.innerHTML=shell(`${state.mystery?'Mystery Specimen':modeLabel()} — Question ${state.session.q} of ${state.length}`,`
    <div class="progressbar"><span style="width:${pct}%"></span></div>
    <div class="quiz-card">
      <div class="image-wrap ${imageClass}" style="--quiz-mask-height:${maskHeight}%;--quiz-mask-x:${i.quizMask?.x??0}%;--quiz-mask-y:${i.quizMask?.y??(100-maskHeight)}%;--quiz-mask-w:${i.quizMask?.w??100}%;--quiz-mask-h:${i.quizMask?.h??maskHeight}%;--quiz-mask-blur:${i.quizMask?.blur??14}px"><img src="${esc(imageSrc)}" alt="${esc(s.common)} specimen" ${labelMode==='show'?`onclick="openLightbox('${esc(imageSrc)}')"`:''}>${i.quizMask?'<div class="quiz-custom-mask"></div>':''}</div>
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

function syncCardEditorDraft(){
  if(!state.editor)return;
  const fields=['cardSpecies','cardCategory','customCategory','cardFront','cardBack'];
  fields.forEach(id=>{const el=$(id);if(el)state.editor[id.replace('card','').replace(/^./,m=>m.toLowerCase())]=el.value});
  state.editor.speciesId=$('cardSpecies')?.value||state.editor.speciesId;
  state.editor.category=$('cardCategory')?.value||state.editor.category;
  if(state.editor.category==='__custom__')state.editor.category=$('customCategory')?.value.trim()||'Custom';
  state.editor.customCategory=$('customCategory')?.value.trim()||'';
  state.editor.front=$('cardFront')?.value||state.editor.front||'';
  state.editor.back=$('cardBack')?.value||state.editor.back||'';
  state.editor.tags=selectedEditorTags();
}
function cardEditorSpeciesChanged(id){syncCardEditorDraft();state.editor.speciesId=id;state.editor.imageId='';render()}
function selectEditorImage(id){syncCardEditorDraft();state.editor.imageId=id;render()}
function setEditorImagePlacement(value){syncCardEditorDraft();state.editor.imagePlacement=value;render()}
function editorSpeciesImages(){
  const sp=speciesById(state.editor?.speciesId);
  return sp?allImages(sp):[];
}
function cardImage(c){
  if(!c?.imageId)return null;
  const sp=speciesById(c.speciesId);
  return sp?allImages(sp).find(i=>i.id===c.imageId)||null:null;
}
function cardImageMarkup(c,extraClass=''){
  const im=cardImage(c); if(!im)return '';
  return `<div class="flash-image ${extraClass}"><img src="${esc(im.data)}" alt="${esc(speciesById(c.speciesId)?.common||'Species image')}" onclick="event.stopPropagation();openLightbox('${esc(im.data)}')"></div>`;
}
function flashDeckCards(cards){
  const deck=[];
  cards.forEach(c=>{
    if(c.imagePlacement==='separate'&&c.imageId){
      deck.push({...c,__imageOnly:true});
    }
    deck.push(c);
  });
  return deck;
}
function filteredFlashDeckCards(){
  const base=filteredStudyCards();
  return flashDeckCards(base);
}

function renderStudy(app){
  if(!speciesList().length){app.innerHTML=shell(subjectTitle(),`<div class="panel empty-workspace"><h2>${currentSubject().icon} Your ${currentSubject().name} workspace is ready.</h2><p>No species have been added yet. Add your first species and then add images and study cards.</p><div class="button-row"><button class="primary" onclick="setScreen('addSpecies')">+ Add First Species</button><button onclick="setScreen('hub')">Class Trainer Hub</button></div></div>`);return}
  if(!state.selectedSpeciesId) state.selectedSpeciesId=speciesList()[0].id;
  const s=selectedSpecies(), cards=cardsFor(s.id), info=state.speciesInfo[s.id]||{};
  const list=speciesList().map(x=>`<button class="species-list-btn ${x.id===s.id?'selected':''}" onclick="setStudySpecies('${x.id}');render()">${esc(x.common)}<small>${sciHtml(x.scientific)}</small></button>`).join('');
  const allStudyCards=cardsFor(s.id);
  const activeTag=state.studyTagFilter||'';
  const filteredCards=activeTag?allStudyCards.filter(x=>(x.tags||[]).includes(activeTag)):allStudyCards;
  const flashDeck=flashDeckCards(filteredCards);
  const c=flashDeck.length?flashDeck[state.studyIndex%flashDeck.length]:null;
  let cardPanel='';
  if(state.studyMode==='flash'&&c){
    const flipped=state.studyFlipped;
    let label=flipped?'ANSWER':'QUESTION';
    let text=flipped?c.back:c.front;
    let image='';
    if(c.__imageOnly){
      label=flipped?'ANSWER':'IMAGE';
      image=cardImageMarkup(c,'image-only');
      text=flipped?`${speciesById(c.speciesId)?.common||''}\n${speciesById(c.speciesId)?.scientific||''}\n${speciesById(c.speciesId)?.family||'Family not specified'}`:'';
    }else if(c.imagePlacement==='front'&&!flipped){image=cardImageMarkup(c,'front-image')}
    else if(c.imagePlacement==='back'&&flipped){image=cardImageMarkup(c,'back-image')}
    cardPanel=`<div class="flashcard ${c.__imageOnly?'image-flashcard':''}" onclick="state.studyFlipped=!state.studyFlipped;render()"><div class="flash-label">${label}</div>${image}<div class="flash-text">${esc(text).replace(/\n/g,'<br>')}</div><div class="flash-tags">${(c.tags||[]).map(t=>`<span class="tag">${esc(t)}</span>`).join('')}</div><div class="flash-hint">Click card to flip</div></div><div class="flash-controls"><button onclick="studyPrev()">← Previous</button><span>${state.studyIndex+1} / ${flashDeck.length}</span><button onclick="studyNext()">Next →</button></div>`;
  } else {
    cardPanel=filteredCards.length?filteredCards.map(c=>`<div class="study-card"><div><span class="tag">${esc(c.category||'General')}</span><h4>${esc(c.front)}</h4>${c.imageId?`<small class="muted">🖼️ Image: ${esc(c.imagePlacement==='separate'?'separate card':c.imagePlacement)}</small>`:''}<div class="tag-row">${(c.tags||[]).map(t=>`<span class="tag secondary">${esc(t)}</span>`).join('')}</div></div><div class="card-answer">${esc(c.back)}</div><div class="card-actions"><button onclick="openStudyEditCard('${c.id}')">Edit</button><button class="danger" onclick="deleteCard('${c.id}')">Delete</button></div></div>`).join(''):`<div class="empty">${activeTag?`No cards tagged “${esc(activeTag)}”.`:`No study cards yet. Add your first card for ${esc(s.common)}.`}</div>`;
  }
  app.innerHTML=shell(subjectTitle(),`<div class="study-layout"><aside class="species-sidebar"><input class="search" id="speciesSearch" placeholder="Search species..." oninput="filterSpeciesList()"><div id="speciesList">${list}</div></aside><section class="study-main"><div class="species-heading"><div><h2>${esc(s.common)} ${state.favorites.includes(s.id)?'⭐':''}</h2><p>${sciHtml(s.scientific)} · ${s.family?esc(s.family):'Family not specified'}</p><div class="mastery-ring" style="--p:${masteryPercent(s.id)}%"><span>${masteryPercent(s.id)}%</span></div></div><div class="button-row"><button onclick="openStudyNewCard()">+ Add Card</button><button onclick="toggleFavorite('${s.id}')">${state.favorites.includes(s.id)?'★ Unfavorite':'☆ Favorite'}</button><button onclick="editSpeciesInfo()">Edit Notes / Clues</button><button onclick="openManageLibrary()">Manage Images</button><button onclick="setScreen('addSpecies')">+ Add Species</button></div></div>${featureOn('galleries')?`<div class="species-gallery panel"><div class="gallery-head"><h3>🖼️ Specimen Gallery</h3><button onclick="openManageLibrary()">Manage Images</button></div><div class="vault-gallery">${allImages(s).slice(0,6).map(i=>`<img src="${esc(i.data)}" alt="${esc(s.common)}" onclick="openLightbox('${esc(i.data)}')">`).join('')}</div>${allImages(s).length?`<small>${allImages(s).length} image${allImages(s).length===1?'':'s'} in this species collection.</small>`:'<p class="muted">Add specimen images in Images.</p>'}</div>`:''}<div class="study-tabs"><button class="${state.studyMode==='browse'?'active':''}" onclick="state.studyMode='browse';render()">Browse Cards</button><button class="${state.studyMode==='flash'?'active':''}" onclick="state.studyMode='flash';state.studyIndex=0;state.studyFlipped=false;render()">Flashcard Mode</button></div>${info.notes?`<div class="notes panel"><h3>My Species Notes</h3><div>${esc(info.notes).replace(/\n/g,'<br>')}</div></div>`:''}${info.clues&&featureOn('clues')?`<div class="notes panel clue-panel"><h3>🔎 My Identification Clues</h3><div>${esc(info.clues).replace(/\n/g,'<br>')}</div></div>`:''}<div class="cards-header"><h3>${state.studyMode==='flash'?'Flashcards':'Study Cards'} <span>${state.studyMode==='flash'?flashDeck.length:filteredCards.length}${activeTag?` / ${cards.length}`:''}</span></h3><div class="filter-row"><label>Filter by tag<select id="studyTagFilter" onchange="state.studyTagFilter=this.value;state.studyIndex=0;state.studyFlipped=false;render()"><option value="">All tags</option>${[...new Set(state.cards.flatMap(x=>x.tags||[]))].sort().map(t=>`<option value="${esc(t)}" ${t===activeTag?'selected':''}>${esc(t)}</option>`).join('')}</select></label>${state.studyMode==='flash'&&flashDeck.length?`<button onclick="shuffleStudyCards()">Shuffle</button>`:''}</div></div>${cardPanel}</section></div>`);
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
  state.editor={id:null,speciesId:selectedSpecies().id,front:'',back:'',category:'General',customCategory:'',tags:[],imageId:'',imagePlacement:'none'};
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
  await saveCard({...state.editor,speciesId,front,back,category,customCategory,tags,imageId:state.editor.imageId||'',imagePlacement:state.editor.imagePlacement||'none',order:state.editor.order??cardsFor(speciesId).length});
  state.editor=null;state.selectedSpeciesId=speciesId;state.screen='study';
}
function cancelCardEditor(){state.editor=null;state.screen='study';render()}
async function saveCard(o){
  const card={id:o.id||('card-'+Date.now()+'-'+Math.random().toString(36).slice(2)),speciesId:o.speciesId,front:o.front,back:o.back,category:o.category||'General',customCategory:o.customCategory||'',tags:Array.isArray(o.tags)?o.tags:parseTags(o.tags),order:o.order??0,imageId:o.imageId||'',imagePlacement:['none','separate','front','back'].includes(o.imagePlacement)?o.imagePlacement:'none'};
  await dbPut(CARD_STORE,card);await refreshStudyData();
}
function editCard(id){openStudyEditCard(id)}
async function deleteCard(id){if(!confirm('Delete this study card?'))return;await dbDelete(CARD_STORE,id);await refreshStudyData();render()}

async function editSpeciesInfo(){const s=selectedSpecies(),old=state.speciesInfo[s.id]||{};const notes=prompt(`Your notes for ${s.common}:`,old.notes||'');if(notes===null)return;const clues=prompt(`Your identification clues for ${s.common}:`,old.clues||'');if(clues===null)return;await dbPut(INFO_STORE,{speciesId:s.id,notes,clues});await refreshStudyData();render()}

function renderCardEditor(app){
  const e=state.editor||{speciesId:selectedSpecies().id,front:'',back:'',category:'General',customCategory:'',tags:[],imageId:'',imagePlacement:'none'};
  const speciesOptions=speciesList().map(x=>`<option value="${x.id}" ${x.id===e.speciesId?'selected':''}>${esc(x.common)} — ${sciHtml(x.scientific)}</option>`).join('');
  const cats=['General','Identification','Anatomy','Skull / Teeth','Dentition','Pelage / Skin','Habitat','Diet','Behavior','Taxonomy','Other'];
  const isCustomCat=!!e.customCategory || !cats.includes(e.category||'General');
  const catOptions=cats.map(x=>`<option value="${esc(x)}" ${!isCustomCat&&x===e.category?'selected':''}>${esc(x)}</option>`).join('')+`<option value="__custom__" ${isCustomCat?'selected':''}>Custom…</option>`;
  const suggested=[...new Set(state.cards.flatMap(x=>x.tags||[]))].sort();
  const tags=e.tags||[];
  const imgs=editorSpeciesImages();
  const selectedImg=imgs.find(i=>i.id===e.imageId);
  const imageChoices=imgs.length?imgs.map(i=>`<button type="button" class="image-choice ${i.id===e.imageId?'selected':''}" onclick="selectEditorImage('${esc(i.id)}')"><img src="${esc(i.data)}" alt="${esc(speciesById(e.speciesId)?.common||'Species image')}"><span>${esc((i.viewTypes||[]).map(t=>(imageTypes().find(x=>x.id===t)||{}).label||t).join(', ')||'Image')}</span>${i.id===e.imageId?'<b>✓ Selected</b>':''}</button>`).join(''):`<div class="empty">No images are in this species library yet. Add an image first in Manage Species & Images.</div>`;
  const placement=e.imagePlacement||'none';
  const previewImage=selectedImg?`<img src="${esc(selectedImg.data)}" alt="Selected species image">`:'';
  const previewFront=placement==='front'&&selectedImg?`${previewImage}<div>${esc(e.front||'')}</div>`:esc(e.front||'');
  const previewBack=placement==='back'&&selectedImg?`${esc(e.back||'')} ${previewImage}`:esc(e.back||'');
  const bankCards=state.cards.slice().sort((a,b)=>(a.order??0)-(b.order??0));
  app.innerHTML=shell(e.id?'Edit Study Card':'Create Study Card',`<div class="editor-layout"><section class="panel editor-form"><div class="form-grid"><label>Species<select id="cardSpecies" onchange="cardEditorSpeciesChanged(this.value)">${speciesOptions}</select></label><label>Category<select id="cardCategory" onchange="state.editor.category=this.value;document.getElementById('customCategoryWrap').style.display=this.value==='__custom__'?'block':'none'">${catOptions}</select></label></div><div id="customCategoryWrap" class="custom-field" style="display:${isCustomCat?'block':'none'}"><label>Custom category<input id="customCategory" value="${esc(e.customCategory||(!cats.includes(e.category||'General')?e.category:'')||'')}" placeholder="e.g., Exam Review, Measurements, Comparison"></label></div><label>Front / Question<textarea id="cardFront" rows="8" placeholder="Example: What family does the eastern wood rat belong to?">${esc(e.front)}</textarea></label><label>Back / Answer<textarea id="cardBack" rows="8" placeholder="Example: Cricetidae">${esc(e.back)}</textarea></label><div class="flash-image-editor panel"><h3>🖼️ Image from Species Library</h3><label class="check-row"><input type="checkbox" ${e.imageId?'checked':''} onchange="if(this.checked){if(!state.editor.imageId&&editorSpeciesImages().length){state.editor.imageId=editorSpeciesImages()[0].id} }else{state.editor.imageId='';state.editor.imagePlacement='none'};render()"> <span>Include an image from this species' library</span></label>${e.imageId?`<div class="image-placement"><strong>Image placement:</strong><label><input type="radio" name="imagePlacement" value="none" ${placement==='none'?'checked':''} onchange="setEditorImagePlacement(this.value)"> No image</label><label><input type="radio" name="imagePlacement" value="separate" ${placement==='separate'?'checked':''} onchange="setEditorImagePlacement(this.value)"> Separate image card</label><label><input type="radio" name="imagePlacement" value="front" ${placement==='front'?'checked':''} onchange="setEditorImagePlacement(this.value)"> Front of card</label><label><input type="radio" name="imagePlacement" value="back" ${placement==='back'?'checked':''} onchange="setEditorImagePlacement(this.value)"> Back of card</label></div><div class="image-choice-grid">${imageChoices}</div>`:'<p class="muted">Check the box to choose an image from this species library. Image placement defaults to <b>No image</b>.</p>'}</div><div class="tag-editor"><div class="tag-editor-title">Tags</div><div class="tag-input-row"><input id="tagInput" list="tagSuggestions" placeholder="Type a tag, then click Add (or press Enter)"><datalist id="tagSuggestions">${suggested.map(t=>`<option value="${esc(t)}">`).join('')}</datalist><button type="button" onclick="addEditorTag()">Add tag</button></div><div id="editorTags" class="tag-chip-list">${tags.map(t=>`<span class="tag-chip" data-tag="${esc(t)}">${esc(t)} <button type="button" aria-label="Remove ${esc(t)}" onclick="removeEditorTag(this)">×</button></span>`).join('')}</div><div class="muted">Use tags to organize cards such as <b>skull</b>, <b>dentition</b>, <b>family</b>, <b>exam</b>, or any custom label you want.</div></div><div id="editorError" class="editor-error"></div><div class="button-row"><button class="primary" onclick="submitCardEditor()">Save Card</button><button onclick="cancelCardEditor()">Cancel</button></div></section><section class="panel live-preview"><h2>Full Card Preview</h2><div class="preview-card"><div class="preview-label">FRONT</div><div id="previewFront" class="preview-text">${previewFront}</div><div class="preview-divider"></div><div class="preview-label">BACK</div><div id="previewBack" class="preview-text">${previewBack}</div><div class="preview-species"><span class="preview-base-species">${esc(speciesById(e.speciesId)?.common||'')} ·</span> <span id="previewCategory">${esc(e.category||'General')}</span><div id="previewTags" class="tag-row">${tags.map(t=>`<span class="tag secondary">${esc(t)}</span>`).join('')}</div></div></div><p class="muted">The selected species image is stored with this card. Existing cards remain unchanged and default to no image.</p></section></div><section class="panel question-bank-panel"><div class="section-head"><div><h2>📚 Flashcard Question Bank</h2><p class="muted">All of your existing flashcards are shown here while you create or edit a card.</p></div><strong id="questionBankCount">${bankCards.length} card${bankCards.length===1?'':'s'}</strong></div><div class="question-bank-filters"><input id="questionBankSearch" value="${esc(state.cardBankQuery||'')}" placeholder="Search questions, answers, categories, tags..." oninput="filterCardBank()"><select id="questionBankSpecies" onchange="filterCardBank()"><option value="">All species</option>${speciesList().map(sp=>`<option value="${sp.id}">${esc(sp.common)}</option>`).join('')}</select></div><div id="questionBankList">${bankCards.map(c=>{const sp=speciesById(c.speciesId);return `<div class="question-bank-row" data-bank-search="${esc(`${c.front} ${c.back} ${c.category||''} ${(c.tags||[]).join(' ')}`)}" data-bank-species="${esc(c.speciesId)}"><div class="question-bank-main"><div class="question-bank-meta"><strong>${esc(sp?.common||'Unknown species')}</strong><span class="tag">${esc(c.category||'General')}</span>${c.imageId?'<span class="tag secondary">🖼️ Image</span>':''}</div><div class="question-bank-front">${esc(c.front||'')}</div><div class="question-bank-back">${esc(c.back||'')}</div></div><div class="card-actions"><button type="button" onclick="openStudyEditCard('${esc(c.id)}')">Edit</button><button type="button" class="danger" onclick="deleteCard('${esc(c.id)}');render()">Delete</button></div></div>`}).join('')||'<div class="empty">No flashcards have been created yet.</div>'}</div></section>`);
}

function openLightbox(src){$('lightboxImg').src=src;$('lightbox').classList.add('open')}
function closeLightbox(){ $('lightbox').classList.remove('open') }

async function blobToDataUrl(blob){return await new Promise((res,rej)=>{const r=new FileReader();r.onload=()=>res(r.result);r.onerror=rej;r.readAsDataURL(blob)})}
async function exportBackup(){
  const images=state.customImages.map(x=>({id:x.id,speciesId:x.speciesId,name:x.name,dataUrl:x.dataUrl,editedDataUrl:x.editedDataUrl||'',viewTypes:x.viewTypes,quizMask:x.quizMask||null,createdAt:x.createdAt}));
  const homeImages=state.homeImages.map(x=>({id:x.id,name:x.name,dataUrl:x.dataUrl}));
  const backup={version:5,createdAt:new Date().toISOString(),customImages:images,quizMaskOverrides:state.maskOverrides,imageEditOverrides:state.imageEdits,studyCards:state.cards,speciesInfo:state.speciesInfo,customSpecies:state.customSpecies,tagOverrides:state.tagOverrides,imageTypes:imageTypes(),progress:loadProgress(),settings:loadSettings(),features:state.features||loadFeatures(),favorites:state.favorites,history:loadHistory(),homeConfig:state.homeConfig||loadHomeConfig(),homeImages};
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
    if(b.homeConfig)localStorage.setItem(subjectKey(HOME_KEY),JSON.stringify(b.homeConfig));
    for(const [id,obj] of Object.entries(b.speciesInfo||{}))await dbPut(INFO_STORE,{speciesId:id,notes:obj.notes||''});
    if(b.tagOverrides)localStorage.setItem(subjectKey(TAGS_KEY),JSON.stringify(b.tagOverrides));if(Array.isArray(b.imageTypes)&&b.imageTypes.length)localStorage.setItem(subjectKey(IMAGE_TYPES_KEY),JSON.stringify(b.imageTypes));
    if(b.quizMaskOverrides)localStorage.setItem(subjectKey(MASKS_KEY),JSON.stringify(b.quizMaskOverrides));
    if(b.imageEditOverrides)localStorage.setItem(subjectKey(EDITS_KEY),JSON.stringify(b.imageEditOverrides));
    if(b.progress)localStorage.setItem(subjectKey(PROGRESS_KEY),JSON.stringify(b.progress));
    if(b.settings)localStorage.setItem(subjectKey(SETTINGS_KEY),JSON.stringify(b.settings));
    if(b.features)localStorage.setItem(subjectKey(FEATURES_KEY),JSON.stringify(b.features));
    if(b.favorites)localStorage.setItem(subjectKey(FAVORITES_KEY),JSON.stringify(b.favorites));
    if(b.history)localStorage.setItem(subjectKey(HISTORY_KEY),JSON.stringify(b.history));
    await refreshStudyData();loadTags();loadMasks();alert('Backup imported successfully.');render()
  }catch(e){alert('Could not import that backup.')}
}

// Public API for GitHub Pages / inline event handlers.
Object.assign(window,{
  state,
  switchSubject,
  setScreen,startQuiz,nextQuestion,checkAnswer,showAnswer,
  startDailyChallenge,startSurprise,startMystery,startSmartReview,startFavorites,
  openStudySpecies,setStudySpecies,studyNext,studyPrev,shuffleStudyCards,
  openStudyNewCard,openStudyEditCard,submitCardEditor,cancelCardEditor,
  saveCard,editCard,deleteCard,editSpeciesInfo,
  handlePaste,handleFiles,saveImageFile,removeCustomImage,setImageTag,openPendingSpeciesMaskEditor,openPendingSpeciesImageEditor,openImageMaskEditor,openImageEditor,resetImageEdit,closeImageEditor,clearImageMask,closeImageMaskEditor,handleNewSpeciesFiles,removePendingSpeciesImage,captureAddSpeciesForm,importGooglePhotosToSpecies,saveGooglePhotosSettings,
  toggleFavorite,openLightbox,closeLightbox,
  enableAllFeatures,disableOptionalFeatures,setFeature,
  addSpeciesFromForm,filterSpeciesLibrary,openManageLibrary,resetProgress,exportBackup,triggerImportBackup,importBackup,
  changeTheme,resetHomeCustomization,addHomeBlock,removeHomeBlock,updateHomeBlock,addImageType,removeImageType,
  handleHomeImages,setHomeBackground,clearHomeBackground,deleteHomeImage,
  saveQuizSetting,toggleCustomCategory,addEditorTag,removeEditorTag,
  render,filterSpeciesList
});

function boot(){
  loadTags();loadImageEdits();state.features=loadFeatures();state.favorites=loadFavorites();state.homeConfig=loadHomeConfig();const s=loadSettings();state.length=Number(s.length||20);state.focusMissed=!!s.focusMissed;
  refreshStudyData().then(()=>{state.selectedSpeciesId=speciesList()[0]?.id;render()});
}
document.addEventListener('keydown',e=>{if(e.key==='Escape')closeLightbox()});
boot();
