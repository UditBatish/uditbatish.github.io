import { createSilk } from './silk.js';
import { initChrome } from './chrome.js';
import { initOverlays } from './overlay.js';
import { initReel } from './reel.js';
import { paper } from './theme.js';

const hero = document.querySelector('.hero');
const silk = createSilk({
  canvas: document.getElementById('field'),
  hero,
  anchor: document.querySelector('.headline'),
  paper: paper(),
});
addEventListener('themechange', () => silk.setPaper(paper()));
initChrome({ lightFrom: () => hero.offsetHeight * silk.fade()[0] - 40 });
initOverlays();

initReel(document.querySelector('.reel'));
