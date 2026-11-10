// Mr. White: a pass-and-play party word game for one phone.
import DATA from './words.json';
import { ART, blank, guest, spy, bottle } from './art.js';
import { I } from './icons.js';
import { sfx, setSound, unlock } from './sound.js';

const KEY = 'mrwhite.v1';
const MIN = 3;
const MAX = 20;
const COLORS = ['#8fc9b0', '#ffbf3c', '#9ec5ff', '#ff9ec4', '#ffbf9b', '#c9b6ff', '#c6e377', '#ff8a7a', '#7fd6e0', '#fbe38e', '#e6a8f0', '#b8cf9a'];
// recommended [undercover, mr white] for each player count
const TABLE = { 3: [1, 0], 4: [1, 0], 5: [1, 1], 6: [1, 1], 7: [2, 1], 8: [2, 1], 9: [2, 1], 10: [3, 1], 11: [3, 1], 12: [3, 2], 13: [3, 2], 14: [3, 2], 15: [4, 2], 16: [4, 2], 17: [4, 2], 18: [5, 2], 19: [5, 2], 20: [5, 2] };
const ROLE = {
  c: { name: 'Civilian', many: 'Civilians', bg: '#8fc9b0', stamp: 'Innocent', line: 'Oops. Wrong person.' },
  u: { name: 'Undercover', many: 'Undercover', bg: '#ffbf3c', stamp: 'Busted', line: 'Nice catch.' },
  w: { name: 'Mr. White', many: 'Mr. White', bg: '#ffffff', stamp: 'Caught', line: 'One shot to steal it.' },
};
const POINTS = { c: 2, u: 5, w: 6 };
const GAME_SCREENS = ['deal', 'round', 'vote', 'out', 'guess', 'check'];
const gridCls = (n) => (n <= 4 ? 'few' : n <= 9 ? 'mid' : '');
const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;

const app = document.getElementById('app');
const layer = document.getElementById('layer');
const ui = { sel: null, tie: false, tied: [], peeked: false, shown: false, sheet: null, busy: false };

// ---------- state ----------
const uid = () => Math.random().toString(36).slice(2, 9);
const rand = (n) => Math.floor(Math.random() * n);
const shuffle = (a) => { for (let i = a.length - 1; i > 0; i--) { const j = rand(i + 1); [a[i], a[j]] = [a[j], a[i]]; } return a; };
const blankPlayers = (n) => Array.from({ length: n }, (_, i) => ({ id: uid(), name: '', color: COLORS[i % COLORS.length] }));

function fresh() {
  return { v: 1, screen: 'home', players: blankPlayers(5), counts: null, pack: 'mix', sound: true, scores: {}, streak: {}, last: {}, rounds: 0, used: [], game: null, back: null, check: null, resume: null };
}
function load() {
  try { const s = JSON.parse(localStorage.getItem(KEY)); if (s && s.v === 1 && Array.isArray(s.players)) return { ...fresh(), ...s }; } catch { /* ignore */ }
  return null;
}
function save() { try { localStorage.setItem(KEY, JSON.stringify(S)); } catch { /* private mode */ } }

let S = load() || fresh();
(function normalize() {
  if (!S.game && GAME_SCREENS.includes(S.screen)) S.screen = 'home';
  if (S.screen === 'check') { S.screen = S.check?.back || 'round'; S.check = null; }
  if (S.screen === 'out' && S.game) S.game.outShown = true;
  if (S.screen === 'result' && !S.game) S.screen = 'home';
  if (S.game && S.game.starter && !S.game.spun) S.game.spun = true;
  setSound(S.sound);
})();

// ---------- helpers ----------
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const byId = (id) => S.players.find((p) => p.id === id);
const nm = (p) => (p.name || '').trim() || `Player ${S.players.indexOf(p) + 1}`;
const nameOf = (id) => { const p = byId(id); return p ? nm(p) : '?'; };
const seg = typeof Intl !== 'undefined' && Intl.Segmenter ? new Intl.Segmenter() : null;
const chars = (s) => (seg ? [...seg.segment(s)].map((x) => x.segment) : Array.from(s));
function ini(s, long = false) {
  const w = s.trim().split(/\s+/);
  const a = chars(w[0] || '?');
  if (long) return a.slice(0, 3).join('');
  return (w.length > 1 ? a[0] + (chars(w[1])[0] || '') : a[0]).toUpperCase();
}
const av = (id, cls = '', long = false) => {
  const p = byId(id);
  if (!p) return `<span class="av ${cls}" style="--c:#e8e3de">?</span>`;
  return `<span class="av ${cls}" style="--c:${p.color}">${esc(ini(nm(p), long))}</span>`;
};
const vibrate = (p) => { try { navigator.vibrate?.(p); } catch { /* iOS */ } };
const nameSize = (s) => { const n = Array.from(s).length; return n <= 6 ? 64 : n <= 9 ? 52 : n <= 12 ? 42 : 36; };
const wordSize = (s) => { const n = s.length; return n <= 6 ? 54 : n <= 9 ? 46 : n <= 12 ? 38 : 32; };
const ib = (act, icon, label, extra = '') => `<button class="ib" data-act="${act}" aria-label="${label}" ${extra}>${icon}</button>`;
const soundBtn = () => ib('sound', S.sound ? I.soundOn : I.soundOff, S.sound ? 'Sound off' : 'Sound on');

function counts() {
  if (S.counts) return { ...S.counts };
  const t = TABLE[S.players.length] || [1, 0];
  return { u: t[0], w: t[1] };
}
// Any mix goes, as long as there's someone to catch and the round can't end before it starts.
function valid(n, u, w) { const inf = u + w; return u >= 0 && w >= 0 && inf >= 1 && n - inf >= 2; }
function canStep(r, d) { const { u, w } = counts(); return valid(S.players.length, u + (r === 'u' ? d : 0), w + (r === 'w' ? d : 0)); }
function dupSet() {
  const seen = new Map(); const d = new Set();
  S.players.forEach((p) => { const k = nm(p).toLowerCase(); if (seen.has(k)) { d.add(p.id); d.add(seen.get(k)); } else seen.set(k, p.id); });
  return d;
}
const packById = (id) => DATA.packs.find((p) => p.id === id);
const packName = () => (S.pack === 'mix' ? 'Mix of everything' : packById(S.pack)?.name || 'Mix of everything');

// ---------- game logic ----------
function pickPair() {
  const packs = S.pack === 'mix' ? DATA.packs : [packById(S.pack) || DATA.packs[0]];
  const pool = [];
  packs.forEach((p) => p.pairs.forEach(([a, b]) => pool.push({ pack: p.name, a, b, k: `${a}|${b}` })));
  let open = pool.filter((x) => !S.used.includes(x.k));
  if (!open.length) {
    const ks = new Set(pool.map((x) => x.k));
    const keep = S.used[S.used.length - 1];
    S.used = S.used.filter((k) => !ks.has(k));
    if (keep) S.used.push(keep);
    const lastKey = S.used[S.used.length - 1];
    open = pool.filter((x) => x.k !== lastKey);
    if (!open.length) open = pool;
    toast('Pack reshuffled');
  }
  const x = open[rand(open.length)];
  S.used.push(x.k);
  return x;
}

