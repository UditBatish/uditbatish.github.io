import { initChrome } from './chrome.js';
import { photos } from './photography-data.js';

initChrome({ lightFrom: () => -1 });   // light paper from the top, so the header starts light

// ---------- the pile ----------
// Every photo is a print on the desk. "Mess" scatters them (a loose grid with jitter and a
// tilt, so they overlap but each one still shows); "tidy" lines them up in columns. Prints
// can be dragged around in either; a tap (no drag) opens the lightbox. On touch screens a
// short press picks a print up, so a plain swipe still scrolls the page.
const desk = document.querySelector('.desk');
const tidyBtn = document.querySelector('[data-act="tidy"]');
const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;

const TAPES = ['#f2734f', '#3f6fd8', '#e0b04a', '#7fc8a9'];
const prints = photos.map((p, i) => {
  const el = document.createElement('button');
  el.type = 'button';
  el.className = 'print';
  el.style.setProperty('--ar', `${p.w} / ${p.h}`);
  el.setAttribute('aria-label', [p.place, p.when].filter(Boolean).join(', ') || 'Photo');
  el.innerHTML =
    `<img src="/photography/${p.id}-s.jpg" alt="" loading="${i < 12 ? 'eager' : 'lazy'}" decoding="async" draggable="false" />` +
    `<span class="cap">${p.place ? `<b>${p.place}</b>` : ''}<i>${p.when}</i></span>`;
  if (i % 3 === 1) {
    const tape = document.createElement('span');
    tape.className = 'tape';
    tape.style.setProperty('--tc', TAPES[i % TAPES.length]);
    tape.style.setProperty('--ta', `${(i * 37) % 24 - 12}deg`);
    el.appendChild(tape);
  }
  desk.appendChild(el);
  return { el, p, x: 0, y: 0, r: 0, w: 0 };
});

// a small seeded random, so the mess stays the same on resize until you shuffle
let seed = 21;
const rand = (s) => () => ((s = (s * 16807) % 2147483647) / 2147483647);

let tidy = false;
let top = prints.length;
function place(pr) {
  pr.el.style.width = `${pr.w}px`;
  pr.el.style.transform = `translate(${pr.x}px, ${pr.y}px) rotate(${pr.r}deg)`;
}
// photo + white border + caption (sizes match photography.css)
const frameH = (pr, w) => { const b = innerWidth <= 640 ? 12 : 16; return (w - b) * (pr.p.h / pr.p.w) + b / 2 + (b === 12 ? 30 : 36); };

function layout() {
  const W = desk.clientWidth;
  let height = 0;
  if (tidy) {
    const gap = W < 600 ? 12 : 22;
    const cols = Math.max(2, Math.floor((W + gap) / (W < 600 ? 150 : 228)));
    const colW = (W - gap * (cols - 1)) / cols;
    const ys = Array(cols).fill(0);
    prints.forEach((pr) => {
      const c = ys.indexOf(Math.min(...ys));
      pr.w = colW; pr.x = c * (colW + gap); pr.y = ys[c]; pr.r = 0;
      ys[c] += frameH(pr, colW) + gap;
      pr.el.style.zIndex = '';
    });
    height = Math.max(...ys);
  } else {
    const r = rand(seed);
    const pw = W < 600 ? 136 : W < 1000 ? 176 : 206;
    const cols = Math.max(2, Math.floor(W / (pw * 0.8)));
    const step = (W - pw) / (cols - 1);
    const order = prints.map((_, i) => i).sort(() => r() - 0.5);
    const ys = Array(cols).fill(0);
    order.forEach((idx, k) => {
      const pr = prints[idx];
      const c = k % cols;
      pr.w = pw * (0.92 + r() * 0.16);
      pr.x = Math.min(W - pr.w, Math.max(0, c * step + (r() - 0.5) * step * 0.5));
      pr.y = ys[c] + (r() - 0.3) * 40;
      pr.r = (r() - 0.5) * 18;
      ys[c] += frameH(pr, pr.w) * (0.5 + r() * 0.15);   // overlap the one above by about half
      pr.el.style.zIndex = k + 1;
      height = Math.max(height, pr.y + frameH(pr, pr.w));
    });
  }
  desk.style.height = `${Math.ceil(height + 40)}px`;
  prints.forEach(place);
}

// first paint: the prints drop onto the desk one after another
layout();
if (!reduceMotion) {
  desk.classList.add('is-dropping');
  prints.forEach((pr, i) => { pr.el.style.transitionDelay = `${Math.min(i, 30) * 35}ms`; });
  requestAnimationFrame(() => requestAnimationFrame(() => {
    desk.classList.remove('is-dropping');
    setTimeout(() => prints.forEach((pr) => { pr.el.style.transitionDelay = ''; }), 1600);
  }));
}

