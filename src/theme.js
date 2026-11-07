// Light/dark theme, shared by every page. A page's own default is in its markup
// (body.theme-dark on /experience/); a choice made with the switch is remembered and
// applied before first paint by the one-line script at the top of each <body>.
const KEY = 'theme';

export const isDark = () => document.body.classList.contains('theme-dark');
export const paper = () => (isDark() ? '#0b0b0b' : '#ffffff');

// Safari tints its status bar / toolbar from theme-color: keep it on the page's colour
export function syncThemeColor() {
  const meta = document.querySelector('meta[name="theme-color"]');
  // a page whose top is a dark photo or video can ask for a fixed tint (data-tint on <body>)
  if (meta) meta.setAttribute('content', document.body.dataset.tint || getComputedStyle(document.body).backgroundColor);
}

export function setTheme(dark) {
  document.body.classList.toggle('theme-dark', dark);
  syncThemeColor();
  try { localStorage.setItem(KEY, dark ? 'dark' : 'light'); } catch { /* private mode: just don't remember */ }
  dispatchEvent(new CustomEvent('themechange', { detail: { dark } }));
}
