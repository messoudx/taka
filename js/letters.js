const lettersGrid = document.getElementById('lettersGrid');
const statusEl = document.getElementById('lettersStatus');
const letters = ['ا','ب','ت','ث','ج','ح','خ','د','ذ','ر','ز','س','ش','ص','ض','ط','ظ','ع','غ','ف','ق','ك','ل','م','ن'];

function renderGrid() {
  lettersGrid.innerHTML = '';
  for (let i = 0; i < 25; i++) {
    const el = document.createElement('div');
    el.className = 'hex';
    el.innerText = letters[i];
    lettersGrid.appendChild(el);
  }
  statusEl.innerText = 'جاهز للعب!';
}

document.addEventListener('DOMContentLoaded', renderGrid);
