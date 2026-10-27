// Builds the Pics Beauty Pros logo set as pure vector SVG (text converted to outlines so it
// renders the same everywhere). Run: node scripts/make-logo.mjs
import fs from 'node:fs';
import opentype from 'opentype.js';

const font = (p) => opentype.loadSync(new URL(`../node_modules/${p}`, import.meta.url).pathname);
const serif = font('@fontsource/bodoni-moda/files/bodoni-moda-latin-600-normal.woff');
const sans = font('@fontsource/alexandria/files/alexandria-latin-400-normal.woff');
const OUT = new URL('../web/public/brand/', import.meta.url).pathname;

export const C = {
  ink: '#2A1734',
  gold1: '#E2BC86', gold2: '#B9853F',
  rose1: '#EBB7A8', rose2: '#C27B70',
  blush: '#F3C9BC',
  white: '#FFFFFF'
};

const defs = `<defs>
  <linearGradient id="pbp-rose" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${C.rose1}"/><stop offset=".55" stop-color="#D9978A"/><stop offset="1" stop-color="${C.rose2}"/></linearGradient>
  <linearGradient id="pbp-gold" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${C.gold1}"/><stop offset=".5" stop-color="${C.gold2}"/><stop offset="1" stop-color="${C.gold1}"/></linearGradient>
  <linearGradient id="pbp-bristle" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#F6D3C8"/><stop offset="1" stop-color="#D79A8D"/></linearGradient>
</defs>`;

// Monogram glyphs: P (ink), B (rose gold), P (ink), sitting on one baseline.
const SIZE = 440, BASE = 640;
function glyph(ch, x) {
  const p = serif.getPath(ch, x, BASE, SIZE);
  return { d: p.toPathData(2), box: p.getBoundingBox() };
}
// The B's stem is a face in profile looking left: its left edge runs from the neck up over the
// chin, lips, nose and brow to the forehead. Points are relative to the glyph's left edge.
const PROFILE = [
  [52, 640],
  ['C', 50, 622, 47, 604, 44, 594], ['C', 38, 590, 30, 586, 27, 578], ['C', 24, 572, 25, 564, 30, 560],
  ['C', 33, 558, 34, 556, 33, 554], ['C', 28, 553, 25, 549, 26, 545], ['C', 27, 543, 30, 542, 32, 541],
  ['C', 27, 539, 23, 535, 24, 531], ['C', 25, 527, 29, 525, 31, 523], ['C', 26, 521, 14, 518, 8, 514],
  ['C', 3, 511, 3, 505, 7, 502], ['C', 16, 490, 26, 474, 30, 458], ['C', 31, 452, 30, 446, 28, 441],
  ['C', 25, 434, 24, 424, 26, 414], ['C', 30, 384, 38, 348, 50, 320], ['C', 52, 315, 55, 311, 60, 310]
];
function faceB(x) {
  const cmds = serif.getPath('B', x, BASE, SIZE).commands;
  const left = cmds[1].x; // left edge of the serifs
  const top = cmds.findIndex((c, i) => i > 1 && c.type === 'L' && c.y === cmds[7].y && c.x > left + 100);
  const pt = (n) => (+n).toFixed(1);
  let d = `M${pt(cmds[0].x)} ${pt(cmds[0].y)}`;
  for (const q of PROFILE) {
    if (q[0] === 'C') d += `C${pt(left + q[1])} ${pt(q[2])} ${pt(left + q[3])} ${pt(q[4])} ${pt(left + q[5])} ${pt(q[6])}`;
    else d += `L${pt(left + q[0])} ${pt(q[1])}`;
  }
  const rest = new opentype.Path();
  rest.commands = cmds.slice(top);
  d += rest.toPathData(2).replace(/^M/, 'L');
  const box = serif.getPath('B', x, BASE, SIZE).getBoundingBox();
  return { d, box, left };
}
const p1 = glyph('P', 0);
const bx = p1.box.x2 - 8;
const b = faceB(bx);
const p2 = glyph('P', b.box.x2 - 12);
const width = p2.box.x2 - p1.box.x1;
const shift = 500 - (p1.box.x1 + width / 2); // centre the monogram on x = 500

const X = (x) => +(x).toFixed(1);
const sx = shift; // letters are drawn at x + shift

