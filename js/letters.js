// js/letters.js (ES module)
export function initLetters(){ }

export async function handleLettersSession(roomRef, me){
  const stateRef = roomRef.child('sessions/letters/state');
  const snap = await stateRef.once('value');
  if(!snap.exists()) await stateRef.set({ board: Array(25).fill(''), winner:'', startedAt:Date.now() });

  const modal = document.getElementById('lettersModal'); const card = document.getElementById('lettersModalCard');
  const letters = ['ا','ب','ت','ث','ج','ح','خ','د','ذ','ر','ز','س','ش','ص','ض','ط','ظ','ع','غ','ف','ق','ك','ل','م','ن'];
  card.innerHTML = `<h3>تحدي الحروف</h3><div class="card small muted">الفِرق سيتم إسنادها حسب الجلسة</div><div id="lettersGrid" class="lettersGrid"></div><div style="margin-top:12px"><button class="btn" id="closeLettersBtn">إغلاق</button></div>`;
  modal.setAttribute('aria-hidden','false');
  document.getElementById('closeLettersBtn').addEventListener('click', ()=>{ modal.setAttribute('aria-hidden','true'); stateRef.off(); });

  const gridEl = document.getElementById('lettersGrid'); gridEl.innerHTML = '';
  for(let i=0;i<25;i++){ const h = document.createElement('div'); h.className='hex'; h.dataset.idx=i; h.innerText = letters[i]; h.addEventListener('click', ()=> clickCell(i)); gridEl.appendChild(h); }

  stateRef.on('value', snap=>{ const s = snap.val(); if(!s) return; updateUI(s.board); if(s.winner){ roomRef.child('chat').push().set({name:'نظام', text:`تحدي الحروف — فاز ${s.winner}`, ts:Date.now()}); } });

  async function clickCell(idx){ const sSnap = await stateRef.once('value'); const s = sSnap.val(); if(!s) return; if(s.board[idx]) return alert('الخانة مستخدمة');
    // decide player's team from session roles
    const sessSnap = await roomRef.child('sessions/letters').once('value'); const sess = sessSnap.val()||{}; const roles = sess.roles || {};
    let mark = null;
    if(Array.isArray(roles.team1) && roles.team1.includes(me.id)) mark = 'team1';
    else if(Array.isArray(roles.team2) && roles.team2.includes(me.id)) mark = 'team2';
    else { const c = prompt('اكتب 1 للفريق1 أو 2 للفريق2 (أو إلغاء)'); if(!c) return; mark = c==='1'?'team1':'team2'; }
    // set atomically
    await stateRef.transaction(cur=>{ if(!cur) return cur; if(cur.board[idx]) return; cur.board[idx] = mark; if(checkWin(cur.board)) cur.winner = mark; return cur; });
  }

  function updateUI(board){ const hexes = gridEl.querySelectorAll('.hex'); hexes.forEach((h,i)=>{ h.classList.remove('team1','team2'); if(board[i] === 'team1') h.classList.add('team1'); if(board[i] === 'team2') h.classList.add('team2'); }); }

  function checkWin(board){ const N=5; for(let r=0;r<N;r++){ const base=r*N; const first=board[base]; if(first && board[base+1]===first && board[base+2]===first && board[base+3]===first && board[base+4]===first) return true; } for(let c=0;c<N;c++){ const first=board[c]; if(first && board[c+N]===first && board[c+2*N]===first && board[c+3*N]===first && board[c+4*N]===first) return true; } return false; }
}

export function cleanupLetters(){ }