function newGame() {
  const ids = S.players.map((p) => p.id);
  const { u, w } = counts();
  const bag = shuffle([...Array(ids.length - u - w).fill('c'), ...Array(u).fill('u'), ...Array(w).fill('w')]);
  const roles = {};
  ids.forEach((id, i) => { roles[id] = bag[i]; });
  const x = pickPair();
  const flip = Math.random() < 0.5;
  S.game = { no: S.rounds + 1, ids, roles, civ: flip ? x.b : x.a, uc: flip ? x.a : x.b, pack: x.pack, out: [], deal: 0, turn: 1, starter: null, spun: false, last: null, outShown: false, winner: null, mwId: null, undo: null, celebrated: false };
  ui.peeked = false;
}

const alive = () => S.game.ids.filter((id) => !S.game.out.includes(id));
function winCheck() {
  const g = S.game;
  const live = alive();
  const inf = live.filter((id) => g.roles[id] !== 'c').length;
  const civ = live.length - inf;
  if (inf === 0) return 'civ';
  if (civ <= 1) return 'inf';
  return null;
}
function pickStarter() {
  const g = S.game;
  const pool = alive().filter((id) => g.roles[id] !== 'w');
  return pool[rand(pool.length)];
}
function kick(id) {
  const g = S.game;
  g.undo = JSON.stringify({ game: { ...g, undo: null }, scores: S.scores, streak: S.streak, last: S.last, rounds: S.rounds });
  g.out.push(id);
  g.last = id;
  g.outShown = false;
  ui.sel = null; ui.tie = false; ui.tied = []; ui.shown = false;
  go('out');
}
function undo() {
  const g = S.game;
  if (!g?.undo) return;
  const u = JSON.parse(g.undo);
  S.game = u.game; S.scores = u.scores; S.streak = u.streak; S.last = u.last; S.rounds = u.rounds;
  ui.sel = null; ui.shown = false;
  closeSheet();
  go('vote');
  toast('Undone');
}
function nextRound() {
  const g = S.game;
  g.starter = null; g.spun = false; g.undo = null; g.turn = (g.turn || 1) + 1;
  go('round');
}
function finish(team, mwId = null) {
  const g = S.game;
  const d = {};
  g.ids.forEach((id) => {
    const r = g.roles[id];
    let p = 0;
    if (team === 'civ' && r === 'c') p = POINTS.c;
    if (team === 'inf' && r !== 'c') p = POINTS[r];
    if (team === 'mw' && id === mwId) p = POINTS.w;
    d[id] = p;
    if (byId(id)) {
      S.scores[id] = (S.scores[id] || 0) + p;
      S.streak[id] = p > 0 ? (S.streak[id] || 0) + 1 : 0;
    }
  });
  S.last = d; S.rounds += 1;
  g.winner = team; g.mwId = mwId; g.celebrated = false;
  go('result');
}
function afterOut() {
  const g = S.game;
  if (g.roles[g.last] === 'w') { ui.shown = false; go('guess'); return; }
  const w = winCheck();
  if (w) finish(w); else nextRound();
}

// ---------- shared pieces ----------
function tag(word, isBlank) {
  return `<div class="tag">
    <div class="band"><b>HELLO</b><span>my word is</span></div>
    <div class="tag-w">${isBlank ? '<span class="w" style="font-size:54px">???</span>' : `<span class="w" style="font-size:${wordSize(word)}px">${esc(word)}</span>`}</div>
    <div class="tag-f">${isBlank ? "<b>You're Mr. White.</b><span>No word. Bluff it.</span>" : '<b>Keep it secret.</b><span>Give hints, never the word.</span>'}</div>
  </div>`;
}
function peekCard(id) {
  const g = S.game; const r = g.roles[id]; const p = byId(id);
  const word = r === 'c' ? g.civ : r === 'u' ? g.uc : '';
  return `<button class="peek" data-peek data-act="peek" aria-label="Show or hide your word" aria-pressed="false">
    <div class="peek-in">
      <div class="face back" style="--c:${p.color}">
        <span class="peel" aria-hidden="true"></span>
        <span class="av xl">${esc(ini(nm(p)))}</span>
        <span class="fp">${I.eye}</span>
        <b class="hold">Tap to see your word</b>
        <small>Tap again to hide</small>
      </div>
      <div class="face front">${tag(word, r === 'w')}</div>
    </div>
  </button>`;
}
const header = (left, mid, right) => `<header class="top">${left || '<span class="ib-ph"></span>'}<div class="top-mid">${mid || ''}</div><div class="top-r">${right || ''}</div></header>`;
const roundChip = (turn = false) => `<span class="chip">Round ${S.game.no}${turn && S.game.turn > 1 ? ` · Turn ${S.game.turn}` : ''}</span>`;

// ---------- screens ----------
function home() {
  const live = S.game && !S.game.winner;
  const hasScores = S.rounds > 0;
  return `${header('', '', soundBtn())}
  <section class="home">
    <div class="home-art">${blank('blink')}</div>
    <h1 class="title">Mr.<br>White</h1>
    <p class="tagline">Everyone gets a word.<br>Well, almost everyone.</p>
  </section>
  <div class="foot">
    ${live ? `<button class="btn" data-act="resume">Continue round ${S.game.no} ${I.arrow}</button><button class="btn alt" data-act="setup">New round</button>`
    : `<button class="btn" data-act="setup">Play ${I.arrow}</button>`}
    <div class="links"><button class="link" data-act="rules">${I.help}How to play</button>${hasScores ? `<button class="link" data-act="board">${I.trophy}Scores</button>` : ''}</div>
  </div>`;
}

function roleTile(r, n, dec, inc) {
  return `<div class="rt" style="--rc:${ROLE[r].bg}">
    <div class="rt-art">${ART[r]('sm')}</div>
    <b class="rt-n">${n}</b>
    <span class="rt-l">${ROLE[r].many}</span>
    ${r === 'c' ? '<span class="rt-auto">the rest</span>' : `<div class="rt-step">
      <button data-act="step" data-r="${r}" data-d="-1" ${dec ? '' : 'disabled'} aria-label="Fewer ${ROLE[r].many}">${I.minus}</button>
      <button data-act="step" data-r="${r}" data-d="1" ${inc ? '' : 'disabled'} aria-label="More ${ROLE[r].many}">${I.plus}</button></div>`}
  </div>`;
}

