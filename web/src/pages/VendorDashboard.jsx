import { useEffect, useState } from 'react';
import { api, useApi, useApp, useT, useFormat, navigate, Link, CATEGORY_LABEL } from '../lib.jsx';
import { Loading, ErrorNote, Empty, Tabs, PaymentFields, Modal, MonthCalendar, Stars } from '../components.jsx';
import { BookingsList, BookingDetail } from './Account.jsx';

function CategoryChecks({ value, onChange }) {
  const t = useT();
  return (
    <div className="checks">
      {Object.keys(CATEGORY_LABEL).map((c) => (
        <label key={c} className={'check' + (value.includes(c) ? ' on' : '')}>
          <input type="checkbox" checked={value.includes(c)} onChange={() => onChange(value.includes(c) ? value.filter((x) => x !== c) : [...value, c])} />
          {t(CATEGORY_LABEL[c])}
        </label>
      ))}
    </div>
  );
}

export function VendorApply() {
  const t = useT();
  const { meta, market, refreshSession, vendor } = useApp();
  const [form, setForm] = useState({ business_name: '', country: market, city: '', bio: '', experience_years: '', certifications: '', style_tags: '', categories: [] });
  const [idDoc, setIdDoc] = useState(null);
  const [files, setFiles] = useState([]);
  const [err, setErr] = useState(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => { if (vendor) navigate('/vendor', { replace: true }); }, [vendor]);
  if (!meta) return <Loading />;
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  const submit = async (e) => {
    e.preventDefault();
    setErr(null);
    setBusy(true);
    try {
      const fd = new FormData();
      for (const [k, v] of Object.entries(form)) fd.append(k, Array.isArray(v) ? v.join(',') : v);
      if (idDoc) fd.append('id_document', idDoc);
      await api('/vendor/apply', { method: 'POST', form: fd });
      if (files.length) {
        const md = new FormData();
        files.forEach((f) => md.append('files', f));
        await api('/vendor/media', { method: 'POST', form: md });
      }
      await refreshSession();
      navigate('/vendor');
    } catch (e2) {
      setErr(e2);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="container section narrow">
      <h1>{t('Vendor application')}</h1>
      <ol className="steps-inline small muted">
        <li className="on">{t('Business info')}</li><li>{t('Admin verification')}</li><li>{t('Packages & availability')}</li><li>{t('Go live')}</li>
      </ol>
      <form className="card form" onSubmit={submit}>
        <label className="field">{t('Business name')}<input value={form.business_name} onChange={set('business_name')} required /></label>
        <div className="field"><span>{t('Services you offer')}</span><CategoryChecks value={form.categories} onChange={(c) => setForm({ ...form, categories: c })} /></div>
        <div className="row-2">
          <label className="field">{t('Country')}
            <select value={form.country} onChange={(e) => setForm({ ...form, country: e.target.value, city: '' })}>
              <option value="EG">{t('Egypt')} (EGP)</option><option value="SA">{t('Saudi Arabia')} (SAR)</option>
            </select>
          </label>
          <label className="field">{t('City')}
            <select value={form.city} onChange={set('city')} required>
              <option value="">{t('Choose…')}</option>
              {Object.keys(meta.cities[form.country]).map((c) => <option key={c} value={c}>{t(c)}</option>)}
            </select>
          </label>
        </div>
        <label className="field">{t('About your business')}<textarea rows="4" value={form.bio} onChange={set('bio')} /></label>
        <div className="row-2">
          <label className="field">{t('Years of experience')}<input type="number" min="0" value={form.experience_years} onChange={set('experience_years')} /></label>
          <label className="field">{t('Style tags (comma separated)')}<input value={form.style_tags} onChange={set('style_tags')} placeholder="bridal, editorial, natural" /></label>
        </div>
        <label className="field">{t('Certifications')}<input value={form.certifications} onChange={set('certifications')} /></label>
        <label className="field">{t('ID document (national ID, passport or commercial registration)')}
          <input type="file" accept="image/jpeg,image/png,image/webp,application/pdf" onChange={(e) => setIdDoc(e.target.files[0])} required />
          <span className="small muted">{t('Only visible to our verification team.')}</span>
        </label>
        <label className="field">{t('Portfolio samples')}
          <input type="file" multiple accept="image/*,video/mp4,video/webm,video/quicktime" onChange={(e) => setFiles([...e.target.files])} />
          <span className="small muted">{t('Add your best 6–12 photos or short videos.')}</span>
        </label>
        <ErrorNote error={err} />
        <button className="btn btn-accent" disabled={busy}>{busy ? t('Submitting…') : t('Submit application')}</button>
      </form>
    </div>
  );
}

function Overview({ profile }) {
  const t = useT();
  const fmt = useFormat();
  const { data: d } = useApi('/vendor/dashboard');
  if (!d) return <Loading />;
  const max = Math.max(1, ...d.earnings.monthly.map((m) => m.net));
  const todo = [
    !profile.packages.length && ['packages', 'Add your first package'],
    !profile.media.length && ['portfolio', 'Upload portfolio photos'],
    !profile.payout_method && ['payouts', 'Add a payout account'],
    !profile.faqs.length && ['profile', 'Answer common questions in your FAQ']
  ].filter(Boolean);
  return (
    <>
      {profile.status === 'pending' && <div className="note">{t('Your application is being reviewed. You can set up packages and availability now — your profile goes live once approved.')}</div>}
      {profile.status === 'rejected' && <div className="note danger"><strong>{t('Application needs changes')}</strong><p>{profile.review_notes}</p></div>}
      {profile.status === 'suspended' && <div className="note danger"><strong>{t('Profile suspended')}</strong><p>{profile.review_notes}</p></div>}
      {todo.length > 0 && (
        <div className="card checklist">
          <h2 className="h-small">{t('Finish setting up')}</h2>
          {todo.map(([k, l]) => <Link key={k} to={`/vendor/${k}`}>○ {t(l)}</Link>)}
        </div>
      )}
      <div className="stat-grid">
        <div className="stat"><span>{t('Requests waiting')}</span><strong>{d.bookings.requested}</strong></div>
        <div className="stat"><span>{t('Upcoming bookings')}</span><strong>{d.bookings.upcoming}</strong></div>
        <div className="stat"><span>{t('Completed')}</span><strong>{d.bookings.completed}</strong></div>
        <div className="stat"><span>{t('Rating')}</span><strong>{d.rating_avg ? d.rating_avg.toFixed(1) : '—'}</strong><small>{t('{n} reviews', { n: d.rating_count })}</small></div>
        <div className="stat"><span>{t('Net earnings')}</span><strong>{fmt.money(d.earnings.net, d.currency)}</strong><small>{t('{x} refunded', { x: fmt.money(d.earnings.refunded, d.currency) })}</small></div>
        <div className="stat"><span>{t('Balances outstanding')}</span><strong>{fmt.money(d.earnings.outstanding_balances, d.currency)}</strong></div>
      </div>
      <div className="card">
        <h2 className="h-small">{t('Earnings by month')}</h2>
        {d.earnings.monthly.length === 0 ? <Empty>{t('No payments yet.')}</Empty> : (
          <div className="bars-v" role="img" aria-label={t('Earnings by month')}>
            {d.earnings.monthly.map((m) => (
              <div key={m.month} className="bar-col">
                <span className="small">{fmt.money(m.net, d.currency)}</span>
                <i style={{ height: `${Math.max(4, (m.net / max) * 140)}px` }} />
                <span className="muted small">{fmt.date(m.month + '-01', { month: 'short' })}</span>
              </div>
            ))}
          </div>
        )}
      </div>
      <div className="card">
        <div className="section-head"><h2 className="h-small">{t('Bookings')}</h2><Link to="/vendor/bookings">{t('See all')} →</Link></div>
        <BookingsList asVendor />
      </div>
    </>
  );
}

function ProfileTab({ profile, reload }) {
  const t = useT();
  const { meta, notify } = useApp();
  const [form, setForm] = useState({
    business_name: profile.business_name, bio: profile.bio, city: profile.city, experience_years: profile.experience_years,
    certifications: profile.certifications, style_tags: profile.style_tags.join(', '), categories: profile.categories, service_radius_km: profile.service_radius_km
  });
  const [faqs, setFaqs] = useState(profile.faqs.length ? profile.faqs : [{ question: '', answer: '' }]);
  const [err, setErr] = useState(null);
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });
  const save = async (e) => {
    e.preventDefault();
    setErr(null);
    try {
      await api('/vendor/profile', { method: 'PATCH', body: form });
      await api('/vendor/faqs', { method: 'PUT', body: { faqs } });
      notify(t('Profile saved'));
      reload();
    } catch (e2) { setErr(e2); }
  };
  return (
    <form className="card form" onSubmit={save}>
      <label className="field">{t('Business name')}<input value={form.business_name} onChange={set('business_name')} /></label>
      <div className="field"><span>{t('Services you offer')}</span><CategoryChecks value={form.categories} onChange={(c) => setForm({ ...form, categories: c })} /></div>
      <div className="row-2">
        <label className="field">{t('City')}
          <select value={form.city} onChange={set('city')}>{Object.keys(meta.cities[profile.country]).map((c) => <option key={c} value={c}>{t(c)}</option>)}</select>
        </label>
        <label className="field">{t('Travel radius (km)')}<input type="number" min="0" max="500" value={form.service_radius_km} onChange={set('service_radius_km')} /></label>
      </div>
      <label className="field">{t('About your business')}<textarea rows="5" value={form.bio} onChange={set('bio')} /></label>
      <div className="row-2">
        <label className="field">{t('Years of experience')}<input type="number" min="0" value={form.experience_years} onChange={set('experience_years')} /></label>
        <label className="field">{t('Style tags (comma separated)')}<input value={form.style_tags} onChange={set('style_tags')} /></label>
      </div>
      <label className="field">{t('Certifications')}<input value={form.certifications} onChange={set('certifications')} /></label>
      <h3 className="h-small">{t('FAQ')}</h3>
      {faqs.map((f, i) => (
        <div key={i} className="faq-edit">
          <input value={f.question} placeholder={t('Question')} onChange={(e) => setFaqs(faqs.map((x, j) => (j === i ? { ...x, question: e.target.value } : x)))} />
          <textarea rows="2" value={f.answer} placeholder={t('Answer')} onChange={(e) => setFaqs(faqs.map((x, j) => (j === i ? { ...x, answer: e.target.value } : x)))} />
          <button type="button" className="btn-link danger small" onClick={() => setFaqs(faqs.filter((_, j) => j !== i))}>{t('Remove')}</button>
        </div>
      ))}
      <button type="button" className="btn-link" onClick={() => setFaqs([...faqs, { question: '', answer: '' }])}>+ {t('Add question')}</button>
      <ErrorNote error={err} />
      <button className="btn">{t('Save profile')}</button>
    </form>
  );
}

