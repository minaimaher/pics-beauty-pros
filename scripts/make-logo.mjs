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
const p1 = glyph('P', 0);
const bx = p1.box.x2 - 18;
const b = glyph('B', bx);
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

// A face in profile carved into the B's stem, looking left, with a closed, lashed eye.
const face = (ink, cut, eye = cut === '#FFFFFF' ? C.ink : C.rose1) => `
<path fill="${cut}" d="M455 404 C449 418 446 432 445 446 C444 462 436 474 426 486 C420 494 414 502 412 508 C416 514 424 516 430 519 C426 526 422 531 423 536 C427 540 431 543 431 546 C427 550 421 555 422 561 C426 572 434 580 436 590 C440 606 448 624 456 641 L470 641 L470 470 L456 470 L456 404 Z"/>
<path fill="url(#pbp-rose)" d="M425 537 C430 535 436 537 438 541 C436 545 430 547 425 546 C428 544 429 540 425 537 Z"/>
<path fill="#C27B70" d="M422 549 C428 547 436 548 439 552 C436 558 428 561 423 559 C425 556 424 552 422 549 Z"/>
<path fill="none" stroke="${eye}" stroke-width="4.5" stroke-linecap="round" d="M462 478 C474 490 494 492 508 480"/>
<g stroke="${eye}" stroke-width="3" stroke-linecap="round" fill="none">
  <path d="M466 484 l-5 9"/><path d="M473 488 l-3 11"/><path d="M481 490 l-1 12"/><path d="M489 490 l1 12"/><path d="M497 488 l3 11"/><path d="M504 484 l5 9"/>
</g>`;

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

const letters = (ink) => `<g transform="translate(${X(sx)} 0)"><path d="${p1.d}" fill="${ink}"/><path d="${b.d}" fill="url(#pbp-rose)"/><path d="${p2.d}" fill="${ink}"/></g>`;
// `cut` is the background colour: it separates the camera, face and brush from the letters.
const monogram = (ink, cut = '#FFFFFF') => letters(ink) + cam(ink, cut) + face(ink, cut) + brush(ink, cut);

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
