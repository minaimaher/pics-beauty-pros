import { useT, BASE } from '../lib.jsx';
import { POOLS, pexels } from '../../../server/photos.js';

const COLORS = [
  ['Aubergine', '#2A1734', 'Text, buttons, footer and the app icon'],
  ['Orchid', '#7A3F8C', 'Links, focus rings and "Pros" in the wordmark'],
  ['Champagne', '#E9B9A2', 'Ratings and highlights on dark backgrounds'],
  ['Rose gold', '#C27B70', 'The B and its face profile, "Beauty" in the wordmark'],
  ['Gold', '#B9853F', 'The camera lens, brush ferrule and the badge ring'],
  ['Mist', '#F5F3F8', 'Quiet panels and placeholders'],
  ['Porcelain', '#FFFFFF', 'Page background, so the photos carry the colour']
];

const ASSETS = [
  ['logo-badge.svg', 'Badge logo'], ['logo-badge.png', 'Badge logo PNG'], ['logo-badge-on-dark.svg', 'Badge for dark backgrounds'],
  ['pbp-mark.svg', 'Monogram'], ['pbp-mark-light.svg', 'Monogram (light, for dark backgrounds)'], ['mark-app.svg', 'App icon SVG'],
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
        <p className="muted">The logo is a <strong>PBP monogram</strong> that shows the whole marketplace in three letters: the first <strong>P</strong> is a camera, its bowl the body with a lens and viewfinder (photographers and videographers); the rose-gold <strong>B</strong> frames a woman’s face in a sweep of hair, with two leaves; and the last <strong>P</strong> frames a face with a hair bun inside its bowl (makeup and hair professionals). The three letters interlock into one mark, the B woven over both Ps. The full badge sets the monogram in a gold double ring above the wordmark.</p>
        <div className="logo-grid">
          <div className="logo-tile light"><img src={asset('logo-badge.svg')} alt="Pics Beauty Pros badge" width="260" height="260" /></div>
          <div className="logo-tile dark"><img src={asset('logo-badge-on-dark.svg')} alt="Pics Beauty Pros badge on a dark background" width="260" height="260" /></div>
          <div className="logo-tile light stack"><img src={asset('pbp-mark.svg')} alt="PBP monogram" width="240" height="113" /><span className="wordmark big">Pics <b>Beauty</b> Pros</span></div>
          <div className="logo-tile dark stack" dir="rtl"><img src={asset('pbp-mark-light.svg')} alt="PBP monogram, light" width="240" height="113" /><span className="wordmark big ar">بيكس <b>بيوتي</b> برو</span></div>
          <div className="logo-tile icons"><img src={asset('mark-app.svg')} alt="App icon" width="96" height="96" /><img src={asset('mark-app.svg')} alt="" width="48" height="48" /><img src={`${BASE}/favicon.svg`} alt="Favicon" width="24" height="24" /></div>
        </div>
        <ul className="rules">
          <li>Keep clear space around the logo of at least half the mark’s height.</li>
          <li>Use the monogram on its own (or the app icon) below 120 px wide; use the full badge only from 160 px wide.</li>
          <li>Don’t recolour the monogram, separate the camera or faces from their letters, add effects, or set the wordmark in another typeface.</li>
          <li>On photos, place the light version over a dark overlay of at least 60% Aubergine, using the light monogram.</li>
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