function PackageForm({ initial, profile, onClose, onSaved }) {
  const t = useT();
  const { meta } = useApp();
  const b = meta.policyBounds;
  const [p, setP] = useState(initial || {
    category: profile.categories[0], title: '', description: '', price: '', duration_hours: 2, booking_mode: 'instant',
    deposit_pct: Math.max(25, b.depositPct[0]), balance_due_days: Math.max(7, b.balanceDueDays[0]), late_refund_pct: 0,
    refund_schedule: [{ days_before: 60, pct: 100 }, { days_before: 30, pct: 50 }]
  });
  const [err, setErr] = useState(null);
  const set = (k) => (e) => setP({ ...p, [k]: e.target.value });
  const setTier = (i, k, v) => setP({ ...p, refund_schedule: p.refund_schedule.map((r, j) => (j === i ? { ...r, [k]: v } : r)) });
  const save = async (e) => {
    e.preventDefault();
    setErr(null);
    try {
      await api(initial ? `/vendor/packages/${initial.id}` : '/vendor/packages', { method: initial ? 'PUT' : 'POST', body: p });
      onSaved();
    } catch (e2) { setErr(e2); }
  };
  return (
    <Modal title={initial ? t('Edit package') : t('New package')} onClose={onClose} wide>
      <form className="form" onSubmit={save}>
        <div className="row-2">
          <label className="field">{t('Category')}
            <select value={p.category} onChange={set('category')}>{profile.categories.map((c) => <option key={c} value={c}>{t(CATEGORY_LABEL[c])}</option>)}</select>
          </label>
          <label className="field">{t('Title')}<input value={p.title} onChange={set('title')} required /></label>
        </div>
        <label className="field">{t('What\'s included')}<textarea rows="3" value={p.description} onChange={set('description')} /></label>
        <div className="row-3">
          <label className="field">{t('Price')} ({profile.currency})<input type="number" min="1" value={p.price} onChange={set('price')} required /></label>
          <label className="field">{t('Duration (hours)')}<input type="number" min="0.5" max="16" step="0.5" value={p.duration_hours} onChange={set('duration_hours')} /></label>
          <label className="field">{t('Booking mode')}
            <select value={p.booking_mode} onChange={set('booking_mode')}>
              <option value="instant">{t('Instant book')}</option><option value="request">{t('Request to book')}</option>
            </select>
          </label>
        </div>
        <fieldset>
          <legend>{t('Payment & cancellation terms')}</legend>
          <p className="small muted">{t('Platform limits: deposit {a}–{b}%, balance due {c}–{d} days before the event, earliest refund tier at least {e}%.', { a: b.depositPct[0], b: b.depositPct[1], c: b.balanceDueDays[0], d: b.balanceDueDays[1], e: b.minEarlyRefundPct })}</p>
          <div className="row-3">
            <label className="field">{t('Deposit %')}<input type="number" min={b.depositPct[0]} max={b.depositPct[1]} value={p.deposit_pct} onChange={set('deposit_pct')} /></label>
            <label className="field">{t('Balance due (days before)')}<input type="number" min={b.balanceDueDays[0]} max={b.balanceDueDays[1]} value={p.balance_due_days} onChange={set('balance_due_days')} /></label>
            <label className="field">{t('Refund after balance due %')}<input type="number" min={b.lateRefundPct[0]} max={b.lateRefundPct[1]} value={p.late_refund_pct} onChange={set('late_refund_pct')} /></label>
          </div>
          <span className="small">{t('Deposit refund if cancelled before the balance due date')}</span>
          {p.refund_schedule.map((r, i) => (
            <div key={i} className="tier-row">
              <span>{t('Cancelled')}</span>
              <input type="number" min={p.balance_due_days} value={r.days_before} onChange={(e) => setTier(i, 'days_before', e.target.value)} aria-label={t('days before')} />
              <span>{t('+ days before → refund')}</span>
              <input type="number" min="0" max="100" value={r.pct} onChange={(e) => setTier(i, 'pct', e.target.value)} aria-label="%" />
              <span>%</span>
              <button type="button" className="btn-link danger small" onClick={() => setP({ ...p, refund_schedule: p.refund_schedule.filter((_, j) => j !== i) })}>✕</button>
            </div>
          ))}
          <button type="button" className="btn-link small" onClick={() => setP({ ...p, refund_schedule: [...p.refund_schedule, { days_before: Number(p.balance_due_days), pct: 0 }] })}>+ {t('Add tier')}</button>
        </fieldset>
        <ErrorNote error={err} />
        <div className="modal-actions"><button className="btn">{t('Save package')}</button></div>
      </form>
    </Modal>
  );
}

