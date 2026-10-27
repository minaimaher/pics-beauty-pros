import { useT, BASE } from '../lib.jsx';
import { BrandMark } from '../components.jsx';
import { POOLS, pexels } from '../../../server/photos.js';

const COLORS = [
  ['Aubergine', '#2A1734', 'Text, buttons, footer and the app icon'],
  ['Orchid', '#7A3F8C', 'Links, focus rings and "Pros" in the wordmark'],
  ['Champagne', '#E9B9A2', 'Ratings and highlights on dark backgrounds'],
  ['Blush', '#F6D3C2', 'The petals and the lens ring'],
  ['Mist', '#F5F3F8', 'Quiet panels and placeholders'],
  ['Porcelain', '#FFFFFF', 'Page background, so the photos carry the colour']
];

const ASSETS = [
  ['logo.svg', 'Logo (light backgrounds)'], ['logo.png', 'Logo PNG'], ['logo-on-dark.svg', 'Logo (dark backgrounds)'],
  ['logo-on-dark.png', 'Logo on dark PNG'], ['mark.svg', 'Mark only'], ['mark-app.svg', 'App icon SVG'],
  ['icon-512.png', 'App icon 512 px'], ['og-image.png', 'Social share image']
];

export function Brand() {
  const t = useT();
  const asset = (f) => `${BASE}/brand/${f}`;
  const samples = [POOLS.wedding[1], POOLS.makeupWork[0], POOLS.maternity[0], POOLS.hijabBride[0]];
  return (
    <div className="container section brand-page">
      <p className="eyebrow">{t('Brand guidelines')}</p>
      <h1>Pics Beauty Pros</h1>
      <p className="lead">Book the pros behind your moments. · <span dir="rtl">احجز المحترفين خلف أجمل لحظاتك</span></p>

      <section className="brand-sec">
        <h2>Logo</h2>
        <p className="muted">The mark is an <strong>aperture bloom</strong>: six petals arranged like the blades of a camera aperture, opening around a lens. It joins the two sides of the marketplace — the camera (photography and film) and the bloom (makeup and hair).</p>
        <div className="logo-grid">
          <div className="logo-tile light"><BrandMark size={56} /><span className="wordmark big">Pics Beauty <b>Pros</b></span></div>
          <div className="logo-tile dark"><BrandMark size={56} /><span className="wordmark big">Pics Beauty <b>Pros</b></span></div>
          <div className="logo-tile light" dir="rtl"><BrandMark size={56} /><span className="wordmark big ar">بيكس بيوتي <b>برو</b></span></div>
          <div className="logo-tile icons"><BrandMark size={96} app /><BrandMark size={48} app /><BrandMark size={24} app /></div>
        </div>
        <ul className="rules">
          <li>Keep clear space around the logo of at least half the mark’s height.</li>
          <li>Use the mark on its own (or the app icon) below 120 px wide; don’t shrink the wordmark under 16 px tall.</li>
          <li>Don’t recolour the petals, add effects, or set the wordmark in another typeface.</li>
          <li>On photos, place the light version over a dark overlay of at least 60% Plum Night.</li>
        </ul>
      </section>

      <section className="brand-sec">
        <h2>Colour</h2>
        <div className="swatches">
          {COLORS.map(([name, hex, use]) => (
            <div key={hex} className="swatch">
              <span className="chip-color" style={{ background: hex }} />
              <strong>{name}</strong>
              <code>{hex}</code>
              <span className="muted small">{use}</span>
            </div>
          ))}
        </div>
      </section>

      <section className="brand-sec">
        <h2>Typography</h2>
        <div className="type-grid">
          <div className="card"><p className="muted small">Headlines and interface: Alexandria</p><p className="type-display">Moments, beautifully booked.</p></div>
          <div className="card"><p className="muted small">Body text: IBM Plex Sans Arabic</p><p className="type-text">Verified vendors, real portfolios, clear prices and live availability.</p></div>
          <div className="card" dir="rtl"><p className="muted small">العربية: Alexandria</p><p className="type-ar">احجز مصورك وخبيرة المكياج في دقائق.</p></div>
        </div>
      </section>

      <section className="brand-sec">
        <h2>Voice</h2>
        <div className="type-grid">
          <div className="card"><strong>Warm, not gushing</strong><p className="small">“Your date is confirmed” — not “Yay!! You’re all set!!!”</p></div>
          <div className="card"><strong>Clear about money</strong><p className="small">Always show the deposit, the balance and the due date in plain numbers.</p></div>
          <div className="card"><strong>Vendor-proud</strong><p className="small">The work is the hero. Let portfolios speak; keep our UI quiet around them.</p></div>
        </div>
      </section>

      <section className="brand-sec">
        <h2>Photography</h2>
        <p className="muted">Real moments in natural or warm light: getting ready, first looks, behind the camera. Pages stay white and quiet so the photos carry the colour. Demo photos are from Pexels.</p>
        <div className="photo-strip">{samples.map(([id, caption]) => <img key={id} src={pexels(id, 600)} alt={caption} loading="lazy" />)}</div>
      </section>

      <section className="brand-sec">
        <h2>Downloads</h2>
        <div className="downloads">
          {ASSETS.map(([f, label]) => <a key={f} className="chip" href={asset(f)} download>{label} ↓</a>)}
        </div>
      </section>
    </div>
  );
}
