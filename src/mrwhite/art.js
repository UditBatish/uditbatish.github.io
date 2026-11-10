// Characters, drawn as flat stickers: navy outline, flat fills, no gradients.
const INK = '#1d2457';
const SKIN = ['#f1c6a0', '#d9a074', '#b9805a', '#e8b48a'];

// Mr. White: a blank sticker with a face. Poses via classes: blink, sweat, shades.
export function blank(cls = '') {
  const shades = cls.includes('shades');
  return `<svg class="art mw ${cls}" viewBox="0 0 120 150" aria-hidden="true">
  <g fill="none" stroke="${INK}" stroke-width="4" stroke-linecap="round">
    <path d="M46 112 L42 134"/><path d="M74 112 L78 134"/>
    <path class="arm-l" d="M18 74 Q7 80 5 95"/><path class="arm-r" d="M102 72 Q113 64 115 50"/>
  </g>
  <rect x="27" y="130" width="21" height="11" rx="5.5" fill="#f2734f" stroke="${INK}" stroke-width="3"/>
  <rect x="72" y="130" width="21" height="11" rx="5.5" fill="#f2734f" stroke="${INK}" stroke-width="3"/>
  <rect x="16" y="14" width="88" height="100" rx="20" fill="#fff" stroke="${INK}" stroke-width="4"/>
  <path d="M80 15.5 Q99 19 102.5 40 L80 40 Z" fill="#ffe0cc" stroke="${INK}" stroke-width="3" stroke-linejoin="round"/>
  ${shades ? `
  <path d="M33 50 H87" stroke="${INK}" stroke-width="4"/>
  <rect x="33" y="48" width="24" height="14" rx="3" fill="${INK}"/><rect x="63" y="48" width="24" height="14" rx="3" fill="${INK}"/>
  <rect x="37" y="51" width="6" height="3" fill="#fff"/><rect x="67" y="51" width="6" height="3" fill="#fff"/>
  <path d="M46 80 Q60 92 74 80" fill="none" stroke="${INK}" stroke-width="4" stroke-linecap="round"/>` : `
  <g class="eyes"><ellipse cx="46" cy="58" rx="6" ry="8" fill="${INK}"/><ellipse cx="72" cy="58" rx="6" ry="8" fill="${INK}"/>
  <circle cx="48" cy="55" r="2.2" fill="#fff"/><circle cx="74" cy="55" r="2.2" fill="#fff"/></g>
  <path d="M37 43 Q45 37 53 41" fill="none" stroke="${INK}" stroke-width="4" stroke-linecap="round"/>
  <path d="M65 40 Q73 36 81 42" fill="none" stroke="${INK}" stroke-width="4" stroke-linecap="round"/>
  <path d="M46 84 q4 -5 7 0 t7 0 t7 0 t7 0" fill="none" stroke="${INK}" stroke-width="4" stroke-linecap="round"/>`}
  <path class="drop" d="M96 50 q6 9 0 12.5 q-6 -3.5 0 -12.5z" fill="#9ec5ff" stroke="${INK}" stroke-width="2.5"/>
</svg>`;
}

function bust(body, face, cls, skin) {
  return `<svg class="art bust ${cls}" viewBox="0 0 120 130" aria-hidden="true">
  <path d="M16 130 V114 Q16 86 60 86 Q104 86 104 114 V130 Z" fill="${body}" stroke="${INK}" stroke-width="4" stroke-linejoin="round"/>
  <rect x="44" y="102" width="32" height="20" rx="4" fill="#fff" stroke="${INK}" stroke-width="3"/>
  <path d="M45.5 103.5 H74.5 V109 H45.5 Z" fill="#e85d3f"/>
  <circle cx="60" cy="54" r="31" fill="${skin}" stroke="${INK}" stroke-width="4"/>
  <path d="M29 54 Q27 21 60 21 Q93 21 91 52 Q81 37 64 39 Q47 41 29 54 Z" fill="#232333" stroke="${INK}" stroke-width="3.5" stroke-linejoin="round"/>
  ${face}
</svg>`;
}

// Civilian: a party guest with a name tag.
export function guest(cls = '', skin = SKIN[0]) {
  return bust('#8fc9b0', `
  <circle cx="49" cy="59" r="3.8" fill="${INK}"/><circle cx="71" cy="59" r="3.8" fill="${INK}"/>
  <circle cx="42" cy="68" r="4.5" fill="#ff9ec4" opacity=".7"/><circle cx="78" cy="68" r="4.5" fill="#ff9ec4" opacity=".7"/>
  <path d="M50 70 Q60 79 70 70" fill="none" stroke="${INK}" stroke-width="4" stroke-linecap="round"/>`, `guest ${cls}`, skin);
}

// Undercover: the same guest hiding behind a photo-booth prop on a stick.
export function spy(cls = '', skin = SKIN[1]) {
  return bust('#ffbf3c', `
  <path d="M90 120 L80 80" stroke="#1d2457" stroke-width="5" stroke-linecap="round"/>
  <path d="M38 57 H82" stroke="${INK}" stroke-width="4"/>
  <circle cx="48" cy="58" r="11" fill="${INK}"/><circle cx="72" cy="58" r="11" fill="${INK}"/>
  <path d="M42 54 q4 -4 8 -2" stroke="#fff" stroke-width="3" fill="none" stroke-linecap="round"/>
  <path d="M66 54 q4 -4 8 -2" stroke="#fff" stroke-width="3" fill="none" stroke-linecap="round"/>
  <path d="M40 76 q9 -10 20 -2 q11 -8 20 2 q-5 7 -12 3 q-5 -2 -8 1 q-3 -3 -8 -1 q-7 4 -12 -3z" fill="${INK}"/>`, `spy ${cls}`, skin);
}

// Spin-the-bottle: points up by default.
export function bottle() {
  return `<svg class="art bottle-svg" viewBox="0 0 44 140" aria-hidden="true">
  <rect x="15" y="6" width="14" height="34" rx="3" fill="#7fc8a0" stroke="${INK}" stroke-width="3"/>
  <rect x="13.5" y="3" width="17" height="9" rx="2.5" fill="#f2734f" stroke="${INK}" stroke-width="3"/>
  <path d="M15 38 Q4 50 4 66 V126 Q4 136 14 136 H30 Q40 136 40 126 V66 Q40 50 29 38 Z" fill="#7fc8a0" stroke="${INK}" stroke-width="3.5" stroke-linejoin="round"/>
  <rect x="9" y="80" width="26" height="28" rx="4" fill="#fff6ee" stroke="${INK}" stroke-width="2.5"/>
  <path d="M15 90 h14 M15 98 h9" stroke="${INK}" stroke-width="2.5" stroke-linecap="round"/>
  <path d="M11 64 V74" stroke="#fff" stroke-width="3.5" stroke-linecap="round" opacity=".8"/>
</svg>`;
}

export const ART = { c: guest, u: spy, w: blank };
