// One panel is highlighted at a time (wider, full height, text showing). It follows the
// pointer or keyboard focus, and goes back to the first panel when you leave the row.
// A panel's video[data-hover] plays only while that panel is highlighted (on touch screens:
// while it's mostly in view).
export function initReel(reel) {
  if (!reel) return;
  const panels = [...reel.querySelectorAll('.panel')];
  const still = matchMedia('(prefers-reduced-motion: reduce)').matches;   // videos stay on their posters
  const highlight = (p) => panels.forEach((x) => {
    x.classList.toggle('is-hl', x === p);
    const v = x.querySelector('video[data-hover]');
    if (v) { if (x === p && !still) v.play().catch(() => {}); else v.pause(); }
  });
  // start fetching hover videos as soon as the mouse reaches the row, so they start at once
  // (not the ones already playing: load() would restart them)
  const warm = (e) => {
    if (e.pointerType !== 'mouse') return;
    reel.removeEventListener('pointerenter', warm);
    reel.querySelectorAll('video[data-hover]').forEach((v) => { if (v.paused) { v.preload = 'auto'; v.load(); } });
  };
  reel.addEventListener('pointerenter', warm);
  // touch screens have no hover: a card's video plays while it's on screen and pauses once it's
  // fully off screen (pausing below some visible share stopped the autoplay at page load)
  if (!still && !matchMedia('(hover: hover)').matches && 'IntersectionObserver' in window) {
    const io = new IntersectionObserver((entries) => entries.forEach((e) => {
      const v = e.target.querySelector('video[data-hover]');
      if (!v) return;
      if (e.intersectionRatio >= 0.25) { v.preload = 'auto'; v.play().catch(() => {}); }
      else if (!e.isIntersecting) v.pause();
    }), { threshold: [0, 0.25] });
    panels.forEach((p) => io.observe(p));
  }
  panels.forEach((p) => {
    p.addEventListener('pointerenter', (e) => { if (e.pointerType === 'mouse') highlight(p); });
    p.addEventListener('focus', () => highlight(p));
  });
  reel.addEventListener('pointerleave', (e) => { if (e.pointerType === 'mouse') highlight(panels[0]); });
  reel.addEventListener('focusout', (e) => { if (!reel.contains(e.relatedTarget)) highlight(panels[0]); });
}
