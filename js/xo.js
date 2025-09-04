// js/xo.js (module) - صفحة XO
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

const xoGrid = document.getElementById('xoGrid');
const turnInfo = document.getElementById('xoTurnInfo');
const gameRoomInfo = document.getElementById('gameRoomInfo');
gameRoomInfo.innerText = `الغرفة: ${roomId}`;

let me = null;
try{ me = JSON.parse(localStorage.getItem('taka_user')); }catch(e){}
if(!me || !me.code){ alert('سجّل دخول أولاً'); location.href='index.html'; }

const sessionRef = db.ref(`rooms/${roomId}/sessions/xo`);
const stateRef = sessionRef.child('state');
const rolesRef = sessionRef.child('roles');

let roles = null;
let myId = me.id;

async function init(){
  // render empty grid
  renderGrid(Array(9).fill(null));
  // get roles
  roles = (await rolesRef.once('value')).val() || {};
  // listen state
  stateRef.on('value', snap=>{
    const s = snap.val();
    if(!s) return;
    updateUI(s);
  });
}
function renderGrid(board){
  xoGrid.innerHTML = '';
  for(let i=0;i<9;i++){
    const cell = document.createElement('div'); cell.className='xoCell'; cell.dataset.idx=i;
    cell.innerText = board[i] ? markForOwner(board[i]) : '؟';
    cell.addEventListener('click', ()=> tryMove(i));
    xoGrid.appendChild(cell);
  }
}
function markForOwner(ownerId){
  if(roles && roles.X === ownerId) return 'X';
  if(roles && roles.O === ownerId) return 'O';
  // fallback: ownerId truncated
  return ownerId ? ownerId.slice(-4) : '?';
}
async function tryMove(idx){
  const sSnap = await stateRef.once('value'); const s = sSnap.val();
  if(!s) return;
  if(s.winner) return alert('اللعبة انتهت');
  if(s.board && s.board[idx]) return alert('الخانة مستخدمة');
  if(s.turn !== myId) return alert('ليست حركتك الآن');

  // transaction: write owner id to board idx, compute win
  await stateRef.transaction(cur=>{
    if(!cur) return cur;
    if(cur.board[idx]) return;
    cur.board[idx] = myId;
    // check win by owner ids
    const w = checkWinByOwner(cur.board);
    if(w) cur.winner = myId;
    else {
      const other = (roles.X === myId) ? roles.O : roles.X;
      cur.turn = other || null;
    }
    return cur;
  });
}
function checkWinByOwner(b){
  const lines=[[0,1,2],[3,4,5],[6,7,8],[0,3,6],[1,4,7],[2,5,8],[0,4,8],[2,4,6]];
  for(const L of lines){
    const [a,b1,c]=L;
    if(b[a] && b[a]===b[b1] && b[a]===b[c]) return b[a];
  }
  return null;
}
function updateUI(s){
  // fill cells
  const cells = xoGrid.querySelectorAll('.xoCell');
  cells.forEach((c,i)=>{ c.innerText = s.board && s.board[i] ? markForOwner(s.board[i]) : '؟'; c.classList.toggle('used', !!(s.board && s.board[i])); });
  // turn
  const you = (s.turn === myId) ? 'دورك الآن' : 'دور لاعب آخر';
  turnInfo.innerText = you;
  if(s.winner){
    if(s.winner === myId) alert('تهانينا — فزت!'); else alert('انتهت المباراة');
  }
}

init().catch(e=>{ console.error(e); alert('خطأ في تحميل اللعبة'); location.href='games.html'; });
