// js/app.js (ES module)
import { initXO, handleXOSession, cleanupXO } from './xo.js';
import { initLetters, handleLettersSession, cleanupLetters } from './letters.js';
import { initBoard, handleBoardSession, cleanupBoard } from './board.js';

/* === config === */
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
const database = firebase.database();

/* DOM refs */
const landing = document.getElementById('landing');
const gamesPage = document.getElementById('gamesPage');
const nickInput = document.getElementById('nickInput');
const userCodeInput = document.getElementById('userCodeInput');
const passwordInput = document.getElementById('passwordInput');
const loginBtn = document.getElementById('loginBtn');
const clearLocal = document.getElementById('clearLocal');
const meBox = document.getElementById('meBox');
const roomInput = document.getElementById('roomInput');
const createRoomBtn = document.getElementById('createRoomBtn');
const joinRoomBtn = document.getElementById('joinRoomBtn');
const playersList = document.getElementById('playersList');
const chatBox = document.getElementById('chatBox');
const chatInput = document.getElementById('chatInput');
const sendChat = document.getElementById('sendChat');
const requestsBox = document.getElementById('requestsBox');
const sessionsBox = document.getElementById('sessionsBox');
const leaveRoomBtn = document.getElementById('leaveRoomBtn');
const logoutBtn = document.getElementById('logoutBtn');
const reqBoard = document.getElementById('reqBoard');
const reqXO = document.getElementById('reqXO');
const reqLetters = document.getElementById('reqLetters');

/* local state */
let me = { id: null, nick: '', code: '' };
let roomId = null; let roomRef = null;