function setup() {
  const n = S.players.length;
  const { u, w } = counts();
  const dups = dupSet();
  return `${header(ib('home', I.back, 'Back'), '<h2 class="top-t">Who’s playing?</h2>', soundBtn())}
  <div class="sec"><span class="sec-h">${I.users}Players</span>
    <div class="stp"><button data-act="pl" data-d="-1" ${n > MIN ? '' : 'disabled'} aria-label="One less player">${I.minus}</button><b>${n}</b><button data-act="pl" data-d="1" ${n < MAX ? '' : 'disabled'} aria-label="One more player">${I.plus}</button></div>
  </div>
  <ol class="names">${S.players.map((p, i) => `
    <li class="prow ${dups.has(p.id) ? 'dup' : ''}" data-row="${p.id}">
      <button class="av" style="--c:${p.color}" data-act="color" data-id="${p.id}" aria-label="Change colour">${esc(ini(nm(p)))}</button>
      <input value="${esc(p.name)}" placeholder="Player ${i + 1}" maxlength="14" data-id="${p.id}" enterkeyhint="next" autocomplete="off" autocorrect="off" autocapitalize="words" spellcheck="false" aria-label="Player ${i + 1} name">
      ${n > MIN ? `<button class="rm" data-act="rm" data-id="${p.id}" aria-label="Remove ${esc(nm(p))}">${I.x}</button>` : ''}
    </li>`).join('')}</ol>
  ${n < MAX ? `<button class="add" data-act="add">${I.plus}Add player</button>` : ''}
  <div class="sec"><span class="sec-h">${I.vote}Roles</span>${S.counts ? `<button class="mini" data-act="auto">${I.cw}Suggested</button>` : '<span class="mini on">Suggested</span>'}</div>
  <div class="roles">${roleTile('c', n - u - w)}${roleTile('u', u, canStep('u', -1), canStep('u', 1))}${roleTile('w', w, canStep('w', -1), canStep('w', 1))}</div>
  <div class="sec"><span class="sec-h">${I.cards}Words</span></div>
  <button class="dd" data-act="pack"><span class="dd-l">${esc(packName())}</span>${I.chev}</button>
  <div class="foot sticky"><button class="btn" data-act="deal" data-deal ${dups.size ? 'disabled' : ''}>${dups.size ? 'Two players, same name' : `Deal the cards ${I.arrow}`}</button></div>`;
}

function deal() {
  const g = S.game;
  const id = g.ids[g.deal];
  const p = byId(id);
  const last = g.deal === g.ids.length - 1;
  const label = last ? `Hide. Everyone’s in ${I.arrow}` : `Hide and pass to ${esc(nameOf(g.ids[g.deal + 1]))} ${I.arrow}`;
  return `${header(ib('menu', I.menu, 'Menu'), `<span class="chip">${g.deal + 1} of ${g.ids.length}</span>`, soundBtn())}
  <div class="pass"><span class="pass-k">Pass the phone to</span><h1 class="pass-n" style="font-size:${nameSize(nm(p))}px">${esc(nm(p))}</h1></div>
  <div class="stage">${peekCard(id)}</div>
  <div class="foot"><button class="btn ink" data-act="dealt" data-needs-peek ${ui.peeked ? '' : 'disabled'}>${label}</button></div>`;
}

function round() {
  const g = S.game;
  if (!g.starter) { g.starter = pickStarter(); g.spun = false; }
  const n = g.ids.length;
  const s = n <= 6 ? 62 : n <= 9 ? 52 : n <= 13 ? 44 : 36;
  const si = g.ids.indexOf(g.starter);
  const out = new Set(g.out);
  const live = alive();
  const hu = live.filter((id) => g.roles[id] === 'u').length;
  const hw = live.filter((id) => g.roles[id] === 'w').length;
  const view = S.view || (n > 9 ? 'grid' : 'ring');
  // clue order: clockwise from the starter, skipping anyone who's out
  const ord = {}; let k = 1;
  for (let j = 0; j < n; j++) { const id = g.ids[(si + j) % n]; if (!out.has(id)) ord[id] = k++; }
  const toggle = `<div class="vt" role="group" aria-label="Table view">
    <button data-act="view" data-v="ring" class="${view === 'ring' ? 'on' : ''}" aria-pressed="${view === 'ring'}" aria-label="Circle view"><svg class="i" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="8" fill="none" stroke="currentColor" stroke-width="2" stroke-dasharray="3 3"/><circle cx="12" cy="4" r="2.6" fill="currentColor"/><circle cx="19" cy="15" r="2.6" fill="currentColor"/><circle cx="5" cy="15" r="2.6" fill="currentColor"/></svg></button>
    <button data-act="view" data-v="grid" class="${view === 'grid' ? 'on' : ''}" aria-pressed="${view === 'grid'}" aria-label="Grid view"><svg class="i" viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="3" width="7.5" height="7.5" rx="2" fill="currentColor"/><rect x="13.5" y="3" width="7.5" height="7.5" rx="2" fill="currentColor"/><rect x="3" y="13.5" width="7.5" height="7.5" rx="2" fill="currentColor"/><rect x="13.5" y="13.5" width="7.5" height="7.5" rx="2" fill="currentColor"/></svg></button>
  </div>`;
  const table = view === 'grid'
    ? `<div class="order ${g.spun ? 'in' : ''} ${n > 12 ? 'dense' : ''}">${g.ids.map((id) => `<div class="otile ${out.has(id) ? 'gone' : ''} ${g.spun && id === g.starter ? 'start' : ''}" data-seat="${id}" style="--c:${byId(id)?.color || '#eee'}">
        ${out.has(id) ? '' : `<b class="onum">${ord[id]}</b>`}${av(id)}<span class="tile-n">${esc(nameOf(id))}</span></div>`).join('')}</div>`
    : `<div class="ring" style="--s:${s}px">
    ${g.ids.map((id, i) => `<div class="seat ${out.has(id) ? 'gone' : ''} ${g.spun && id === g.starter ? 'start' : ''}" data-seat="${id}" style="--a:${(i * 360) / n}deg">
      ${av(id, '', n > 9)}${n <= 9 ? `<span class="seat-n">${esc(nameOf(id))}</span>` : ''}</div>`).join('')}
    <div class="bottle" data-rot="${(si * 360) / n}" style="--rot:${g.spun ? (si * 360) / n : 0}deg">${bottle()}</div>
  </div>`;
  return `${header(ib('menu', I.menu, 'Menu'), roundChip(true), ib('check', I.eye, 'Check my word') + soundBtn())}
  ${toggle}
  ${table}
  <div class="starter ${g.spun ? 'in' : ''}">
    <h1 class="h1">${esc(nameOf(g.starter))} starts</h1>
    <p class="cw">${I.cw}${view === 'grid' ? 'Then follow the numbers.' : 'Then clockwise. One clue each.'}</p>
  </div>
  <div class="hiding" aria-label="Still hiding">
    <span class="hide-k">Still hiding</span>
    ${hu ? `<span class="hchip" style="--rc:${ROLE.u.bg}">${spy('xs')}<b>${hu}</b></span>` : ''}
    ${hw ? `<span class="hchip" style="--rc:#fff">${blank('xs')}<b>${hw}</b></span>` : ''}
  </div>
  <div class="foot"><button class="btn" data-act="vote" data-after-spin ${g.spun ? '' : 'disabled'}>Time to vote ${I.arrow}</button></div>`;
}

