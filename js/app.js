// js/app.js (module - lobby + login handlers)
// يستخدم toast.js عبر import نسبي
import { showToast } from './toast.js';

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

// init firebase once
if(!window.firebase.apps || window.firebase.apps.length === 0){
  firebase.initializeApp(firebaseConfig);
}
const db = firebase.database();

function makeId(){ return Date.now().toString(36) + Math.random().toString(36).slice(2,6); }
function escapeHtml(s){ return (s||'').toString().replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c])); }

// helper: SHA-256
async function sha256Hex(str){
  const enc = new TextEncoder();
  const data = enc.encode(str);
  const hash = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(hash)).map(b=>b.toString(16).padStart(2,'0')).join('');
}

// wrap all DOM logic
document.addEventListener('DOMContentLoaded', () => {
  // elements (many pages share some ids; check presence)
  const loginBtn = document.getElementById('loginBtn');
  const toGamesBtn = document.getElementById('toGamesBtn');
  const nickInput = document.getElementById('nickInput');
  const userCodeInput = document.getElementById('userCodeInput');
  const passwordInput = document.getElementById('passwordInput');

  const createRoomBtn = document.getElementById('createRoomBtn');
  const joinRoomBtn = document.getElementById('joinRoomBtn');
  const leaveRoomBtn = document.getElementById('leaveRoomBtn');
  const roomInput = document.getElementById('roomInput');
  const playersList = document.getElementById('playersList');
  const chatLog = document.getElementById('chatLog');
  const chatInput = document.getElementById('chatInput');
  const sendChat = document.getElementById('sendChat');
  const meBox = document.getElementById('meBox');
  const requestBtns = document.querySelectorAll('.requestGame');
  const logoutBtn = document.getElementById('logoutBtn');

  // local user state
  let me = { id: makeId(), nick:'', code:'' };
  try{ const raw = localStorage.getItem('taka_user'); if(raw) me = JSON.parse(raw); }catch(e){}

  // show meBox if present
  if(meBox){ if(me.nick) meBox.innerHTML = `<strong>${escapeHtml(me.nick)}</strong>`; else meBox.innerHTML = `<a href="index.html" class="btn">سجل دخول</a>`; }

  // LOGIN handler (index.html)
  if(loginBtn){
    loginBtn.addEventListener('click', async ()=>{
      const nick = (nickInput.value||'').trim();
      const username = (userCodeInput.value||'').trim();
      const pwd = (passwordInput.value||'').trim();
      if(!nick || !username || !pwd){ alert('اكمل الحقول'); return; }
      const userRef = db.ref('users/' + username);
      const snap = await userRef.once('value');
      if(!snap.exists()){ alert('المستخدم غير موجود'); return; }
      const enteredHash = await sha256Hex(pwd);
      const user = snap.val();
      if(user.passwordHash === enteredHash){
        // set online via simple update; we try to avoid double-login
        const onlineSnap = await userRef.child('online').once('value');
        if(onlineSnap.exists() && onlineSnap.val() === true){
          alert('هذا الحساب متصل الآن من مكان آخر');
          return;
        }
        await userRef.update({ online:true, lastLogin:Date.now(), nick });
        userRef.child('online').onDisconnect().set(false);
        me = { id: username + '_' + Date.now(), nick, code: username };
        localStorage.setItem('taka_user', JSON.stringify(me));
        location.href = 'games.html';
      } else {
        alert('كلمة المرور خاطئة');
      }
    });
  }

  if(toGamesBtn) toGamesBtn.addEventListener('click', ()=> location.href='games.html');

  // LOGOUT
  if(logoutBtn){
    logoutBtn.addEventListener('click', async ()=>{
      try{ if(me.code) await db.ref('users/' + me.code).update({ online:false }); }catch(e){}
      localStorage.removeItem('taka_user');
      location.href = 'index.html';
    });
  }

  /* ===== Lobby functions (only if games.html loaded) ===== */
  let roomRef = null;
  if(createRoomBtn) createRoomBtn.addEventListener('click', async ()=>{
    const id = (roomInput.value||'').trim(); if(!id){ alert('اكتب رمز الغرفة'); return; }
    const ref = db.ref('rooms/' + id);
    const snap = await ref.once('value');
    if(snap.exists()){ alert('الغرفة موجودة'); return; }
    await ref.set({ meta:{ createdAt:Date.now(), createdBy: me.id }, players:{}, sessions:{}, chat:{}, requests:{} });
    joinRoom(id);
  });

  if(joinRoomBtn) joinRoomBtn.addEventListener('click', ()=> {
    const id = (roomInput.value||'').trim(); if(!id){ alert('اكتب رمز غرفة'); return; } joinRoom(id);
  });

  async function joinRoom(id){
    if(!me.nick){ alert('سجل دخول أولاً'); location.href='index.html'; return; }
    roomRef = db.ref('rooms/' + id);
    const snap = await roomRef.once('value'); if(!snap.exists()){ alert('الغرفة غير موجودة'); roomRef = null; return; }
    await roomRef.child('players/' + me.id).set({ name: me.nick, joinedAt: Date.now() });
    roomRef.child('players/' + me.id).onDisconnect().remove();
    const meta = (await roomRef.child('meta').once('value')).val() || {};
    if(meta.createdBy === me.id){
      // if creator, remove room on disconnect
      roomRef.onDisconnect().remove();
    }
    attachRoomListeners();
    showToast(`انضممت إلى الغرفة ${id}`);
  }

  if(leaveRoomBtn) leaveRoomBtn.addEventListener('click', async ()=>{
    if(!roomRef) { showToast('أنت لست داخل غرفة'); return; }
    const meta = (await roomRef.child('meta').once('value')).val() || {};
    await roomRef.child('players/' + me.id).remove();
    if(meta.createdBy === me.id){
      await roomRef.remove();
      showToast('أنت المنشئ — الغرفة حُذفت');
    } else {
      showToast('غادرت الغرفة');
    }
    if(roomRef) roomRef.off();
    roomRef = null;
    if(playersList) playersList.innerHTML = 'لم تنضم لغرفة بعد';
  });

  if(sendChat) sendChat.addEventListener('click', async ()=>{
    if(!roomRef) return alert('انضم لغرفة أولاً');
    const text = (chatInput.value||'').trim(); if(!text) return;
    await roomRef.child('chat').push().set({ name: me.nick, text, ts: Date.now(), senderId: me.id });
    chatInput.value = '';
  });

  // request game buttons
  requestBtns.forEach(b=>{
    b.addEventListener('click', async (e)=>{
      if(!roomRef) return alert('انضم لغرفة');
      const game = b.dataset.game;
      const id = makeId();
      await roomRef.child('requests/' + id).set({ id, requesterId: me.id, requesterName: me.nick, game, ts: Date.now() });
      await roomRef.child('chat').push().set({ name:'نظام', text: `${me.nick} طلب لعب ${game}`, ts: Date.now() });
    });
  });

  // accept request is exposed as window.acceptReq for buttons inside notifList
  window.acceptReq = async function(reqId){
    if(!roomRef) return alert('انضم لغرفة');
    const snap = await roomRef.child('requests/' + reqId).once('value'); const r = snap.val();
    if(!r) return alert('الطلب انتهى'); if(r.requesterId === me.id) return alert('لا يمكنك قبول طلبك');

    // basic accept logic: create session and state
    if(r.game === 'xo'){
      const session = { active:true, game:'xo', startedAt:Date.now(), roles:{ X: me.id, O: r.requesterId } };
      await roomRef.child('sessions/xo').set(session);
      await roomRef.child('sessions/xo/state').set({ board: Array(9).fill(''), turn: session.roles.X, winner: '', startedAt: Date.now() });
    } else {
      const playersSnap = await roomRef.child('players').once('value'); const players = playersSnap.val()||{};
      const ids = Object.keys(players);
      let team1=[], team2=[];
      if(ids.length >= 4){
        let t=0; ids.forEach(pid=>{ if(t===0) team1.push(pid); else team2.push(pid); t=1-t; });
      } else {
        team1 = [r.requesterId]; team2 = [me.id];
      }
      const session = { active:true, game:r.game, startedAt:Date.now(), roles:{ team1, team2 } };
      await roomRef.child('sessions/' + r.game).set(session);
      await roomRef.child('sessions/' + r.game + '/state').set({ board: r.game==='letters'? Array(25).fill('') : {}, turn:'team1', winner:'', startedAt: Date.now() });
    }
    await roomRef.child('requests/' + reqId).remove();
    await roomRef.child('chat').push().set({ name:'نظام', text: `${me.nick} قبل طلب ${r.requesterName} للعب ${r.game}`, ts: Date.now() });
  };

  function attachRoomListeners(){
    if(!roomRef) return;
    roomRef.child('players').on('value', snap=>{
      const v = snap.val() || {}; const ids = Object.keys(v);
      if(playersList) playersList.innerHTML = ids.length? ids.map(k=>`<div style="padding:6px;border-bottom:1px solid #f3f3f3"><strong>${escapeHtml(v[k].name)}</strong></div>`).join('') : 'لا أحد';
    });

    roomRef.child('chat').on('child_added', snap=>{
      const msg = snap.val();
      if(!msg) return;
      if(msg.name === 'نظام'){ showToast(msg.text, 4500); if(document.getElementById('notifList')) document.getElementById('notifList').innerHTML = `<div style="padding:6px;border-bottom:1px solid #eee">${escapeHtml(msg.text)}</div>` + document.getElementById('notifList').innerHTML; }
      else if(chatLog) chatLog.innerHTML = `<div style="padding:6px;border-bottom:1px solid #f6f6f6"><strong>${escapeHtml(msg.name)}</strong>: ${escapeHtml(msg.text)}</div>` + chatLog.innerHTML;
    });

    roomRef.child('requests').on('value', snap=>{
      const v = snap.val(); const arr = v? Object.values(v) : [];
      const box = document.getElementById('notifList');
      if(!box) return;
      box.innerHTML = arr.sort((a,b)=>a.ts-b.ts).map(r=>{
        const canAccept = r.requesterId !== me.id;
        const acceptBtn = canAccept ? `<button class="btn" onclick="acceptReq('${r.id}')">اقبل</button>` : `<span class="muted small">بانتظار قبول</span>`;
        return `<div style="padding:8px;border-bottom:1px solid #f6f6f6"><strong>${escapeHtml(r.requesterName)}</strong> طلب <em>${escapeHtml(r.game)}</em> — ${acceptBtn}</div>`;
      }).join('') || '<div class="muted small">لا توجد طلبات</div>';
    });

    // sessions watcher: redirect players to the game page when session created
    roomRef.child('sessions').on('value', snap=>{
      const s = snap.val() || {};
      Object.keys(s).forEach(key=>{
        if(s[key] && s[key].active){
          if(key === 'xo') location.href = `xo.html?room=${roomRef.key}`;
          else if(key === 'letters') location.href = `letters.html?room=${roomRef.key}`;
          else if(key === 'board') location.href = `board.html?room=${roomRef.key}`;
        }
      });
    });
  }
}); // end DOMContentLoaded
