
const DB_NAME='mammalogy-practical-db', DB_VERSION=3;
const IMG_STORE='customImages', CARD_STORE='studyCards', INFO_STORE='speciesInfo', HOMEIMG_STORE='homeImages';
const TAGS_KEY='mammalogy-tag-overrides', PROGRESS_KEY='mammalogy-progress', SETTINGS_KEY='mammalogy-settings', HOME_KEY='mammalogy-home-customization';

const state={
  screen:'home', mode:'full', length:20, current:null, answered:false, editor:null,
  session:{q:0,correct:0,points:0,totalPoints:0}, lastSpecies:null, focusMissed:false,
  customImages:[], tagOverrides:{}, cards:[], speciesInfo:{}, homeImages:[], homeConfig:null,
  selectedSpeciesId:null, studyMode:'browse', studyIndex:0, studyFlipped:false, studyTagFilter:''
};

const $=id=>document.getElementById(id);
function normalize(s){return(s||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[“”‘’]/g,"'").replace(/\s+/g,' ').trim().toLowerCase()}
function normalizeSci(s){return normalize(s).replace(/[.]/g,'')}
function esc(s){return String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}
function speciesById(id){return SOURCE_SPECIES.find(s=>s.id===id)}
function loadProgress(){try{return JSON.parse(localStorage.getItem(PROGRESS_KEY)||'{}')}catch{return{}}}
function saveProgress(p){localStorage.setItem(PROGRESS_KEY,JSON.stringify(p))}
function recordResult(id,ok){const p=loadProgress(),r=p[id]||{seen:0,correct:0,wrong:0};r.seen++;ok?r.correct++:r.wrong++;p[id]=r;saveProgress(p)}
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
  state.homeConfig=loadHomeConfig();
}

function allImages(s){return[
  ...s.images.map((im,i)=>({id:`source:${s.id}:${i}`,speciesId:s.id,file:im.file,data:(SOURCE_IMAGE_DATA[im.file]||`images/${im.file}`),viewTypes:state.tagOverrides[`source:${s.id}:${i}`]||im.viewTypes||['mixed'],custom:false})),
  ...state.customImages.filter(x=>x.speciesId===s.id).map(x=>({...x,custom:true,data:x.dataUrl}))
]}
function eligible(s,filter){const a=allImages(s);return filter==='all'?a:a.filter(x=>(x.viewTypes||[]).includes(filter))}
function modeLabel(){return({full:'Full Practical',scientific:'Scientific Name',family:'Family',skull:'Skull / Teeth Focus',skin:'Skin / Whole Focus'})[state.mode]}
function weightedSpecies(){
  let a=[...SOURCE_SPECIES];
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
  state.mode=mode;state.answered=false;state.session={q:0,correct:0,points:0,totalPoints:0};state.lastSpecies=null;
  const s=loadSettings();state.length=Number(s.length||20);state.focusMissed=!!s.focusMissed;
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
  SOURCE_SPECIES.forEach(s=>{const r=p[s.id];if(r){seen+=r.seen;correct+=r.correct;wrong+=r.wrong}});
  return {seen,correct,wrong}
}
function speciesProgress(id){return loadProgress()[id]||{seen:0,correct:0,wrong:0}}

function cardsFor(id){return state.cards.filter(c=>c.speciesId===id).sort((a,b)=>(a.order??0)-(b.order??0))}
function selectedSpecies(){return speciesById(state.selectedSpeciesId)||SOURCE_SPECIES[0]}
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
}

function shell(title,body){
  return `<div class="shell">
    <header class="topbar ${state.screen==='home'?'home-topbar':''}"><button class="brand" onclick="setScreen('home')">Mammalogy Practical Trainer</button>
    <nav><button onclick="setScreen('home')">Home</button><button onclick="setScreen('study')">Species Study</button><button onclick="setScreen('manage')">Manage</button><button onclick="setScreen('progress')">Progress</button><button onclick="setScreen('customize')">Customize Home</button></nav></header>
    <section class="content"><div class="page-title"><h1>${title}</h1></div>${body}</section>
  </div>`
}