// Camera sitting on the first P's stem, with a gold-rimmed lens.
const cam = (ink, cut) => `<g transform="translate(227 500) scale(.8) translate(-227 -500)">
<g stroke="${cut}" stroke-width="9" paint-order="stroke" stroke-linejoin="round">
  <path fill="${ink}" d="M108 440 h38 l6 -12 h28 l6 12 h22 l18 -30 h84 l18 30 h14 a22 22 0 0 1 22 22 v84 a22 22 0 0 1 -22 22 h-212 a22 22 0 0 1 -22 -22 v-84 a22 22 0 0 1 22 -22 z"/>
</g>
<circle cx="227" cy="500" r="56" fill="${cut}"/>
<circle cx="227" cy="500" r="50" fill="none" stroke="url(#pbp-gold)" stroke-width="9"/>
<circle cx="227" cy="500" r="38" fill="${C.ink}"/>
<circle cx="227" cy="500" r="25" fill="none" stroke="#fff" stroke-opacity=".18" stroke-width="3"/>
<circle cx="213" cy="486" r="7" fill="#fff" fill-opacity=".85"/>
<rect x="120" y="456" width="26" height="10" rx="3" fill="url(#pbp-gold)"/></g>`;

// Lips and a closed, lashed eye on the B's face; drawn in the letters' coordinates.
const face = () => { const l = b.left; const x = (n) => X(l + n); return `
<path fill="#B9675E" d="M${x(31)} 523 C${x(29)} 525 ${x(25)} 527 ${x(24)} 531 C${x(23)} 535 ${x(27)} 539 ${x(32)} 541 C${x(30)} 542 ${x(27)} 543 ${x(26)} 545 C${x(25)} 549 ${x(28)} 553 ${x(33)} 554 C${x(38)} 553 ${x(42)} 549 ${x(43)} 545 C${x(42)} 538 ${x(38)} 527 ${x(31)} 523 Z"/>
<path fill="none" stroke="#8E4A45" stroke-width="1.8" stroke-linecap="round" d="M${x(31)} 541 C${x(35)} 541.5 ${x(39)} 542.5 ${x(43)} 544"/>
<path fill="none" stroke="${C.ink}" stroke-width="2.2" stroke-linecap="round" d="M${x(48)} 429 C${x(56)} 423 ${x(69)} 422 ${x(80)} 427"/>
<path fill="none" stroke="${C.ink}" stroke-width="3.6" stroke-linecap="round" d="M${x(50)} 448 C${x(57)} 456 ${x(71)} 457 ${x(80)} 448"/>
<g stroke="${C.ink}" stroke-width="2.3" stroke-linecap="round" fill="none">
  <path d="M${x(52)} 451 l-5 6"/><path d="M${x(57)} 454 l-3 8"/><path d="M${x(63)} 455.5 l-1 8"/><path d="M${x(69)} 455.5 l1 8"/><path d="M${x(75)} 453 l3 7"/>
</g>`; };

// Makeup brush leaning across the second P.
const brush = (ink, cut) => `
<g transform="translate(${X(sx + 650)} 612) rotate(24) scale(.8)">
  <g stroke="${cut}" stroke-width="8" paint-order="stroke" stroke-linejoin="round">
    <path fill="${ink}" d="M-7 0 C-8 -60 -9 -110 -10 -152 L10 -152 C9 -110 8 -60 7 0 C6 8 -6 8 -7 0 Z"/>
    <path fill="url(#pbp-gold)" d="M-12 -152 L12 -152 L13 -200 L-13 -200 Z"/>
    <path fill="url(#pbp-bristle)" d="M-13 -200 C-30 -222 -44 -248 -40 -276 C-34 -300 -12 -312 0 -312 C12 -312 34 -300 40 -276 C44 -248 30 -222 13 -200 Z"/>
  </g>
  <g stroke="#C9877B" stroke-opacity=".55" stroke-width="1.6" fill="none">
    <path d="M0 -204 L0 -306"/><path d="M-6 -204 L-22 -298"/><path d="M6 -204 L22 -298"/><path d="M-10 -206 L-34 -284"/><path d="M10 -206 L34 -284"/>
  </g>
  <path d="M-12 -170 h24" stroke="#fff" stroke-opacity=".5" stroke-width="2"/>
</g>`;

const letters = (ink) => `<g transform="translate(${X(sx)} 0)"><path d="${p1.d}" fill="${ink}"/><path d="${b.d}" fill="url(#pbp-rose)"/><path d="${p2.d}" fill="${ink}"/>${face()}</g>`;
// `cut` is the background colour: it separates the camera, face and brush from the letters.
const monogram = (ink, cut = '#FFFFFF') => letters(ink) + cam(ink, cut) + brush(ink, cut);