function PackagesTab({ profile, reload }) {
  const t = useT();
  const fmt = useFormat();
  const { notify } = useApp();
  const [edit, setEdit] = useState(null);
  const active = profile.packages.filter((p) => p.active);
  const archive = async (p) => {
    if (!confirm(t('Archive this package? Existing bookings are not affected.'))) return;
    await api(`/vendor/packages/${p.id}`, { method: 'DELETE' });
    notify(t('Package archived'));
    reload();
  };
  return (
    <>
      <div className="section-head">
        <p className="muted small">{t('{n} of {max} packages on your plan', { n: active.length, max: profile.limits.maxPackages })}</p>
        <button className="btn" onClick={() => setEdit('new')}>+ {t('New package')}</button>
      </div>
      {active.length === 0 && <Empty>{t('Add packages so customers can book you.')}</Empty>}
      <div className="packages">
        {active.map((p) => (
          <article key={p.id} className="package">
            <div className="pkg-top">
              <div><span className="muted small">{t(CATEGORY_LABEL[p.category])} · {t('{h} hours', { h: p.duration_hours })}</span><h3>{p.title}</h3></div>
              <div className="pkg-price">{fmt.money(p.price, profile.currency)}</div>
            </div>
            <p className="small muted">{p.booking_mode === 'instant' ? t('Instant book') : t('Request to book')} · {t('Deposit')} {p.deposit_pct}% · {t('Balance {d} days before', { d: p.balance_due_days })}</p>
            <div className="actions">
              <button className="btn btn-ghost btn-small" onClick={() => setEdit(p)}>{t('Edit')}</button>
              <button className="btn-link danger small" onClick={() => archive(p)}>{t('Archive')}</button>
            </div>
          </article>
        ))}
      </div>
      {edit && <PackageForm initial={edit === 'new' ? null : edit} profile={profile} onClose={() => setEdit(null)} onSaved={() => { setEdit(null); notify(t('Package saved')); reload(); }} />}
    </>
  );
}

