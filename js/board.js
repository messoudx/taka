// js/board.js (ES module)
let boardModalOpen = false;
let currentBoardStateRef = null;

export function initBoard(){ }

export async function handleBoardSession(roomRef, me){
  if(boardModalOpen) return;
  boardModalOpen = true;

  const sessionRef = roomRef.child('sessions/board');
  const stateRef = sessionRef.child('state');
  currentBoardStateRef = stateRef;

  const snap = await stateRef.once('value');
  if(!snap.exists()){
    // initialize default categories
    const categories = [
      {name:'عام', qs:[{v:100,q:'ما عاصمة فرنسا؟',a:'باريس'},{v:200,q:'أين الأهرامات؟',a:'مصر'}]},
      {name:'أنمي', qs:[{v:100,q:'من بطل ناروتو؟',a:'ناروتو'},{v:200,q:'سلسلة تتكلم عن الشونين؟',a:'مثال'}]}
    ];
    const cells = {};
    categories.forEach((cat,ci)=> cat.qs.forEach((q,ri)=> cells[`c${ci}_r${ri}`] = { disabled:false }));
    await stateRef.set({ categories, cells, turn: 'team1', winner: '', startedAt: Date.now() });
  }

  // render modal
  const modal = document.getElementById('boardModal'); const card = document.getElementById('boardModalCard');
  card.innerHTML = `<h3>لوحة الأسئلة</h3><div id="boardArea"></div><div style="margin-top:12px"><div id="boardStatus" class="muted small"></div><button class="btn" id="closeBoardBtn">إغلاق</button></div>`;
  modal.setAttribute('aria-hidden','false');

  document.getElementById('closeBoardBtn').addEventListener('click', ()=>{
    modal.setAttribute('aria-hidden','true');
    if(stateRef) stateRef.off();
    boardModalOpen = false;
  }, { once:true });

  const boardArea = document.getElementById('boardArea');

  stateRef.on('value', snap=>{
    const s = snap.val(); if(!s) return;
    renderBoardUI(s);
    const status = document.getElementById('boardStatus');
    status.innerText = s.winner ? `انتهت اللعبة — الفائز: ${s.winner}` : `الدور: ${s.turn}`;
  });

  function renderBoardUI(s){
    boardArea.innerHTML = '';
    const categories = s.categories || [];
    categories.forEach((cat,ci)=>{
      const col = document.createElement('div'); col.className='catCard';
      const h = document.createElement('div'); h.style.fontWeight='900'; h.innerText = cat.name; col.appendChild(h);
      const values = document.createElement('div'); values.style.marginTop='8px';
      cat.qs.forEach((q,ri)=>{
        const key = `c${ci}_r${ri}`;
        const pill = document.createElement('div');
        pill.className='valuePill';
        pill.dataset.key = key; pill.dataset.ci = ci; pill.dataset.ri = ri;
        pill.innerText = q.v;
        if(s.cells && s.cells[key] && s.cells[key].disabled) pill.classList.add('disabled');
        pill.addEventListener('click', ()=> openQuestion(ci,ri,key));
        values.appendChild(pill);
      });
      col.appendChild(values);
      boardArea.appendChild(col);
    });
  }

  async function openQuestion(ci,ri,key){
    const stSnap = await stateRef.child('cells/' + key).once('value'); const st = stSnap.val();
    if(st && st.disabled) return alert('هذه الخانة مُعطلة');
    const sAllSnap = await stateRef.once('value'); const sAll = sAllSnap.val();
    const q = sAll.categories[ci].qs[ri];

    // build question panel
    const panelId = 'boardQuestionPanel';
    const prev = document.getElementById(panelId);
    if(prev) prev.remove();

    const panel = document.createElement('div'); panel.id = panelId;
    panel.innerHTML = `
      <div class="qText">${q.q}</div>
      <div class="muted small">${sAll.categories[ci].name} — ${q.v} نقطة</div>
      <div style="margin-top:8px;display:flex;gap:8px;justify-content:center">
        <button id="revealAns" class="btn">إظهار الإجابة</button>
        <button id="claimBtn" class="btn primary">أجب (ادعاء النقاط إذا كان دورك)</button>
        <button id="closeQ" class="btn">إغلاق</button>
      </div>
      <div id="qAns" class="card" style="margin-top:10px;display:none"></div>
    `;
    const qModal = document.getElementById('boardModalCard'); qModal.appendChild(panel);

    document.getElementById('revealAns').addEventListener('click', ()=>{ const aEl = document.getElementById('qAns'); aEl.style.display = 'block'; aEl.innerText = q.a || 'لا توجد إجابة'; });

    document.getElementById('claimBtn').addEventListener('click', async ()=>{
      // fetch current state and session roles
      const stNowSnap = await stateRef.once('value'); const stNow = stNowSnap.val();
      if(stNow.winner) return alert('اللعبة انتهت');
      const currentTurn = stNow.turn; // 'team1' or 'team2' or maybe playerId
      // check if me is allowed: find session roles
      const sessSnap = await roomRef.child('sessions/board').once('value'); const sess = sessSnap.val()||{}; const roles = sess.roles || {};
      let allowed = false;
      // if team-based
      if(roles.team1 && roles.team2){
        if(currentTurn === 'team1' && Array.isArray(roles.team1) && roles.team1.includes(me.id)) allowed = true;
        if(currentTurn === 'team2' && Array.isArray(roles.team2) && roles.team2.includes(me.id)) allowed = true;
      } else {
        // fallback: if single-player roles (e.g., 1v1), check if currentTurn equals our id
        if(currentTurn === me.id) allowed = true;
      }
      if(!allowed) return alert('ليس دورك الآن');

      // award points to appropriate team key
      if(currentTurn === 'team1' || currentTurn === 'team2'){
        await roomRef.child('scores/' + currentTurn).transaction(old => (old||0) + Number(q.v));
        await stateRef.child('cells/' + key).set({ disabled:true, by: me.id, at: Date.now() });
        // switch turn
        await stateRef.child('turn').set(currentTurn === 'team1' ? 'team2' : 'team1');
        await roomRef.child('chat').push().set({ name:'نظام', text:`${me.nick} حصل على ${q.v} نقطة لـ ${currentTurn}`, ts: Date.now() });
      } else {
        // single player case (if turn stores playerId)
        await roomRef.child('scores/' + me.id).transaction(old => (old||0) + Number(q.v));
        await stateRef.child('cells/' + key).set({ disabled:true, by: me.id, at: Date.now() });
        // switch turn to other player if available via session roles
        const other = (roles.team1 && roles.team1.includes(me.id) ? roles.team2 && roles.team2[0] : null);
        if(other) await stateRef.child('turn').set(other);
        await roomRef.child('chat').push().set({ name:'نظام', text:`${me.nick} حصل على ${q.v} نقطة`, ts: Date.now() });
      }

      // remove panel
      const p = document.getElementById(panelId);
      if(p) p.remove();
    });

    document.getElementById('closeQ').addEventListener('click', ()=>{ const p = document.getElementById(panelId); if(p) p.remove(); });
  }
}

export function cleanupBoard(){
  try{
    const modal = document.getElementById('boardModal');
    if(modal) modal.setAttribute('aria-hidden','true');
    if(currentBoardStateRef) currentBoardStateRef.off();
  }catch(e){}
  boardModalOpen = false;
  currentBoardStateRef = null;
}
