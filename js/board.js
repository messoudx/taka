const boardArea = document.getElementById('boardArea');
const boardStatus = document.getElementById('boardStatus');

function renderBoard() {
  boardArea.innerHTML = '';
  const categories = [
    { name: 'عام', qs: [{ v: 100, q: 'ما عاصمة فرنسا؟' }, { v: 200, q: 'أين الأهرامات؟' }] },
    { name: 'أنمي', qs: [{ v: 100, q: 'من بطل ناروتو؟' }, { v: 200, q: 'من بطل ون بيس؟' }] }
  ];
  categories.forEach(cat => {
    const col = document.createElement('div');
    col.className = 'catCard';
    const h = document.createElement('div');
    h.style.fontWeight = '900';
    h.innerText = cat.name;
    col.appendChild(h);
    const values = document.createElement('div');
    values.style.marginTop = '8px';
    cat.qs.forEach(q => {
      const pill = document.createElement('div');
      pill.className = 'valuePill';
      pill.innerText = q.v;
      pill.title = q.q;
      values.appendChild(pill);
    });
    col.appendChild(values);
    boardArea.appendChild(col);
  });
  boardStatus.innerText = 'جاهز للعب!';
}

document.addEventListener('DOMContentLoaded', renderBoard);