function PortfolioTab({ profile, reload }) {
  const t = useT();
  const { notify } = useApp();
  const [err, setErr] = useState(null);
  const [busy, setBusy] = useState(false);
  const upload = async (e) => {
    const files = [...e.target.files];
    if (!files.length) return;
    setBusy(true);
    setErr(null);
    try {
      const fd = new FormData();
      files.forEach((f) => fd.append('files', f));
      await api('/vendor/media', { method: 'POST', form: fd });
      notify(t('Uploaded'));
      reload();
    } catch (e2) { setErr(e2); } finally { setBusy(false); e.target.value = ''; }
  };
  const remove = async (m) => {
    if (!confirm(t('Delete this item?'))) return;
    await api(`/vendor/media/${m.id}`, { method: 'DELETE' });
    reload();
  };
  const caption = async (m, c) => api(`/vendor/media/${m.id}`, { method: 'PATCH', body: { caption: c } });
  return (
    <>
      <div className="section-head">
        <p className="muted small">{t('{n} of {max} items on your plan', { n: profile.media.length, max: profile.limits.maxMedia })}</p>
        <label className="btn">{busy ? t('Uploading…') : '+ ' + t('Upload photos or videos')}<input type="file" hidden multiple accept="image/*,video/mp4,video/webm,video/quicktime" onChange={upload} /></label>
      </div>
      <ErrorNote error={err} />
      {profile.media.length === 0 && <Empty>{t('Your portfolio is the first thing customers see. Upload your best work.')}</Empty>}
      <div className="media-grid">
        {profile.media.map((m) => (
          <figure key={m.id} className={'media-item' + (m.status === 'hidden' ? ' hidden-item' : '')}>
            {m.kind === 'video' ? <video src={m.url} controls preload="metadata" /> : <img src={m.url} alt={m.caption} loading="lazy" />}
            {m.status === 'hidden' && <span className="badge status-cancelled">{t('Hidden by moderators')}</span>}
            <input defaultValue={m.caption} placeholder={t('Caption')} onBlur={(e) => e.target.value !== m.caption && caption(m, e.target.value)} />
            <button className="btn-link danger small" onClick={() => remove(m)}>{t('Delete')}</button>
          </figure>
        ))}
      </div>
    </>
  );
}

