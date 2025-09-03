// Letters 5x5 (فريق ضد فريق)
function startLettersSession(sess){
  const initState = { 
    board: Array(25).fill(''), 
    winner:'' 
  };
  roomRef.child('sessions/letters').set({ active:true, startedBy:me.id, state:initState });
}

function openLettersModal(){
  const modal=document.getElementById('lettersModal');
  modal.style.display='flex';
  renderLettersGrid();
  roomRef.child('sessions/letters/state').on('value',snap=>{
    const state=snap.val(); 
    if(!state) return;
    renderLettersGrid(state);
    if(state.winner) alert(`انتهت اللعبة! الفائز: ${state.winner}`);
  });
}

function renderLettersGrid(state={board:Array(25).fill('')}){
  const grid=document.getElementById('lettersGrid');
  grid.innerHTML='';
  state.board.forEach((cell,i)=>{
    const d=document.createElement('div');
    d.className='letterCell';
    d.innerText=cell||String.fromCharCode(65+i);
    d.onclick=()=>clickLetterCell(i,state);
    grid.appendChild(d);
  });
}

function clickLetterCell(i,state){
  if(state.winner||state.board[i]) return;
  // تحديد الفريق من DB
  roomRef.child('sessions/letters/teams').once('value').then(snap=>{
    const teams=snap.val()||{};
    let myTeam=null;
    for(const t in teams){
      if(teams[t].includes(me.id)) myTeam=t;
    }
    if(!myTeam) return;
    state.board[i]=myTeam==='team1'?'A':'B';
    if(checkLettersWin(state.board)) state.winner=myTeam;
    roomRef.child('sessions/letters/state').set(state);
  });
}

function checkLettersWin(board,N=5){
  for(let r=0;r<N;r++){
    const row=board.slice(r*N,r*N+N);
    if(row.every(v=>v&&v===row[0])) return true;
  }
  for(let c=0;c<N;c++){
    const col=[...Array(N)].map((_,i)=>board[i*N+c]);
    if(col.every(v=>v&&v===col[0])) return true;
  }
  return false;
}
