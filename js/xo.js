const xoGrid = document.getElementById('xoGrid');
const turnInfo = document.getElementById('xoTurnInfo');

function renderXO() {
  xoGrid.innerHTML = '';
  for (let i = 0; i < 9; i++) {
    const cell = document.createElement('div');
    cell.className = 'xoCell';
    cell.innerText = '؟';
    xoGrid.appendChild(cell);
  }
  turnInfo.innerText = 'جاهز للعب!';
}

document.addEventListener('DOMContentLoaded', renderXO);