/* helpers */
const makeId = ()=> Date.now().toString(36) + Math.random().toString(36).slice(2,6);
const escapeHtml = s => (s+'').replace(/[&<>"]/g, c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));

/* password hashing utility (SHA-256 via Web Crypto) */
async function sha256Hex(str){
  const enc = new TextEncoder();
  const data = enc.encode(str);
  const hash = await crypto.subtle.digest('SHA-256', data);
  const bytes = new Uint8Array(hash);
  return Array.from(bytes).map(b=>b.toString(16).padStart(2,'0')).join('');
}

/* local storage helpers */
function loadLocal(){ try{ const raw = localStorage.getItem('taka_user'); if(raw) me = JSON.parse(raw); }catch(e){} if(!me.id) me.id = makeId(); nickInput.value = me.nick||''; userCodeInput.value = me.code||''; updateMeBox(); }
function saveLocal(){ localStorage.setItem('taka_user', JSON.stringify(me)); }
function clearLocalData(){ localStorage.removeItem('taka_user'); me = { id: makeId(), nick:'', code:'' }; nickInput.value=''; userCodeInput.value=''; passwordInput.value=''; alert('تم مسح بيانات الجهاز'); updateMeBox(); }
function updateMeBox(){ meBox.innerHTML = `<div style="font-weight:900">${escapeHtml(me.nick||'')}</div><div class="muted small">معرّفك المحلي: <code>${escapeHtml(me.id)}</code></div>`; }

/* ===== LOGIN using hashed passwords stored at /users/{username}/passwordHash ===== */
async function handleLogin(){
  const nick = (nickInput.value||'').trim();
  const username = (userCodeInput.value||'').trim();
  const pwd = (passwordInput.value||'').trim();
  if(!nick || !username || !pwd){ alert('ادخل الاسم واسم المستخدم وكلمة المرور'); return; }

  try{
    const userRef = database.ref('users/' + username);
    const snap = await userRef.once('value');
    const userObj = snap.val();
    if(!userObj){ alert('اسم المستخدم غير موجود'); return; }
    const enteredHash = await sha256Hex(pwd);
    if(userObj.passwordHash && userObj.passwordHash === enteredHash){
      // success - prevent simultaneous login
      const onlineRef = userRef.child('online');
      const txn = await onlineRef.transaction(current=>{ if(current) return; return true; });
      if(!txn.committed){ alert('المستخدم متصل الآن من جهاز آخر'); return; }

      me.id = username + '_' + Date.now(); me.nick = nick; me.code = username;
      await userRef.update({ online:true, sessionId: me.id, lastLogin: Date.now(), nick: nick });
      userRef.child('online').onDisconnect().set(false);
      userRef.child('sessionId').onDisconnect().remove();

      saveLocal(); showGamesPage();
    } else {
      alert('كلمة المرور غير صحيحة');
    }
  }catch(err){ console.error(err); alert('خطأ أثناء تسجيل الدخول'); }
}

/* helper: create user with hashed password (admin / dev use only).
   Usage: call createHashedUser('username','plainPassword','player') from console (temporary)
*/
async function createHashedUser(username, plainPassword, role='player'){
  if(!username || !plainPassword) throw new Error('username and plainPassword required');
  const h = await sha256Hex(plainPassword);
  await database.ref('users/' + username).set({ passwordHash: h, role, createdAt: Date.now() });
  return h;
}

loginBtn.addEventListener('click', handleLogin);
clearLocal.addEventListener('click', clearLocalData);

/* ====== إظهار/إخفاء الصفحات ====== */
function showGamesPage(){
  landing.style.display = 'none';
  gamesPage.style.display = 'block';
  updateMeBox();
}
function showLanding(){
  landing.style.display = 'flex';
  gamesPage.style.display = 'none';
}

/* ====== إنشاء / انضمام غرف ====== */
createRoomBtn.addEventListener('click', async ()=>{
  const id = (roomInput.value||'').trim();
  if(!id){ alert('اكتب رمز غرفة'); return; }
  const ref = database.ref('rooms/' + id);
  const snap = await ref.once('value');
  if(snap.exists()){ alert('الغرفة موجودة بالفعل'); return; }
  // create room and auto-join creator
  await ref.set({ meta:{createdAt:Date.now(), createdBy:me.id}, players:{}, sessions:{}, chat:{}, requests:{}, roles:{} });
  joinRoom(id);
});

joinRoomBtn.addEventListener('click', ()=>{ const id = (roomInput.value||'').trim(); if(!id){ alert('اكتب رمز غرفة'); return; } joinRoom(id); });

async function joinRoom(id){
  if(!me.nick || !me.code){ alert('سجّل الدخول أولاً'); return; }
  const ref = database.ref('rooms/' + id);
  const snap = await ref.once('value');
  if(!snap.exists()){ alert('لا يمكنك الانضمام — هذه الغرفة لم تُنشأ'); return; }
  roomId = id; roomRef = ref;
  await roomRef.child('players/' + me.id).set({name:me.nick, joinedAt:Date.now()});
  roomRef.child('players/' + me.id).onDisconnect().remove();
  attachListeners();
}

/* مغادرة الغرفة / تسجيل خروج */
leaveRoomBtn.addEventListener('click', async ()=>{
  if(roomRef && me.id) await roomRef.child('players/' + me.id).remove();
  if(roomRef) roomRef.off();
  roomRef = null; roomId = null;
  playersList.innerHTML = 'لم تنضم إلى غرفة بعد';
  chatBox.innerHTML = '';
  requestsBox.innerHTML = 'لا توجد طلبات';
  alert('غادرت الغرفة');
  showLanding();
});

logoutBtn.addEventListener('click', async ()=>{
  try{
    if(me.code){
      const userRef = database.ref('users/' + me.code);
      await userRef.update({ online:false });
    }
  }catch(e){ console.warn(e); }
  if(roomRef && me.id) await roomRef.child('players/' + me.id).remove();
  if(roomRef) roomRef.off();
  roomRef = null; roomId = null;
  me = { id: makeId(), nick:'', code:'' };
  saveLocal();
  showLanding();
});

/* ====== الدردشة ====== */
sendChat.addEventListener('click', async ()=>{
  if(!roomRef) return alert('انضم لغرفة');
  const text = (chatInput.value||'').trim();
  if(!text) return;
  await roomRef.child('chat').push().set({name:me.nick, text, ts:Date.now(), senderId:me.id});
  chatInput.value = '';
});

/* ====== طلب الألعاب ====== */
reqBoard.addEventListener('click', ()=> requestGame('board'));
reqXO.addEventListener('click', ()=> requestGame('xo'));
reqLetters.addEventListener('click', ()=> requestGame('letters'));

async function requestGame(game){
  if(!roomRef) return alert('انضم لغرفة');
  const id = makeId();
  await roomRef.child('requests/' + id).set({ id, requesterId: me.id, requesterName: me.nick, game, ts: Date.now() });
  await roomRef.child('chat').push().set({ name: 'نظام', text: `${me.nick} طلب لعب ${game}`, ts: Date.now() });
}

/* ====== قبول الطلب (تابع عالمي تستخدمه أزرار الواجهة) ====== */
window.acceptRequest = async function(reqId){
  if(!roomRef) return alert('انضم لغرفة');
  const snap = await roomRef.child('requests/' + reqId).once('value');
  const r = snap.val();
  if(!r) return alert('الطلب انتهى');
  if(r.requesterId === me.id) return alert('لا يمكنك قبول طلبك');
  // gather players
  const playersSnap = await roomRef.child('players').once('value');
  const playersObj = playersSnap.val() || {};
  const playerIds = Object.keys(playersObj);

  let session = { active:true, game:r.game, startedBy: me.id, requesterId: r.requesterId, startedAt: Date.now(), roles: {} };

  if(r.game === 'xo'){
    // assign X to accepter (me), O to requester
    session.roles = { X: me.id, O: r.requesterId };
    // create session and initial state (state.turn is playerId)
    await roomRef.child('sessions/xo').set(session);
    await roomRef.child('sessions/xo/state').set({ board: Array(9).fill(''), turn: session.roles.X, winner: '', startedAt: Date.now() });
  } else if(r.game === 'letters' || r.game === 'board'){
    // if 4+ players split into two teams, else requester vs acceptor
    if(playerIds.length >= 4){
      const team1 = [], team2 = [];
      let toggle = 0;
      for(const pid of playerIds){
        if(toggle === 0) team1.push(pid); else team2.push(pid);
        toggle = 1 - toggle;
      }
      session.roles.team1 = team1;
      session.roles.team2 = team2;
    } else {
      session.roles.team1 = [r.requesterId];
      session.roles.team2 = [me.id];
    }
    // set session and initial state: team-based turn starting with team1
    await roomRef.child('sessions/' + r.game).set(session);
    await roomRef.child('sessions/' + r.game + '/state').set({ board: (r.game==='letters'? Array(25).fill('') : {}), turn: 'team1', winner: '', startedAt: Date.now() });
  }

  await roomRef.child('requests/' + reqId).remove();
  await roomRef.child('chat').push().set({ name: 'نظام', text: `${me.nick} قبل طلب ${r.requesterName} للعب ${r.game}`, ts: Date.now() });
};

/* ====== إدارة المستمعين وحماية من فتح نفس المودال عدة مرات ====== */
const activeSessions = {}; // gameKey -> startedAt (to avoid reopening same session)
const cleanupMap = { xo: cleanupXO, letters: cleanupLetters, board: cleanupBoard };

function attachListeners(){
  if(!roomRef) return;

  // لاعبين
  roomRef.child('players').on('value', snap=>{
    const v = snap.val() || {};
    const ids = Object.keys(v);
    playersList.innerHTML = ids.length? ids.map(k=>`<div style="padding:8px;border-bottom:1px solid #f3f3f3"><strong>${escapeHtml(v[k].name)}</strong></div>`).join('') : 'لا أحد';
  });

  // دردشة
  roomRef.child('chat').on('value', snap=>{
    const v = snap.val() || {};
    const arr = Object.values(v);
    chatBox.innerHTML = arr.sort((a,b)=>a.ts-b.ts).map(m=>`<div><strong>${escapeHtml(m.name)}</strong>: ${escapeHtml(m.text)}</div>`).join('');
    chatBox.scrollTop = chatBox.scrollHeight;
  });

  // طلبات
  roomRef.child('requests').on('value', snap=>{
    const v = snap.val();
    const arr = v ? Object.values(v) : [];
    requestsBox.innerHTML = arr.sort((a,b)=>a.ts-b.ts).map(r=>{
      const canAccept = r.requesterId !== me.id;
      const acceptBtn = canAccept ? `<button class="btn" onclick="acceptRequest('${r.id}')">اقبل</button>` : `<span class="muted small">بانتظار قبول آخر</span>`;
      return `<div class="requestsBoxItem" style="padding:8px;border-bottom:1px solid #f6f6f6"><strong>${escapeHtml(r.requesterName)}</strong> يريد لعب <em>${escapeHtml(r.game)}</em> — ${acceptBtn}</div>`;
    }).join('');
  });

  // جلسات/ألعاب — رصد ذكي حتى لا نفتح نفس المودال مرتين
  roomRef.child('sessions').on('value', snap=>{
    const s = snap.val() || {};
    const keys = Object.keys(s);

    // Handle active sessions
    keys.forEach(key=>{
      const sess = s[key];
      if(sess && sess.active){
        const startedAt = sess.startedAt || (sess.startedAt = Date.now());
        if(!activeSessions[key] || activeSessions[key] !== startedAt){
          // New session for this game — route to handler
          activeSessions[key] = startedAt;
          if(key === 'xo' && sess.active){
            handleXOSession(roomRef, me);
          } else if(key === 'letters' && sess.active){
            handleLettersSession(roomRef, me);
          } else if(key === 'board' && sess.active){
            handleBoardSession(roomRef, me);
          }
        }
      } else {
        // session exists but inactive or removed -> cleanup if we had it
        if(activeSessions[key]){
          // call cleanup if exists
          if(cleanupMap[key]) try{ cleanupMap[key](); }catch(e){ console.warn(e); }
          delete activeSessions[key];
        }
      }
    });

    // Also, if a session key previously active is now missing -> cleanup
    Object.keys(activeSessions).forEach(prevKey=>{
      if(!s[prevKey] || !s[prevKey].active){
        if(cleanupMap[prevKey]) try{ cleanupMap[prevKey](); }catch(e){ console.warn(e); }
        delete activeSessions[prevKey];
      }
    });

    // update sessions box for UI
    const activeKeys = keys.filter(k=>s[k] && s[k].active);
    sessionsBox.innerHTML = activeKeys.length ? activeKeys.map(k=>`<div style="padding:6px;border-bottom:1px solid #f6f6f6">${escapeHtml(k)} — نشطة</div>`).join('') : 'لا توجد جلسات نشطة';
  });
}

/* ====== تنظيف عند إغلاق الصفحة ====== */
window.addEventListener('beforeunload', async ()=>{
  try{
    if(me.code){
      const userRef = database.ref('users/' + me.code);
      await userRef.update({ online: false });
    }
    if(roomRef && me.id) await roomRef.child('players/' + me.id).remove();
  }catch(e){ /* ignore */ }
});

/* ====== init الألعاب والتحميل ====== */
initXO(); initLetters(); initBoard();
loadLocal();

// make helper available in window for admin use (temporary)
window.createHashedUser = createHashedUser;
