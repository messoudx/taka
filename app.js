/* app.js — يعمل مع index.html و styles.css
   يحتوي على: التحقق من كود الدخول، الغرف، الدردشة، الطلبات، جلسات الألعاب
   و: تنفيذ الألعاب داخل المودالات (XO, Letters, Board) متزامنة عبر Firebase.
*/

/* ===== Firebase config ===== */
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
firebase.initializeApp(firebaseConfig);
const database = firebase.database();

/* ===== Allowed codes (ضع أكوادك هنا) ===== */
const allowedCodes = [
  // ضع الأكواد المصرح بها هنا
  "PLAYER01",
  "PLAYER02",
  "CODE123"
];

/* ===== Helpers ===== */
const $ = id => document.getElementById(id);
const makeId = ()=> Date.now().toString(36) + Math.random().toString(36).slice(2,6);
const escapeHtml = s => (s+'').replace(/[&<>\"]/g, c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));

/* ===== Local state and DOM refs ===== */
let me = { id: null, nick:'', code:'' };
let roomId = null;
let roomRef = null;

const landing = $('landing'), gamesPage = $('gamesPage');
const nickInput = $('nickInput'), userCodeInput = $('userCodeInput'), loginBtn = $('loginBtn'), clearLocal = $('clearLocal');
const meBox = $('meBox'), roomInput = $('roomInput'), createRoomBtn = $('createRoomBtn'), joinRoomBtn = $('joinRoomBtn');
const playersList = $('playersList'), chatBox = $('chatBox'), chatInput = $('chatInput'), sendChat = $('sendChat');
const requestsBox = $('requestsBox'), leaveRoomBtn = $('leaveRoomBtn'), logoutBtn = $('logoutBtn');

/* Game UI refs */
const xoModal = $('xoModal'), xoGrid = $('xoGrid'), xoTurn = $('xoTurn'), xoMyRole = $('xoMyRole');
const claimXBtn = $('claimXBtn'), claimOBtn = $('claimOBtn'), resetXOBtn = $('resetXOBtn');

const lettersModal = $('lettersModal'), lettersGrid = $('lettersGrid');
const claimTeam1BtnModal = $('claimTeam1BtnModal'), claimTeam2BtnModal = $('claimTeam2BtnModal');
const team1NameUI = $('team1NameUI'), team2NameUI = $('team2NameUI');
const resetLettersBtn = $('resetLettersBtn');

const boardModal = $('boardModal'), boardArea = $('boardArea');
const questionModal = $('questionModal'), qText = $('qText'), qMeta = $('qMeta'), qAnswer = $('qAnswer');
const revealAnswerBtn = $('revealAnswerBtn'), awardTeam1Btn = $('awardTeam1Btn'), awardTeam2Btn = $('awardTeam2Btn'), closeQuestionBtn = $('closeQuestionBtn');

/* ===== Local storage handling ===== */
function loadLocal(){
  const raw = localStorage.getItem('taka_user');
  if(raw){ try{ me = JSON.parse(raw); }catch(e){} }
  if(!me.id) me.id = makeId();
  nickInput.value = me.nick || '';
  userCodeInput.value = me.code || '';
}
function saveLocal(){ localStorage.setItem('taka_user', JSON.stringify(me)); }
function clearLocalData(){ localStorage.removeItem('taka_user'); me = { id: makeId(), nick:'', code:'' }; nickInput.value=''; userCodeInput.value=''; alert('تم مسح بيانات الجهاز'); }

/* ===== UI helpers ===== */
function showGamesPage(){ landing.style.display='none'; gamesPage.style.display='block'; updateMeBox(); }
function showLanding(){ landing.style.display='flex'; gamesPage.style.display='none'; }
function updateMeBox(){ meBox.innerHTML = `<div style="font-weight:900">${escapeHtml(me.nick||'')}</div><div class="muted small">الكود محفوظ محليًا ولن يُشارَك</div>`; }

/* ===== Login flow ===== */
loginBtn.addEventListener('click', ()=>{
  const nick = (nickInput.value||'').trim();
  const code = (userCodeInput.value||'').trim();
  if(!nick || !code){ alert('ادخل الاسم المستعار والكود'); return; }
  if(!allowedCodes.includes(code)){ alert('هذا الكود غير مصرح له بالدخول'); return; }
  me.nick = nick; me.code = code; me.id = me.id || makeId();
  saveLocal(); showGamesPage();
});
clearLocal.addEventListener('click', clearLocalData);
logoutBtn.addEventListener('click', ()=>{
  if(roomRef && me.id) roomRef.child('players/' + me.id).remove();
  if(roomRef) roomRef.off();
  roomRef = null; roomId = null;
  showLanding();
});

/* ===== Room creation/join ===== */
createRoomBtn.addEventListener('click', async ()=>{
  const id = (roomInput.value||'').trim(); if(!id){ alert('اكتب رمز غرفة'); return; }
  const ref = database.ref('rooms/' + id);
  const snap = await ref.once('value');
  if(!snap.exists()){
    await ref.set({
      meta:{createdAt:Date.now()},
      players:{},
      teams:{team1:{name:'الفريق 1'},team2:{name:'الفريق 2'}},
      scores:{team1:0,team2:0},
      xo:{board:Array(9).fill(''),turn:'X',winner:''},
      letters:{board:Array(25).fill(''),winner:''},
      boardCells:{},
      chat:{},
      requests:{},
      sessions:{}
    });
    alert('تم إنشاء الغرفة');
  } else alert('الغرفة موجودة — يمكنك الانضمام إليها');
});

joinRoomBtn.addEventListener('click', ()=>{ const id = (roomInput.value||'').trim(); if(!id){ alert('اكتب رمز غرفة'); return; } joinRoom(id); });

async function joinRoom(id){
  if(!me.nick || !me.code){ alert('سجّل الدخول أولًا'); return; }
  if(!allowedCodes.includes(me.code)){ alert('كودك لم يعد مصرحًا'); return; }
  roomId = id; roomRef = database.ref('rooms/' + roomId);
  await roomRef.child('players/' + me.id).set({name:me.nick,joinedAt:Date.now()});
  roomRef.child('players/' + me.id).onDisconnect().remove();
  roomRef.on('value', snap => { const data = snap.val(); if(!data) return; renderRoomData(data); });
  attachRealtimeChildListeners();
  showGamesPage();
}

/* leave room */
leaveRoomBtn.addEventListener('click', ()=>{ if(roomRef && me.id) roomRef.child('players/' + me.id).remove(); if(roomRef) roomRef.off(); roomRef=null; roomId=null; playersList.innerHTML='لم تنضم إلى غرفة بعد'; chatBox.innerHTML=''; requestsBox.innerHTML='لا توجد طلبات'; alert('غادرت الغرفة'); });

/* render players and UI updates */
function renderRoomData(data){
  // players
  const players = data.players||{}; const keys = Object.keys(players);
  playersList.innerHTML = keys.length? keys.map(k=>`<div style="padding:8px;border-bottom:1px solid #f3f3f3"><strong>${escapeHtml(players[k].name)}</strong></div>`).join('') : 'لا أحد';
  // teams names show
  const teams = data.teams || {team1:{name:'الفريق1'},team2:{name:'الفريق2'}};
  team1NameUI.innerText = teams.team1.name || 'الفريق1'; team2NameUI.innerText = teams.team2.name || 'الفريق2';
}

/* ===== Chat ===== */
sendChat.addEventListener('click', sendChatMessage);
async function sendChatMessage(){
  if(!roomRef) return alert('انضم لغرفة أولاً');
  const text = (chatInput.value||'').trim(); if(!text) return;
  const ref = roomRef.child('chat').push();
  await ref.set({name:me.nick, text, ts:Date.now(), senderId:me.id});
  chatInput.value='';
}

/* ===== Requests (invite) ===== */
async function requestGame(game){
  if(!roomRef) return alert('انضم لغرفة أولاً');
  const id = makeId();
  await roomRef.child('requests/' + id).set({id, requesterId:me.id, requesterName:me.nick, game, ts:Date.now()});
  await roomRef.child('chat').push().set({name:'نظام', text:`${me.nick} طلب لعب ${game}`, ts:Date.now()});
  alert('تم إرسال الطلب');
}

/* render requests: others can accept (not requester) */
function renderRequestsList(reqs){
  if(!reqs || !reqs.length){ requestsBox.innerHTML='لا توجد طلبات'; return; }
  requestsBox.innerHTML = reqs.sort((a,b)=>a.ts-b.ts).map(r=>{
    const canAccept = r.requesterId !== me.id;
    const acceptBtn = canAccept? `<button class="btn" onclick="acceptRequest('${r.id}')">اقبل</button>` : `<span class="muted small">بانتظار قبول آخر</span>`;
    return `<div class="requestsBoxItem"><strong>${escapeHtml(r.requesterName)}</strong> يريد لعب <em>${escapeHtml(r.game)}</em> — ${acceptBtn}</div>`;
  }).join('');
}
window.acceptRequest = async function(reqId){
  if(!roomRef) return alert('انضم لغرفة');
  const s = await roomRef.child('requests/' + reqId).once('value'); const r=s.val();
  if(!r) return alert('الطلب انتهى');
  if(r.requesterId === me.id) return alert('لا يمكنك قبول طلبك الخاص');
  // create session under sessions/{game}
  const session = {active:true, game:r.game, startedBy:me.id, requesterId:r.requesterId, startedAt:Date.now()};
  await roomRef.child('sessions/' + r.game).set(session);
  await roomRef.child('requests/' + reqId).remove();
  await roomRef.child('chat').push().set({name:'نظام', text:`${me.nick} قبل طلب ${r.requesterName} للعب ${r.game}`, ts: Date.now()});
};

/* ===== Sessions and realtime child listeners ===== */
function attachRealtimeChildListeners(){
  if(!roomRef) return;
  roomRef.child('chat').on('value', snap => {
    const v = snap.val(); if(!v){ chatBox.innerHTML=''; return; }
    const arr = Object.values(v);
    chatBox.innerHTML = arr.sort((a,b)=>a.ts-b.ts).map(m=>`<div><strong>${escapeHtml(m.name)}</strong>: ${escapeHtml(m.text)}</div>`).join('');
    chatBox.scrollTop = chatBox.scrollHeight;
  });
  roomRef.child('requests').on('value', snap => {
    const v = snap.val(); const arr = v?Object.values(v):[]; renderRequestsList(arr);
  });
  roomRef.child('sessions').on('value', snap => {
    const sessions = snap.val()||{};
    // XO session
    if(sessions.xo && sessions.xo.active) startXOSession(sessions.xo);
    if(sessions.letters && sessions.letters.active) startLettersSession(sessions.letters);
    if(sessions.board && sessions.board.active) startBoardSession(sessions.board);
  });
  // also listen to boardCells/scores/roles changes for inside-game updates
  roomRef.child('roles').on('value', snap=>{/* roles update handled in game UIs if needed */});
}

/* ====== XO Implementation ====== */
let currentXOstate = null; // cached local copy
function startXOSession(sess){
  // initialize session data in DB if not present
  roomRef.child('sessions/xo/state').once('value').then(snap=>{
    if(!snap.exists()){
      const initState = {board:Array(9).fill(''), turn:'X', winner:'', startedAt:Date.now()};
      roomRef.child('sessions/xo/state').set(initState);
    }
    // open modal for everyone
    openXOModal();
  });
}

function openXOModal(){
  xoModal.setAttribute('aria-hidden','false');
  // setup grid and listeners
  renderXOGrid();
  // attach realtime listener to state
  roomRef.child('sessions/xo/state').on('value', snap=>{
    const s = snap.val(); if(!s) return;
    currentXOstate = s;
    xoTurn.innerText = s.turn || '—';
    // update grid visuals
    const cells = xoGrid.querySelectorAll('.cell');
    cells.forEach((c, idx)=>{
      c.innerText = s.board[idx] || '؟';
      c.classList.toggle('used', !!s.board[idx]);
      c.classList.remove('win');
    });
    if(s.winner){
      // highlight winning line if possible (compute)
      highlightXOWin(s.board);
    }
    // set my role text if I claimed role
    roomRef.child('roles').once('value').then(snap=> {
      const roles = snap.val() || {};
      if(roles.X && roles.X.playerId===me.id) xoMyRole.innerText='X';
      else if(roles.O && roles.O.playerId===me.id) xoMyRole.innerText='O';
      else xoMyRole.innerText='—';
    });
  });
}

function renderXOGrid(){
  xoGrid.innerHTML = '';
  for(let i=0;i<9;i++){
    const d = document.createElement('div'); d.className='cell'; d.dataset.idx=i; d.innerText='؟';
    d.addEventListener('click', ()=> clickXOCell(i));
    xoGrid.appendChild(d);
  }
}

async function clickXOCell(idx){
  if(!roomRef) return;
  const snap = await roomRef.child('sessions/xo/state').once('value'); const s = snap.val();
  if(!s) return alert('حالة اللعبة غير جاهزة');
  if(s.winner) return alert('اللعبة انتهت');
  if(s.board[idx]) return alert('الخانة مستخدمة');
  // ensure user has role X or O
  const role = await ensureRole('X','O');
  if(!role) return;
  if(s.turn !== role) return alert('ليست حركتك');
  s.board[idx] = role;
  // check win
  if(checkXOwin(s.board)){
    s.winner = role;
    await roomRef.child('sessions/xo/state').set(s);
    await roomRef.child('sessions/xo/state').update({winner:role});
    await roomRef.child('chat').push().set({name:'نظام', text:`${me.nick} (${role}) فاز في XO`, ts:Date.now()});
    return;
  }
  s.turn = s.turn === 'X' ? 'O' : 'X';
  await roomRef.child('sessions/xo/state').set(s);
}

function ensureRole(...allowed){
  // check roles under roomRef/roles
  return roomRef.child('roles').once('value').then(snap=>{
    const roles = snap.val() || {};
    for(const r of allowed){
      if(roles[r] && roles[r].playerId === me.id) return r;
    }
    // otherwise prompt to claim
    const want = prompt(`اختر دور: اكتب ${allowed.join('/')} للمطالبة (أو إلغاء)`);
    if(!want) return null;
    const c = want.toUpperCase();
    if(!allowed.includes(c)) return null;
    // set role node
    roomRef.child('roles/' + c).set({playerId:me.id, name:me.nick, claimedAt:Date.now()});
    roomRef.child('chat').push().set({name:'نظام', text:`${me.nick} طالب الدور ${c}`, ts:Date.now()});
    return c;
  });
}

function checkXOwin(b){
  const lines = [[0,1,2],[3,4,5],[6,7,8],[0,3,6],[1,4,7],[2,5,8],[0,4,8],[2,4,6]];
  for(const l of lines){ const [a,b1,c]=l; if(b[a] && b[a]===b[b1] && b[a]===b[c]) return true; }
  return false;
}

function highlightXOWin(board){
  const lines = [[0,1,2],[3,4,5],[6,7,8],[0,3,6],[1,4,7],[2,5,8],[0,4,8],[2,4,6]];
  for(const l of lines){ const [a,b1,c]=l; if(board[a] && board[a]===board[b1] && board[a]===board[c]){
    const cells = xoGrid.querySelectorAll('.cell');
    [a,b1,c].forEach(i=> cells[i].classList.add('win'));
    break;
  }}
}

function closeXOModal(){
  xoModal.setAttribute('aria-hidden','true');
  if(roomRef) roomRef.child('sessions/xo/state').off();
}

/* claim/reset buttons */
claimXBtn.addEventListener('click', ()=> roomRef && roomRef.child('roles/X').set({playerId:me.id,name:me.nick,claimedAt:Date.now()}));
claimOBtn.addEventListener('click', ()=> roomRef && roomRef.child('roles/O').set({playerId:me.id,name:me.nick,claimedAt:Date.now()}));
resetXOBtn.addEventListener('click', async ()=>{
  if(!roomRef) return;
  // reset state
  await roomRef.child('sessions/xo/state').set({board:Array(9).fill(''),turn:'X',winner:'',startedAt:Date.now()});
  await roomRef.child('chat').push().set({name:'نظام',text:`${me.nick} أعاد ضبط XO`,ts:Date.now()});
});

/* ===== Letters Implementation (5x5) ===== */
function startLettersSession(sess){
  // ensure letters state exists
  roomRef.child('sessions/letters/state').once('value').then(snap=>{
    if(!snap.exists()){
      roomRef.child('sessions/letters/state').set({board:Array(25).fill(''), winner:'', startedAt:Date.now()});
    }
    openLettersModal();
  });
}

function openLettersModal(){
  lettersModal.setAttribute('aria-hidden','false');
  renderLettersGrid();
  roomRef.child('sessions/letters/state').on('value', snap=>{
    const s = snap.val(); if(!s) return;
    updateLettersUI(s.board);
    if(s.winner){
      roomRef.child('chat').push().set({name:'نظام', text:`فاز ${s.winner} في تحدي الحروف`, ts:Date.now()});
    }
  });
}

function renderLettersGrid(){
  lettersGrid.innerHTML = '';
  const letters = ['ا','ب','ت','ث','ج','ح','خ','د','ذ','ر','ز','س','ش','ص','ض','ط','ظ','ع','غ','ف','ق','ك','ل','م','ن'];
  for(let i=0;i<25;i++){
    const hex = document.createElement('div'); hex.className='hex'; hex.dataset.idx=i; hex.innerText = letters[i];
    hex.addEventListener('click', ()=> clickLetterCell(i));
    lettersGrid.appendChild(hex);
  }
}

async function clickLetterCell(idx){
  if(!roomRef) return;
  const snap = await roomRef.child('sessions/letters/state').once('value'); const s = snap.val();
  if(!s) return alert('حالة الشبكة غير جاهزة');
  if(s.board[idx]) return alert('الخانة مستخدمة');
  // decide marking: prefer player's claimed team roles under roles/team1/team2, else prompt
  const rolesSnap = await roomRef.child('roles').once('value'); const roles = rolesSnap.val() || {};
  let mark = null;
  // if player claimed team1/team2
  if(roles.team1 && roles.team1.playerId === me.id) mark = 'team1';
  else if(roles.team2 && roles.team2.playerId === me.id) mark = 'team2';
  else {
    const choice = prompt('علّم الخانة باسم أي فريق؟ اكتب 1 للفريق1 أو 2 للفريق2 (أو إلغاء)');
    if(!choice) return;
    mark = choice === '1' ? 'team1' : 'team2';
  }
  s.board[idx] = mark;
  // check win
  if(checkLettersWin(s.board)){
    s.winner = mark;
    await roomRef.child('sessions/letters/state').set(s);
    await roomRef.child('chat').push().set({name:'نظام', text:`${me.nick} أكمل خطًا وفاز ${mark}`, ts:Date.now()});
    return;
  }
  await roomRef.child('sessions/letters/state').set(s);
}

function updateLettersUI(board){
  const hexes = lettersGrid.querySelectorAll('.hex');
  hexes.forEach((h, i)=>{
    h.classList.remove('team1','team2');
    if(board[i] === 'team1') h.classList.add('team1');
    if(board[i] === 'team2') h.classList.add('team2');
  });
}

function checkLettersWin(board){
  const N=5;
  for(let r=0;r<N;r++){
    const base = r*N; const first = board[base];
    if(first && board[base+1]===first && board[base+2]===first && board[base+3]===first && board[base+4]===first) return true;
  }
  for(let c=0;c<N;c++){
    const first = board[c];
    if(first && board[c+N]===first && board[c+2*N]===first && board[c+3*N]===first && board[c+4*N]===first) return true;
  }
  return false;
}

claimTeam1BtnModal.addEventListener('click', ()=> roomRef && roomRef.child('roles/team1').set({playerId:me.id,name:me.nick,claimedAt:Date.now()}));
claimTeam2BtnModal.addEventListener('click', ()=> roomRef && roomRef.child('roles/team2').set({playerId:me.id,name:me.nick,claimedAt:Date.now()}));
resetLettersBtn.addEventListener('click', async ()=>{
  if(!roomRef) return;
  await roomRef.child('sessions/letters/state').set({board:Array(25).fill(''), winner:'', startedAt:Date.now()});
  await roomRef.child('chat').push().set({name:'نظام', text:`${me.nick} أعاد ضبط تحدي الحروف`, ts:Date.now()});
});

function closeLettersModal(){ lettersModal.setAttribute('aria-hidden','true'); if(roomRef) roomRef.child('sessions/letters/state').off(); }

/* ===== Board (quiz) Implementation ===== */
/* categories array (يمكنك تعديل الأسئلة هنا أو جدولة واجهة إدارة لاحقًا) */
let categories = [
  {name:'عام', qs:[
    {v:100,q:'ما عاصمة فرنسا؟',a:'باريس'},
    {v:200,q:'أين تقع الأهرامات الكبرى؟',a:'مصر'},
    {v:500,q:'ما اسم الكوكب الأحمر؟',a:'المريخ'}
  ]},
  {name:'رياضة', qs:[
    {v:100,q:'كم لاعبًا في فريق كرة القدم؟',a:'11'},
    {v:200,q:'ما رياضة رواد الفضاء غالبًا يتدربون عليها لتحسين التحمل؟',a:'الجري'},
    {v:500,q:'من فاز بكأس العالم 2018؟',a:'فرنسا'}
  ]}
];

function startBoardSession(sess){
  // initialize board cells in DB if not present
  roomRef.child('sessions/board/state').once('value').then(snap=>{
    if(!snap.exists()){
      // create disabled map
      const cells = {};
      categories.forEach((cat,ci)=> cat.qs.forEach((q,ri)=> cells[`c${ci}_r${ri}`] = {disabled:false}));
      roomRef.child('sessions/board/state').set({cells, startedAt:Date.now()});
    }
    openBoardModal();
  });
}

function openBoardModal(){
  boardModal.setAttribute('aria-hidden','false');
  renderBoardUI();
  // listen to board state changes
  roomRef.child('sessions/board/state').on('value', snap=>{
    const s = snap.val(); if(!s) return;
    // update UI based on s.cells
    updateBoardUI(s.cells || {});
  });
}

function renderBoardUI(){
  boardArea.innerHTML = '';
  categories.forEach((cat,ci)=>{
    const col = document.createElement('div'); col.className='catCard';
    const h = document.createElement('div'); h.style.fontWeight='900'; h.innerText = cat.name; col.appendChild(h);
    const values = document.createElement('div'); values.style.marginTop='8px';
    cat.qs.forEach((q,ri)=>{
      const key = `c${ci}_r${ri}`;
      const pill = document.createElement('div'); pill.className='valuePill'; pill.dataset.key=key; pill.dataset.ci=ci; pill.dataset.ri=ri; pill.innerText = q.v;
      pill.addEventListener('click', ()=> openQuestionModal(ci,ri,key));
      values.appendChild(pill);
    });
    col.appendChild(values);
    boardArea.appendChild(col);
  });
}

function updateBoardUI(cells){
  const pills = boardArea.querySelectorAll('.valuePill');
  pills.forEach(p=>{
    const k = p.dataset.key;
    if(cells[k] && cells[k].disabled) p.classList.add('disabled'); else p.classList.remove('disabled');
  });
}

let currentQuestionRefKey = null;
function openQuestionModal(ci,ri,key){
  if(!roomRef) return alert('انضم لغرفة');
  // fetch current state to see if disabled
  roomRef.child('sessions/board/state/cells/' + key).once('value').then(snap=>{
    const st = snap.val(); if(st && st.disabled){ alert('هذه الخانة مُعطّلة'); return; }
    const q = categories[ci].qs[ri];
    qText.innerText = q.q; qMeta.innerText = `${categories[ci].name} — ${q.v} نقطة`;
    qAnswer.style.display='none'; qAnswer.innerText='';
    questionModal.setAttribute('aria-hidden','false');
    currentQuestionRefKey = key;
    // award handlers
    revealAnswerBtn.onclick = ()=>{ qAnswer.style.display='block'; qAnswer.innerText = q.a || 'لا توجد إجابة مسجلة'; };
    awardTeam1Btn.onclick = async ()=>{ await awardPointsToTeam('team1', q.v); await disableBoardCell(key); closeQuestionModal(); };
    awardTeam2Btn.onclick = async ()=>{ await awardPointsToTeam('team2', q.v); await disableBoardCell(key); closeQuestionModal(); };
    closeQuestionBtn.onclick = ()=> closeQuestionModal();
  });
}

function closeQuestionModal(){ questionModal.setAttribute('aria-hidden','true'); currentQuestionRefKey=null; }

async function awardPointsToTeam(teamKey, points){
  if(!roomRef) return;
  await roomRef.child('scores/' + teamKey).transaction(old=> (old||0) + Number(points));
  await roomRef.child('chat').push().set({name:'نظام', text:`${me.nick} منح ${points} نقطة لـ ${teamKey}`, ts:Date.now()});
}

async function disableBoardCell(key){
  if(!roomRef) return;
  await roomRef.child('sessions/board/state/cells/' + key).set({disabled:true, by:me.id, at:Date.now()});
}

function closeBoardModal(){ boardModal.setAttribute('aria-hidden','true'); if(roomRef) roomRef.child('sessions/board/state').off(); }

/* ===== Realtime: when a session ends/cleared, close modals if open ===== */
function clearSessionHandlers(){
  // If sessions removed or set inactive, close modals
  if(!roomRef) return;
  roomRef.child('sessions').on('value', snap=>{
    const s = snap.val() || {};
    if(!(s.xo && s.xo.active)) { xoModal.setAttribute('aria-hidden','true'); roomRef.child('sessions/xo/state').off(); }
    if(!(s.letters && s.letters.active)) { lettersModal.setAttribute('aria-hidden','true'); roomRef.child('sessions/letters/state').off(); }
    if(!(s.board && s.board.active)) { boardModal.setAttribute('aria-hidden','true'); roomRef.child('sessions/board/state').off(); }
  });
}

/* ===== attachRealtimeChildListeners wrapper ensures we also watch sessions removal ===== */
function attachRealtimeChildListeners(){
  if(!roomRef) return;
  // chat & requests & sessions (handled earlier)
  roomRef.child('chat').on('value', snap => { const v = snap.val(); if(!v){ chatBox.innerHTML=''; return; } const arr = Object.values(v); chatBox.innerHTML = arr.sort((a,b)=>a.ts-b.ts).map(m=>`<div><strong>${escapeHtml(m.name)}</strong>: ${escapeHtml(m.text)}</div>`).join(''); chatBox.scrollTop = chatBox.scrollHeight; });
  roomRef.child('requests').on('value', snap => { const v = snap.val(); const arr = v?Object.values(v):[]; renderRequestsList(arr); });
  roomRef.child('sessions').on('value', snap => {
    const sessions = snap.val() || {};
    if(sessions.xo && sessions.xo.active) startXOSession(sessions.xo);
    if(sessions.letters && sessions.letters.active) startLettersSession(sessions.letters);
    if(sessions.board && sessions.board.active) startBoardSession(sessions.board);
  });
  clearSessionHandlers();
}

/* ===== Utility: when page unload remove player node ===== */
window.addEventListener('beforeunload', ()=>{ if(roomRef && me.id) roomRef.child('players/' + me.id).remove(); });

/* ===== Init ===== */
loadLocal(); if(!me.id) me.id = makeId(); updateMeBox();

/* Expose functions used inline in HTML */
window.requestGame = requestGame;
window.acceptRequest = acceptRequest;
window.joinRoom = joinRoom;
window.closeXOModal = closeXOModal;
window.closeLettersModal = closeLettersModal;
window.closeBoardModal = closeBoardModal;