// Tracked capitals for the wordmark: PICS (ink) BEAUTY (rose) PROS (ink).
function wordmark(ink, y, size = 50, track = 0.36) {
  const parts = [['PICS', ink], ['BEAUTY', 'url(#pbp-rose)'], ['PROS', ink]];
  const gap = size * 0.55;
  const adv = (ch) => sans.getAdvanceWidth(ch, size) + size * track;
  const total = parts.reduce((w, [t]) => w + [...t].reduce((a, ch) => a + adv(ch), 0), 0) - size * track + gap * 2;
  let x = 500 - total / 2;
  let out = '';
  parts.forEach(([t, fill], k) => {
    let d = '';
    for (const ch of t) { d += sans.getPath(ch, x, y, size).toPathData(2); x += adv(ch); }
    out += `<path d="${d}" fill="${fill}"/>`;
    x += gap - size * track;
  });
  return out;
}

const ornament = (y) => `
<g fill="none" stroke="${C.gold2}" stroke-width="2.5" stroke-linecap="round">
  <path d="M300 ${y} H448"/><path d="M552 ${y} H700"/>
  <path d="M448 ${y} c10 -14 26 -14 30 -2 c3 9 -7 13 -12 7"/><path d="M552 ${y} c-10 -14 -26 -14 -30 -2 c-3 9 7 13 12 7"/>
</g>
<path fill="url(#pbp-gold)" d="M500 ${y - 22} L509 ${y - 4} L500 ${y + 14} L491 ${y - 4} Z"/>`;

const rings = `
<circle cx="500" cy="500" r="438" fill="none" stroke="url(#pbp-gold)" stroke-width="6"/>
<path fill="none" stroke="url(#pbp-gold)" stroke-width="3" stroke-linecap="round" d="M ${X(500 + 462 * Math.cos(Math.PI * 1.15))} ${X(500 + 462 * Math.sin(Math.PI * 1.15))} A 462 462 0 0 1 ${X(500 + 462 * Math.cos(Math.PI * 1.72))} ${X(500 + 462 * Math.sin(Math.PI * 1.72))}"/>
<path fill="none" stroke="url(#pbp-gold)" stroke-width="3" stroke-linecap="round" d="M ${X(500 + 462 * Math.cos(Math.PI * 0.18))} ${X(500 + 462 * Math.sin(Math.PI * 0.18))} A 462 462 0 0 1 ${X(500 + 462 * Math.cos(Math.PI * 0.72))} ${X(500 + 462 * Math.sin(Math.PI * 0.72))}"/>`;

const svg = (viewBox, body, bg = '') => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${viewBox}" role="img" aria-label="Pics Beauty Pros">${defs}${bg}${body}</svg>\n`;

// 1. Full badge (primary logo), on light and dark.
const badge = (ink, word, bg) => svg('0 0 1000 1000', `${rings}<g transform="translate(500 438) scale(.8) translate(-500 -476)">${monogram(ink)}</g>${wordmark(word, 668, 44)}${ornament(726)}`, bg);
fs.writeFileSync(OUT + 'logo-badge.svg', badge(C.ink, C.ink, ''));
fs.writeFileSync(OUT + 'logo-badge-on-dark.svg', badge(C.ink, C.ink, `<circle cx="500" cy="500" r="438" fill="#fff"/>`));

// 2. Monogram only, cropped tight, for the site header.
const mono = svg('108 290 790 370', monogram(C.ink));
fs.writeFileSync(OUT + 'pbp-mark.svg', mono);
fs.writeFileSync(OUT + 'pbp-mark-light.svg', svg('108 290 790 370', monogram('#FFFFFF', C.ink)));

// 3. App icon / favicon: monogram on a white tile with the gold ring.
fs.writeFileSync(OUT + 'mark-app.svg', svg('0 0 1000 1000', `<rect width="1000" height="1000" rx="220" fill="#fff"/>
<circle cx="500" cy="500" r="430" fill="none" stroke="url(#pbp-gold)" stroke-width="14"/>
<g transform="translate(500 500) scale(.86) translate(-500 -476)">${monogram(C.ink)}</g>`));
fs.writeFileSync(new URL('../web/public/favicon.svg', import.meta.url).pathname, svg('0 0 1000 1000', `<rect width="1000" height="1000" rx="200" fill="#fff"/>
<g transform="translate(500 500) scale(1.18) translate(-500 -476)">${letters(C.ink)}</g>`));
fs.rmSync(OUT + 'draft.svg', { force: true });
console.log('logo files written');