function defaultHomeConfig(){return {theme:{bg:'#f3f5f7',header:'#172b3a',accent:'#1e5b8c',card:'#ffffff',button:'#ffffff',text:'#17212b',border:'#d7dde3',radius:12,font:'Arial, Helvetica, sans-serif',fontSize:16,dark:false,bgImage:'',bgOpacity:.18,bgFit:'cover',bgPosition:'center'},blocks:[{id:'image-practical',type:'action',title:'Image Practical',subtitle:'Random specimen images with typed answers.',action:'full'},{id:'species-study',type:'action',title:'Species Study',subtitle:'Your flashcards, notes, and study sets.',action:'study'},{id:'progress',type:'progress',title:'Progress'},{id:'missed',type:'missed',title:'Missed Species'},{id:'quick',type:'quick',title:'Quick Actions'}]}}
function loadHomeConfig(){try{const x=JSON.parse(localStorage.getItem(HOME_KEY)||'null');return x&&x.blocks?x:defaultHomeConfig()}catch{return defaultHomeConfig()}}
function saveHomeConfig(c){state.homeConfig=c;localStorage.setItem(HOME_KEY,JSON.stringify(c));applyHomeTheme()}
function applyHomeTheme(){const c=state.homeConfig||loadHomeConfig(),t=c.theme||{};const root=document.documentElement;root.style.setProperty('--home-bg',t.bg||'#f3f5f7');root.style.setProperty('--home-header',t.header||'#172b3a');root.style.setProperty('--home-accent',t.accent||'#1e5b8c');root.style.setProperty('--home-card',t.card||'#fff');root.style.setProperty('--home-button',t.button||'#fff');root.style.setProperty('--home-text',t.text||'#17212b');root.style.setProperty('--home-border',t.border||'#d7dde3');root.style.setProperty('--home-radius',(t.radius??12)+'px');root.style.setProperty('--home-font',t.font||'Arial, Helvetica, sans-serif');root.style.setProperty('--home-font-size',(t.fontSize??16)+'px');root.style.setProperty('--home-bg-image',t.bgImage?`url(${JSON.stringify(t.bgImage)})`:'none');root.style.setProperty('--home-bg-opacity',String(t.bgOpacity??.18));root.style.setProperty('--home-bg-fit',t.bgFit||'cover');root.style.setProperty('--home-bg-position',t.bgPosition||'center');document.body.classList.toggle('home-dark',!!t.dark)}
function homeBlockStyle(b){return b.type==='image'?`width:${b.width||'100%'};min-height:${b.height||'220px'};opacity:${b.opacity??1};border-radius:${b.radius??12}px;object-fit:${b.fit||'contain'};object-position:${b.position||'center'};`:''}
function homeImageSrc(b){if(!b)return '';if(b.source==='upload')return state.homeImages.find(x=>x.id===b.imageId)?.dataUrl||'';if(b.source==='random'){const all=SOURCE_SPECIES.flatMap(s=>allImages(s));return all.length?all[Math.floor(Math.random()*all.length)].data:''}if(b.source==='species'){const s=speciesById(b.speciesId);const all=s?allImages(s):[];return all.length?all[Math.floor(Math.random()*all.length)].data:''}return ''}
function missedSpecies(){const p=loadProgress();return SOURCE_SPECIES.map(s=>({s,r:p[s.id]||{seen:0,wrong:0}})).filter(x=>x.r.wrong>0).sort((a,b)=>b.r.wrong-a.r.wrong).slice(0,5)}
function renderHome(app){
  const st=progressStats();const c=state.homeConfig||loadHomeConfig();state.homeConfig=c;applyHomeTheme();
  const blockHtml=c.blocks.map((b,idx)=>{if(b.type==='action'){const click=b.action==='study'?"setScreen('study')":`startQuiz('${b.action||'full'}')`;const bi=b.buttonImageId?state.homeImages.find(x=>x.id===b.buttonImageId):null;return `<section class="home-block panel"><h2>${esc(b.title)}</h2><p>${esc(b.subtitle||'')}</p><button class="primary wide home-image-button" onclick="${click}">${bi?`<img src="${esc(bi.dataUrl)}" alt="" class="button-thumb">`:''}${esc(b.button||b.title)}</button></section>`;}
    if(b.type==='progress')return `<section class="home-block panel"><h3>${esc(b.title||'Progress')}</h3><div class="big">${st.seen}</div><p>${st.correct} correct · ${st.wrong} missed</p><button onclick="setScreen('progress')">View Progress</button></section>`;
    if(b.type==='missed'){const ms=missedSpecies();return `<section class="home-block panel"><h3>${esc(b.title||'Missed Species')}</h3>${ms.length?ms.map(x=>`<div class="missed-row"><span>${esc(x.s.common)}</span><b>${x.r.wrong}</b></div>`).join(''):'<p>No missed species yet.</p>'}`}
    if(b.type==='quick')return `<section class="home-block panel"><h3>${esc(b.title||'Quick Actions')}</h3><div class="button-grid"><button onclick="startQuiz('full')">Full Practical</button><button onclick="startQuiz('skull')">Skull / Teeth</button><button onclick="startQuiz('skin')">Skin / Whole</button><button onclick="setScreen('study')">Species Study</button></div></section>`;
    if(b.type==='image'){const src=homeImageSrc(b);const click=b.clickAction&&b.clickAction!=='none'?(b.clickAction==='study'?"setScreen('study')":`startQuiz('${b.clickAction}')`):'';return `<section class="home-block panel image-home-block">${b.title?`<h3>${esc(b.title)}</h3>`:''}${src?(click?`<img onclick="${click}" class="clickable-home-image" src="${esc(src)}" alt="${esc(b.title||'Custom home image')}" style="${homeBlockStyle(b)}">`:`<img src="${esc(src)}" alt="${esc(b.title||'Custom home image')}" style="${homeBlockStyle(b)}">`):'<div class="empty">Choose an image in Customize Home.</div>'}</section>`}
    return ''}).join('');
  app.innerHTML=shell('',`<div class="home-custom-page"><div class="home-bg-layer"></div><div class="home-dashboard"><div class="hero"><div><h2>Mammalogy Practical Trainer</h2><p>Image Practical + Species Study</p></div><div class="statbox"><strong>${SOURCE_SPECIES.length}</strong><span>species</span><strong>${SOURCE_SPECIES.reduce((n,s)=>n+s.images.length,0)}</strong><span>source images</span></div></div><div class="home-grid" id="homeGrid">${blockHtml}</div><div class="home-footer"><button onclick="setScreen('customize')">⚙ Customize Home Page</button><button onclick="exportBackup()">Export Backup</button><button onclick="triggerImportBackup()">Import Backup</button><input id="backupFile" type="file" accept=".json" hidden onchange="importBackup(this.files[0])"></div></div></div>`);
  const grid=$('homeGrid');grid?.querySelectorAll('.home-block').forEach((el,i)=>{el.draggable=true;el.dataset.index=i;el.addEventListener('dragstart',e=>e.dataTransfer.setData('text/plain',String(i)));el.addEventListener('dragover',e=>e.preventDefault());el.addEventListener('drop',e=>{e.preventDefault();const from=Number(e.dataTransfer.getData('text/plain')),to=Number(el.dataset.index);if(from===to)return;const [m]=c.blocks.splice(from,1);c.blocks.splice(to,0,m);saveHomeConfig(c);render()})});
}
function addHomeBlock(type){const c=state.homeConfig||loadHomeConfig();const id='block-'+Date.now();if(type==='image')c.blocks.push({id,type:'image',title:'Custom Image',source:'upload',imageId:state.homeImages[0]?.id||'',width:'100%',height:'240px',opacity:1,radius:12,fit:'contain',position:'center',clickAction:'none'});else if(type==='action')c.blocks.push({id,type:'action',title:'New Quiz',subtitle:'',action:'full'});else if(type==='gallery')c.blocks.push({id,type:'gallery',title:'Image Gallery',count:4,height:'140px',fit:'contain'});else c.blocks.push({id,type,title:type==='quick'?'Quick Actions':type==='missed'?'Missed Species':'Progress'});saveHomeConfig(c);render()}
function removeHomeBlock(id){const c=state.homeConfig||loadHomeConfig();c.blocks=c.blocks.filter(b=>b.id!==id);saveHomeConfig(c);render()}
function updateHomeBlock(id,key,val){const c=state.homeConfig||loadHomeConfig(),b=c.blocks.find(x=>x.id===id);if(!b)return;b[key]=val;saveHomeConfig(c)}
function renderCustomizer(app){
  const c=state.homeConfig||loadHomeConfig();state.homeConfig=c;const t=c.theme||{};const imgOpts=state.homeImages.map(x=>`<option value="${esc(x.id)}">${esc(x.name||x.id)}</option>`).join('');
  app.innerHTML=shell('Customize Home Page',`<div class="customizer-layout"><section class="panel customizer-controls"><h2>Appearance</h2><div class="custom-grid">${[['bg','Background'],['header','Header'],['accent','Accent'],['card','Cards'],['button','Buttons'],['text','Text'],['border','Borders']].map(([k,l])=>`<label>${l}<span class="color-line"><input type="color" id="theme_${k}" value="${esc(t[k]||'#ffffff')}" onchange="changeTheme('${k}',this.value)"><input type="text" value="${esc(t[k]||'#ffffff')}" maxlength="7" oninput="changeTheme('${k}',this.value)"></span></label>`).join('')}<label>Border radius<input type="range" min="0" max="30" value="${t.radius??12}" oninput="changeTheme('radius',Number(this.value));this.nextElementSibling.value=this.value"><output>${t.radius??12}</output></label><label>Font size<input type="range" min="12" max="22" value="${t.fontSize??16}" oninput="changeTheme('fontSize',Number(this.value));this.nextElementSibling.value=this.value"><output>${t.fontSize??16}</output></label><label>Font<select onchange="changeTheme('font',this.value)"><option ${t.font==='Arial, Helvetica, sans-serif'?'selected':''}>Arial, Helvetica, sans-serif</option><option ${t.font==='Georgia, serif'?'selected':''}>Georgia, serif</option><option ${t.font==='Verdana, sans-serif'?'selected':''}>Verdana, sans-serif</option><option ${t.font==='Trebuchet MS, sans-serif'?'selected':''}>Trebuchet MS, sans-serif</option></select></label><label><input type="checkbox" ${t.dark?'checked':''} onchange="changeTheme('dark',this.checked)"> Dark appearance</label></div><h2>Background Image</h2><label>Upload background image<input type="file" accept="image/*" onchange="setHomeBackground(this.files[0])"></label><div class="custom-grid"><label>Opacity<input type="range" min="0" max="1" step=".05" value="${t.bgOpacity??.18}" oninput="changeTheme('bgOpacity',Number(this.value));this.nextElementSibling.value=this.value"><output>${t.bgOpacity??.18}</output></label><label>Fit<select onchange="changeTheme('bgFit',this.value)"><option>cover</option><option ${t.bgFit==='contain'?'selected':''}>contain</option></select></label><label>Position<select onchange="changeTheme('bgPosition',this.value)"><option>center</option><option>top</option><option>bottom</option><option>left</option><option>right</option></select></label></div><button onclick="clearHomeBackground()">Remove Background Image</button><h2>Dashboard Blocks</h2><p class="muted">Drag blocks to reorder them. Add or remove blocks below.</p><div class="block-editor-list">${c.blocks.map((b,i)=>`<div class="block-editor-item" draggable="true" data-block-index="${i}"><span class="drag-handle">☷</span><div class="block-editor-main"><strong>${esc(b.title||b.type)}</strong><small>${esc(b.type)}</small>${b.type==='image'?`<label>Image source<select onchange="updateHomeBlock('${b.id}','source',this.value);render()"><option value="upload" ${b.source==='upload'?'selected':''}>Uploaded home image</option><option value="random" ${b.source==='random'?'selected':''}>Random specimen image</option><option value="species" ${b.source==='species'?'selected':''}>Specific species</option></select></label>${b.source==='upload'?`<label>Image<select onchange="updateHomeBlock('${b.id}','imageId',this.value);render()">${imgOpts}</select></label>`:''}${b.source==='species'?`<label>Species<select onchange="updateHomeBlock('${b.id}','speciesId',this.value);render()">${SOURCE_SPECIES.map(s=>`<option value="${s.id}" ${s.id===b.speciesId?'selected':''}>${esc(s.common)}</option>`).join('')}</select></label>`:''}<div class="custom-grid"><label>Width<input value="${esc(b.width||'100%')}" oninput="updateHomeBlock('${b.id}','width',this.value)"></label><label>Height<input value="${esc(b.height||'240px')}" oninput="updateHomeBlock('${b.id}','height',this.value)"></label><label>Opacity<input type="range" min=".1" max="1" step=".05" value="${b.opacity??1}" oninput="updateHomeBlock('${b.id}','opacity',Number(this.value))"></label><label>Fit<select onchange="updateHomeBlock('${b.id}','fit',this.value)"><option>contain</option><option ${b.fit==='cover'?'selected':''}>cover</option><option ${b.fit==='fill'?'selected':''}>fill</option></select></label><label>Position<select onchange="updateHomeBlock('${b.id}','position',this.value)"><option>center</option><option>top</option><option>bottom</option><option>left</option><option>right</option></select></label><label>Click action<select onchange="updateHomeBlock('${b.id}','clickAction',this.value)"><option value="none">None</option><option value="study">Species Study</option><option value="full">Full Practical</option><option value="skull">Skull / Teeth</option><option value="skin">Skin / Whole</option><option value="scientific">Scientific Name</option><option value="family">Family</option></select></label></div>`:''}${b.type==='action'?`<label>Button text<input value="${esc(b.button||b.title||'Start')}" oninput="updateHomeBlock('${b.id}','button',this.value)"></label><label>Action<select onchange="updateHomeBlock('${b.id}','action',this.value)"><option value="full">Full Practical</option><option value="skull">Skull / Teeth</option><option value="skin">Skin / Whole</option><option value="scientific">Scientific Name</option><option value="family">Family</option><option value="study">Species Study</option></select></label><label>Button image<select onchange="updateHomeBlock('${b.id}','buttonImageId',this.value)"><option value="">None</option>${imgOpts}</select></label>`:''}${b.type==='gallery'?`<div class="custom-grid"><label>Number of images<input type="number" min="2" max="6" value="${b.count||4}" oninput="updateHomeBlock('${b.id}','count',Number(this.value))"></label><label>Image height<input value="${esc(b.height||'140px')}" oninput="updateHomeBlock('${b.id}','height',this.value)"></label><label>Fit<select onchange="updateHomeBlock('${b.id}','fit',this.value)"><option>contain</option><option ${b.fit==='cover'?'selected':''}>cover</option></select></label></div>`:''}<label>Title<input value="${esc(b.title||'')}" oninput="updateHomeBlock('${b.id}','title',this.value)"></label><button class="danger" onclick="removeHomeBlock('${b.id}')">Remove block</button></div></div>`).join('')}</div><div class="button-row"><button onclick="addHomeBlock('image')">+ Image Block</button><button onclick="addHomeBlock('action')">+ Button Block</button><button onclick="addHomeBlock('progress')">+ Progress</button><button onclick="addHomeBlock('missed')">+ Missed Species</button><button onclick="addHomeBlock('quick')">+ Quick Actions</button><button onclick="addHomeBlock('gallery')">+ Image Gallery</button></div><h2>Your Home Images</h2><label class="file-button">Add home images<input type="file" accept="image/*" multiple onchange="handleHomeImages(this.files)"></label><div class="home-image-list">${state.homeImages.map(x=>`<div><img src="${esc(x.dataUrl)}"><span>${esc(x.name)}</span><button class="danger" onclick="deleteHomeImage('${x.id}')">Delete</button></div>`).join('')}</div><div class="button-row"><button onclick="resetHomeCustomization()">Reset Home Page</button><button class="primary" onclick="setScreen('home')">Done</button></div></section><section class="panel customizer-preview"><h2>Live Preview</h2><div class="mini-home"><p>Return to Home to see your full layout. Changes are saved automatically.</p><div class="mini-swatch"><span style="background:${esc(t.accent||'#1e5b8c')}"></span><span style="background:${esc(t.card||'#fff')}"></span><span style="background:${esc(t.bg||'#f3f5f7')}"></span></div></div></section></div>`);
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
  app.innerHTML=shell(`${modeLabel()} — Question ${state.session.q} of ${state.length}`,`
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
  const pct=state.session.totalPoints?Math.round(state.session.points/state.session.totalPoints*100):0;
  app.innerHTML=shell('Quiz Results',`
    <div class="results panel"><div class="score">${pct}%</div><h2>${state.session.correct} / ${state.length} questions fully correct</h2><p>${state.session.points} / ${state.session.totalPoints} requested fields correct.</p>
    <div class="button-row"><button class="primary" onclick="startQuiz(state.mode)">Try Again</button><button onclick="setScreen('home')">Home</button><button onclick="setScreen('progress')">Review Progress</button></div></div>
  `);
}

function renderStudy(app){
  if(!state.selectedSpeciesId) state.selectedSpeciesId=SOURCE_SPECIES[0].id;
  const s=selectedSpecies(), cards=cardsFor(s.id), info=state.speciesInfo[s.id]||{};
  const list=SOURCE_SPECIES.map(x=>`<button class="species-list-btn ${x.id===s.id?'selected':''}" onclick="setStudySpecies('${x.id}');render()">${esc(x.common)}<small><i>${esc(x.scientific)}</i></small></button>`).join('');
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
  app.innerHTML=shell('Species Study',`
    <div class="study-layout">
      <aside class="species-sidebar"><input class="search" id="speciesSearch" placeholder="Search species..." oninput="filterSpeciesList()"><div id="speciesList">${list}</div></aside>
      <section class="study-main">
        <div class="species-heading"><div><h2>${esc(s.common)}</h2><p><i>${esc(s.scientific)}</i> · ${esc(s.family)}</p></div><div class="button-row"><button onclick="openStudyNewCard()">+ Add Card</button><button onclick="editSpeciesInfo()">Edit Species Notes</button><button onclick="setScreen('manage')">Manage Images</button></div></div>
        <div class="study-tabs"><button class="${state.studyMode==='browse'?'active':''}" onclick="state.studyMode='browse';render()">Browse Cards</button><button class="${state.studyMode==='flash'?'active':''}" onclick="state.studyMode='flash';state.studyIndex=0;state.studyFlipped=false;render()">Flashcard Mode</button></div>
        ${info.notes?`<div class="notes panel"><h3>My Species Notes</h3><div>${esc(info.notes).replace(/\n/g,'<br>')}</div></div>`:''}
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

async function editSpeciesInfo(){
  const s=selectedSpecies(),old=state.speciesInfo[s.id]?.notes||'';
  const notes=prompt(`Your notes for ${s.common}:`,old);if(notes===null)return;
  await dbPut(INFO_STORE,{speciesId:s.id,notes});await refreshStudyData();render()
}

function renderCardEditor(app){
  const e=state.editor||{speciesId:selectedSpecies().id,front:'',back:'',category:'General',customCategory:'',tags:[]};
  const speciesOptions=SOURCE_SPECIES.map(x=>`<option value="${x.id}" ${x.id===e.speciesId?'selected':''}>${esc(x.common)} — ${esc(x.scientific)}</option>`).join('');
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
  if(!state.selectedSpeciesId)state.selectedSpeciesId=SOURCE_SPECIES[0].id;
  const s=selectedSpecies(),imgs=allImages(s);
  const list=SOURCE_SPECIES.map(x=>`<button class="species-list-btn ${x.id===s.id?'selected':''}" onclick="setStudySpecies('${x.id}');render()">${esc(x.common)}<small><i>${esc(x.scientific)}</i></small></button>`).join('');
  app.innerHTML=shell('Manage Species & Images',`
    <div class="manage-layout">
      <aside class="species-sidebar"><input class="search" placeholder="Search species..." oninput="filterSpeciesList()"><div>${list}</div></aside>
      <section class="study-main">
        <div class="species-heading"><div><h2>${esc(s.common)}</h2><p><i>${esc(s.scientific)}</i> · ${esc(s.family)}</p></div><button onclick="setScreen('study')">Study this species</button></div>
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

function renderProgress(app){
  const p=loadProgress();
  const rows=SOURCE_SPECIES.map(s=>{const r=p[s.id]||{seen:0,correct:0,wrong:0};const pct=r.seen?Math.round(r.correct/r.seen*100):0;return `<tr><td>${esc(s.common)}</td><td><i>${esc(s.scientific)}</i></td><td>${r.seen}</td><td>${r.correct}</td><td>${r.wrong}</td><td>${pct}%</td></tr>`}).join('');
  app.innerHTML=shell('Progress',`<div class="panel"><div class="table-wrap"><table><thead><tr><th>Species</th><th>Scientific name</th><th>Seen</th><th>Correct</th><th>Missed</th><th>Accuracy</th></tr></thead><tbody>${rows}</tbody></table></div><div class="button-row"><button onclick="resetProgress()">Reset Practical Progress</button><button onclick="exportBackup()">Export Full Backup</button></div></div>`)
}
function resetProgress(){if(confirm('Reset practical quiz progress?')){localStorage.removeItem(PROGRESS_KEY);render()}}

function openLightbox(src){$('lightboxImg').src=src;$('lightbox').classList.add('open')}
function closeLightbox(){ $('lightbox').classList.remove('open') }

async function blobToDataUrl(blob){return await new Promise((res,rej)=>{const r=new FileReader();r.onload=()=>res(r.result);r.onerror=rej;r.readAsDataURL(blob)})}
async function exportBackup(){
  const images=state.customImages.map(x=>({id:x.id,speciesId:x.speciesId,name:x.name,dataUrl:x.dataUrl,viewTypes:x.viewTypes,createdAt:x.createdAt}));
  const homeImages=state.homeImages.map(x=>({id:x.id,name:x.name,dataUrl:x.dataUrl}));
  const backup={version:3,createdAt:new Date().toISOString(),customImages:images,studyCards:state.cards,speciesInfo:state.speciesInfo,tagOverrides:state.tagOverrides,progress:loadProgress(),settings:loadSettings(),homeConfig:state.homeConfig||loadHomeConfig(),homeImages};
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
    if(b.homeConfig)localStorage.setItem(HOME_KEY,JSON.stringify(b.homeConfig));
    for(const [id,obj] of Object.entries(b.speciesInfo||{}))await dbPut(INFO_STORE,{speciesId:id,notes:obj.notes||''});
    if(b.tagOverrides)localStorage.setItem(TAGS_KEY,JSON.stringify(b.tagOverrides));
    if(b.progress)localStorage.setItem(PROGRESS_KEY,JSON.stringify(b.progress));
    if(b.settings)localStorage.setItem(SETTINGS_KEY,JSON.stringify(b.settings));
    await refreshStudyData();loadTags();alert('Backup imported successfully.');render()
  }catch(e){alert('Could not import that backup.')}
}

function boot(){
  loadTags();state.homeConfig=loadHomeConfig();const s=loadSettings();state.length=Number(s.length||20);state.focusMissed=!!s.focusMissed;
  refreshStudyData().then(()=>{state.selectedSpeciesId=SOURCE_SPECIES[0]?.id;render()});
}
document.addEventListener('keydown',e=>{if(e.key==='Escape')closeLightbox()});
boot();
