
const DB_NAME='mammalogy-practical-db', DB_VERSION=2;
const IMG_STORE='customImages', CARD_STORE='studyCards', INFO_STORE='speciesInfo';
const TAGS_KEY='mammalogy-tag-overrides', PROGRESS_KEY='mammalogy-progress', SETTINGS_KEY='mammalogy-settings';

const state={
  screen:'home', mode:'full', length:20, current:null, answered:false, editor:null,
  session:{q:0,correct:0,points:0,totalPoints:0}, lastSpecies:null, focusMissed:false,
  customImages:[], tagOverrides:{}, cards:[], speciesInfo:{},
  selectedSpeciesId:null, studyMode:'browse', studyIndex:0, studyFlipped:false
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
  if(state.screen==='progress') return renderProgress(app);
}

function shell(title,body){
  return `<div class="shell">
    <header class="topbar"><button class="brand" onclick="setScreen('home')">Mammalogy Practical Trainer</button>
    <nav><button onclick="setScreen('home')">Home</button><button onclick="setScreen('study')">Species Study</button><button onclick="setScreen('manage')">Manage</button><button onclick="setScreen('progress')">Progress</button></nav></header>
    <section class="content"><div class="page-title"><h1>${title}</h1></div>${body}</section>
  </div>`
}

function renderHome(app){
  const st=progressStats();
  app.innerHTML=shell('Mammalogy Practical Trainer',`
    <div class="hero">
      <div><h2>Image Practical + Species Study</h2><p>Practice specimen identification from your course images, then study your own notes and flashcards for each species.</p></div>
      <div class="statbox"><strong>${SOURCE_SPECIES.length}</strong><span>species</span><strong>${SOURCE_SPECIES.reduce((n,s)=>n+s.images.length,0)}</strong><span>source images</span></div>
    </div>
    <div class="grid two">
      <section class="panel"><h2>Image Practical</h2><p>Random specimen images with typed scientific name and family answers.</p>
        <div class="button-grid">
          <button class="primary" onclick="startQuiz('full')">Full Practical</button>
          <button onclick="startQuiz('skull')">Skull / Teeth</button>
          <button onclick="startQuiz('skin')">Skin / Whole</button>
          <button onclick="startQuiz('scientific')">Scientific Name Only</button>
          <button onclick="startQuiz('family')">Family Only</button>
        </div>
        <div class="settings-row"><label>Questions <select id="quizLength" onchange="saveQuizSetting()"><option>10</option><option selected>20</option><option>30</option><option>40</option><option>50</option></select></label>
        <label><input id="focusMissed" type="checkbox" onchange="saveQuizSetting()"> Focus missed/unseen species</label></div>
      </section>
      <section class="panel"><h2>Species Study</h2><p>Create and manage your own information cards, notes, and study material linked to individual species.</p>
        <button class="primary wide" onclick="setScreen('study')">Open Species Study</button>
        <button class="wide" onclick="openStudyNewCard()">+ Add Study Card</button>
      </section>
    </div>
    <div class="grid three">
      <section class="panel compact"><h3>Progress</h3><div class="big">${st.seen}</div><p>questions answered</p><p>${st.correct} correct · ${st.wrong} missed</p><button onclick="setScreen('progress')">View progress</button></section>
      <section class="panel compact"><h3>Manage Images</h3><p>Paste images with Ctrl+V or upload files. Tag them by skull/teeth or skin/whole.</p><button onclick="setScreen('manage')">Manage Species & Images</button></section>
      <section class="panel compact"><h3>Backup</h3><p>Export your custom images, study cards, notes, tags, and progress so you can move them to another computer.</p><button onclick="exportBackup()">Export Full Backup</button><button onclick="triggerImportBackup()">Import Backup</button><input id="backupFile" type="file" accept=".json" hidden onchange="importBackup(this.files[0])"></section>
    </div>
  `);
  const s=loadSettings(); if($('quizLength'))$('quizLength').value=String(s.length||20); if($('focusMissed'))$('focusMissed').checked=!!s.focusMissed;
}

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
  const c=cardMode(s.id);
  const list=SOURCE_SPECIES.map(x=>`<button class="species-list-btn ${x.id===s.id?'selected':''}" onclick="setStudySpecies('${x.id}');render()">${esc(x.common)}<small><i>${esc(x.scientific)}</i></small></button>`).join('');
  const cardPanel=state.studyMode==='flash' && c ? `
    <div class="flashcard" onclick="state.studyFlipped=!state.studyFlipped;render()">
      <div class="flash-label">${state.studyFlipped?'ANSWER':'QUESTION'}</div>
      <div class="flash-text">${esc(state.studyFlipped?c.back:c.front)}</div>
      <div class="flash-hint">Click card to flip</div>
    </div>
    <div class="flash-controls"><button onclick="studyPrev()">← Previous</button><span>${state.studyIndex+1} / ${cards.length}</span><button onclick="studyNext()">Next →</button></div>
  ` : cards.length ? cards.map(c=>`<div class="study-card"><div><span class="tag">${esc(c.category||'General')}</span><h4>${esc(c.front)}</h4></div><div class="card-answer">${esc(c.back)}</div><div class="card-actions"><button onclick="openStudyEditCard('${c.id}')">Edit</button><button class="danger" onclick="deleteCard('${c.id}')">Delete</button></div></div>`).join('') : `<div class="empty">No study cards yet. Add your first card for ${esc(s.common)}.</div>`;
  app.innerHTML=shell('Species Study',`
    <div class="study-layout">
      <aside class="species-sidebar"><input class="search" id="speciesSearch" placeholder="Search species..." oninput="filterSpeciesList()"><div id="speciesList">${list}</div></aside>
      <section class="study-main">
        <div class="species-heading"><div><h2>${esc(s.common)}</h2><p><i>${esc(s.scientific)}</i> · ${esc(s.family)}</p></div><div class="button-row"><button onclick="openStudyNewCard()">+ Add Card</button><button onclick="editSpeciesInfo()">Edit Species Notes</button><button onclick="setScreen('manage')">Manage Images</button></div></div>
        <div class="study-tabs"><button class="${state.studyMode==='browse'?'active':''}" onclick="state.studyMode='browse';render()">Browse Cards</button><button class="${state.studyMode==='flash'?'active':''}" onclick="state.studyMode='flash';state.studyIndex=0;state.studyFlipped=false;render()">Flashcard Mode</button></div>
        ${info.notes?`<div class="notes panel"><h3>My Species Notes</h3><div>${esc(info.notes).replace(/\n/g,'<br>')}</div></div>`:''}
        <div class="cards-header"><h3>${state.studyMode==='flash'?'Flashcards':'Study Cards'} <span>${cards.length}</span></h3>${state.studyMode==='flash'&&cards.length?`<button onclick="shuffleStudyCards()">Shuffle</button>`:''}</div>
        ${cardPanel}
      </section>
    </div>
  `);
}
function filterSpeciesList(){
  const q=normalize($('speciesSearch')?.value||'');
  document.querySelectorAll('.species-list-btn').forEach(b=>b.style.display=normalize(b.textContent).includes(q)?'':'none')
}
function studyNext(){const cards=cardsFor(selectedSpecies().id);if(cards.length){state.studyIndex=(state.studyIndex+1)%cards.length;state.studyFlipped=false;render()}}
function studyPrev(){const cards=cardsFor(selectedSpecies().id);if(cards.length){state.studyIndex=(state.studyIndex-1+cards.length)%cards.length;state.studyFlipped=false;render()}}
function shuffleStudyCards(){const cards=cardsFor(selectedSpecies().id);if(cards.length){state.studyIndex=Math.floor(Math.random()*cards.length);state.studyFlipped=false;render()}}

