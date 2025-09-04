// js/xo.js (ES module)
let currentStateRef = null;
let currentRoomRefForXO = null;
let xoModalOpen = false;

export function initXO(){ /* no-op */ }

export async function handleXOSession(roomRef, me){
  // Avoid re-opening if already open for same room/session
  if(xoModalOpen) return;
  xoModalOpen = true;
  currentRoomRefForXO = roomRef;

  const sessionRef = roomRef.child('sessions/xo');
  const stateRef = sessionRef.child('state');
  currentStateRef = stateRef;

  // ensure state exists and has turn set to roles.X (if roles available)
  const sessionSnap = await sessionRef.once('value');
  const sessionObj = sessionSnap.val() || {};
  const roles = sessionObj.roles || {};
  if(!sessionObj.state){
    const initialTurn = roles.X || Object.values(roles)[0] || null;
    await stateRef.set({ board: Array(9).fill(''), turn: initialTurn, winner: '', startedAt: Date.now() });
  }

  // render modal
  const modal = document.getElementById('xoModal');
  const card = document.getElementById('xoModalCard');
  card.innerHTML = `
    <h3>XO — المباراة</h3>
    <div class="card small muted">الدور الحالي: <span id="xoTurn">—</span> · أنت: <strong id="xoMyRole">—</strong></div>
    <div id="xoGrid" class="xoGrid"></div>
    <div style="margin-top:12px"><button class="btn" id="closeXOBtn">إغلاق</button></div>
  `;
  modal.setAttribute('aria-hidden','false');

  document.getElementById('closeXOBtn').addEventListener('click', ()=>{
    modal.setAttribute('aria-hidden','true');
    // cleanup listeners
    if(stateRef) stateRef.off();
    xoModalOpen = false;
  }, { once: true });

  const grid = document.getElementById('xoGrid');
  function renderEmptyGrid(){ grid.innerHTML = ''; for(let i=0;i<9;i++){ const cell = document.createElement('div'); cell.className = 'xoCell'; cell.dataset.idx = i; cell.innerText = '؟'; grid.appendChild(cell); } }
  renderEmptyGrid();

  // get roles and determine my mark
  const rolesSnap = await sessionRef.child('roles').once('value');
  const rolesObj = rolesSnap.val() || {};
  const myRole = (rolesObj.X === me.id) ? 'X' : (rolesObj.O === me.id) ? 'O' : null;
  document.getElementById('xoMyRole').innerText = myRole || '—';

  // helper to map mark char by owner id
  function markForOwner(ownerId){
    if(rolesObj.X === ownerId) return 'X';
    if(rolesObj.O === ownerId) return 'O';
    return '?';
  }

  // listen to state changes
  stateRef.on('value', snap=>{
    const s = snap.val();
    if(!s) return;
    // turn is playerId
    document.getElementById('xoTurn').innerText = s.turn ? (s.turn === me.id ? 'دورك' : 'دور لاعب آخر') : '—';
    // update UI
    const cells = grid.querySelectorAll('.xoCell');
    cells.forEach((c,i)=>{
      const v = s.board[i];
      if(v){
        // v stores ownerId
        c.innerText = markForOwner(v);
        c.classList.add('used');
      } else {
        c.innerText = '؟';
        c.classList.remove('used','win');
      }
    });
    if(s.winner){
      // winner is playerId -> find mark and highlight
      const winnerMark = markForOwner(s.winner);
      // highlight winning indices if available (we can compute)
      const winIdx = findWinIndices(s.boardByOwner || s.board);
      if(winIdx) winIdx.forEach(i=> grid.children[i].classList.add('win'));
      // broadcast chat
      roomRef.child('chat').push().set({name:'نظام', text:`XO — فاز ${winnerMark}`, ts:Date.now()});
    }
  });

  // click handler
  grid.addEventListener('click', async (e)=>{
    if(!e.target.classList.contains('xoCell')) return;
    const idx = Number(e.target.dataset.idx);
    // ensure it's our turn
    const sSnap = await stateRef.once('value');
    const s = sSnap.val();
    if(!s) return;
    if(s.winner) return alert('اللعبة انتهت');
    if(s.board[idx]) return alert('الخانة مستخدمة');
    if(s.turn !== me.id) return alert('ليست حركتك حالياً');

    // atomic transaction
    await stateRef.transaction(cur=>{
      if(!cur) return cur;
      if(cur.board[idx]) return; // someone else took it
      cur.board[idx] = me.id; // store owner id
      // check win on owner ids
      const ownerBoard = cur.board;
      const w = checkWinOwner(ownerBoard);
      if(w) cur.winner = me.id;
      else {
        // switch turn to other player if roles known
        const other = (rolesObj.X === me.id) ? rolesObj.O : rolesObj.X;
        cur.turn = other || null;
      }
      return cur;
    });
  });

  // helpers
  function checkWinOwner(b){
    const lines=[[0,1,2],[3,4,5],[6,7,8],[0,3,6],[1,4,7],[2,5,8],[0,4,8],[2,4,6]];
    for(const L of lines){
      const [a,b1,c]=L;
      if(b[a] && b[a]===b[b1] && b[a]===b[c]) return b[a]; // returns ownerId
    }
    return null;
  }
  function findWinIndices(b){
    const lines=[[0,1,2],[3,4,5],[6,7,8],[0,3,6],[1,4,7],[2,5,8],[0,4,8],[2,4,6]];
    for(const L of lines){
      const [a,b1,c]=L;
      if(b[a] && b[a]===b[b1] && b[a]===b[c]) return L;
    }
    return null;
  }
}

export function cleanupXO(){
  // try to close modal safely (if open)
  try{
    const modal = document.getElementById('xoModal');
    if(modal) modal.setAttribute('aria-hidden','true');
  }catch(e){}
  xoModalOpen = false;
  if(currentStateRef) try{ currentStateRef.off(); }catch(e){}
  currentStateRef = null;
  currentRoomRefForXO = null;
}
