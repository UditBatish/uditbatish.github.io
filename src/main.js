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
// fade the highlights video in once it's really playing (its poster shows underneath until then)
const hv = document.querySelector('.panel--video video');
if (hv) {
  const shown = () => hv.classList.add('is-playing');
  if (!hv.paused && hv.readyState >= 3) shown();
  else hv.addEventListener('playing', shown, { once: true });
}
// reduced motion: the card videos stay on their posters
if (matchMedia('(prefers-reduced-motion: reduce)').matches) document.querySelectorAll('.reel video').forEach((v) => { v.removeAttribute('autoplay'); v.pause(); });