function openStudyNewCard(){
  state.editor={id:null,speciesId:selectedSpecies().id,front:'',back:'',category:'General'};
  state.screen='cardEditor';render();
}
function openStudyEditCard(id){
  const c=state.cards.find(x=>x.id===id);if(!c)return;
  state.editor={...c};state.screen='cardEditor';render();
}
function editorValue(id){return $(id)?.value||''}
async function submitCardEditor(){
  const speciesId=editorValue('cardSpecies');
  const front=editorValue('cardFront').trim();
  const back=editorValue('cardBack').trim();
  const category=editorValue('cardCategory')||'General';
  if(!speciesId||!front||!back){$('editorError').textContent='Please fill in the species, front, and back.';return}
  await saveCard({...state.editor,speciesId,front,back,category,order:state.editor.order??cardsFor(speciesId).length});
  state.editor=null;state.selectedSpeciesId=speciesId;state.screen='study';
}
function cancelCardEditor(){state.editor=null;state.screen='study';render()}
async function saveCard(o){
  const card={id:o.id||('card-'+Date.now()+'-'+Math.random().toString(36).slice(2)),speciesId:o.speciesId,front:o.front,back:o.back,category:o.category||'General',order:o.order??0};
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
  const e=state.editor||{speciesId:selectedSpecies().id,front:'',back:'',category:'General'};
  const speciesOptions=SOURCE_SPECIES.map(x=>`<option value="${x.id}" ${x.id===e.speciesId?'selected':''}>${esc(x.common)} — ${esc(x.scientific)}</option>`).join('');
  const cats=['General','Identification','Anatomy','Skull / Teeth','Dentition','Pelage / Skin','Habitat','Diet','Behavior','Taxonomy','Other'];
  const catOptions=cats.map(x=>`<option ${x===(e.category||'General')?'selected':''}>${esc(x)}</option>`).join('');
  const previewFront=esc(e.front||'Your question will appear here.');
  const previewBack=esc(e.back||'Your answer will appear here.');
  app.innerHTML=shell(e.id?'Edit Study Card':'Create Study Card',`
    <div class="editor-layout">
      <section class="panel editor-form">
        <div class="form-grid">
          <label>Species<select id="cardSpecies">${speciesOptions}</select></label>
          <label>Category<select id="cardCategory">${catOptions}</select></label>
        </div>
        <label>Front / Question<textarea id="cardFront" rows=8 placeholder="Example: What family does the eastern wood rat belong to?">${esc(e.front)}</textarea></label>
        <label>Back / Answer<textarea id="cardBack" rows=8 placeholder="Example: Cricetidae">${esc(e.back)}</textarea></label>
        <div id="editorError" class="editor-error"></div>
        <div class="button-row"><button class="primary" onclick="submitCardEditor()">Save Card</button><button onclick="cancelCardEditor()">Cancel</button></div>
      </section>
      <section class="panel live-preview"><h2>Full Card Preview</h2>
        <div class="preview-card"><div class="preview-label">FRONT</div><div id="previewFront" class="preview-text">${previewFront}</div><div class="preview-divider"></div><div class="preview-label">BACK</div><div id="previewBack" class="preview-text">${previewBack}</div><div class="preview-species">${esc(speciesById(e.speciesId)?.common||'')} · ${esc(e.category||'General')}</div></div>
        <p class="muted">The preview updates as you type. The front and back stay visible together while you build the card.</p>
      </section>
    </div>
  `);
  ['cardFront','cardBack','cardSpecies','cardCategory'].forEach(id=>$(id)?.addEventListener('input',updateCardPreview));
}
function updateCardPreview(){
  const f=editorValue('cardFront'),b=editorValue('cardBack'),sid=editorValue('cardSpecies'),cat=editorValue('cardCategory');
  if($('previewFront'))$('previewFront').textContent=f||'Your question will appear here.';
  if($('previewBack'))$('previewBack').textContent=b||'Your answer will appear here.';
  const sp=speciesById(sid);document.querySelector('.preview-species')?.replaceChildren(document.createTextNode(`${sp?.common||''} · ${cat||'General'}`));
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
  const backup={version:2,createdAt:new Date().toISOString(),customImages:images,studyCards:state.cards,speciesInfo:state.speciesInfo,tagOverrides:state.tagOverrides,progress:loadProgress(),settings:loadSettings()};
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
    for(const [id,obj] of Object.entries(b.speciesInfo||{}))await dbPut(INFO_STORE,{speciesId:id,notes:obj.notes||''});
    if(b.tagOverrides)localStorage.setItem(TAGS_KEY,JSON.stringify(b.tagOverrides));
    if(b.progress)localStorage.setItem(PROGRESS_KEY,JSON.stringify(b.progress));
    if(b.settings)localStorage.setItem(SETTINGS_KEY,JSON.stringify(b.settings));
    await refreshStudyData();loadTags();alert('Backup imported successfully.');render()
  }catch(e){alert('Could not import that backup.')}
}

function boot(){
  loadTags();const s=loadSettings();state.length=Number(s.length||20);state.focusMissed=!!s.focusMissed;
  refreshStudyData().then(()=>{state.selectedSpeciesId=SOURCE_SPECIES[0]?.id;render()});
}
document.addEventListener('keydown',e=>{if(e.key==='Escape')closeLightbox()});
boot();
