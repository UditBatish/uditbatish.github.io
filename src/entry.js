import { initChrome } from './chrome.js';

// Standalone entry page (e.g. /experience/z21/ opened directly or shared).
initChrome({ lightFrom: () => 0 });   // no colour band here: over the light theme the header goes light at once

// photos open full screen here too
document.addEventListener('click', (e) => {
  const img = e.target.closest('.e-photos img');
  if (!img) return;
  const lb = document.createElement('dialog');
  lb.className = 'lb';
  lb.innerHTML = `<button class="ov-close" aria-label="Close photo">×</button><img src="${img.src}" alt="${img.alt}" />`;
  document.body.appendChild(lb);
  lb.addEventListener('click', () => lb.close());
  lb.addEventListener('close', () => lb.remove());
  lb.showModal();
});