document.querySelector('[data-act="shuffle"]').addEventListener('click', () => {
  tidy = false;
  tidyBtn.textContent = 'Tidy up';
  seed = Math.floor(Math.random() * 1e6) + 1;
  layout();
});
tidyBtn.addEventListener('click', () => {
  tidy = !tidy;
  tidyBtn.textContent = tidy ? 'Make a mess' : 'Tidy up';
  if (!tidy) seed = Math.floor(Math.random() * 1e6) + 1;
  layout();
});
// re-spread when the desk changes width (window resize, phone rotation)
let lastW = desk.clientWidth;
let resizeT = 0;
new ResizeObserver(() => {
  clearTimeout(resizeT);
  resizeT = setTimeout(() => { if (desk.clientWidth !== lastW) { lastW = desk.clientWidth; layout(); } }, 120);
}).observe(desk);

// ---------- drag, tap ----------
let held = null;
prints.forEach((pr, i) => {
  const el = pr.el;
  el.addEventListener('pointerdown', (ev) => {
    if (ev.button !== 0) return;
    const start = { x: ev.clientX, y: ev.clientY, px: pr.x, py: pr.y };
    let moved = false;
    let picked = ev.pointerType !== 'touch';   // touch: picked up after a short press
    const pick = () => {
      picked = true;
      held = pr;
      el.style.zIndex = ++top;
      el.classList.add('is-held');
    };
    if (picked) pick();
    const timer = picked ? 0 : setTimeout(pick, 380);   // about iOS's own long-press, so a slow scroll isn't mistaken for a grab
    el.setPointerCapture(ev.pointerId);

    const move = (e) => {
      const dx = e.clientX - start.x, dy = e.clientY - start.y;
      if (!picked) { if (Math.hypot(dx, dy) > 8) end(e, true); return; }
      if (!moved && Math.hypot(dx, dy) < 5) return;
      moved = true;
      pr.x = start.px + dx; pr.y = start.py + dy;
      el.style.transform = `translate(${pr.x}px, ${pr.y}px) rotate(${pr.r}deg) scale(1.06)`;
    };
    const end = (e, cancelled = false) => {
      clearTimeout(timer);
      el.removeEventListener('pointermove', move);
      el.removeEventListener('pointerup', up);
      el.removeEventListener('pointercancel', cancel);
      el.classList.remove('is-held');
      held = null;
      if (moved) {
        pr.r += (Math.random() - 0.5) * 6;   // set down a little crooked
        pr.x = Math.min(desk.clientWidth - pr.w * 0.4, Math.max(-pr.w * 0.6, pr.x));
        pr.y = Math.max(-40, pr.y);
        place(pr);
      } else {
        place(pr);
        if (!cancelled && e.type === 'pointerup') openLightbox(i);
      }
    };
    const up = (e) => end(e);
    const cancel = (e) => end(e, true);
    el.addEventListener('pointermove', move);
    el.addEventListener('pointerup', up);
    el.addEventListener('pointercancel', cancel);
  });
  // keyboard: Enter / Space opens it (pointer taps are handled above)
  el.addEventListener('click', (ev) => { if (ev.detail === 0) openLightbox(i); });
});
// while a print is held on a touch screen, the page must not scroll under the finger
desk.addEventListener('touchmove', (ev) => { if (held) ev.preventDefault(); }, { passive: false });

// ---------- lightbox ----------
const lb = document.querySelector('.lb');
const lbImg = lb.querySelector('img');
let current = 0;
function show(i) {
  current = (i + photos.length) % photos.length;
  const p = photos[current];
  lbImg.src = `/photography/${p.id}-s.jpg`;   // the small one is cached: show it at once, then swap in the big one
  const big = new Image();
  big.onload = () => { if (photos[current] === p) lbImg.src = big.src; };
  big.src = `/photography/${p.id}.jpg`;
  lbImg.alt = [p.place, p.when].filter(Boolean).join(', ');
  lb.querySelector('.lb-place').textContent = p.place;
  lb.querySelector('.lb-when').textContent = p.when;
  lb.style.setProperty('--ar', `${p.w} / ${p.h}`);
}
function openLightbox(i) {
  show(i);
  if (!lb.open) lb.showModal();
}
lb.querySelector('.lb-prev').addEventListener('click', () => show(current - 1));
lb.querySelector('.lb-next').addEventListener('click', () => show(current + 1));
lb.querySelector('.lb-close').addEventListener('click', () => lb.close());
lb.addEventListener('click', (ev) => { if (ev.target === lb) lb.close(); });   // backdrop
lb.addEventListener('keydown', (ev) => {
  if (ev.key === 'ArrowLeft') show(current - 1);
  if (ev.key === 'ArrowRight') show(current + 1);
});
// swipe left / right on the photo
let sx = null;
lbImg.addEventListener('pointerdown', (ev) => { sx = ev.clientX; });
lbImg.addEventListener('pointercancel', () => { sx = null; });
lbImg.addEventListener('pointerup', (ev) => {
  if (sx === null) return;
  const dx = ev.clientX - sx;
  sx = null;
  if (Math.abs(dx) > 40) show(current + (dx < 0 ? 1 : -1));
});
