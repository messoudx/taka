// js/app.js (module)
import { showToast } from './toast.js';

/* Firebase config — انسخ config مشروعك كما في النسخة السابقة */
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

/* helpers */
const makeId = ()=> Date.now().toString(36) + Math.random().toString(36).slice(2,6);
const getEl = id => document.getElementById(id);
const params = new URLSearchParams(location.search);
function escapeHtml(s){ return (s||'').toString().replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c])); }

/* simple local user state */
let me = { id: null, nick: '', code: ''};
try{ const raw = localStorage.getItem('taka_user'); if(raw) me = JSON.parse(raw); }catch(e){}
if(!me.id) me.id = makeId();

/* If on index.html, handle login inputs */
if(document.getElementById('loginBtn')){
  const nickInput = getEl('nickInput');
  const userCodeInput = getEl('userCodeInput');
  const passwordInput = getEl('passwordInput');
  const loginBtn = getEl('loginBtn');
  const toGamesBtn = getEl('toGamesBtn');

  async function sha256Hex(str){
    const enc = new TextEncoder();
    const data = enc.encode(str);
    const hash = await crypto.subtle.digest('SHA-256', data);
    return Array.from(new Uint8Array(hash)).map(b=>b.toString(16).padStart(2,'0')).join('');
  }
  loginBtn.addEventListener('click', async ()=>{
    const nick = (nickInput.value||'').trim();
    const username = (userCodeInput.value||'').trim();
    const pwd = (passwordInput.value||'').trim();
    if(!nick || !username || !pwd){ alert('اكمل الحقول'); return; }
    const userRef = db.ref('users/' + username);
    const snap = await userRef.once('value'); if(!snap.exists()){ alert('المستخدم غير موجود'); return; }
    const enteredHash = await sha256Hex(pwd);
    const user = snap.val();
    if(user.passwordHash === enteredHash){
      // set online via transaction
      const tx = await userRef.child('online').transaction(cur=> cur? null : true);
      if(!tx.committed){ alert('هذا الحساب متصل الآن'); return; }
      me = { id: username + '_' + Date.now(), nick, code: username };
      await userRef.update({ online:true, lastLogin:Date.now(), nick });
      userRef.child('online').onDisconnect().set(false);
      localStorage.setItem('taka_user', JSON.stringify(me));
      location.href = 'games.html';
    } else alert('كلمة المرور خاطئة');
  });

  toGamesBtn.addEventListener('click', ()=> location.href='games.html');
}

