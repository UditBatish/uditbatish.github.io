// Kenney CC0 one-shots (public/Games/mrwhite/sfx), played through Web Audio so they start
// instantly on iOS. A couple of extras (drumroll, slide whistle) are synthesised.
const BASE = '/Games/mrwhite/sfx/';
const FILES = ['tap', 'pop', 'flip', 'deal', 'shuffle', 'reveal', 'eliminate', 'stamp', 'win', 'win_big', 'lose', 'wrong', 'tick', 'sting'];
let ctx = null;
let on = true;
const buf = {};

export function setSound(v) { on = v; }

function ac() {
  if (!ctx) {
    const A = window.AudioContext || window.webkitAudioContext;
    if (!A) return null;
    ctx = new A();
    FILES.forEach(async (n) => {
      try {
        const r = await fetch(BASE + n + '.mp3');
        buf[n] = await ctx.decodeAudioData(await r.arrayBuffer());
      } catch { /* sound is optional */ }
    });
  }
  if (ctx.state !== 'running') ctx.resume().catch(() => {});
  return ctx;
}

// Call from a user gesture so iOS lets audio play.
export function unlock() { ac(); }

function play(n, { vol = 0.7, at = 0, rate = 1 } = {}) {
  if (!on) return;
  const c = ac();
  if (!c || !buf[n]) return;
  const s = c.createBufferSource();
  const g = c.createGain();
  s.buffer = buf[n];
  s.playbackRate.value = rate;
  g.gain.value = vol;
  s.connect(g).connect(c.destination);
  s.start(c.currentTime + at);
}

function tone(f, at, dur, { type = 'sine', vol = 0.15, f2 = null } = {}) {
  const c = ctx;
  const t = c.currentTime + at;
  const o = c.createOscillator();
  const g = c.createGain();
  o.type = type;
  o.frequency.setValueAtTime(f, t);
  if (f2) o.frequency.exponentialRampToValueAtTime(f2, t + dur);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(vol, t + 0.015);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g).connect(c.destination);
  o.start(t);
  o.stop(t + dur + 0.05);
}

let noiseBuf = null;
function noise(at, dur, vol = 0.25, freq = 180) {
  const c = ctx;
  if (!noiseBuf) {
    noiseBuf = c.createBuffer(1, c.sampleRate * 0.3, c.sampleRate);
    const d = noiseBuf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  }
  const t = c.currentTime + at;
  const s = c.createBufferSource();
  const f = c.createBiquadFilter();
  const g = c.createGain();
  s.buffer = noiseBuf;
  f.type = 'lowpass';
  f.frequency.value = freq;
  g.gain.setValueAtTime(vol, t);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  s.connect(f).connect(g).connect(c.destination);
  s.start(t);
  s.stop(t + dur + 0.02);
}

const synth = (fn) => () => { if (!on) return; if (!ac()) return; fn(); };

export const sfx = {
  tap: () => play('tap', { vol: 0.5 }),
  pop: () => play('pop', { vol: 0.6 }),
  peel: () => play('flip', { vol: 0.55 }),
  deal: () => play('deal', { vol: 0.6 }),
  shuffle: () => play('shuffle', { vol: 0.55 }),
  tick: () => play('tick', { vol: 0.45 }),
  land: () => play('reveal', { vol: 0.7 }),
  thump: () => { play('stamp', { vol: 0.9 }); play('eliminate', { vol: 0.5, at: 0.02 }); },
  sting: () => play('sting', { vol: 0.8 }),
  win: () => play('win_big', { vol: 0.8 }),
  lose: () => play('lose', { vol: 0.7 }),
  wrong: () => play('wrong', { vol: 0.6 }),
  // a snare roll that speeds up for about a second
  drum: synth(() => {
    let t = 0;
    for (let i = 0; i < 18; i++) { noise(t, 0.06, 0.18 + i * 0.012, 1400); t += 0.075 - i * 0.0022; }
  }),
  // Mr. White steals it
  whistle: synth(() => {
    tone(420, 0, 0.42, { vol: 0.12, f2: 1500 });
    tone(1500, 0.44, 0.3, { vol: 0.1, f2: 900 });
    play('win', { vol: 0.7, at: 0.7 });
  }),
};