function CalendarTab({ profile, reload }) {
  const t = useT();
  const fmt = useFormat();
  const { meta, notify } = useApp();
  const [hours, setHours] = useState({ working_days: profile.working_days, work_start: profile.work_start, work_end: profile.work_end });
  const [month, setMonth] = useState(meta.today.slice(0, 7));
  const [bookings, setBookings] = useState([]);
  const [err, setErr] = useState(null);
  useEffect(() => { api('/bookings?as=vendor').then((d) => setBookings(d.bookings)); }, []);
  const blocked = new Set(profile.blocked_dates);
  const [y, m] = month.split('-').map(Number);
  const days = [...Array(new Date(Date.UTC(y, m, 0)).getUTCDate())].map((_, i) => {
    const date = `${month}-${String(i + 1).padStart(2, '0')}`;
    const dow = new Date(date + 'T00:00:00Z').getUTCDay();
    const count = bookings.filter((b) => b.event_date === date && ['requested', 'confirmed'].includes(b.status)).length;
    const state = date <= meta.today ? 'past' : blocked.has(date) || !profile.working_days.includes(dow) ? 'unavailable' : count ? 'partial' : 'available';
    return { date, state, count, selectable: date > meta.today };
  });
  const toggle = async (date) => {
    await api('/vendor/blocked-dates', { method: 'POST', body: { date, blocked: !blocked.has(date) } });
    reload();
  };
  const saveHours = async () => {
    setErr(null);
    try {
      await api('/vendor/calendar', { method: 'PUT', body: hours });
      notify(t('Working hours saved'));
      reload();
    } catch (e) { setErr(e); }
  };
  const dayName = (d) => fmt.date(`2026-02-0${d + 1}`, { weekday: 'short' });
  return (
    <div className="cal-tab">
      <div className="card">
        <h2 className="h-small">{t('Block or unblock dates')}</h2>
        <p className="small muted">{t('Click a future date to block it (holidays, personal days). Numbers show bookings on that day.')}</p>
        <MonthCalendar month={month} days={days} onMonth={setMonth} onSelect={toggle} minMonth={meta.today.slice(0, 7)}
          renderDay={(d) => (d.count ? <span className="cal-count">{d.count}</span> : null)} />
      </div>
      <div className="card form">
        <h2 className="h-small">{t('Working hours')}</h2>
        <div className="checks">
          {[0, 1, 2, 3, 4, 5, 6].map((d) => (
            <label key={d} className={'check' + (hours.working_days.includes(d) ? ' on' : '')}>
              <input type="checkbox" checked={hours.working_days.includes(d)} onChange={() => setHours({ ...hours, working_days: hours.working_days.includes(d) ? hours.working_days.filter((x) => x !== d) : [...hours.working_days, d] })} />
              {dayName(d)}
            </label>
          ))}
        </div>
        <div className="row-2">
          <label className="field">{t('Start')}<input type="time" value={hours.work_start} onChange={(e) => setHours({ ...hours, work_start: e.target.value })} /></label>
          <label className="field">{t('End')}<input type="time" value={hours.work_end} onChange={(e) => setHours({ ...hours, work_end: e.target.value })} /></label>
        </div>
        <ErrorNote error={err} />
        <button className="btn" onClick={saveHours}>{t('Save hours')}</button>
      </div>
    </div>
  );
}

