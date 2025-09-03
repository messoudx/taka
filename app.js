/* app.js — lobby logic with stricter entry and working request/accept/session flow */

/* ====== Firebase setup (ضع نفس config الخاص بك هنا) ====== */
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

/* ====== ADMIN: هنا ضَع قائمة الأكواد المصرح بها (أدِرها بنفسك) ======
   مثال: ['ABC123','XYZ999'] — فقط هذه الأكواد تُمكن الدخول
   **ضع الأكواد التي تريدها فعلاً** */
const allowedCodes = [
  // أمثلة (استبدلها بكودّك الحقيقي ثم احذف هذه الأمثلة)
  "CODE123",
  "PLAYER01",
  "FRIENDA"
];

/* ====== Helpers ====== */
const $ = id => document.getElementById(id);
const makeId = ()=> Date.now().toString(36) + Math.random().toString(36).slice(2,6);
const escapeHtml = s => (s+'').replace(/[&<>\"]/g, c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));

/* ====== Local state ====== */
let me = { id: null, nick: '', code: '' };
let roomId = null;
let roomRef = null;

/* ====== DOM refs ====== */
const landing = $('landing');
const gamesPage = $('gamesPage');
const nickInput = $('nickInput');
const userCodeInput = $('userCodeInput');
const loginBtn = $('loginBtn');
const clearLocal = $('clearLocal');

const meBox = $('meBox');
const roomInput = $('roomInput');
const createRoomBtn = $('createRoomBtn');
const joinRoomBtn = $('joinRoomBtn');

const playersList = $('playersList');
const chatBox = $('chatBox');
const chatInput = $('chatInput');
const sendChatBtn = $('sendChat');
const requestsBox = $('requestsBox');

const leaveRoomBtn = $('leaveRoomBtn');
const logoutBtn = $('logoutBtn');

/* ====== Init from localStorage ====== */
function loadLocal() {
  const raw = localStorage.getItem('taka_user');
  if(raw){
    try{ me = JSON.parse(raw); }catch(e){}
  } else {
    me.id = makeId();
  }
  // fill landing inputs if present
  nickInput.value = me.nick || '';
  userCodeInput.value = me.code || '';
}
function saveLocal(){ localStorage.setItem('taka_user', JSON.stringify(me)); }
function clearLocalData(){ localStorage.removeItem('taka_user'); me = { id: makeId(), nick:'', code:'' }; nickInput.value=''; userCodeInput.value=''; alert('تم مسح بيانات الجهاز'); }

/* ====== UI helpers ====== */
function showGamesPage(){ landing.style.display='none'; gamesPage.style.display='block'; updateMeBox(); }
function showLanding(){ landing.style.display='flex'; gamesPage.style.display='none'; }

/* update my box (shows my name and a reminder about code only for me) */
function updateMeBox(){
  meBox.innerHTML = `<div style="font-weight:900">${escapeHtml(me.nick || '')}</div>
                     <div class="muted small">الكود الخاص بك محفوظ محليًا ولن يشارَك</div>`;
}

/* ====== Login flow (validate code against allowedCodes) ====== */
loginBtn.addEventListener('click', async ()=>{
  const nick = (nickInput.value||'').trim();
  const code = (userCodeInput.value||'').trim();
  if(!nick || !code){ alert('ادخل الاسم المستعار والكود'); return; }
  // validate code (client-side check against allowedCodes)
  if(!allowedCodes.includes(code)){
    alert('هذا الكود غير مصرح له بالدخول. تواصل مع المدير.');
    return;
  }
  me.nick = nick; me.code = code; me.id = me.id || makeId();
  saveLocal();
  showGamesPage();
});

/* clear local */
clearLocal.addEventListener('click', ()=> clearLocalData());

/* logout */
logoutBtn.addEventListener('click', ()=>{
  if(roomRef && me.id){ roomRef.child('players/' + me.id).remove(); roomRef.off(); }
  roomRef = null; roomId = null;
  showLanding();
});

/* ====== Room creation / join ====== */
createRoomBtn.addEventListener('click', async ()=>{
  const id = (roomInput.value||'').trim();
  if(!id){ alert('اكتب رمز غرفة'); return; }
  // create only if not exists
  const ref = database.ref('rooms/' + id);
  const snap = await ref.once('value');
  if(!snap.exists()){
    await ref.set({
      meta:{createdAt:Date.now()},
      players:{},
      teams:{team1:{name:'الفريق 1'}, team2:{name:'الفريق 2'}},
      scores:{team1:0,team2:0},
      xo:{board:Array(9).fill(''),turn:'X',winner:''},
      letters:{board:Array(25).fill(''),winner:''},
      boardCells:{},
      chat:{},
      requests:{},
      sessions:{}
    });
    alert('تم إنشاء الغرفة');
  } else {
    alert('الغرفة موجودة بالفعل — يمكنك الانضمام إليها');
  }
});

joinRoomBtn.addEventListener('click', ()=> {
  const id = (roomInput.value||'').trim();
  if(!id){ alert('اكتب رمز غرفة'); return; }
  joinRoom(id);
});

async function joinRoom(id){
  if(!me.nick || !me.code){ alert('سجّل الدخول أولاً'); return; }
  // re-check code against allowedCodes (safety)
  if(!allowedCodes.includes(me.code)){ alert('كودك لم يعد مصرحًا'); return; }
  roomId = id;
  roomRef = database.ref('rooms/' + roomId);

  // add player (store only name and joinedAt — NOT the secret code)
  await roomRef.child('players/' + me.id).set({name:me.nick,joinedAt:Date.now()});
  roomRef.child('players/' + me.id).onDisconnect().remove();

  // attach listeners for room realtime updates
  roomRef.on('value', snap => {
    const data = snap.val();
    if(!data) return;
    renderRoomData(data);
  });

  // child listeners for chat/requests/sessions for faster UI updates
  attachRealtimeChildListeners();

  showGamesPage();
}

/* leave room */
leaveRoomBtn.addEventListener('click', ()=>{
  if(!roomRef) return showLanding();
  if(me.id) roomRef.child('players/' + me.id).remove();
  roomRef.off();
  roomRef = null; roomId = null;
  playersList.innerHTML = 'لم تنضم إلى غرفة بعد';
  chatBox.innerHTML = '';
  requestsBox.innerHTML = 'لا توجد طلبات';
  alert('غادرت الغرفة');
});

/* ====== Render helpers ====== */
function renderRoomData(data){
  // players list
  const players = data.players || {};
  const keys = Object.keys(players);
  if(keys.length===0) playersList.innerText = 'لا أحد';
  else playersList.innerHTML = keys.map(k=>{
    const p = players[k];
    return `<div style="padding:8px;border-bottom:1px solid #f3f3f3"><strong>${escapeHtml(p.name||'—')}</strong></div>`;
  }).join('');
  // chat and requests handled by child listeners
}

/* ====== Chat ====== */
sendChatBtn.addEventListener('click', sendChatMessage);
async function sendChatMessage(){
  if(!roomRef) return alert('انضم لغرفة أولاً');
  const text = (chatInput.value||'').trim();
  if(!text) return;
  const ref = roomRef.child('chat').push();
  await ref.set({name:me.nick, text, ts:Date.now(), senderId:me.id});
  chatInput.value = '';
}

/* ====== Requests (invite flow) ====== */
/* request structure:
   rooms/{roomId}/requests/{reqId} = {
      id, requesterId, requesterName, game, ts
   }
*/
async function requestGame(game){
  if(!roomRef) return alert('انضم لغرفة أولاً');
  const id = makeId();
  const rRef = roomRef.child('requests/' + id);
  await rRef.set({ id, requesterId: me.id, requesterName: me.nick, game, ts: Date.now() });
  // inform chat
  await roomRef.child('chat').push().set({name:'نظام', text:`${me.nick} طلب لعب ${game}`, ts: Date.now()});
  alert('تم إرسال الطلب إلى الغرفة');
}

/* render requests: only other players see accept button (not requester) */
function renderRequestsList(reqs){
  if(!reqs || !reqs.length){ requestsBox.innerHTML = 'لا توجد طلبات'; return; }
  requestsBox.innerHTML = reqs.sort((a,b)=>a.ts-b.ts).map(r=>{
    const canAccept = r.requesterId !== me.id; // cannot accept your own
    const acceptBtn = canAccept ? `<button class="btn" onclick="acceptRequest('${r.id}')">اقبل</button>` : `<span class="muted small">بانتظار قبول آخر</span>`;
    return `<div class="requestsBoxItem"><strong>${escapeHtml(r.requesterName)}</strong> يريد لعب <em>${escapeHtml(r.game)}</em> — ${acceptBtn}</div>`;
  }).join('');
}

/* accept request (only allowed for other players) */
window.acceptRequest = async function(reqId){
  if(!roomRef) return alert('انضم لغرفة أولاً');
  const s = await roomRef.child('requests/' + reqId).once('value');
  const r = s.val();
  if(!r) return alert('الطلب لم يعد موجودًا');
  if(r.requesterId === me.id) return alert('لا يمكنك قبول طلبك الخاص');
  // create a session for the game (everyone watches sessions/*)
  const session = { active: true, game: r.game, startedBy: me.id, acceptedFor: r.requesterId, startedAt: Date.now(), reqId };
  await roomRef.child('sessions/' + r.game).set(session);
  // remove request
  await roomRef.child('requests/' + reqId).remove();
  // notify chat
  await roomRef.child('chat').push().set({name:'نظام', text: `${me.nick} قبل طلب ${r.requesterName} للعب ${r.game}`, ts: Date.now()});
};

/* ====== Sessions listeners: when a session node appears, open appropriate modal for everyone ====== */
function attachRealtimeChildListeners(){
  if(!roomRef) return;
  // chat
  roomRef.child('chat').on('value', snap => {
    const v = snap.val();
    if(!v){ chatBox.innerHTML = ''; return; }
    const arr = Object.values(v);
    chatBox.innerHTML = arr.sort((a,b)=>a.ts-b.ts).map(m=>`<div><strong>${escapeHtml(m.name)}</strong>: ${escapeHtml(m.text)}</div>`).join('');
    chatBox.scrollTop = chatBox.scrollHeight;
  });
  // requests
  roomRef.child('requests').on('value', snap => {
    const v = snap.val();
    const arr = v ? Object.values(v) : [];
    renderRequestsList(arr);
  });
  // sessions
  roomRef.child('sessions').on('value', snap => {
    const sessions = snap.val() || {};
    // for each game session that is active, open corresponding modal
    if(sessions.xo && sessions.xo.active) openXOForSession(sessions.xo);
    if(sessions.letters && sessions.letters.active) openLettersForSession(sessions.letters);
    if(sessions.board && sessions.board.active) openBoardForSession(sessions.board);
  });
}

/* ====== Open game UIs when session starts (simple placeholders: you can replace with full game code) */
function openXOForSession(sess){
  // open modal
  const modal = $('xoModal'); modal.setAttribute('aria-hidden','false');
  $('xoArea').innerText = `جلسة XO بدأت بواسطة ${sess.startedBy === me.id ? 'أنت' : 'لاعب آخر'} — اللعبة: ${sess.game}`;
  // (here you can initialize real XO logic)
}
function closeXOModal(){ $('xoModal').setAttribute('aria-hidden','true'); }

function openLettersForSession(sess){
  const modal = $('lettersModal'); modal.setAttribute('aria-hidden','false');
  $('lettersArea').innerText = `جلسة تحدي الحروف بدأت — بدأها ${sess.startedBy === me.id ? 'أنت' : 'لاعب آخر'}`;
  // init letters game logic here
}
function closeLettersModal(){ $('lettersModal').setAttribute('aria-hidden','true'); }

function openBoardForSession(sess){
  const modal = $('boardModal'); modal.setAttribute('aria-hidden','false');
  $('boardArea').innerText = `جلسة لوحة الأسئلة بدأت — بدأها ${sess.startedBy === me.id ? 'أنت' : 'لاعب آخر'}`;
}
function closeBoardModal(){ $('boardModal').setAttribute('aria-hidden','true'); }

/* ====== Utility / cleanup ====== */
window.addEventListener('beforeunload', ()=>{
  if(roomRef && me.id) roomRef.child('players/' + me.id).remove();
});

/* ====== Start ====== */
loadLocal();
if(!me.id) me.id = makeId();
updateMeBox();

/* Expose joinRoom so you can call via UI */
window.joinRoom = joinRoom;
