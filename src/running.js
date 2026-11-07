import { initChrome } from './chrome.js';

const hero = document.querySelector('.run-hero');
initChrome({ lightFrom: () => hero.offsetHeight - 60 });   // the video hero is dark; white starts below it

const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
if (reduceMotion) document.querySelectorAll('video').forEach((v) => { v.removeAttribute('autoplay'); v.pause(); });
if (reduceMotion) document.querySelectorAll('video[data-inview]').forEach((v) => { v.controls = true; });   // play it yourself
// the Strava flyover sits further down: it loads and plays only once it's on screen
// (saves ~2 MB on phones that never scroll that far)
const inview = document.querySelectorAll('video[data-inview]');
if (!reduceMotion && 'IntersectionObserver' in window) {
  const io = new IntersectionObserver((entries) => entries.forEach((e) => {
    if (e.isIntersecting) e.target.play().catch(() => {}); else e.target.pause();
  }), { threshold: 0.25 });
  inview.forEach((v) => io.observe(v));
}

// ---------- the road ----------
// The stage is pinned while .road scrolls past. Scroll progress p (0 to 1) slides the
// track left under a runner who stays put. Running through a finished race's arch pops a
// medal (+1) and lights one up in the tally. He stops just short of the 2027 arch, with
// New York just beyond it.
const road = document.querySelector('.road');
const stage = road.querySelector('.road-stage');
const track = road.querySelector('.track');
const runner = road.querySelector('.runner');
const stops = [...road.querySelectorAll('.stop')];
const tally = [...road.querySelectorAll('.tally img')];
const fired = new Set();

let geo = null;
function layout() {
  const vw = stage.clientWidth;
  const runnerX = vw * (vw < 760 ? 0.3 : 0.24);   // matches .runner's left in running.css
  const start = vw * (vw < 760 ? 0.9 : 0.7);
  const gap = Math.max(vw * (vw < 760 ? 0.95 : 0.6), 300);
  const xs = stops.map((_, i) => start + i * gap);
  stops.forEach((s, i) => s.style.setProperty('--x', `${xs[i]}px`));
  const last = xs[xs.length - 1];
  const archHalf = vw < 760 ? 70 : 90;
  const end = last - archHalf - runner.offsetWidth / 2 - 40 - runnerX;   // where he stops: just short of the 2027 arch
  track.style.setProperty('--track-w', `${last + vw * 1.5}px`);
  const city = track.querySelector('.horizon');
  const cityX = last + archHalf + 60;
  city.style.setProperty('--city-x', `${cityX}px`);   // New York, just past 2027
  // the run road ends just ahead of where he stops
  track.querySelector('.future').style.setProperty('--future-x', `${runnerX + end + runner.offsetWidth / 2 + 16}px`);
  // narrow screens can't fit New York beside him: after he stops, the view pans on to it
  const pan = Math.max(0, cityX + city.offsetWidth - end - (vw - 16));
  geo = { vw, runnerX, xs, end, pan, runFor: pan ? 0.78 : 1 };
}

function celebrate(stop) {
  const coin = document.createElement('div');
  coin.className = 'coin';
  coin.innerHTML = '<img src="/running/emoji/medal.png" alt="" /><b>+1</b>';
  stop.appendChild(coin);
  setTimeout(() => coin.remove(), 1200);

  const box = document.createElement('div');
  box.className = 'confetti';
  const colours = ['#f2734f', '#3f6fd8', '#e0b04a', '#1d2457', '#fc4c02'];
  for (let i = 0; i < 24; i++) {
    const c = document.createElement('i');
    const a = (Math.random() * 140 + 20) * (Math.PI / 180);   // fan upwards
    const d = 60 + Math.random() * 110;
    c.style.setProperty('--c', colours[i % colours.length]);
    c.style.setProperty('--dx', `${Math.cos(a) * d}px`);
    c.style.setProperty('--dy', `${-Math.sin(a) * d}px`);
    c.style.setProperty('--r', `${Math.random() * 540 - 270}deg`);
    box.appendChild(c);
  }
  stop.appendChild(box);
  setTimeout(() => box.remove(), 1400);
}

let lastY = scrollY, idle = 0;
function update() {
  if (!geo) return;
  const span = road.offsetHeight - stage.offsetHeight;
  const p = Math.min(1, Math.max(0, (scrollY - road.offsetTop) / span));
  const travelled = Math.min(1, p / geo.runFor) * geo.end;
  const panned = geo.pan && p > geo.runFor ? ((p - geo.runFor) / (1 - geo.runFor)) * geo.pan : 0;
  track.style.setProperty('--tx', `${-(travelled + panned)}px`);
  runner.style.setProperty('--pan', `${-panned}px`);   // he stays where he stopped on the road
  stage.style.setProperty('--hx', `${-travelled * 0.15}px`);
  stage.style.setProperty('--travel', `${travelled}px`);

  const at = geo.runnerX + travelled;   // the runner's position on the track
  let medals = 0;
  stops.forEach((s, i) => {
    const passed = geo.xs[i] <= at && !s.classList.contains('is-next');
    s.classList.toggle('is-passed', passed);
    s.classList.toggle('is-near', Math.abs(geo.xs[i] - at) < geo.vw * 0.45);
    if (passed) medals += 1;
    if (passed && !fired.has(i) && !reduceMotion) { fired.add(i); celebrate(s); }
  });
  tally.forEach((m, i) => m.classList.toggle('on', i < medals));
  road.classList.toggle('is-moving', p > 0.02);
  road.classList.toggle('is-arrived', p > geo.runFor - 0.015);
}

addEventListener('scroll', () => {
  const dy = scrollY - lastY;
  lastY = scrollY;
  const r = road.getBoundingClientRect();
  const inRoad = r.top <= 0 && r.bottom >= innerHeight;
  if (inRoad && dy !== 0 && !reduceMotion && !road.classList.contains('is-arrived')) {
    runner.classList.add('is-running');
    // faster scroll, quicker strides
    const stride = Math.min(0.8, Math.max(0.36, 0.8 - Math.abs(dy) / 120));
    runner.style.setProperty('--stride', `${stride.toFixed(2)}s`);
    runner.style.setProperty('--face', dy < 0 ? -1 : 1);   // scroll back up and he turns round
    clearTimeout(idle);
    idle = setTimeout(() => { runner.classList.remove('is-running'); runner.style.setProperty('--face', 1); }, 180);
  }
  requestAnimationFrame(update);
}, { passive: true });
addEventListener('resize', () => { layout(); update(); });
addEventListener('load', () => { layout(); update(); });   // runner width is known once its image loads
layout();
update();
