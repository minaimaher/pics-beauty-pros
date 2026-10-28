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
const X = (x) => +(x).toFixed(1);
function glyph(ch, x) {
  const p = serif.getPath(ch, x, BASE, SIZE);
  return { d: p.toPathData(2), box: p.getBoundingBox() };
}
// The B ("woman in profile") and the second P (face inside the bowl) are supplied artwork, traced
// to vector paths in scripts/brand/ (with a 36-unit margin) and scaled to the first P's cap height.
const art = (file, w, h) => ({ d: fs.readFileSync(new URL(`./brand/${file}`, import.meta.url), 'utf8').trim(), w, h, m: 36 });
const B_ART = art('b-face.path', 1380, 1746);
const P_ART = art('p-face.path', 1440, 2316);
function artGlyph(a, x) {
  const k = (BASE - 310) / (a.h - 2 * a.m); // cap height: y 310 to the baseline
  const tx = x - a.m * k, ty = 310 - a.m * k;
  return { transform: `translate(${X(tx)} ${X(ty)}) scale(${k.toFixed(5)})`, d: a.d, box: { x1: x, x2: x + (a.w - 2 * a.m) * k } };
}
// The first P is a camera: its bowl is the camera body, with a lens ring and a viewfinder on top.
const P_CAM = {
  body: 'M0 640 L0 430 A100 100 0 0 1 100 330 L160 330 A90 90 0 0 1 250 420 L250 445 A90 90 0 0 1 160 535 L72 535 L72 632 A8 8 0 0 1 64 640 Z M176 312 L222 312 A7 7 0 0 1 229 319 L229 345 L169 345 L169 319 A7 7 0 0 1 176 312 Z',
  holes: '<circle cx="170" cy="434" r="58" fill="#000"/><circle cx="170" cy="434" r="42" fill="#fff"/><rect x="186" y="320" width="28" height="10" rx="3" fill="#000"/>',
  box: { x1: 0, x2: 250 }
};
const p1 = P_CAM;
const bx = p1.box.x2 + 6;
const b = artGlyph(B_ART, bx);
const p2 = artGlyph(P_ART, b.box.x2 + 14);
const width = p2.box.x2 - p1.box.x1;
const shift = 500 - (p1.box.x1 + width / 2); // centre the monogram on x = 500

const sx = shift; // letters are drawn at x + shift
const MARK_VIEW = `${X(500 - width / 2 - 14)} 296 ${X(width + 28)} 358`;
console.log('mark viewBox', MARK_VIEW);

const letters = (ink) => `<g transform="translate(${X(sx)} 0)"><mask id="pbp-pcam" maskUnits="userSpaceOnUse" x="-20" y="290" width="300" height="370"><rect x="-20" y="290" width="300" height="370" fill="#fff"/>${p1.holes}</mask><path d="${p1.body}" fill="${ink}" mask="url(#pbp-pcam)"/><path d="${b.d}" transform="${b.transform}" fill="url(#pbp-rose)" fill-rule="evenodd"/><path d="${p2.d}" transform="${p2.transform}" fill="${ink}" fill-rule="evenodd"/></g>`;
const monogram = (ink) => letters(ink);

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
const mono = svg(MARK_VIEW, monogram(C.ink));
fs.writeFileSync(OUT + 'pbp-mark.svg', mono);
fs.writeFileSync(OUT + 'pbp-mark-light.svg', svg(MARK_VIEW, monogram('#FFFFFF')));

// 3. App icon / favicon: monogram on a white tile with the gold ring.
fs.writeFileSync(OUT + 'mark-app.svg', svg('0 0 1000 1000', `<rect width="1000" height="1000" rx="220" fill="#fff"/>
<circle cx="500" cy="500" r="430" fill="none" stroke="url(#pbp-gold)" stroke-width="14"/>
<g transform="translate(500 500) scale(.86) translate(-500 -476)">${monogram(C.ink)}</g>`));
fs.writeFileSync(new URL('../web/public/favicon.svg', import.meta.url).pathname, svg('0 0 1000 1000', `<rect width="1000" height="1000" rx="200" fill="#fff"/>
<g transform="translate(500 500) scale(1.18) translate(-500 -476)">${letters(C.ink)}</g>`));
fs.rmSync(OUT + 'draft.svg', { force: true });
console.log('logo files written');
