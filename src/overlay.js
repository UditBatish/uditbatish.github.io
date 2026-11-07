// Modal routes. A link with data-open="work" or "side" points at a real page
// (e.g. /experience/z21/). Clicked from here, that page's <article data-entry> opens
// in a <dialog> and the URL changes; back, Esc, the close button or a click outside
// closes it. Visited directly, the page renders on its own.
//   work: a full page that rises from below, the index sinking back behind it
//   side: a page that slides in from the right
// Photos inside an entry open in a nested lightbox (layer 3).

const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
const cache = new Map();
const home = { url: location.pathname + location.search, title: document.title };

let dlg = null;         // the open overlay
let opener = null;      // link to return focus to
let pushed = false;     // whether we added a history entry
let openUrl = null;     // the entry currently open
let seq = 0;            // latest open() call, so a double tap doesn't open twice

async function load(url) {
  if (!cache.has(url)) {
    cache.set(url, fetch(url).then((r) => {
      if (!r.ok) throw new Error(r.status);
      return r.text();
    }).then((html) => {
      const doc = new DOMParser().parseFromString(html, 'text/html');
      return { article: doc.querySelector('article[data-entry]'), title: doc.title };
    }).catch(() => {   // offline or a bad response: forget it, and let the link navigate normally
      cache.delete(url);
      return {};
    }));
  }
  return cache.get(url);
}

function lockScroll(on) {
  const sb = innerWidth - document.documentElement.clientWidth;
  document.documentElement.style.overflow = on ? 'hidden' : '';
  document.body.style.paddingRight = on && sb ? `${sb}px` : '';
  document.body.classList.toggle('ov-open', on);
}

async function open(link, { push = true } = {}) {
  const url = new URL(link.href, location.href).pathname;
  const kind = link.dataset.open;
  if (dlg && openUrl === url) return;
  const t = ++seq;
  const { article, title } = await load(url);
  if (t !== seq) return;   // another open() started while this one was loading
  if (!article) { location.href = url; return; }

  if (dlg) close({ silent: true });
  opener = link;
  dlg = document.createElement('dialog');
  dlg.className = `ov ov--${kind}`;
  dlg.setAttribute('aria-label', article.querySelector('h1')?.textContent || 'Details');
  dlg.innerHTML = `
    <div class="ov-bar">
      <button class="ov-close" aria-label="Close">×</button>
    </div>
    <div class="ov-body"></div>`;
  dlg.querySelector('.ov-body').appendChild(document.importNode(article, true));
  // photos open full size: make them reachable from the keyboard too
  dlg.querySelectorAll('.e-photos img').forEach((img) => { img.tabIndex = 0; img.setAttribute('role', 'button'); img.setAttribute('aria-label', `View photo: ${img.alt}`); });
  document.body.appendChild(dlg);
  openUrl = url;

  dlg.addEventListener('cancel', (e) => { e.preventDefault(); requestClose(); });
  dlg.addEventListener('click', (e) => {
    if (e.target === dlg) requestClose();                        // backdrop
    if (e.target.closest('.ov-close')) requestClose();
    const img = e.target.closest('.e-photos img');
    if (img) lightbox(img);
  });
  dlg.addEventListener('keydown', (e) => {
    const img = e.target.closest?.('.e-photos img');
    if (img && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); lightbox(img); }
  });

  dlg.showModal();
  lockScroll(true);
  // focus the panel itself, not the close button: Safari would ring the button on every open
  dlg.tabIndex = -1;
  dlg.focus({ preventScroll: true });
  if (push) { history.pushState({ overlay: url, kind }, '', url); pushed = true; }
  document.title = title;
}

function requestClose() {
  if (pushed) history.back();          // popstate does the closing
  else close();
}

function close({ silent = false } = {}) {
  if (!dlg) return;
  const d = dlg;
  dlg = null;
  openUrl = null;
  pushed = false;
  document.title = home.title;
  if (!silent && location.pathname !== home.url) history.replaceState(null, '', home.url);   // after a deep link
  const finish = () => { d.close(); d.remove(); lockScroll(false); if (!silent) opener?.focus({ preventScroll: true }); };
  if (silent || reduceMotion) return finish();
  d.classList.add('is-closing');
  setTimeout(finish, 320);
}

function lightbox(img) {
  const lb = document.createElement('dialog');
  lb.className = 'lb';
  lb.innerHTML = `<button class="ov-close" aria-label="Close photo">×</button><img src="${img.src}" alt="${img.alt}" />`;
  document.body.appendChild(lb);
  lb.addEventListener('click', () => lb.close());
  lb.addEventListener('close', () => lb.remove());
  lb.showModal();
}

export function initOverlays(root = document) {
  // Entry pages send visitors here as /experience/?open=/experience/z21/ so a shared or
  // refreshed link still shows the entry as a panel over the reel.
  const deep = new URLSearchParams(location.search).get('open');
  if (deep) {
    home.url = location.pathname;
    history.replaceState(null, '', home.url);
    const a = root.querySelector(`a[data-open][href="${CSS.escape(deep)}"]`);
    if (a) open(a, { push: false }).then(() => history.replaceState({ overlay: deep, kind: a.dataset.open }, '', deep));
  }
  root.addEventListener('click', (e) => {
    const a = e.target.closest('a[data-open]');
    if (!a || e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return;
    e.preventDefault();
    open(a);
  });
  // warm the cache on hover so the open feels instant
  root.addEventListener('pointerover', (e) => {
    const a = e.target.closest('a[data-open]');
    if (a) load(new URL(a.href, location.href).pathname);
  });
  addEventListener('popstate', (e) => {
    if (dlg && !e.state?.overlay) close();
    else if (e.state?.overlay) {
      const a = root.querySelector(`a[data-open][href="${e.state.overlay}"]`);
      if (a) open(a, { push: false }).then(() => { pushed = true; });
    }
  });
}