/* If on games.html, set up lobby behaviour */
if(document.body.classList.contains('wrap') || location.pathname.endsWith('games.html')){
  const createBtn = getEl('createRoomBtn');
  const joinBtn = getEl('joinRoomBtn');
  const leaveBtn = getEl('leaveRoomBtn');
  const roomInput = getEl('roomInput');
  const playersList = getEl('playersList');
  const chatLog = getEl('chatLog');
  const chatInput = getEl('chatInput');
  const sendChat = getEl('sendChat');
  const notifList = getEl('notifList');
  const meBox = getEl('meBox');
  const requestBtns = document.querySelectorAll('.requestGame');

  // load me from storage if possible
  try{ const raw = localStorage.getItem('taka_user'); if(raw) me = JSON.parse(raw); }catch(e){}
  if(me.nick){ meBox.innerHTML = `<strong>${escapeHtml(me.nick)}</strong>`; } else meBox.innerHTML = `<a href="index.html" class="btn">سجل دخول</a>`;

  let roomId = null; let roomRef = null;

  createBtn.addEventListener('click', async ()=>{
    const id = (roomInput.value||'').trim();
    if(!id){ alert('اكتب رمز غرفة'); return; }
    const ref = db.ref('rooms/' + id);
    const snap = await ref.once('value'); if(snap.exists()){ alert('الغرفة موجودة'); return; }
    // make room with meta.createdBy
    await ref.set({ meta:{ createdAt:Date.now(), createdBy: me.id }, players:{}, sessions:{}, chat:{}, requests:{} });
    // auto-join creator
    joinRoom(id);
  });

  joinBtn.addEventListener('click', ()=>{ const id = (roomInput.value||'').trim(); if(!id){ alert('اكتب رمز غرفة'); return; } joinRoom(id); });

  async function joinRoom(id){
    if(!me.nick){ alert('سجل دخول أولا'); location.href='index.html'; return; }
    const ref = db.ref('rooms/' + id);
    const snap = await ref.once('value'); if(!snap.exists()){ alert('الغرفة غير موجودة'); return; }
    roomId = id; roomRef = ref;
    await roomRef.child('players/' + me.id).set({ name: me.nick, joinedAt: Date.now() });
    roomRef.child('players/' + me.id).onDisconnect().remove();
    // if I'm the creator, ensure the room gets removed on disconnect
    const metaSnap = await roomRef.child('meta').once('value');
    const meta = metaSnap.val() || {};
    if(meta.createdBy === me.id){
      // Try to remove entire room if I disconnect unexpectedly
      roomRef.onDisconnect().remove();
    }
    attachListeners();
    showToast(`انضممت إلى الغرفة ${roomId}`);
  }

  leaveBtn.addEventListener('click', async ()=>{
    if(!roomRef){ showToast('أنت لست داخل غرفة'); return; }
    // check if I'm creator
    const metaSnap = await roomRef.child('meta').once('value');
    const meta = metaSnap.val()||{};
    // remove my player node
    await roomRef.child('players/' + me.id).remove();
    // if creator -> delete whole room
    if(meta.createdBy === me.id){
      await roomRef.remove();
      showToast('أنت المنشئ — الغرفة حُذفت');
    } else {
      showToast('غادرت الغرفة');
    }
    roomRef.off();
    roomRef = null; roomId = null;
    playersList.innerHTML = 'لم تنضم لغرفة بعد';
  });

  // chat send
  sendChat.addEventListener('click', async ()=>{
    if(!roomRef) return alert('انضم لغرفة أولاً');
    const text = (chatInput.value||'').trim(); if(!text) return;
    // system messages (accept/decline) will be pushed by server code — here user sends normal chat
    await roomRef.child('chat').push().set({ name: me.nick, text, ts: Date.now(), senderId: me.id });
    chatInput.value = '';
  });

  function showToast(msg){ // local wrapper if toast module not loaded on this page
    if(window.showToast) return window.showToast(msg);
    const el = document.createElement('div'); el.className='toast'; el.innerText = msg; document.body.appendChild(el);
    setTimeout(()=>el.remove(),3500);
  }

  // attach listeners for the joined room
  function attachListeners(){
    if(!roomRef) return;
    // players list
    roomRef.child('players').on('value', snap=>{
      const v = snap.val() || {};
      const ids = Object.keys(v);
      playersList.innerHTML = ids.length? ids.map(k=>`<div style="padding:6px;border-bottom:1px solid #f3f3f3"><strong>${escapeHtml(v[k].name)}</strong></div>`).join('') : 'لا أحد';
    });

    // chat -> append to log but also show important system messages as toast/notification
    roomRef.child('chat').on('child_added', snap=>{
      const msg = snap.val();
      if(!msg) return;
      // treat messages from name 'نظام' as notifications
      if(msg.name === 'نظام'){
        // if contains "قبل" or "رفض" or "طلب" => show toast
        showToast(msg.text, 4500);
        const nl = getEl('notifList');
        if(nl) nl.innerHTML = `<div style="padding:6px;border-bottom:1px solid #eee">${escapeHtml(msg.text)}</div>` + nl.innerHTML;
      } else {
        chatLog.innerHTML = `<div style="padding:6px;border-bottom:1px solid #f6f6f6"><strong>${escapeHtml(msg.name)}</strong>: ${escapeHtml(msg.text)}</div>` + chatLog.innerHTML;
      }
    });

    // requests
    roomRef.child('requests').on('value', snap=>{
      const v = snap.val();
      const arr = v? Object.values(v) : [];
      const requestsBox = getEl('notifList');
      // show list (as items)
      const html = arr.sort((a,b)=>a.ts-b.ts).map(r=> {
        const canAccept = r.requesterId !== me.id;
        const acceptBtn = canAccept ? `<button class="btn" onclick="acceptReq('${r.id}')">اقبل</button>` : `<span class="muted small">بانتظار قبول</span>`;
        return `<div style="padding:8px;border-bottom:1px solid #f6f6f6"><strong>${escapeHtml(r.requesterName)}</strong> طلب <em>${escapeHtml(r.game)}</em> — ${acceptBtn}</div>`;
      }).join('');
      if(requestsBox) requestsBox.innerHTML = html || '<div class="muted small">لا توجد طلبات</div>';
      // expose global to accept (simpler)
      window.acceptReq = async function(reqId){
        if(!roomRef) return alert('انضم لغرفة');
        const snap = await roomRef.child('requests/' + reqId).once('value'); const r = snap.val();
        if(!r) return alert('انتهى الطلب');
        if(r.requesterId === me.id) return alert('لا يمكنك قبول طلبك');
        // send system accept
        await roomRef.child('chat').push().set({ name:'نظام', text: `${me.nick} قبل طلب ${r.requesterName} للعب ${r.game}`, ts: Date.now() });
        // create session and initial state and redirect all players via session listener
        if(r.game === 'xo'){
          const session = { active:true, game:'xo', startedAt:Date.now(), roles:{ X: me.id, O: r.requesterId } };
          await roomRef.child('sessions/xo').set(session);
          await roomRef.child('sessions/xo/state').set({ board: Array(9).fill(''), turn: session.roles.X, winner: '', startedAt: Date.now() });
        } else {
          // team game
          const playersSnap = await roomRef.child('players').once('value'); const players = playersSnap.val()||{};
          const ids = Object.keys(players);
          let team1=[], team2=[];
          if(ids.length>=4){
            let t=0; ids.forEach(pid=>{ if(t===0) team1.push(pid); else team2.push(pid); t=1-t; });
          } else {
            team1 = [r.requesterId]; team2 = [me.id];
          }
          const session = { active:true, game:r.game, startedAt:Date.now(), roles:{ team1, team2 } };
          await roomRef.child('sessions/' + r.game).set(session);
          await roomRef.child('sessions/' + r.game + '/state').set({ board: r.game==='letters'? Array(25).fill('') : {}, turn:'team1', winner:'', startedAt:Date.now() });
        }
        await roomRef.child('requests/' + reqId).remove();
      };
    });

    // sessions: redirect players to game pages when a session for a game becomes active
    roomRef.child('sessions').on('value', snap=>{
      const s = snap.val() || {};
      Object.keys(s).forEach(key=>{
        if(s[key] && s[key].active){
          // redirect to corresponding page
          if(key === 'xo') location.href = `xo.html?room=${roomId}`;
          else if(key === 'letters') location.href = `letters.html?room=${roomId}`;
          else if(key === 'board') location.href = `board.html?room=${roomId}`;
        }
      });
    });
  } // end lobby block
}

/* Utility showToast used in index/games pages when toast.js may not be loaded */
function showToast(msg, ttl=3600){
  if(window.showToast) return window.showToast(msg, ttl);
  const el = document.createElement('div'); el.className='toast'; el.innerText = msg; document.body.appendChild(el);
  setTimeout(()=>el.remove(), ttl);
}

// export helper for index's createHashedUser (if loaded)
export async function createHashedUser(username, plainPassword, role='player'){
  if(!username || !plainPassword) throw new Error('username and plainPassword required');
  const enc = new TextEncoder();
  const data = enc.encode(plainPassword);
  const hashBuf = await crypto.subtle.digest('SHA-256', data);
  const hex = Array.from(new Uint8Array(hashBuf)).map(b=>b.toString(16).padStart(2,'0')).join('');
  await db.ref('users/' + username).set({ passwordHash: hex, role, createdAt: Date.now() });
  return hex;
}

// expose global for quick use in console/testing
window.createHashedUser = createHashedUser;
