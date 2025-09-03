// Board Quiz (فرق)
const categories = {
  "رياضة":[{q:"كم عدد لاعبي كرة السلة؟",a:"5",v:10}],
  "تاريخ":[{q:"في أي عام بدأت الحرب العالمية الثانية؟",a:"1939",v:20}]
};

function startBoardSession(sess){
  const state={cells:{},scores:{team1:0,team2:0}};
  roomRef.child('sessions/board').set({active:true,startedBy:me.id,state});
}

function openBoardModal(){
  const modal=document.getElementById('boardModal');
  modal.style.display='flex';
  renderBoardUI();
  roomRef.child('sessions/board/state').on('value',snap=>{
    const state=snap.val(); if(!state) return;
    renderBoardUI(state);
  });
}

function renderBoardUI(state={cells:{},scores:{team1:0,team2:0}}){
  const grid=document.getElementById('boardGrid'); grid.innerHTML='';
  for(const cat in categories){
    categories[cat].forEach((qObj,idx)=>{
      const key=cat+"_"+idx;
      const cell=document.createElement('div');
      cell.className='boardCell';
      cell.innerText=qObj.v;
      if(state.cells[key]) cell.style.background='gray';
      cell.onclick=()=>openQuestionModal(cat,idx,key,qObj,state);
      grid.appendChild(cell);
    });
  }
  document.getElementById('scoreTeam1').innerText=state.scores.team1||0;
  document.getElementById('scoreTeam2').innerText=state.scores.team2||0;
}

function openQuestionModal(cat,idx,key,qObj,state){
  if(state.cells[key]) return;
  const ans=prompt(qObj.q);
  if(ans && ans.toLowerCase()===qObj.a.toLowerCase()){
    const myTeam = (Math.random()>0.5?'team1':'team2'); 
    roomRef.child('sessions/board/state/scores/'+myTeam)
      .transaction(old=>(old||0)+qObj.v);
  }
  roomRef.child('sessions/board/state/cells/'+key).set(true);
}