function vote() {
  const g = S.game;
  const live = alive();
  const tie = ui.tie;
  const isSel = (id) => (tie ? ui.tied.includes(id) : ui.sel === id);
  return `${header(ib('back-round', I.back, 'Back'), roundChip(true), soundBtn())}
  <h1 class="h1 left">${tie ? 'Who’s tied?' : 'Who’s out?'}</h1>
  ${tie ? '<p class="sub">They give one more clue each. Still tied? Tap them, fate picks.</p>' : `<button class="count321" data-act="count">${I.vote}<span>3, 2, 1… point!</span></button>`}
  <div class="grid ${gridCls(live.length)}">${live.map((id) => `<button class="tile ${isSel(id) ? 'sel' : ''}" data-act="pick" data-id="${id}" style="--c:${byId(id).color}" aria-pressed="${isSel(id)}">
    ${av(id, 'md')}<span class="tile-n">${esc(nameOf(id))}</span>${tie && isSel(id) ? `<span class="tick">${I.check}</span>` : ''}</button>`).join('')}</div>
  <div class="foot sticky">
    ${tie
    ? `<button class="btn" data-act="fate" ${ui.tied.length >= 2 ? '' : 'disabled'}>${I.shuffle}Let fate pick</button><button class="link" data-act="untie">Cancel</button>`
    : `<button class="btn ${ui.sel ? 'danger' : ''}" data-act="kick" ${ui.sel ? '' : 'disabled'}>${ui.sel ? `Kick out ${esc(nameOf(ui.sel))}` : 'Tap who’s out'}</button><button class="link" data-act="tie">It’s a tie</button>`}
  </div>`;
}

function outScreen() {
  const g = S.game;
  const id = g.last;
  const r = g.roles[id];
  const w = r === 'w' ? null : winCheck();
  const next = r === 'w' ? `Mr. White’s last shot ${I.arrow}` : w ? `See who won ${I.arrow}` : `Next turn ${I.arrow}`;
  return `${header(ib('menu', I.menu, 'Menu'), roundChip(), soundBtn())}
  <h1 class="h1 out-h">${esc(nameOf(id))} was…</h1>
  <div class="stage"><div class="flip ${g.outShown ? 'on' : ''}">
    <div class="flip-in">
      <div class="face back" style="--c:${byId(id).color}">${av(id, 'xl')}<b class="drum-q">?</b></div>
      <div class="face front" style="--rc:${ROLE[r].bg}">
        <div class="role-art">${ART[r]('big')}</div>
        <b class="role-n">${ROLE[r].name}</b>
        <span class="role-line">${ROLE[r].line}</span>
        <span class="stamp s-${r}">${ROLE[r].stamp}</span>
      </div>
    </div></div></div>
  <div class="foot ${g.outShown ? '' : 'wait'}" data-out-foot>
    <button class="btn" data-act="after-out">${next}</button>
    <button class="link" data-act="undo">${I.undo}Undo</button>
  </div>`;
}

// The civilians' word as boxes: one per letter, a gap per space, punctuation shown as-is.
const norm = (s) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]/g, '');
function slotsHtml(word, typed) {
  let i = 0;
  return word.split(' ').map((part) => `<span class="sw">${[...part].map((ch) => {
    if (!/[a-z0-9]/i.test(norm(ch))) return `<span class="slot fixed">${esc(ch)}</span>`;
    const t = typed[i]; const cur = i === typed.length; i += 1;
    return `<span class="slot ${t ? 'full' : ''} ${cur ? 'cur' : ''}">${t ? esc(t.toUpperCase()) : ''}</span>`;
  }).join('')}</span>`).join('');
}
// Box size so the longest word part fits one line on a 375px phone.
function slotSize(word) {
  const longest = Math.max(...word.split(' ').map((w) => [...w].length));
  return Math.max(20, Math.min(42, Math.floor((330 - (longest - 1) * 5) / longest)));
}
// One wrong letter is forgiven on longer words (Pakora vs Pakoda).
function close(a, b) {
  if (a === b) return true;
  if (a.length !== b.length || a.length < 6) return false;
  let d = 0; for (let k = 0; k < a.length; k++) if (a[k] !== b[k]) d += 1;
  return d <= 1;
}
function guessScreen() {
  const g = S.game;
  const n = norm(g.civ).length;
  const typed = ui.typed || '';
  return `${header(ib('menu', I.menu, 'Menu'), roundChip(), soundBtn())}
  <div class="guess">
    <div class="guess-art">${blank('sweat')}</div>
    <h1 class="h1">One shot, ${esc(nameOf(g.last))}.</h1>
    <p class="sub">Type the civilians’ word. ${n} letters.</p>
    <label class="slots" data-act="g-focus" style="--sz:${slotSize(g.civ)}px">
      <span class="slots-row" aria-hidden="true">${slotsHtml(g.civ, typed)}</span>
      <input class="slots-in" maxlength="${n}" value="${esc(typed)}" autocomplete="off" autocorrect="off" autocapitalize="off" spellcheck="false" enterkeyhint="go" aria-label="Your guess, ${n} letters">
    </label>
  </div>
  <div class="foot">
    <button class="btn" data-act="g-try" data-try ${typed.length === n ? '' : 'disabled'}>Lock it in ${I.arrow}</button>
    <button class="link" data-act="undo">${I.undo}Undo</button>
  </div>`;
}
function submitGuess() {
  const g = S.game;
  const typed = ui.typed || '';
  const target = norm(g.civ);
  if (typed.length !== target.length || ui.busy) return;
  ui.busy = true;
  const box = app.querySelector('.slots');
  app.querySelector('.slots-in')?.blur();
  if (close(typed, target)) {
    box.classList.add('right');
    box.querySelector('.slots-row').innerHTML = slotsHtml(g.civ, target);
    sfx.land();
    setTimeout(() => { ui.busy = false; ui.typed = ''; finish('mw', g.last); }, 1100);
  } else {
    box.classList.add('wrong');
    app.querySelector('.guess .sub').textContent = 'Nope. The game goes on.';
    sfx.wrong(); vibrate([80, 40, 80]);
    setTimeout(() => {
      ui.busy = false; ui.typed = '';
      if (S.game !== g) return;
      const w = winCheck();
      if (w) finish(w); else nextRound();
    }, 1500);
  }
}

