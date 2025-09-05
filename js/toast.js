// js/toast.js (module)
export function showToast(text, ttl=4000){
  const container = document.getElementById('toastContainer');
  if(!container) return;
  const el = document.createElement('div'); el.className='toast'; el.innerText = text;
  container.appendChild(el);
  setTimeout(()=>{ el.style.opacity='0'; el.style.transform='translateY(-8px)'; setTimeout(()=>el.remove(),350); }, ttl);
}

// expose globally for simple use
window.showToast = showToast;