function ReviewsTab({ profile, reload }) {
  const t = useT();
  const fmt = useFormat();
  const { notify } = useApp();
  const [drafts, setDrafts] = useState({});
  const respond = async (r) => {
    await api(`/vendor/reviews/${r.id}/respond`, { method: 'POST', body: { response: drafts[r.id] } });
    notify(t('Response posted'));
    reload();
  };
  return (
    <>
      <p><Stars value={profile.rating_avg} count={profile.rating_count} size="lg" /></p>
      {profile.reviews.length === 0 && <Empty>{t('Reviews from completed bookings appear here.')}</Empty>}
      {profile.reviews.map((r) => (
        <article key={r.id} className="review card">
          <div className="review-top">
            <strong>{r.customer_name}</strong>
            <span className="stars sm"><span className="star-fill">{'★'.repeat(r.rating)}</span></span>
            <span className="muted small">{r.package_title} · {fmt.date(r.event_date)}</span>
            {r.status === 'hidden' && <span className="badge status-cancelled">{t('Hidden by moderators')}</span>}
          </div>
          <p>{r.body}</p>
          {r.vendor_response ? <blockquote className="response"><p>{r.vendor_response}</p></blockquote> : (
            <div className="respond">
              <textarea rows="2" placeholder={t('Write a public response…')} value={drafts[r.id] || ''} onChange={(e) => setDrafts({ ...drafts, [r.id]: e.target.value })} />
              <button className="btn btn-small" disabled={!drafts[r.id]} onClick={() => respond(r)}>{t('Respond')}</button>
            </div>
          )}
        </article>
      ))}
    </>
  );
}

