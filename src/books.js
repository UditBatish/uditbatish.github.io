import { createSilk } from './silk.js';
import { initChrome } from './chrome.js';
import { shelves } from './books-data.js';
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

// ---------- sizes ----------
// Spine height follows the cover's shape; thickness follows page count.
const SPINE_H = 290;
const heightOf = (b) => Math.round(SPINE_H * Math.min(1.1, Math.max(0.9, b.aspect / 1.5)));
const thickOf = (b) => Math.round(16 + b.pages * 0.1);

const all = shelves.flatMap((s) => s.books.map((b) => ({ ...b, shelf: s.name })));
const byId = Object.fromEntries(all.map((b) => [b.id, b]));
const esc = (t) => t.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

// Top shelf is favorites; the rest follow in data order
const favorites = shelves[0].books.map((b) => b.id);
const rest = shelves.slice(1).flatMap((s) => s.books.map((b) => b.id));
const order = [...favorites, ...rest];   // reading order for prev/next

function bookVars(b, scale = 1) {
  const h = heightOf(b) * scale;
  return `--h:${h}px;--w:${Math.round(h / b.aspect)}px;--d:${Math.round(thickOf(b) * scale)}px;` +
    `--spine:${b.spine};--accent:${b.accent};--ink:${b.ink}`;
}

function book3d(b, scale) {
  return `<div class="book3d" style="${bookVars(b, scale)}">
      <div class="b-cover"><img src="${b.cover}" alt="" loading="lazy" /></div>
      <div class="b-spine"><span>${esc(b.title)}</span></div>
      <div class="b-pages"></div>
      <div class="b-back"></div>
    </div>`;
}

// ---------- render ----------
// Covers face out, a row per shelf. Rows are re-cut to fit the width.
const root = document.querySelector('.shelves');
let perRow = 0;

// Split ids into rows of at most `max`, evened out so no shelf holds a lone book
function cut(ids, max) {
  const n = Math.ceil(ids.length / Math.ceil(ids.length / max));
  const rows = [];
  for (let i = 0; i < ids.length; i += n) rows.push(ids.slice(i, i + n));
  return rows;
}

function render() {
  const narrow = innerWidth < 640;
  const gap = narrow ? 14 : 34, pad = narrow ? 24 : 72;
  const widest = Math.max(...all.map((b) => heightOf(b) / b.aspect));   // cover width at scale 1
  // phones: at least three books a shelf, so covers shrink to fit three across
  const scale = narrow ? Math.min(0.44, ((root.clientWidth - pad - gap * 2) / 3 - 10) / widest) : 0.6;
  const coverW = widest * scale + 10;   // + page edge
  const max = Math.max(narrow ? 3 : 2, Math.min(6, Math.floor((root.clientWidth - pad + gap) / (coverW + gap))));
  const key = `${max}:${scale.toFixed(3)}`;   // re-cut only when the row count or cover size changes
  if (key === perRow) return;
  perRow = key;
  const rows = [
    ...cut(favorites, max).map((ids, i) => ({ ids, fav: true, plaque: i === 0 })),
    ...cut(rest, max).map((ids) => ({ ids })),
  ];
  root.innerHTML = rows.map((r) => `
    <div class="shelf${r.fav ? ' is-fav' : ''}${r.plaque ? ' has-plaque' : ''}">
      ${r.plaque ? '<div class="plaque"><span>Favourites</span></div>' : ''}
      <div class="shelf-row">
        ${r.ids.map((id) => {
          const b = byId[id];
          return `<button class="book" data-id="${id}" aria-label="${esc(b.title)} by ${esc(b.author)}">${book3d(b, scale)}</button>`;
        }).join('')}
      </div>
      <div class="board" aria-hidden="true"></div>
    </div>`).join('');
}
render();
addEventListener('resize', render);

// ---------- detail ----------
const modal = document.querySelector('.book-modal');
const mBook = modal.querySelector('.bm-book');
let current = -1;
let lastSpine = null;

function fill(b) {
  mBook.setAttribute('style', bookVars(b, 1.45));
  mBook.querySelector('img').src = b.cover;
  mBook.querySelector('img').alt = `Cover of ${b.title}`;
  mBook.querySelector('.b-spine').innerHTML = `<span>${esc(b.title)}</span>`;
  modal.querySelector('.bm-title').textContent = b.title;
  modal.querySelector('.bm-subtitle').textContent = b.subtitle;
  modal.querySelector('.bm-author').textContent = `by ${b.author}`;
  const note = modal.querySelector('.bm-note');
  note.textContent = b.note;
  note.hidden = !b.note;
  modal.querySelector('.bm-link').href = `https://www.goodreads.com/search?q=${encodeURIComponent(`${b.title} ${b.author.split(',')[0]}`)}`;
}

// while the book is open, the page behind it is out of reach (keyboard and screen readers)
const behind = document.querySelectorAll('body > header, body > main');
let closeTimer = 0;
let isOpen = false;   // set at once (the is-open class waits a frame for the animation)

function open(id) {
  clearTimeout(closeTimer);   // reopened before the close finished
  const first = !isOpen;
  isOpen = true;
  current = order.indexOf(id);
  const b = byId[id];
  if (lastSpine) lastSpine.classList.remove('is-out');
  lastSpine = root.querySelector(`.book[data-id="${id}"]`);
  lastSpine?.classList.add('is-out');
  fill(b);
  modal.hidden = false;
  document.body.classList.add('modal-open');
  // restart the pull-out turn
  mBook.classList.remove('turn-in');
  void mBook.offsetWidth;
  mBook.classList.add('turn-in');
  requestAnimationFrame(() => modal.classList.add('is-open'));
  behind.forEach((el) => { el.inert = true; });
  if (first) modal.querySelector('.bm-close').focus({ preventScroll: true });   // stepping keeps focus on the arrow
}

function close() {
  if (!isOpen) return;
  isOpen = false;
  modal.classList.remove('is-open');
  document.body.classList.remove('modal-open');
  behind.forEach((el) => { el.inert = false; });
  const spine = lastSpine;
  closeTimer = setTimeout(() => {
    modal.hidden = true;
    spine?.classList.remove('is-out');
    spine?.focus({ preventScroll: true });
  }, 380);
}

function step(d) {
  open(order[(current + d + order.length) % order.length]);
}
// swipe the cover left / right for the next book
let swipeX = null;
const stage = modal.querySelector('.bm-stage');
stage.addEventListener('pointerdown', (ev) => { swipeX = ev.clientX; });
stage.addEventListener('pointercancel', () => { swipeX = null; });
stage.addEventListener('pointerup', (ev) => {
  if (swipeX === null) return;
  const dx = ev.clientX - swipeX;
  swipeX = null;
  if (Math.abs(dx) > 40) step(dx < 0 ? 1 : -1);
});

root.addEventListener('click', (ev) => {
  const btn = ev.target.closest('.book');
  if (btn) open(btn.dataset.id);
});
modal.addEventListener('click', (ev) => { if (ev.target.closest('[data-close]')) close(); });
modal.querySelector('.bm-prev').addEventListener('click', () => step(-1));
modal.querySelector('.bm-next').addEventListener('click', () => step(1));
addEventListener('keydown', (ev) => {
  if (!isOpen) return;
  if (ev.key === 'Escape') close();
  if (ev.key === 'ArrowRight') step(1);
  if (ev.key === 'ArrowLeft') step(-1);
});

// Deep link: /books/#chip-war opens that book
const fromHash = () => { const id = location.hash.slice(1); if (byId[id]) open(id); };
addEventListener('hashchange', fromHash);
fromHash();
