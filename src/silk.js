import { vert, frag } from './shader.js';

// Dawn palette, dark to light
const PAL = ['#1d2457', '#3f6fd8', '#f2734f', '#ffbf9b', '#fff3ea'];

const CYCLE = 7.5;   // seconds per photo, including a short silk-only gap
const RISE = 1.8;    // sweep-in / sweep-out time
const HOLD = 4.4;    // fully visible time

const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
const hex = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16) / 255);
const smooth = (x) => x * x * (3 - 2 * x);

// The dithered silk backdrop. It fills `hero` and dissolves into white just
// behind `anchor` (the page's headline). `photos` cycle through it one at a time.
// Returns { fade(), setPaper() }: where the colour ends, and a way to change the page colour.
// `paper` is the page colour behind it (white by default, black on dark pages).
export function createSilk({ canvas, hero, anchor, photos = [], paper = '#ffffff' }) {
  const gl = canvas.getContext('webgl', { antialias: false });
  const state = {
    cell: 4,
    fade: [0.3, 0.55],
    aspect: 1,
    mouse: [0, 0],
    mouseTarget: [0, 0],
    introStart: performance.now(),
  };
  if (!gl) {
    document.body.classList.add('no-gl');
    return { fade: () => state.fade, setPaper: () => {} };
  }

  const U = {};
  const textures = [];   // { tex, aspect, side, focus } per photo, filled as images load
  let blank;

  function compile(type, src) {
    const s = gl.createShader(type);
    gl.shaderSource(s, src);
    gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s));
    return s;
  }

  function makeTexture(source) {
    const tex = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    if (source) gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGB, gl.RGB, gl.UNSIGNED_BYTE, source);
    else gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGB, 1, 1, 0, gl.RGB, gl.UNSIGNED_BYTE, new Uint8Array([0, 0, 0]));
    return tex;
  }

  // Downscale before upload: the dither samples one texel per cell, so a small
  // pre-averaged image avoids shimmer.
  function loadPhoto(photo, i) {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.decoding = 'async';
    img.onload = () => {
      const w = Math.min(img.naturalWidth, 480), h = Math.round((w * img.naturalHeight) / img.naturalWidth);
      const c = document.createElement('canvas');
      c.width = w; c.height = h;
      c.getContext('2d').drawImage(img, 0, 0, w, h);
      textures[i] = { tex: makeTexture(c), aspect: w / h, side: { left: -1, right: 1, full: 2 }[photo.side] ?? 1, focus: photo.focus ?? 0.5 };
    };
    img.src = photo.src;
  }

  // The colour the field dissolves into, and whether its last cells lift to pale (on white)
  function setPaper(color) {
    const ph = hex(color);
    gl.uniform3fv(U.u_paper, new Float32Array(ph));
    gl.uniform1f(U.u_lift, ph[0] + ph[1] + ph[2] > 1.5 ? 1 : 0);
  }

  function initGL() {
    const prog = gl.createProgram();
    gl.attachShader(prog, compile(gl.VERTEX_SHADER, vert));
    gl.attachShader(prog, compile(gl.FRAGMENT_SHADER, frag));
    gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(prog));
    gl.useProgram(prog);

    gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    const loc = gl.getAttribLocation(prog, 'a_pos');
    gl.enableVertexAttribArray(loc);
    gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);

    for (const n of ['u_res', 'u_time', 'u_mouse', 'u_intro', 'u_pal[0]', 'u_fade', 'u_img', 'u_slot', 'u_info', 'u_focus', 'u_paper', 'u_lift']) {
      U[n] = gl.getUniformLocation(prog, n);
    }
    gl.uniform3fv(U['u_pal[0]'], new Float32Array(PAL.flatMap(hex)));
    setPaper(paper);
    gl.uniform1i(U.u_img, 0);
    blank = makeTexture(null);
    photos.forEach(loadPhoto);
  }

  // Canvas is one pixel per dither cell; CSS scales it up exactly.
  function resize() {
    const w = innerWidth, h = hero.offsetHeight;
    canvas.width = Math.ceil(w / state.cell);
    canvas.height = Math.ceil(h / state.cell);
    canvas.style.width = canvas.width * state.cell + 'px';
    canvas.style.height = canvas.height * state.cell + 'px';
    gl.viewport(0, 0, canvas.width, canvas.height);
    gl.uniform2f(U.u_res, canvas.width, canvas.height);
    state.aspect = w / h;

    // The field runs down into the headline and finishes dissolving behind it;
    // the cells there are lifted to pale peach so the dark type stays crisp.
    const head = anchor.getBoundingClientRect();
    const headTop = head.top - hero.getBoundingClientRect().top;
    const end = Math.max(0.35, (headTop + head.height * 0.6) / h);
    state.fade = [end - (w < 640 ? 0.24 : 0.3), end];
    gl.uniform2f(U.u_fade, state.fade[0], state.fade[1]);
  }

  // One photo at a time. Landscapes ('full') fill the whole field. Side photos keep
  // their own shape: full field height, as wide as that makes it (capped a little past
  // the centre), flush to their side. Returns [cx, cy, w, h] and the side code.
  function slotGeometry(entry) {
    const halfW = state.aspect / 2;
    const h = state.fade[1] * 0.95;
    const cy = 0.5 - h / 2;
    if (state.aspect < 0.9) return [[0, cy, halfW * 2, h], 0];
    const side = entry ? entry.side : 1;
    if (side === 2) return [[0, cy, halfW * 2 + 0.06, h], 2];   // full bleed
    const w = Math.min(h * (entry ? entry.aspect : 1.5), halfW + 0.3);
    return [[side * (halfW - w / 2), cy, w, h], side];
  }

  function presence(phase) {
    if (phase < RISE) return smooth(phase / RISE);
    if (phase < RISE + HOLD) return 1;
    if (phase < RISE * 2 + HOLD) return 1 - smooth((phase - RISE - HOLD) / RISE);
    return 0;
  }

  // ?photo=N pins photo N (0-based) on screen, for reviewing crops
  const pinned = new URLSearchParams(location.search).get('photo');

  function bindPhoto(time) {
    const local = time - 1.4;               // first photo arrives just after the intro
    const k = pinned !== null ? +pinned : Math.floor(local / CYCLE);
    const entry = k < 0 || reduceMotion || !photos.length ? null : textures[k % photos.length];
    const pres = !entry ? 0 : pinned !== null ? Math.min(1, Math.max(0, local / RISE)) : presence(local - k * CYCLE);
    gl.bindTexture(gl.TEXTURE_2D, entry ? entry.tex : blank);
    const [slot, side] = slotGeometry(entry);
    gl.uniform4fv(U.u_slot, slot);
    gl.uniform3f(U.u_info, pres, entry ? entry.aspect : 1, side);
    gl.uniform1f(U.u_focus, entry ? entry.focus : 0.5);
  }

  const t0 = performance.now();
  let visible = true;
  function frame(now) {
    requestAnimationFrame(frame);
    if (!visible) return;
    const elapsed = (now - t0) / 1000;
    const time = reduceMotion ? 42 : elapsed + 30;
    const intro = reduceMotion ? 1 : Math.min(1, (now - state.introStart) / 1500);

    state.mouse[0] += (state.mouseTarget[0] - state.mouse[0]) * 0.05;
    state.mouse[1] += (state.mouseTarget[1] - state.mouse[1]) * 0.05;

    gl.uniform1f(U.u_time, time);
    gl.uniform1f(U.u_intro, 1 - Math.pow(1 - intro, 3));
    gl.uniform2f(U.u_mouse, state.mouse[0], state.mouse[1]);
    bindPhoto(elapsed);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  }

  addEventListener('pointermove', (ev) => {
    const h = hero.offsetHeight;
    state.mouseTarget = [(ev.clientX - innerWidth / 2) / h, -(ev.clientY + scrollY - h / 2) / h];
  });
  new IntersectionObserver(([e]) => { visible = e.isIntersecting; }).observe(hero);

  try {
    initGL();
  } catch (err) {   // shader failed or context lost: fall back to the plain gradient
    console.warn('silk: WebGL unavailable', err);
    document.body.classList.add('no-gl');
    return { fade: () => state.fade, setPaper: () => {} };
  }
  document.fonts.ready.then(resize);
  resize();
  addEventListener('resize', resize);
  requestAnimationFrame(frame);

  return { fade: () => state.fade, setPaper };
}
