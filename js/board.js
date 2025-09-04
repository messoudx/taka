// js/board.js (ES module)
export function initBoard(){ }

export async function handleBoardSession(roomRef, me){
  const stateRef = roomRef.child('sessions/board/state');
  const snap = await stateRef.once('value');
  if(!snap.exists()){
    // initialize cells for default categories
    const categories = [
      {name:'عام', qs:[{v:100,q:'ما عاصمة فرنسا؟',a:'باريس'},{v:200,q:'أين الأهرامات؟',a:'مصر'}]},
      {name:'أنمي', qs:[{v:100,q:'من بطل ناروتو؟',a:'ناروتو'},{v:200,q:'سلسلة تتكلم عن الشونين؟',a:'مثال'}]}
    ];
    const cells = {};
    categories.forEach((cat,ci)=> cat.qs.forEach((q,ri)=> cells[`c${ci}_r${ri}`] = { disabled:false }));
    await stateRef.set({ categories, cells, startedAt:Date.now() });
  }

  // render modal
  const modal = document.getElementById('boardModal'); const card = document.getElementById('boardModalCard');
  card.innerHTML = `<h3>لوحة الأسئلة</h3><div id="boardArea"></div><div style="margin-top:12px"><button class="btn" id="closeBoardBtn">إغلاق</button></div>`;
  modal.setAttribute('aria-hidden','false'); document.getElementById('closeBoardBtn').addEventListener('click', ()=>{ modal.setAttribute('aria-hidden','true'); stateRef.off(); });

  const boardArea = document.getElementById('boardArea');
  stateRef.on('value', snap=>{ const s = snap.val(); if(!s) return; renderBoardUI(s); });

  function renderBoardUI(s){ boardArea.innerHTML = '';
    s.categories.forEach((cat,ci)=>{
      const col = document.createElement('div'); col.className='catCard'; const h = document.createElement('div'); h.style.fontWeight='900'; h.innerText = cat.name; col.appendChild(h);
      const values = document.createElement('div'); values.style.marginTop='8px'; cat.qs.forEach((q,ri)=>{
        const key = `c${ci}_r${ri}`; const pill = document.createElement('div'); pill.className='valuePill'; pill.dataset.key=key; pill.dataset.ci=ci; pill.dataset.ri=ri; pill.innerText = q.v; pill.addEventListener('click', ()=> openQuestion(ci,ri,key));
        if(s.cells && s.cells[key] && s.cells[key].disabled) pill.classList.add('disabled'); values.appendChild(pill);
      }); col.appendChild(values); boardArea.appendChild(col);
    });
  }

  async function openQuestion(ci,ri,key){ const sSnap = await stateRef.child('cells/' + key).once('value'); const st = sSnap.val(); if(st && st.disabled) return alert('هذه الخانة مُعطلة'); const sAll = (await stateRef.once('value')).val(); const q = sAll.categories[ci].qs[ri]; // show modal (simple)
    const html = `<div class="qText">${q.q}</div><div class="muted small">${sAll.categories[ci].name} — ${q.v} نقطة</div><div style="margin-top:8px;display:flex;gap:8px;justify-content:center"><button id="revealAns" class="btn primary">إظهار الإجابة</button><button id="awardTeam1" class="btn">منح للفريق 1</button><button id="awardTeam2" class="btn">منح للفريق 2</button><button id="closeQ" class="btn">إغلاق</button></div><div id="qAns" class="card" style="margin-top:10px;display:none"></div>`;
    const qModal = document.getElementById('boardModalCard'); const prev = document.getElementById('boardQuestionPanel'); if(prev) prev.remove(); const panel = document.createElement('div'); panel.id='boardQuestionPanel'; panel.innerHTML = html; qModal.appendChild(panel);
    document.getElementById('revealAns').addEventListener('click', ()=>{ document.getElementById('qAns').style.display='block'; document.getElementById('qAns').innerText = q.a || 'لا توجد إجابة'; });
    document.getElementById('awardTeam1').addEventListener('click', async ()=>{ await award('team1', q.v); await disableCell(key); panel.remove(); });
    document.getElementById('awardTeam2').addEventListener('click', async ()=>{ await award('team2', q.v); await disableCell(key); panel.remove(); });
    document.getElementById('closeQ').addEventListener('click', ()=>{ panel.remove(); });
  }

  async function award(teamKey, points){ await roomRef.child('scores/' + teamKey).transaction(old => (old||0) + Number(points)); await roomRef.child('chat').push().set({name:'نظام', text:`${me.nick} منح ${points} نقطة لـ ${teamKey}`, ts:Date.now()}); }
  async function disableCell(key){ await stateRef.child('cells/' + key).set({ disabled:true, by:me.id, at:Date.now() }); }
}

export function cleanupBoard(){ }
