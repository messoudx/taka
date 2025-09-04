// js/board.js (module)
const params = new URLSearchParams(location.search);
const roomId = params.get('room');
if(!roomId){ alert('رمز الغرفة مفقود'); location.href='games.html'; }

const firebaseConfig = {
  apiKey: "AIzaSyC2eUDscOP_Vgq7iFGRQm09soisquGHe9g",
  authDomain: "taka-e3b3d.firebaseapp.com",
  databaseURL: "https://taka-e3b3d-default-rtdb.firebaseio.com",
  projectId: "taka-e3b3d",
  storageBucket: "taka-e3b3d.firebasestorage.app",
  messagingSenderId: "719794585832",
  appId: "1:719794585832:web:1c235cfd14e78b5a92095d",
  measurementId: "G-6MC3MZZYTZ"
};
if(!firebase.apps.length) firebase.initializeApp(firebaseConfig);
const db = firebase.database();

const boardArea = document.getElementById('boardArea');
const boardStatus = document.getElementById('boardStatus');
const me = JSON.parse(localStorage.getItem('taka_user') || '{}');
if(!me || !me.code){ alert('سجّل دخول'); location.href='index.html'; }

const sessionRef = db.ref(`rooms/${roomId}/sessions/board`);
const stateRef = sessionRef.child('state');

async function init(){
  const sSnap = await stateRef.once('value');
  if(!sSnap.exists()){
    const categories = [
      {name:'عام', qs:[{v:100,q:'ما عاصمة فرنسا؟',a:'باريس'},{v:200,q:'أين الأهرامات؟',a:'مصر'}]},
      {name:'أنمي', qs:[{v:100,q:'من بطل ناروتو؟',a:'ناروتو'},{v:200,q:'من بطل ون بيس؟',a:'لوفي'}]}
    ];
    const cells = {}; categories.forEach((cat,ci)=> cat.qs.forEach((q,ri)=> cells[`c${ci}_r${ri}`] = { disabled:false }));
    await stateRef.set({ categories, cells, turn:'team1', winner:'', startedAt: Date.now() });
  }

  stateRef.on('value', snap=>{
    const s = snap.val(); if(!s) return;
    renderBoard(s);
    boardStatus.innerText = s.winner ? `انتهت — الفائز: ${s.winner}` : `الدور: ${s.turn}`;
  });
}

function renderBoard(s){
  boardArea.innerHTML = '';
  (s.categories||[]).forEach((cat,ci)=>{
    const col = document.createElement('div'); col.className='catCard';
    const h = document.createElement('div'); h.style.fontWeight='900'; h.innerText = cat.name; col.appendChild(h);
    const values = document.createElement('div'); values.style.marginTop='8px';
    cat.qs.forEach((q,ri)=>{
      const key = `c${ci}_r${ri}`;
      const pill = document.createElement('div'); pill.className='valuePill'; pill.dataset.key=key; pill.dataset.ci=ci; pill.dataset.ri=ri;
      pill.innerText = q.v;
      if(s.cells && s.cells[key] && s.cells[key].disabled) pill.classList.add('disabled');
      pill.addEventListener('click', ()=> openQuestion(ci,ri,key,q,s));
      values.appendChild(pill);
    });
    col.appendChild(values);
    boardArea.appendChild(col);
  });
}

async function openQuestion(ci,ri,key,q,sState){
  const s = sState; if(s.cells && s.cells[key] && s.cells[key].disabled) return alert('الخانة مُعطلة');
  // check if me belongs to current turn team
  const sessSnap = await sessionRef.once('value'); const sess = sessSnap.val() || {}; const roles = sess.roles || {};
  const myTeam = Array.isArray(roles.team1) && roles.team1.includes(me.id) ? 'team1' : (Array.isArray(roles.team2) && roles.team2.includes(me.id) ? 'team2' : null);
  if(!myTeam) return alert('أنت غير مشارك في هذه الجلسة');
  if(s.turn !== myTeam) return alert('ليس دور فريقك الآن');

  // show simple modal-like prompt (browser)
  if(!confirm(`السؤال: ${q.q}\nهل تريد اعتماد الإجابة ومنح ${q.v} نقطة لفريقك؟`)) return;
  // award
  if(myTeam === 'team1' || myTeam === 'team2'){
    await db.ref(`rooms/${roomId}/scores/${myTeam}`).transaction(old => (old||0) + Number(q.v));
    await stateRef.child('cells/' + key).set({ disabled:true, by: me.id, at: Date.now() });
    // switch turn
    await stateRef.child('turn').set(myTeam==='team1' ? 'team2' : 'team1');
    await db.ref(`rooms/${roomId}/chat`).push().set({ name:'نظام', text:`${me.nick} منح ${q.v} نقطة لفريق ${myTeam}`, ts: Date.now()});
  }
}

init().catch(e=>{ console.error(e); alert('خطأ'); location.href='games.html'; });
