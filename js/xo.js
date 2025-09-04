// js/xo.js (ES module) - يتوقّف على node: rooms/{roomId}/sessions/xo/state
export function initXO(){ /* يمكن إضافة DOM templates إن أردت */ }

export async function handleXOSession(roomRef, me){
  // ensure state exists
  const stateRef = roomRef.child('sessions/xo/state');
  const snap = await stateRef.once('value');
  if(!snap.exists()){ await stateRef.set({ board: Array(9).fill(''), turn:'X', winner:'', startedAt:Date.now() }); }
  // render modal
  const modal = document.getElementById('xoModal'); const card = document.getElementById('xoModalCard');
  card.innerHTML = `
    <h3>XO — المباراة</h3>
    <div class="card small muted">الدور: <span id="xoTurn">—</span> · أنت: <strong id="xoMyRole">—</strong></div>
    <div id="xoGrid" class="xoGrid"></div>
    <div style="margin-top:12px"><button class="btn" id="closeXOBtn">إغلاق</button></div>
  `;
  modal.setAttribute('aria-hidden','false');
  document.getElementById('closeXOBtn').addEventListener('click', ()=>{ modal.setAttribute('aria-hidden','true'); roomRef.child('sessions/xo/state').off(); });

  const grid = document.getElementById('xoGrid');
  grid.innerHTML = '';
  for(let i=0;i<9;i++){ const cell = document.createElement('div'); cell.className = 'xoCell'; cell.dataset.idx = i; cell.innerHTML = '؟'; cell.addEventListener('click', ()=>{ if(cell.classList.contains('used')) return; openXOQuestion(i); }); grid.appendChild(cell); }

  // listen to state
  stateRef.on('value', snap=>{
    const s = snap.val(); if(!s) return;
    document.getElementById('xoTurn').innerText = s.turn || '—';
    stateUpdateUI(s);
  });

  // roles: read roles from session
  const rolesSnap = await roomRef.child('sessions/xo/roles').once('value'); const roles = rolesSnap.val() || {};
  const myRole = roles && ((roles.X===me.id)?'X': (roles.O===me.id)?'O': null);
  document.getElementById('xoMyRole').innerText = myRole || '—';

  async function openXOQuestion(idx){
    const qSnap = await roomRef.child('sessions/xo/questions').once('value');
    // for simplicity use a placeholder question if not present
    const question = qSnap.val() && qSnap.val()[idx] ? qSnap.val()[idx] : { q:'سؤال افتراضي', a:'' };
    document.getElementById('xoGrid').querySelectorAll('.xoCell')[idx].classList.add('selected');
    // show Q panel
    const xoQPanel = document.createElement('div');
    xoQPanel.className = 'xoQPanel';
    xoQPanel.innerHTML = `<div class="xoQ">${question.q}</div><div class="xoMeta">—</div><div style="display:flex;gap:8px;margin-top:10px;justify-content:center"><button id="xoMarkX" class="btn primary">X</button><button id="xoMarkO" class="btn primary">O</button></div>`;
    card.appendChild(xoQPanel);
    document.getElementById('xoMarkX').addEventListener('click', ()=> placeXO('X', idx, xoQPanel));
    document.getElementById('xoMarkO').addEventListener('click', ()=> placeXO('O', idx, xoQPanel));
  }

  async function placeXO(mark, idx, panel){
    // atomic update on state
    await stateRef.transaction(cur=>{
      if(!cur) return cur;
      if(cur.board[idx]) return; // taken
      cur.board[idx] = mark;
      // check win
      const w = checkWin(cur.board);
      if(w) cur.winner = w;
      else cur.turn = cur.turn === 'X' ? 'O' : 'X';
      return cur;
    });
    if(panel && panel.remove) panel.remove();
  }

  function stateUpdateUI(s){ const cells = grid.querySelectorAll('.xoCell'); cells.forEach((c,i)=>{ c.innerText = s.board[i] || '؟'; c.classList.toggle('used', !!s.board[i]); c.classList.remove('win','selected'); }); if(s.winner){ const winIdx = findWinIndices(s.board); if(winIdx){ winIdx.forEach(i=> grid.children[i].classList.add('win')); } roomRef.child('chat').push().set({name:'نظام', text:`XO — فاز ${s.winner}`, ts:Date.now()}); } }

  function checkWin(b){ const lines=[[0,1,2],[3,4,5],[6,7,8],[0,3,6],[1,4,7],[2,5,8],[0,4,8],[2,4,6]]; for(const L of lines){ const [a,b1,c]=L; if(b[a] && b[a]===b[b1] && b[a]===b[c]) return b[a]; } return null; }
  function findWinIndices(b){ const lines=[[0,1,2],[3,4,5],[6,7,8],[0,3,6],[1,4,7],[2,5,8],[0,4,8],[2,4,6]]; for(const L of lines){ const [a,b1,c]=L; if(b[a] && b[a]===b[b1] && b[a]===b[c]) return L; } return null; }
}

export function cleanupXO(){ /* empty for now */ }