function resultScreen() {
  const g = S.game;
  const t = g.winner;
  const H = {
    civ: ['Civilians win!', 'Party saved.', ROLE.c.bg, guest('big')],
    inf: ['Infiltrators win!', 'Smooth operators.', ROLE.u.bg, spy('big')],
    mw: ['Mr. White wins!', 'Bluffed the whole room.', '#ffffff', blank('shades big')],
  }[t];
  const order = { c: 0, u: 1, w: 2 };
  const rows = [...g.ids].filter(byId).sort((a, b) => (S.last[b] || 0) - (S.last[a] || 0) || order[g.roles[a]] - order[g.roles[b]]);
  return `${header(ib('menu', I.menu, 'Menu'), roundChip(), soundBtn())}
  <div class="banner" style="--bg:${H[2]}"><div class="banner-art">${H[3]}</div><div><h1 class="h1">${H[0]}</h1><p>${H[1]}</p></div></div>
  <div class="words">
    <div class="wtag" style="--rc:${ROLE.c.bg}"><span>Civilians</span><b>${esc(g.civ)}</b></div>
    <div class="wtag" style="--rc:${ROLE.u.bg}"><span>Undercover</span><b>${esc(g.uc)}</b></div>
  </div>
  <ul class="res">${rows.map((id) => `<li class="${g.out.includes(id) ? 'was-out' : ''}">
    ${av(id)}<span class="res-n">${esc(nameOf(id))}</span>
    <span class="res-r" style="--rc:${ROLE[g.roles[id]].bg}">${ROLE[g.roles[id]].name}</span>
    ${S.last[id] ? `<b class="pts">+${S.last[id]}</b>` : '<span class="pts0"></span>'}</li>`).join('')}</ul>
  <div class="foot"><button class="btn" data-act="again">Play again ${I.arrow}</button><button class="btn alt" data-act="board">${I.trophy}Scores</button></div>`;
}

function board() {
  const rows = S.players.map((p) => ({ p, pts: S.scores[p.id] || 0 })).sort((a, b) => b.pts - a.pts);
  const solo = rows.length > 1 && rows[0].pts > 0 && rows[0].pts > rows[1].pts;
  let rank = 0; let prev = null;
  const ranked = rows.map((r, i) => { if (r.pts !== prev) { rank = i + 1; prev = r.pts; } return { ...r, rank }; });
  return `${header(ib('board-back', I.back, 'Back'), '<h2 class="top-t">Scores</h2>', soundBtn())}
  <p class="sub">${S.rounds ? `After ${S.rounds} round${S.rounds > 1 ? 's' : ''}` : 'No rounds yet'}</p>
  <ol class="board">${ranked.map(({ p, pts, rank: rk }) => `<li class="${solo && rk === 1 ? 'lead' : ''}">
    <span class="rk">${solo && rk === 1 ? I.crown : `#${rk}`}</span>${av(p.id)}<span class="bn">${esc(nm(p))}</span>
    ${(S.streak[p.id] || 0) >= 2 ? `<span class="streak" title="Win streak">${I.flame}${S.streak[p.id]}</span>` : ''}
    ${S.last[p.id] ? `<span class="lastp">+${S.last[p.id]}</span>` : ''}
    <b class="bp ${pts ? '' : 'zero'}">${pts || '–'}</b></li>`).join('')}</ol>
  <div class="howpts">
    <div style="--rc:${ROLE.c.bg}">${guest('xs')}<span>Civilians win</span><b>+2 each</b></div>
    <div style="--rc:${ROLE.u.bg}">${spy('xs')}<span>Undercover wins</span><b>+5</b></div>
    <div style="--rc:#fff">${blank('xs')}<span>Mr. White wins</span><b>+6</b></div>
  </div>
  <div class="foot">${S.game && !S.game.winner ? `<button class="btn" data-act="resume">Back to round ${S.game.no} ${I.arrow}</button>` : `<button class="btn" data-act="again">Play again ${I.arrow}</button>`}
    <div class="links"><button class="link" data-act="edit">${I.users}Edit players</button><button class="link" data-act="reset" data-confirm>${I.cw}<span>Reset scores</span></button></div></div>`;
}

function checkScreen() {
  const c = S.check;
  if (!c.id) {
    return `${header(ib('check-done', I.back, 'Back'), roundChip(), soundBtn())}
    <h1 class="h1 left">Whose word?</h1>
    <p class="sub">Only they look.</p>
    <div class="grid ${gridCls(alive().length)}">${alive().map((id) => `<button class="tile" data-act="check-pick" data-id="${id}" style="--c:${byId(id).color}">${av(id, 'md')}<span class="tile-n">${esc(nameOf(id))}</span></button>`).join('')}</div>`;
  }
  const p = byId(c.id);
  return `${header(ib('check-done', I.back, 'Back'), roundChip(), soundBtn())}
  <div class="pass"><span class="pass-k">Only this person looks</span><h1 class="pass-n" style="font-size:${nameSize(nm(p))}px">${esc(nm(p))}</h1></div>
  <div class="stage">${peekCard(c.id)}</div>
  <div class="foot"><button class="btn ink" data-act="check-done">Hide. Done ${I.check}</button></div>`;
}

const SCREENS = { home, setup, deal, round, vote, out: outScreen, guess: guessScreen, result: resultScreen, board, check: checkScreen };

// ---------- sheets ----------
function rulesSheet() {
  const step = (art, t) => `<li><span class="rs-art">${art}</span><p>${t}</p></li>`;
  return `<div class="sh-head"><h3>How to play</h3>${ib('close', I.x, 'Close')}</div>
  <ol class="rules">
    ${step(guest('xs'), '<b>Civilians</b> all get the same secret word.')}
    ${step(spy('xs'), '<b>Undercover</b> gets a slightly different one, and doesn’t know it.')}
    ${step(blank('xs'), '<b>Mr. White</b> gets no word. He bluffs.')}
    ${step(`<span class="rs-i">${I.vote}</span>`, 'Everyone gives <b>one clue</b>. Then vote someone out.')}
    ${step(`<span class="rs-i">${I.trophy}</span>`, 'Civilians win by catching them all. Undercover and Mr. White win if only <b>one Civilian</b> is left.')}
    ${step(blank('xs sweat'), 'Caught Mr. White gets <b>one guess</b>: he types the word to steal the win. He never goes first.')}
  </ol>`;
}
function packSheet() {
  const all = DATA.packs.reduce((n, p) => n + p.pairs.length, 0);
  const items = [{ id: 'mix', name: 'Mix of everything', blurb: `${all} pairs` }, ...DATA.packs.map((p) => ({ id: p.id, name: p.name, blurb: p.blurb }))];
  return `<div class="sh-head"><h3>Word pack</h3>${ib('close', I.x, 'Close')}</div>
  <div class="plist">${items.map((it, i) => `<button class="pitem ${S.pack === it.id ? 'on' : ''}" data-act="setpack" data-id="${it.id}" style="--c:${COLORS[i % COLORS.length]}">
    <span class="pdot"></span><span class="pmeta"><b>${esc(it.name)}</b><small>${esc(it.blurb)}</small></span>${S.pack === it.id ? `<span class="pchk">${I.check}</span>` : ''}</button>`).join('')}</div>`;
}
function menuSheet() {
  const g = S.game;
  const live = g && !g.winner && GAME_SCREENS.includes(S.screen);
  const items = [];
  if (g?.undo && ['vote', 'out', 'guess', 'result'].includes(S.screen)) items.push(['undo', I.undo, 'Undo last kick-out']);
  if (live && !['deal', 'check'].includes(S.screen)) items.push(['check', I.eye, 'Check my word']);
  items.push(['rules', I.help, 'How to play']);
  items.push(['m-board', I.trophy, 'Scores']);
  if (live) items.push(['m-redeal', I.shuffle, 'New words, deal again', 1]);
  items.push(['edit', I.users, 'Edit players', live ? 1 : 0]);
  items.push(['m-home', I.home, 'Home']);
  return `<div class="sh-head"><h3>Menu</h3>${ib('close', I.x, 'Close')}</div>
  <div class="mlist">${items.map(([a, i, l, c]) => `<button class="mitem" data-act="${a}" ${c ? 'data-confirm' : ''}>${i}<span>${l}</span></button>`).join('')}</div>`;
}
const SHEETS = { rules: rulesSheet, pack: packSheet, menu: menuSheet };
function openSheet(kind) {
  ui.sheet = kind;
  layer.innerHTML = `<div class="scrim" data-act="close"></div><div class="sheet" role="dialog" aria-modal="true">${SHEETS[kind]()}</div>`;
  layer.classList.add('open');
  document.body.classList.add('locked');
}
function closeSheet() {
  if (!ui.sheet) return;
  ui.sheet = null;
  layer.classList.remove('open');
  layer.innerHTML = '';
  document.body.classList.remove('locked');
}

