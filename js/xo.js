// XO Game Logic (لاعب ضد لاعب)
function startXOSession(sess) {
  const initState = { 
    board: Array(9).fill(''), 
    turn: 'X', 
    winner: '' 
  };
  roomRef.child('sessions/xo').set({ active:true, startedBy: me.id, state:initState });
}

function openXOModal() {
  const modal = document.getElementById('xoModal');
  modal.style.display = 'flex';
  renderXOGrid();
  roomRef.child('sessions/xo/state').on('value', snap=>{
    const state = snap.val();
    if(!state) return;
    renderXOGrid(state);
    if(state.winner) alert(`انتهت اللعبة! الفائز: ${state.winner}`);
  });
}

function renderXOGrid(state={board:Array(9).fill(''), turn:'X'}) {
  const grid = document.getElementById('xoGrid');
  grid.innerHTML = '';
  state.board.forEach((cell,i)=>{
    const d = document.createElement('div');
    d.className = 'xoCell';
    d.innerText = cell;
    d.onclick = ()=> clickXOCell(i,state);
    grid.appendChild(d);
  });
}

function clickXOCell(i,state) {
  if(state.winner || state.board[i]) return;
  let myRole = null;
  roomRef.child('sessions/xo/roles').once('value').then(snap=>{
    const roles = snap.val()||{};
    for(const role in roles){ if(roles[role].playerId===me.id) myRole=role; }
    if(!myRole) return;
    if(state.turn !== myRole) return;
    state.board[i] = myRole;
    state.turn = myRole==='X'?'O':'X';
    if(checkXOwin(state.board)) state.winner=myRole;
    roomRef.child('sessions/xo/state').set(state);
  });
}

function checkXOwin(b){
  const lines=[[0,1,2],[3,4,5],[6,7,8],[0,3,6],[1,4,7],[2,5,8],[0,4,8],[2,4,6]];
  return lines.some(line=>line.every(i=>b[i]&&b[i]===b[line[0]]));
}
