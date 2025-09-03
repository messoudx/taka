// App logic — منفصل في ملف مستقل

// ====== Firebase config: استبدل القيم إن أردت (وضعت config الذي زودتني به) ======
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

// ====== Helpers ======
function makeId(){ return Date.now().toString(36) + Math.random().toString(36).slice(2,7); }
function $(id){ return document.getElementById(id); }
function escapeHtml(s){ return (s+'').replace(/[&<>\"]/g, c=>({'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;'}[c])); }

// ====== Local state ======
let me = { id: null, nick: '', code: '' };
let roomId = null;
let roomRef = null;

// ====== Cached DOM ======
const landing = $('landing');
const gamesPage = $('gamesPage');
const nickInput = $('nickInput');
const userCodeInput = $('userCodeInput');
const regenCode = $('regenCode');
const roomInput = $('roomInput');
const createRoomBtn = $('createRoomBtn');
const joinRoomBtn = $('joinRoomBtn');
const connStatus = $('connStatus');
const roomBox = $('roomBox');
const meBox = $('meBox');
const playersList = $('playersList');
const chatBox = $('chatBox');
const chatInput = $('chatInput');
const sendChat = $('sendChat');
const requestsBox = $('requestsBox');
const leaveRoomBtn = $('leaveRoomBtn');
const backToLanding = $('backToLanding');
const team1NameInput = $('team1NameInput');
const team2NameInput = $('team2NameInput');
const saveTeamsBtn = $('saveTeamsBtn');
const claimTeam1Btn = $('claimTeam1Btn');
const claimTeam2Btn = $('claimTeam2Btn');

// buttons
createRoomBtn.addEventListener('click', async ()=>{ const id = (roomInput.value||'').trim(); if(!id){ alert('ضع رمز غرفة'); return; } await createRoom(id); joinRoom(id); });
joinRoomBtn.addEventListener('click', ()=>{ const id = (roomInput.value||'').trim(); if(!id){ alert('ضع رمز غرفة'); return; } joinRoom(id); });
regenCode.addEventListener('click', ()=>{ genUserCode(); saveLocalUser(); });

sendChat.addEventListener('click', sendChatMessage);
leaveRoomBtn.addEventListener('click', leaveRoom);
backToLanding.addEventListener('click', ()=>{ leaveRoom(); showLanding(); });

saveTeamsBtn && saveTeamsBtn.addEventListener('click', async ()=>{
  if(!roomRef) return alert('انضم لغرفة أولاً');
  const t1 = (team1NameInput.value||'').trim() || 'الفريق 1';
  const t2 = (team2NameInput.value||'').trim() || 'الفريق 2';
  await roomRef.child('teams').set({team1:{name:t1}, team2:{name:t2}});
  // also ensure scores structure
  await roomRef.child('scores').update({team1:0,team2:0});
  alert('تم حفظ أسماء الفرق');
});

claimTeam1Btn && claimTeam1Btn.addEventListener('click', async ()=>{ await claimTeam('team1'); });
claimTeam2Btn && claimTeam2Btn.addEventListener('click', async ()=>{ await claimTeam('team2'); });

// local storage user
function saveLocalUser(){ localStorage.setItem('t_user', JSON.stringify(me)); }
function loadLocalUser(){ const raw = localStorage.getItem('t_user'); if(raw){ try{ me = JSON.parse(raw); nickInput.value = me.nick || ''; userCodeInput.value = me.code || ''; }catch(e){} } else { genUserCode(); } }
function genUserCode(){ me.code = makeId().slice(-6).toUpperCase(); userCodeInput.value = me.code; }

// on load
loadLocalUser();
if(me.id==null) me.id = makeId();
me.nick = nickInput.value || me.nick || '';
nickInput.addEventListener('input', ()=>{ me.nick = nickInput.value; saveLocalUser(); });

// ===== Rooms & players =====
async function createRoom(id){
  const ref = database.ref('rooms/' + id);
  const snap = await ref.once('value');
  if(!snap.exists()){
    // init with teams (default names) and empty structures
    await ref.set({
      meta:{createdAt:Date.now()},
      players:{},
      teams:{team1:{name:'الفريق 1'}, team2:{name:'الفريق 2'}},
      scores:{team1:0,team2:0},
      xo:{board:Array(9).fill(''),turn:'X',winner:''},
      letters:{board:Array(25).fill(''),winner:''},
      boardCells:{},
      chat:{},
      requests:{}
    });
  }
}

async function joinRoom(id){
  if(!me.nick || me.nick.trim()===''){ alert('اكتب اسمك المستعار أولاً'); return; }
  roomId = id;
  roomRef = database.ref('rooms/' + roomId);
  // add player
  me.id = me.id || makeId();
  me.nick = nickInput.value.trim()||('Player-'+me.id.slice(-4));
  await roomRef.child('players/' + me.id).set({name:me.nick,code:me.code,joinedAt:Date.now()});
  roomRef.child('players/' + me.id).onDisconnect().remove();
  // start listeners
  roomRef.on('value', snap => { const data = snap.val(); if(!data) return; renderRoomData(data); });
  // attach chat & requests child listeners for realtime update UI
  attachRealtimeChildListeners();
  // UI switch
  showGames();
}

function leaveRoom(){
  if(roomRef && me.id){
    roomRef.child('players/' + me.id).remove();
    roomRef.off();
    roomRef = null;
    roomId = null;
    connStatus.innerText = 'غير متصل';
    playersList.innerHTML = 'لا أحد';
    chatBox.innerHTML = '';
    requestsBox.innerHTML = '';
  }
  showLanding();
}

function renderRoomData(data){
  connStatus.innerText = 'متصل';
  roomBox.innerText = roomId;
  meBox.innerHTML = `${escapeHtml(me.nick)} — ${escapeHtml(me.code)}`;

  // teams
  const teams = data.teams || {team1:{name:'الفريق 1'},team2:{name:'الفريق 2'}};
  team1NameInput.value = teams.team1 && teams.team1.name ? teams.team1.name : 'الفريق 1';
  team2NameInput.value = teams.team2 && teams.team2.name ? teams.team2.name : 'الفريق 2';

  // players
  const players = data.players || {};
  const keys = Object.keys(players);
  if(keys.length===0) playersList.innerText = 'لا أحد';
  else playersList.innerHTML = keys.map(k=>`<div style="padding:6px;border-bottom:1px solid #f3f3f3"><strong>${escapeHtml(players[k].name)}</strong> <small style="color:#666">${escapeHtml(players[k].code||'')}</small></div>`).join('');

  // chat & requests handled by child listeners (attached separately)

  // scores display (update local scoreboard area if present)
  const scores = data.scores || {};
  // (we don't have a dedicated scoreboard section in UI beyond playersList; you can add if needed)
}

// ===== Chat =====
function attachRealtimeChildListeners(){
  if(!roomRef) return;
  roomRef.child('chat').on('value', snap => {
    const v = snap.val();
    if(v) renderChat(Object.values(v));
    else chatBox.innerHTML = '';
  });
  roomRef.child('requests').on('value', snap => {
    const v = snap.val();
    if(v) renderRequests(Object.values(v));
    else requestsBox.innerHTML = '';
  });
  roomRef.child('teams').on('value', snap=>{
    const v = snap.val();
    if(v){
      team1NameInput.value = (v.team1 && v.team1.name) || team1NameInput.value;
      team2NameInput.value = (v.team2 && v.team2.name) || team2NameInput.value;
    }
  });
  // keep scores updated in DB (optional UI hook)
  roomRef.child('scores').on('value', snap=>{
    // placeholder if you add scoreboard UI later
    const v = snap.val() || {};
    // console.log('scores updated', v);
  });
}

function renderChat(messages){
  chatBox.innerHTML = messages.sort((a,b)=>a.ts-b.ts).map(m=>`<div class="chatMsg"><strong>${escapeHtml(m.name)}</strong>: ${escapeHtml(m.text)}</div>`).join('');
  chatBox.scrollTop = chatBox.scrollHeight;
}

async function sendChatMessage(){
  if(!roomRef) return alert('انضم لغرفة أولاً');
  const txt = chatInput.value.trim();
  if(!txt) return;
  const ref = roomRef.child('chat').push();
  await ref.set({name:me.nick,text:txt,ts:Date.now(),code:me.code});
  chatInput.value='';
}

// ===== Requests (game invites) =====
function renderRequests(reqs){
  requestsBox.innerHTML = reqs.sort((a,b)=>a.ts-b.ts).map(r=>{
    return `<div class="requestsBoxItem"><strong>${escapeHtml(r.name)}</strong> يريد لعب <em>${escapeHtml(r.game)}</em> — <button class="btn" data-id="${r.id}" onclick="acceptRequest('${r.id}')">اقبل</button></div>`;
  }).join('');
}

async function requestGame(game){
  if(!roomRef) return alert('انضم لغرفة');
  const id = makeId();
  const ref = roomRef.child('requests/' + id);
  await ref.set({id:id,name:me.nick,code:me.code,game:game,ts:Date.now()});
}

window.acceptRequest = async function(id){
  if(!roomRef) return;
  const rSnap = await roomRef.child('requests/' + id).once('value');
  const r = rSnap.val();
  if(!r) return alert('الطلب انتهى');
  await roomRef.child('requests/' + id).remove();
  await roomRef.child('chat').push().set({name:'نظام',text:`${me.nick} قبل طلب ${r.name} للعب ${r.game}`,ts:Date.now()});
  // start session marker for everyone
  if(r.game==='xo'){ await roomRef.child('xo/session').set({active:true,startedBy:me.id,ts:Date.now()}); }
  if(r.game==='letters'){ await roomRef.child('letters/session').set({active:true,startedBy:me.id,ts:Date.now()}); }
  if(r.game==='board'){ await roomRef.child('board/session').set({active:true,startedBy:me.id,ts:Date.now()}); }
}

// ===== Board actions (award points with team names) =====
// reuse categories from localStorage or fallback
let categories = JSON.parse(localStorage.getItem('wj_categories')) || [
  {name:'عام', qs:[{v:100,q:'عاصمة فرنسا؟',a:'باريس'},{v:200,q:'أكبر محيط في العالم؟',a:'المحيط الهادي'}]}
];

async function openQuestionLocal(ci,ri, key){
  if(!roomRef) return alert('انضم لغرفة');
  const q = categories[ci].qs[ri];
  const show = confirm(`السؤال:\n${q.q}\n\nموافق لإظهار الإجابة ومنح النقاط؟`);
  if(!show) return;
  alert('الإجابة: ' + (q.a || 'لا توجد'));
  // read teams names
  const teamsSnap = await roomRef.child('teams').once('value');
  const teams = teamsSnap.val() || {team1:{name:'الفريق 1'},team2:{name:'الفريق 2'}};
  const t1name = teams.team1.name || 'الفريق 1';
  const t2name = teams.team2.name || 'الفريق 2';
  const give = prompt(`من يعطي النقاط؟ اكتب 1 لـ "${t1name}" أو 2 لـ "${t2name}" أو NONE`);
  if(give && (give==='1' || give==='2')){
    const teamKey = give==='1' ? 'team1' : 'team2';
    await roomRef.child('scores/' + teamKey).transaction(old=> (old||0) + Number(q.v));
    await roomRef.child('boardCells/' + key).set({disabled:true,by:me.id,at:Date.now()});
    await roomRef.child('chat').push().set({name:'نظام',text:`${me.nick} أعطى ${q.v} نقطة لـ ${give==='1'?t1name:t2name}`,ts:Date.now()});
  } else {
    await roomRef.child('boardCells/' + key).set({disabled:true,by:me.id,at:Date.now()});
  }
}

// ===== XO online logic (1v1 with X/O) =====
async function tryPlaceXO(idx){
  if(!roomRef) return alert('انضم لغرفة');
  const snap = await roomRef.child('xo').once('value');
  const xo = snap.val() || {board:Array(9).fill(''),turn:'X',winner:''};
  if(xo.winner) return alert('اللعبة انتهت');
  if(xo.board[idx]) return alert('الخانة مستخدمة');
  // ensure player has role X or O in room roles or prompt to claim
  let role = await ensureRoleXO();
  if(!role) return;
  if(xo.turn !== role) return alert('ليست حركتك');
  xo.board[idx] = role;
  const win = checkXOwin(xo.board);
  if(win){ xo.winner = role; xo.turn = ''; await roomRef.child('chat').push().set({name:'نظام',text:`${me.nick} (${role}) فاز في XO`,ts:Date.now()}); }
  else{ xo.turn = (xo.turn==='X')?'O':'X'; }
  await roomRef.child('xo').set(xo);
}

async function ensureRoleXO(){
  if(!roomRef) return null;
  const rolesSnap = await roomRef.child('roles').once('value');
  const roles = rolesSnap.val() || {};
  if(roles.X && roles.X.playerId === me.id) return 'X';
  if(roles.O && roles.O.playerId === me.id) return 'O';
  const claim = prompt('هل تريد المطالبة بدور X أو O؟ اكتب X أو O، أو إلغاء');
  if(!claim) return null;
  const c = claim.toUpperCase();
  if(c==='X' || c==='O'){
    await roomRef.child('roles/' + c).set({playerId:me.id,name:me.nick,claimedAt:Date.now()});
    await roomRef.child('chat').push().set({name:'نظام',text:`${me.nick} طالب الدور ${c}`,ts:Date.now()});
    return c;
  }
  return null;
}
function checkXOwin(b){ const lines=[[0,1,2],[3,4,5],[6,7,8],[0,3,6],[1,4,7],[2,5,8],[0,4,8],[2,4,6]]; for(const l of lines){ const [a,b1,c]=l; if(b[a] && b[a]===b[b1] && b[a]===b[c]) return true; } return false; }

// ===== Letters online logic (team markers) =====
const letters = ['ا','ب','ت','ث','ج','ح','خ','د','ذ','ر','ز','س','ش','ص','ض','ط','ظ','ع','غ','ف','ق','ك','ل','م','ن'];

async function markLetter(idx){
  if(!roomRef) return alert('انضم لغرفة');
  const snap = await roomRef.child('letters').once('value');
  const lettersState = snap.val() || {board:Array(25).fill(''),winner:''};
  if(lettersState.board[idx]) return alert('الخانة مستخدمة');
  // decide whether to mark as team1/team2 (team game) or as X/O if XO chosen
  // We'll use teams: team1/team2 names from DB
  const teamsSnap = await roomRef.child('teams').once('value');
  const teams = teamsSnap.val() || {team1:{name:'الفريق 1'},team2:{name:'الفريق 2'}};
  const choose = prompt(`علّم الخانة باسم أي فريق؟ اكتب 1 لـ "${teams.team1.name}" أو 2 لـ "${teams.team2.name}"`);
  if(!choose) return;
  const teamKey = choose === '1' ? 'team1' : 'team2';
  lettersState.board[idx] = teamKey;
  const win = checkLettersWin(lettersState.board);
  if(win) lettersState.winner = teamKey;
  await roomRef.child('letters').set(lettersState);
  if(win){
    await roomRef.child('chat').push().set({name:'نظام',text:`${me.nick} فاز مع ${teams[teamKey].name}`,ts:Date.now()});
  }
}

function checkLettersWin(board){
  const N = 5;
  for(let r=0;r<N;r++){
    const base = r*N;
    const first = board[base];
    if(first && board[base+1]===first && board[base+2]===first && board[base+3]===first && board[base+4]===first) return true;
  }
  for(let c=0;c<N;c++){
    const first = board[c];
    if(first && board[c+N]===first && board[c+2*N]===first && board[c+3*N]===first && board[c+4*N]===first) return true;
  }
  return false;
}

// ===== Team claiming (for team games) =====
async function claimTeam(teamKey){
  if(!roomRef) return alert('انضم لغرفة أولاً');
  if(!(teamKey==='team1' || teamKey==='team2')) return;
  // set roles/team assignments
  await roomRef.child('roles/' + teamKey).set({playerId:me.id,name:me.nick,claimedAt:Date.now()});
  await roomRef.child('chat').push().set({name:'نظام',text:`${me.nick} انضم كـ ${teamKey}`,ts:Date.now()});
  alert('تم الانضمام إلى ' + teamKey);
}

// ===== Utilities for UI pages =====
function showGames(){ landing.style.display = 'none'; gamesPage.style.display = 'block'; }
function showLanding(){ landing.style.display = 'block'; gamesPage.style.display = 'none'; }

// expose some helpers used by inline onclick in HTML
window.requestGame = requestGame;
window.openQuestionLocal = openQuestionLocal;
window.tryPlaceXO = tryPlaceXO;
window.markLetter = markLetter;
window.claimTeam = claimTeam;

// init
console.log('app.js loaded');