// ---------- render ----------
let theme = document.querySelector('meta[name="theme-color"]');
function flood(color) {
  document.body.style.setProperty('--flood', color || '');
  document.body.classList.toggle('flooded', !!color);
  theme.setAttribute('content', color || '#fff6ee');
}
function render() {
  app.innerHTML = SCREENS[S.screen]();
  app.dataset.screen = S.screen;
  const g = S.game;
  if (S.screen === 'deal') flood(byId(g.ids[g.deal]).color);
  else if (S.screen === 'check' && S.check?.id) flood(byId(S.check.id).color);
  else flood(null);
  save();
  after();
  wake();
}
let renderedAt = 0;
function go(screen) {
  S.screen = screen;
  ui.peeked = false;
  clearTimeout(holdT);
  if (GAME_SCREENS.includes(screen)) S.resume = screen === 'check' ? S.check?.back || 'round' : screen;
  render();
  renderedAt = performance.now();
  window.scrollTo(0, 0);
  app.scrollTop = 0;
}

function after() {
  const g = S.game;
  if (S.screen === 'round' && !g.spun) spin();
  if (S.screen === 'out' && !g.outShown) revealOut();
  if (S.screen === 'result' && !g.celebrated) { g.celebrated = true; save(); celebrate(); }
  if (S.screen === 'guess') app.querySelector('.slots-in')?.focus({ preventScroll: true });
}

function spin() {
  if (app.querySelector('.order')) { pickGrid(); return; }
  const g = S.game;
  const el = app.querySelector('.bottle');
  if (!el || ui.animating === el) return;
  ui.animating = el;
  const stale = () => S.game !== g || S.screen !== 'round' || !el.isConnected;
  const target = Number(el.dataset.rot);
  const done = () => {
    ui.animating = null;
    if (stale()) return;
    S.game.spun = true; save();
    app.querySelector(`[data-seat="${S.game.starter}"]`)?.classList.add('start');
    app.querySelector('.starter')?.classList.add('in');
    const b = app.querySelector('[data-after-spin]'); if (b) b.disabled = false;
    sfx.land(); vibrate(30);
  };
  if (reduced) { el.style.setProperty('--rot', `${target}deg`); done(); return; }
  const total = 360 * 4 + target + rand(2) * 360;
  const dur = 2600;
  requestAnimationFrame(() => {
    el.style.transition = `transform ${dur}ms cubic-bezier(.12,.8,.2,1)`;
    el.style.setProperty('--rot', `${total}deg`);
  });
  // ticks that slow down with the bottle
  let t = 0; let gap = 55;
  while (t < dur - 250) { setTimeout(() => { if (!stale()) sfx.tick(); }, t); t += gap; gap *= 1.13; }
  setTimeout(done, dur + 60);
}

function pickGrid() {
  const g = S.game;
  const box = app.querySelector('.order');
  if (!box || ui.animating === box) return;
  ui.animating = box;
  const stale = () => S.game !== g || S.screen !== 'round' || !box.isConnected;
  const done = () => {
    ui.animating = null;
    if (stale()) return;
    box.querySelectorAll('.flash').forEach((x) => x.classList.remove('flash'));
    S.game.spun = true; save();
    box.querySelector(`[data-seat="${g.starter}"]`)?.classList.add('start');
    box.classList.add('in');
    app.querySelector('.starter')?.classList.add('in');
    const b = app.querySelector('[data-after-spin]'); if (b) b.disabled = false;
    sfx.land(); vibrate(30);
  };
  if (reduced) { done(); return; }
  const pool = alive().filter((id) => g.roles[id] !== 'w');
  const seq = [];
  for (let k = 0; k < 16; k++) seq.push(pool[rand(pool.length)]);
  seq.push(g.starter);
  let t = 0; let gap = 70;
  seq.forEach((id) => {
    setTimeout(() => {
      if (stale()) return;
      box.querySelectorAll('.flash').forEach((x) => x.classList.remove('flash'));
      box.querySelector(`[data-seat="${id}"]`)?.classList.add('flash');
      sfx.tick();
    }, t);
    t += gap; gap *= 1.11;
  });
  setTimeout(done, t + 120);
}

function revealOut() {
  const g = S.game;
  const card = app.querySelector('.flip');
  if (!card || ui.animating === card) return;
  ui.animating = card;
  const finish = () => {
    ui.animating = null;
    if (S.game !== g || S.screen !== 'out' || !card.isConnected) return;
    card.classList.remove('drum'); card.classList.add('on');
    S.game.outShown = true; save();
    app.querySelector('[data-out-foot]')?.classList.remove('wait');
    const r = S.game.roles[S.game.last];
    if (r === 'c') sfx.lose(); else sfx.thump();
    if (r === 'w') setTimeout(sfx.sting, 250);
    vibrate([40, 30, 80]);
  };
  if (reduced) { finish(); return; }
  card.classList.add('drum');
  sfx.drum();
  setTimeout(finish, 1250);
}

