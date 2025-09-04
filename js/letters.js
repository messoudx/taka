// js/letters.js (ES module)
let lettersModalOpen = false;
let currentLettersStateRef = null;

export function initLetters(){ }

export async function handleLettersSession(roomRef, me){
  if(lettersModalOpen) return;
  lettersModalOpen = true;

  const sessionRef = roomRef.child('sessions/letters');
  const stateRef = sessionRef.child('state');
  currentLettersStateRef = stateRef;

  // ensure state exists
  const snap = await stateRef.once('value');
  if(!snap.exists()){
    await stateRef.set({ board: Array(25).fill(''), winner:'', turn: 'team1', startedAt: Date.now() });
  }

  // render modal
  const modal = document.getElementById('lettersModal'); const card = document.getElementById('lettersModalCard');
  const letters = ['ا','ب','ت','ث','ج','ح','خ','د','ذ','ر','ز','س','ش','ص','ض','ط','ظ','ع','غ','ف','ق','ك','ل','م','ن'];
  card.innerHTML = `<h3>تحدي الحروف</h3><div class="card small muted">اللعبة بنظام الفرق — الدور الحالي يظهر أدناه</div><div id="lettersGrid" class="lettersGrid"></div><div style="margin-top:12px"><div id="lettersStatus" class="muted small"></div><button class="btn" id="closeLettersBtn">إغلاق</button></div>`;
  modal.setAttribute('aria-hidden','false');

  document.getElementById('closeLettersBtn').addEventListener('click', ()=>{
    modal.setAttribute('aria-hidden','true');
    if(stateRef) stateRef.off();
    lettersModalOpen = false;
  }, { once:true });

  const gridEl = document.getElementById('lettersGrid');
  gridEl.innerHTML = '';
  for(let i=0;i<25;i++){
    const h = document.createElement('div');
    h.className='hex';
    h.dataset.idx=i;
    h.innerText = letters[i];
    gridEl.appendChild(h);
  }

  // update UI from state
  stateRef.on('value', snap=>{
    const s = snap.val();
    if(!s) return;
    updateUI(s.board);
    const status = document.getElementById('lettersStatus');
    status.innerText = `الدور: ${s.turn === 'team1' ? 'الفريق 1' : 'الفريق 2'}${s.winner? ' · تم انتهاء اللعبة' : ''}`;
    if(s.winner){
      roomRef.child('chat').push().set({name:'نظام', text:`تحدي الحروف — فاز ${s.winner}`, ts:Date.now()});
    }
  });

  // click handler
  gridEl.addEventListener('click', async (e)=>{
    const el = e.target.closest('.hex');
    if(!el) return;
    const idx = Number(el.dataset.idx);
    const sSnap = await stateRef.once('value');
    const s = sSnap.val();
    if(!s) return;
    if(s.board[idx]) return alert('الخانة مستخدمة');
    if(s.winner) return alert('اللعبة انتهت');

    // decide player's team from session.roles
    const sessSnap = await roomRef.child('sessions/letters').once('value');
    const sess = sessSnap.val()||{};
    const roles = sess.roles || {};
    const myTeam = Array.isArray(roles.team1) && roles.team1.includes(me.id) ? 'team1' : (Array.isArray(roles.team2) && roles.team2.includes(me.id) ? 'team2' : null);

    if(!myTeam){ return alert('أنت غير مشارك في هذه الجلسة'); }
    // check turn
    if(s.turn !== myTeam) return alert('ليس دور فريقك الآن');

    // mark and switch turn atomically
    await stateRef.transaction(cur=>{
      if(!cur) return cur;
      if(cur.board[idx]) return;
      cur.board[idx] = myTeam; // store 'team1' or 'team2'
      // check win
      if(checkWin(cur.board)) cur.winner = myTeam;
      else cur.turn = (cur.turn === 'team1' ? 'team2' : 'team1');
      return cur;
    });
  });

  function updateUI(board){
    const hexes = gridEl.querySelectorAll('.hex');
    hexes.forEach((h,i)=>{
      h.classList.remove('team1','team2');
      if(board[i] === 'team1') h.classList.add('team1');
      else if(board[i] === 'team2') h.classList.add('team2');
    });
  }

  function checkWin(board){
    const N=5;
    for(let r=0;r<N;r++){
      const base=r*N;
      const first=board[base];
      if(first && board[base+1]===first && board[base+2]===first && board[base+3]===first && board[base+4]===first) return true;
    }
    for(let c=0;c<N;c++){
      const first=board[c];
      if(first && board[c+N]===first && board[c+2*N]===first && board[c+3*N]===first && board[c+4*N]===first) return true;
    }
    return false;
  }
}

export function cleanupLetters(){
  try{
    const modal = document.getElementById('lettersModal');
    if(modal) modal.setAttribute('aria-hidden','true');
    if(currentLettersStateRef) currentLettersStateRef.off();
  }catch(e){}
  lettersModalOpen = false;
  currentLettersStateRef = null;
}
