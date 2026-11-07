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
// reduced motion: the card videos stay on their posters
if (matchMedia('(prefers-reduced-motion: reduce)').matches) document.querySelectorAll('.reel video').forEach((v) => { v.removeAttribute('autoplay'); v.pause(); });