function SubscriptionTab({ profile, reload }) {
  const t = useT();
  const fmt = useFormat();
  const { meta, notify } = useApp();
  const [choice, setChoice] = useState(null);
  const [payment, setPayment] = useState({ method: 'card' });
  const [err, setErr] = useState(null);
  const inTrial = profile.subscription_status === 'trialing' && profile.trial_ends_at > meta.today;
  const subscribe = async () => {
    setErr(null);
    try {
      await api('/vendor/subscription', { method: 'POST', body: { tier: choice, payment } });
      setChoice(null);
      notify(t('Plan updated'));
      reload();
    } catch (e) { setErr(e); }
  };
  const cancel = async () => {
    if (!confirm(t('Cancel your subscription? You will drop to Basic limits.'))) return;
    await api('/vendor/subscription/cancel', { method: 'POST' });
    reload();
  };
  return (
    <>
      <div className="card">
        <p>{t('Current plan')}: <strong>{t({ basic: 'Basic', pro: 'Pro', featured: 'Featured' }[profile.tier_selected])}</strong> · <span className="badge">{t(profile.subscription_status)}</span></p>
        {inTrial && <p className="small">{t('Free trial until {d}. Your card is charged when the trial ends.', { d: fmt.date(profile.trial_ends_at) })}</p>}
        {profile.renews_at && profile.subscription_status === 'active' && <p className="small">{t('Renews on {d}', { d: fmt.date(profile.renews_at) })}</p>}
        {profile.subscription_status === 'past_due' && <p className="small danger">{t('Payment needed — paid-plan benefits are paused.')}</p>}
        <p className="small muted">{t('Subscriptions are the only platform fee — there is no commission on your bookings.')}</p>
      </div>
      <div className="tier-grid">
        {['basic', 'pro', 'featured'].map((k) => {
          const tier = meta.tiers[k];
          const price = tier.price[profile.currency];
          const current = profile.tier_selected === k && profile.subscription_status !== 'cancelled';
          return (
            <div key={k} className={'tier-card' + (current ? ' highlight' : '')}>
              <h3>{t({ basic: 'Basic', pro: 'Pro', featured: 'Featured' }[k])}</h3>
              <p className="tier-price">{price ? fmt.money(price, profile.currency) : t('Free')}<span className="muted small">{price ? ' / ' + t('month') : ''}</span></p>
              <ul>
                <li>{t('{n} portfolio items', { n: tier.maxMedia })}</li>
                <li>{t('{n} active packages', { n: tier.maxPackages })}</li>
                <li>{tier.maxBookingsPerMonth ? t('{n} bookings per month', { n: tier.maxBookingsPerMonth }) : t('Unlimited bookings')}</li>
                {k !== 'basic' && <li>{t('Higher placement in search')}</li>}
                {k === 'featured' && <li>{t('Homepage slot and promoted badge')}</li>}
              </ul>
              {current ? <span className="badge">{t('Current plan')}</span> : <button className="btn btn-small" onClick={() => setChoice(k)}>{t('Switch to {p}', { p: t({ basic: 'Basic', pro: 'Pro', featured: 'Featured' }[k]) })}</button>}
            </div>
          );
        })}
      </div>
      {profile.tier_selected !== 'basic' && profile.subscription_status !== 'cancelled' && <button className="btn-link danger" onClick={cancel}>{t('Cancel subscription')}</button>}
      {choice && (
        <Modal title={t('Switch plan')} onClose={() => setChoice(null)}>
          {choice !== 'basic' && (
            <>
              <p>{inTrial ? t('No charge today — your card is saved and billed when the trial ends.') : t('You will be charged {x} today and every 30 days.', { x: fmt.money(meta.tiers[choice].price[profile.currency], profile.currency) })}</p>
              <PaymentFields country={profile.country} value={payment} onChange={setPayment} methods={['card']} />
            </>
          )}
          <ErrorNote error={err} />
          <div className="modal-actions"><button className="btn" onClick={subscribe}>{t('Confirm')}</button></div>
        </Modal>
      )}
    </>
  );
}

