import { createSilk } from './silk.js';
import { initChrome } from './chrome.js';
import { photos } from './photos.js';
import { initReel } from './reel.js';
import { paper } from './theme.js';

const hero = document.querySelector('.hero');
const silk = createSilk({
  canvas: document.getElementById('field'),
  hero,
  anchor: document.querySelector('.headline'),
  photos,
  paper: paper(),
});
addEventListener('themechange', () => silk.setPaper(paper()));
initChrome({ lightFrom: () => hero.offsetHeight * silk.fade()[0] - 40 });
initReel(document.querySelector('.reel'));
// make sure the highlights video starts: nudge it once it can play, and again on the first touch
// or scroll (some phones only allow it after that)
const hv = document.querySelector('.panel--video video');
if (hv && !matchMedia('(prefers-reduced-motion: reduce)').matches) {
  const kick = () => { if (hv.paused) hv.play().catch(() => {}); };
  hv.addEventListener('canplay', kick, { once: true });
  kick();
  addEventListener('touchstart', kick, { once: true, passive: true });
  addEventListener('scroll', kick, { once: true, passive: true });
}
// reduced motion: the card videos stay on their posters
if (matchMedia('(prefers-reduced-motion: reduce)').matches) document.querySelectorAll('.reel video').forEach((v) => { v.removeAttribute('autoplay'); v.pause(); });