function celebrate() {
  if (S.game.winner === 'mw') sfx.whistle(); else sfx.win();
  vibrate([30, 40, 30, 40, 120]);
  if (reduced) return;
  const box = document.createElement('div');
  box.className = 'confetti';
  const cols = ['#f2734f', '#ffbf3c', '#8fc9b0', '#9ec5ff', '#ff9ec4', '#c9b6ff', '#1d2457'];
  for (let i = 0; i < 46; i++) {
    const b = document.createElement('i');
    b.style.cssText = `left:${rand(100)}%;background:${cols[i % cols.length]};animation-delay:${(Math.random() * 0.35).toFixed(2)}s;animation-duration:${(1.1 + Math.random() * 0.9).toFixed(2)}s;--r:${rand(720) - 360}deg;--x:${rand(120) - 60}px;width:${6 + rand(7)}px;height:${8 + rand(9)}px`;
    box.appendChild(b);
  }
  document.body.appendChild(box);
  setTimeout(() => box.remove(), 2600);
}

function fate() {
  const tied = [...ui.tied];
  const pick = tied[rand(tied.length)];
  ui.busy = true;
  const tiles = (id) => app.querySelector(`.tile[data-id="${id}"]`);
  app.querySelectorAll('.tile').forEach((t) => t.classList.remove('sel'));
  let i = 0; let gap = 70; let t = 0;
  const steps = 14 + rand(tied.length);
  const seq = [];
  for (let k = 0; k < steps; k++) seq.push(tied[k % tied.length]);
  seq.push(pick);
  seq.forEach((id, k) => {
    setTimeout(() => {
      app.querySelectorAll('.tile.flash').forEach((x) => x.classList.remove('flash'));
      tiles(id)?.classList.add('flash');
      sfx.tick();
      if (k === seq.length - 1) {
        setTimeout(() => { ui.busy = false; ui.tie = false; ui.tied = []; ui.sel = pick; sfx.land(); render(); }, 450);
      }
    }, t);
    t += gap; gap *= 1.12; i++;
  });
}

// ---------- 3, 2, 1, point! ----------
function countdown() {
  if (ui.busy) return;
  ui.busy = true;
  const el = document.createElement('div');
  el.className = 'cd';
  el.setAttribute('aria-live', 'assertive');
  document.body.appendChild(el);
  const steps = ['3', '2', '1', 'Point!'];
  steps.forEach((t, i) => setTimeout(() => {
    el.innerHTML = `<b class="${i === 3 ? 'go' : ''}">${t}</b>`;
    if (i < 3) { sfx.tick(); vibrate(20); } else { sfx.thump(); vibrate([60, 40, 60]); }
  }, i * (reduced ? 500 : 750)));
  setTimeout(() => { el.classList.add('out'); ui.busy = false; }, 3 * (reduced ? 500 : 750) + 900);
  setTimeout(() => el.remove(), 3 * (reduced ? 500 : 750) + 1250);
}

// ---------- toast ----------
let toastT;
function toast(msg) {
  let el = document.querySelector('.toast');
  if (!el) { el = document.createElement('div'); el.className = 'toast'; el.setAttribute('role', 'status'); document.body.appendChild(el); }
  el.textContent = msg;
  el.classList.add('in');
  clearTimeout(toastT);
  toastT = setTimeout(() => el.classList.remove('in'), 1800);
}

// ---------- actions ----------
function refreshDups() {
  const d = dupSet();
  app.querySelectorAll('[data-row]').forEach((li) => li.classList.toggle('dup', d.has(li.dataset.row)));
  const b = app.querySelector('[data-deal]');
  if (b) { b.disabled = d.size > 0; b.innerHTML = d.size ? 'Two players, same name' : `Deal the cards ${I.arrow}`; }
}
function addPlayer() {
  const used = new Set(S.players.map((p) => p.color));
  const color = COLORS.find((c) => !used.has(c)) || COLORS[S.players.length % COLORS.length];
  S.players.push({ id: uid(), name: '', color });
  S.counts = null;
}

const ACT = {
  sound(el) {
    S.sound = !S.sound; setSound(S.sound); save();
    if (S.sound) sfx.pop();
    app.querySelectorAll('[data-act="sound"]').forEach((b) => { b.innerHTML = S.sound ? I.soundOn : I.soundOff; b.setAttribute('aria-label', S.sound ? 'Sound off' : 'Sound on'); });
  },
  setup() { closeSheet(); if (S.game && !S.game.winner) S.game = null; go('setup'); },
  home() { go('home'); },
  resume() {
    closeSheet();
    const r = S.resume && GAME_SCREENS.includes(S.resume) && S.resume !== 'check' ? S.resume : 'round';
    go(r === 'out' && !S.game.last ? 'round' : r);
  },
  rules() { openSheet('rules'); },
  board() { S.back = S.screen; go('board'); },
  'board-back'() {
    const b = S.back && S.back !== 'board' ? S.back : 'home';
    go((b === 'result' || GAME_SCREENS.includes(b)) && !S.game ? 'home' : b === 'check' ? 'round' : b);
  },
  'm-board'() { closeSheet(); S.back = S.screen; go('board'); },
  'm-home'() { closeSheet(); if (S.game && !S.game.winner) S.resume = S.screen; go('home'); },
  close() { closeSheet(); },
  menu() { openSheet('menu'); },
  pack() { openSheet('pack'); },
  setpack(el) { S.pack = el.dataset.id; closeSheet(); sfx.tap(); render(); },
  pl(el) {
    const d = Number(el.dataset.d);
    if (d > 0 && S.players.length < MAX) addPlayer();
    if (d < 0 && S.players.length > MIN) {
      const blankAt = S.players.map((p) => !(p.name || '').trim()).lastIndexOf(true);
      const [p] = S.players.splice(blankAt >= 0 ? blankAt : S.players.length - 1, 1);
      delete S.scores[p.id]; delete S.streak[p.id]; delete S.last[p.id]; S.counts = null;
    }
    sfx.tap(); render();
  },
  add() {
    addPlayer(); sfx.pop(); render();
    const inputs = app.querySelectorAll('.prow input');
    inputs[inputs.length - 1]?.focus();
  },
  rm(el) {
    S.players = S.players.filter((p) => p.id !== el.dataset.id);
    delete S.scores[el.dataset.id]; delete S.streak[el.dataset.id]; delete S.last[el.dataset.id];
    S.counts = null; sfx.tap(); render();
  },
  color(el) {
    const p = byId(el.dataset.id);
    p.color = COLORS[(COLORS.indexOf(p.color) + 1) % COLORS.length];
    sfx.tap(); render();
  },
  step(el) {
    const r = el.dataset.r; const d = Number(el.dataset.d);
    if (!canStep(r, d)) return;
    const c = counts(); c[r] += d; S.counts = c;
    const t = TABLE[S.players.length];
    if (t && c.u === t[0] && c.w === t[1]) S.counts = null;
    sfx.tap(); render();
  },
  auto() { S.counts = null; sfx.tap(); render(); },
  deal() {
    if (dupSet().size) return;
    S.players.forEach((p) => { p.name = (p.name || '').trim(); });
    newGame(); sfx.shuffle(); go('deal');
  },
  dealt() {
    if (!ui.peeked) return;
    peekOff();
    const g = S.game;
    g.deal += 1;
    sfx.deal();
    if (g.deal >= g.ids.length) { g.starter = null; g.spun = false; go('round'); } else go('deal');
  },
  check() {
    closeSheet();
    S.check = { back: S.screen === 'check' ? S.check?.back || 'round' : S.screen, id: null };
    go('check');
  },
  'check-pick'(el) { S.check.id = el.dataset.id; sfx.tap(); go('check'); },
  'check-done'() { const b = S.check?.back || 'round'; S.check = null; go(b); },
  vote() { ui.sel = null; ui.tie = false; ui.tied = []; sfx.tap(); go('vote'); },
  'back-round'() { go('round'); },
  pick(el) {
    if (ui.busy) return;
    const id = el.dataset.id;
    if (ui.tie) ui.tied = ui.tied.includes(id) ? ui.tied.filter((x) => x !== id) : [...ui.tied, id];
    else ui.sel = ui.sel === id ? null : id;
    sfx.tap(); render();
  },
  tie() { ui.tie = true; ui.tied = []; ui.sel = null; render(); },
  untie() { ui.tie = false; ui.tied = []; render(); },
  fate() { if (ui.tied.length >= 2 && !ui.busy) fate(); },
  kick() { if (ui.sel) kick(ui.sel); },
  'after-out'() { sfx.tap(); ui.typed = ''; afterOut(); },
  undo() { undo(); },
  peek(el) { peekToggle(el); },
  view(el) {
    S.view = el.dataset.v;
    if (S.game && !S.game.spun) S.game.spun = true; // skip the animation, the starter is already picked
    ui.animating = null;
    sfx.tap(); render();
  },
  'g-try'() { submitGuess(); },
  'g-focus'() { app.querySelector('.slots-in')?.focus(); },
  again() { closeSheet(); if (dupSet().size) { go('setup'); return; } newGame(); sfx.shuffle(); go('deal'); },
  count() { countdown(); },
  edit() { closeSheet(); if (S.game && !S.game.winner) S.game = null; go('setup'); },
  'm-redeal'() { closeSheet(); newGame(); sfx.shuffle(); go('deal'); },
  reset() { S.scores = {}; S.streak = {}; S.last = {}; S.rounds = 0; if (S.game?.winner) S.game = null; toast('Scores reset'); render(); },
};