function PayoutsTab({ profile, reload }) {
  const t = useT();
  const fmt = useFormat();
  const { notify } = useApp();
  const { data } = useApi('/vendor/payments');
  const [form, setForm] = useState({ payout_method: profile.payout_method || 'bank', payout_account: profile.payout_account || '' });
  const [err, setErr] = useState(null);
  const save = async (e) => {
    e.preventDefault();
    setErr(null);
    try {
      await api('/vendor/payout', { method: 'PUT', body: form });
      notify(t('Payout details saved'));
      reload();
    } catch (e2) { setErr(e2); }
  };
  return (
    <>
      <form className="card form" onSubmit={save}>
        <h2 className="h-small">{t('Where customer payments are sent')}</h2>
        <div className="row-2">
          <label className="field">{t('Method')}
            <select value={form.payout_method} onChange={(e) => setForm({ ...form, payout_method: e.target.value })}>
              <option value="bank">{t('Bank account (IBAN)')}</option><option value="wallet">{t('Mobile wallet')}</option>
            </select>
          </label>
          <label className="field">{form.payout_method === 'bank' ? 'IBAN' : t('Wallet number')}<input value={form.payout_account} onChange={(e) => setForm({ ...form, payout_account: e.target.value })} /></label>
        </div>
        <ErrorNote error={err} />
        <button className="btn">{t('Save')}</button>
      </form>
      <div className="card">
        <h2 className="h-small">{t('Transactions')}</h2>
        {!data ? <Loading /> : (
          <div className="table-wrap">
            <table className="table">
              <thead><tr><th>{t('Date')}</th><th>{t('Type')}</th><th>{t('Booking')}</th><th>{t('Status')}</th><th className="num">{t('Amount')}</th></tr></thead>
              <tbody>
                {data.payments.map((p) => (
                  <tr key={p.id}>
                    <td className="small">{fmt.dateTime(p.created_at)}</td>
                    <td>{t({ deposit: 'Deposit', balance: 'Balance', refund: 'Refund', subscription: 'Subscription' }[p.kind])}</td>
                    <td className="small">{p.code ? <Link to={`/vendor/bookings/${p.booking_id}`}>{p.code}</Link> : p.description}</td>
                    <td className="small">{p.status === 'failed' ? <span className="danger">{t('failed')}</span> : t('succeeded')}</td>
                    <td className={'num' + (p.kind === 'refund' || p.kind === 'subscription' ? ' danger' : '')}>{p.kind === 'refund' || p.kind === 'subscription' ? '−' : ''}{fmt.money(p.amount, p.currency)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </>
  );
}

export function VendorDashboard({ section, sub }) {
  const t = useT();
  const { vendor, ready } = useApp();
  const { data: profile, error, reload } = useApi(vendor ? '/vendor/profile' : null, [vendor?.id]);
  useEffect(() => { if (ready && !vendor) navigate('/vendor/apply', { replace: true }); }, [ready, vendor]);
  if (error) return <div className="container section"><ErrorNote error={error} /></div>;
  if (!profile) return <Loading />;
  if (section === 'bookings' && sub) return <BookingDetail id={sub} asVendor />;
  const tabs = [['', 'Overview'], ['bookings', 'Bookings'], ['packages', 'Packages'], ['portfolio', 'Portfolio'], ['calendar', 'Calendar'], ['profile', 'Profile & FAQ'], ['reviews', 'Reviews'], ['subscription', 'Subscription'], ['payouts', 'Payouts']];
  const props = { profile, reload };
  return (
    <div className="container section dash">
      <div className="dash-head">
        <div>
          <p className="eyebrow">{t('Vendor dashboard')}</p>
          <h1>{profile.business_name}</h1>
        </div>
        <div className="head-actions">
          <span className={'badge ' + ({ approved: 'status-confirmed', pending: 'status-requested' }[profile.status] || 'status-cancelled')}>{t({ approved: 'Live', pending: 'Pending review' }[profile.status] || profile.status)}</span>
          {profile.status === 'approved' && <Link className="btn btn-ghost btn-small" to={`/vendors/${profile.id}`}>{t('View public profile')}</Link>}
        </div>
      </div>
      <Tabs tabs={tabs} active={section || ''} base="/vendor" />
      <div className="tab-body">
        {!section && <Overview {...props} />}
        {section === 'bookings' && <BookingsList asVendor />}
        {section === 'packages' && <PackagesTab {...props} />}
        {section === 'portfolio' && <PortfolioTab {...props} />}
        {section === 'calendar' && <CalendarTab {...props} />}
        {section === 'profile' && <ProfileTab {...props} />}
        {section === 'reviews' && <ReviewsTab {...props} />}
        {section === 'subscription' && <SubscriptionTab {...props} />}
        {section === 'payouts' && <PayoutsTab {...props} />}
      </div>
    </div>
  );
}
