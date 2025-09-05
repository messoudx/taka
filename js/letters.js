// js/letters.js (module)
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

const lettersGrid = document.getElementById('lettersGrid');
const statusEl = document.getElementById('lettersStatus');
const gameRoomInfo = document.getElementById('gameRoomInfo');
gameRoomInfo.innerText = `الغرفة: ${roomId}`;

const me = JSON.parse(localStorage.getItem('taka_user') || '{}');
if(!me || !me.code){ alert('سجّل دخول'); location.href='index.html'; }

const sessionRef = db.ref(`rooms/${roomId}/sessions/letters`);
const stateRef = sessionRef.child('state');

const letters = ['ا','ب','ت','ث','ج','ح','خ','د','ذ','ر','ز','س','ش','ص','ض','ط','ظ','ع','غ','ف','ق','ك','ل','م','ن'];

async function init(){
  // create grid UI
  lettersGrid.innerHTML = '';
  for(let i=0;i<25;i++){
    const el = document.createElement('div'); el.className='hex'; el.dataset.idx = i; el.innerText = letters[i];
    lettersGrid.appendChild(el);
  }

  // ensure state exists
  const sSnap = await stateRef.once('value');
  if(!sSnap.exists()){
    await stateRef.set({ board: Array(25).fill(''), winner:'', turn:'team1', startedAt: Date.now() });
  }

  stateRef.on('value', snap=>{
    const s = snap.val();
    if(!s) return;
    updateUI(s.board);
    statusEl.innerText = s.winner ? `انتهت — الفائز: ${s.winner}` : `الدور: ${s.turn}`;
  });

  // click handler
  lettersGrid.addEventListener('click', async e=>{
    const hex = e.target.closest('.hex'); if(!hex) return;
    const idx = Number(hex.dataset.idx);
    const sSnap = await stateRef.once('value'); const s = sSnap.val();
    if(!s) return;
    if(s.board[idx]) return alert('الخانة مستخدمة');
    if(s.winner) return alert('اللعبة انتهت');

    // get session roles
    const sessSnap = await sessionRef.once('value'); const sess = sessSnap.val() || {};
    const roles = sess.roles || {};
    const myTeam = Array.isArray(roles.team1) && roles.team1.includes(me.id) ? 'team1' : (Array.isArray(roles.team2) && roles.team2.includes(me.id) ? 'team2' : null);
    if(!myTeam) return alert('أنت غير مشارك في الجلسة');
    if(s.turn !== myTeam) return alert('ليس دور فريقك');

    // transaction mark
    await stateRef.transaction(cur=>{
      if(!cur) return cur;
      if(cur.board[idx]) return;
      cur.board[idx] = myTeam;
      if(checkWin(cur.board)) cur.winner = myTeam;
      else cur.turn = (cur.turn === 'team1' ? 'team2' : 'team1');
      return cur;
    });
  });
}

function updateUI(board){
  const hexes = lettersGrid.querySelectorAll('.hex');
  hexes.forEach((h,i)=>{
    h.classList.remove('team1','team2');
    if(board[i] === 'team1') h.classList.add('team1');
    else if(board[i] === 'team2') h.classList.add('team2');
  });
}

function checkWin(board){
  const N=5;
  for(let r=0;r<N;r++){ const base=r*N; const first=board[base]; if(first && board[base+1]===first && board[base+2]===first && board[base+3]===first && board[base+4]===first) return true; }
  for(let c=0;c<N;c++){ const first=board[c]; if(first && board[c+N]===first && board[c+2*N]===first && board[c+3*N]===first && board[c+4*N]===first) return true; }
  return false;
}

init().catch(e=>{ console.error(e); alert('خطأ في تحميل اللعبة'); location.href='games.html'; });
