import { isDark, setTheme, syncThemeColor } from './theme.js';

// Header, light/dark switch and right-hand menu, shared by every page.
// `lightFrom()` returns the scroll position (px) where the page under the header turns white.
export function initChrome({ lightFrom = () => 0 } = {}) {
  syncThemeColor();   // a remembered dark/light choice may differ from the page's default
  const header = document.querySelector('.top');
  const menuBtn = document.querySelector('.menu-btn');
  const menu = document.getElementById('menu');

  // dark pages never turn white, so the header keeps its dark-glass style there
  function onScroll() {
    header.classList.toggle('on-light', !isDark() && scrollY > lightFrom());
  }
  addEventListener('scroll', onScroll, { passive: true });
  addEventListener('resize', onScroll);

  const main = document.querySelector('main');
  function setMenu(open) {
    const hadFocus = menu.contains(document.activeElement);
    document.body.classList.toggle('menu-open', open);
    menuBtn.setAttribute('aria-expanded', String(open));
    menuBtn.setAttribute('aria-label', open ? 'Close menu' : 'Open menu');
    menu.setAttribute('aria-hidden', String(!open));
    if (main) main.inert = open;   // the page behind the open menu is out of reach
    // focus the panel, not its first link: Safari would underline that link on every open
    if (open) { menu.tabIndex = -1; menu.focus({ preventScroll: true }); }
    else if (hadFocus) menuBtn.focus({ preventScroll: true });   // don't leave focus on a link that's disappearing
  }
  menuBtn.addEventListener('click', () => setMenu(!document.body.classList.contains('menu-open')));
  document.querySelector('.scrim').addEventListener('click', () => setMenu(false));
  menu.querySelectorAll('a').forEach((a) => a.addEventListener('click', () => setMenu(false)));
  addEventListener('keydown', (ev) => { if (ev.key === 'Escape' && document.body.classList.contains('menu-open')) setMenu(false); });

  // a page can fix its own theme (the home page is always dark): then there's no switch
  if (document.body.hasAttribute('data-theme-lock')) {
    onScroll();
    requestAnimationFrame(() => document.body.classList.add('ready'));
    return { setMenu, onScroll };
  }

  const themeBtn = document.createElement('button');
  themeBtn.className = 'theme-btn';
  themeBtn.innerHTML =
    '<svg class="moon" viewBox="0 0 24 24" aria-hidden="true"><path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5z"/></svg>' +
    '<svg class="sun" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/></svg>';
  const label = () => themeBtn.setAttribute('aria-label', isDark() ? 'Switch to light background' : 'Switch to dark background');
  themeBtn.addEventListener('click', () => setTheme(!isDark()));
  addEventListener('themechange', () => { label(); onScroll(); });
  label();
  header.insertBefore(themeBtn, menuBtn);

  onScroll();
  requestAnimationFrame(() => document.body.classList.add('ready'));
  return { setMenu, onScroll };
}