document.addEventListener('click', (e) => {
  unlock();
  const el = e.target.closest('[data-act]');
  if (!el || el.disabled) return;
  if (performance.now() - renderedAt < 350 && !el.closest('#layer')) return;
  if (el.hasAttribute('data-confirm') && !el.classList.contains('armed')) {
    el.classList.add('armed');
    const sp = el.querySelector('span'); if (sp) sp.textContent = 'Tap again to confirm';
    setTimeout(() => { el.classList.remove('armed'); }, 3000);
    return;
  }
  const fn = ACT[el.dataset.act];
  if (fn) { e.preventDefault(); fn(el); }
});

// names: update in place so the keyboard stays up
document.addEventListener('input', (e) => {
  if (e.target.classList?.contains('slots-in')) {
    const n = norm(S.game.civ).length;
    const v = norm(e.target.value).slice(0, n);
    e.target.value = v;
    ui.typed = v;
    app.querySelector('.slots-row').innerHTML = slotsHtml(S.game.civ, v);
    const b = app.querySelector('[data-try]'); if (b) b.disabled = v.length !== n;
    return;
  }
  const inp = e.target.closest('.prow input');
  if (!inp) return;
  const p = byId(inp.dataset.id);
  if (!p) return;
  p.name = chars(inp.value).slice(0, 14).join('');
  inp.closest('.prow').querySelector('.av').textContent = ini(nm(p));
  save(); refreshDups();
});
document.addEventListener('keydown', (e) => {
  if (e.target.classList?.contains('slots-in') && e.key === 'Enter') { e.preventDefault(); submitGuess(); return; }
  const inp = e.target.closest?.('.prow input');
  if (inp && e.key === 'Enter') {
    e.preventDefault();
    const all = [...app.querySelectorAll('.prow input')];
    const nx = all[all.indexOf(inp) + 1];
    if (nx) nx.focus(); else inp.blur();
  }
  if (e.key === 'Escape' && ui.sheet) closeSheet();
});

// ---------- tap to see your word, tap again to hide ----------
let holdT = null; // kept so go() can clear any pending timer
function peekToggle(pk) {
  const on = !pk.classList.contains('on');
  pk.classList.toggle('on', on);
  pk.setAttribute('aria-pressed', String(on));
  sfx.peel(); vibrate(12);
  if (on && !ui.peeked) {
    ui.peeked = true;
    const b = app.querySelector('[data-needs-peek]'); if (b) b.disabled = false;
  }
}
function peekOff() {
  app.querySelectorAll('[data-peek].on').forEach((pk) => { pk.classList.remove('on'); pk.setAttribute('aria-pressed', 'false'); });
}
document.addEventListener('pointerdown', () => unlock());
document.addEventListener('contextmenu', (e) => { if (e.target.closest('[data-peek]')) e.preventDefault(); });
document.addEventListener('visibilitychange', () => { if (document.hidden) peekOff(); else wake(); });
window.addEventListener('pagehide', peekOff);

// ---------- keep the screen on during a round ----------
let lock = null;
let lockPending = false;
async function wake() {
  if (lockPending) return;
  const want = GAME_SCREENS.includes(S.screen) || S.screen === 'result';
  try {
    if (want && !lock && 'wakeLock' in navigator && document.visibilityState === 'visible') {
      lockPending = true;
      lock = await navigator.wakeLock.request('screen');
      lockPending = false;
      lock.addEventListener('release', () => { lock = null; });
    } else if (!want && lock) { lock.release(); lock = null; }
  } catch { lockPending = false; }
}

// ---------- back button / swipe: open the menu instead of leaving mid-game ----------
history.replaceState({ mw: 0 }, '');
history.pushState({ mw: 1 }, '');
window.addEventListener('popstate', () => {
  if (ui.sheet) { closeSheet(); history.pushState({ mw: 1 }, ''); return; }
  if (GAME_SCREENS.includes(S.screen) || S.screen === 'result') { openSheet('menu'); history.pushState({ mw: 1 }, ''); return; }
  if (S.screen !== 'home') { go('home'); history.pushState({ mw: 1 }, ''); return; }
  history.back();
});

document.body.insertAdjacentHTML('beforeend', `<div class="deco" aria-hidden="true"><div class="d1">${blank('blink')}</div><div class="d2">${spy('')}</div><div class="d3">${bottle()}</div><div class="d4">${guest('', '#b9805a')}</div></div>`);
render();
