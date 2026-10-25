import { useEffect, useMemo, useState } from 'react';
import { api, useApi, useApp, useT, useFormat, navigate, useLocation, Link, CATEGORY_LABEL } from '../lib.jsx';
import { Stars, TierBadge, Loading, ErrorNote, MonthCalendar, PaymentFields, Empty, Avatar } from '../components.jsx';
import { MapView } from '../MapView.jsx';

export function addDays(date, n) {
  const d = new Date(date + 'T00:00:00Z');
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

export function PolicySummary({ policy, currency, price }) {
  const t = useT();
  const fmt = useFormat();
  return (
    <div className="policy">
      <p><strong>{t('Deposit')}:</strong> {policy.deposit_pct}%{price != null && ` (${fmt.money(Math.round((price * policy.deposit_pct) / 100), currency)})`} {t('at booking')}</p>
      <p><strong>{t('Balance')}:</strong> {t('due {d} days before the event', { d: policy.balance_due_days })}</p>
      <ul className="small">
        {policy.refund_schedule.map((r) => (
          <li key={r.days_before}>{t('Cancel {d}+ days before: {p}% of deposit refunded', { d: r.days_before, p: r.pct })}</li>
        ))}
        <li>{t('After the balance due date: {p}% of amount paid refunded', { p: policy.late_refund_pct })}</li>
        <li>{t('Same-day cancellation or no-show: no refund')}</li>
      </ul>
    </div>
  );
}

function Gallery({ media }) {
  const [open, setOpen] = useState(null);
  const t = useT();
  if (!media.length) return null;
  return (
    <>
      <div className="gallery">
        {media.slice(0, 5).map((m, i) => (
          <button key={m.id} className={'g-item' + (i === 0 ? ' big' : '')} onClick={() => setOpen(i)} aria-label={m.caption || t('Open image')}>
            {m.kind === 'video' ? <video src={m.url} muted preload="metadata" /> : <img src={m.url} alt={m.caption} loading="lazy" />}
            {m.kind === 'video' && <span className="play">▶</span>}
            {i === 4 && media.length > 5 && <span className="more">{t('+{n} more', { n: media.length - 5 })}</span>}
          </button>
        ))}
      </div>
      {open != null && (
        <div className="lightbox" onClick={() => setOpen(null)} role="dialog" aria-modal="true">
          <button className="lb-nav prev" onClick={(e) => { e.stopPropagation(); setOpen((open - 1 + media.length) % media.length); }} aria-label={t('Previous')}>‹</button>
          <figure onClick={(e) => e.stopPropagation()}>
            {media[open].kind === 'video' ? <video src={media[open].url} controls autoPlay /> : <img src={media[open].url} alt={media[open].caption} />}
            {media[open].caption && <figcaption>{media[open].caption}</figcaption>}
          </figure>
          <button className="lb-nav next" onClick={(e) => { e.stopPropagation(); setOpen((open + 1) % media.length); }} aria-label={t('Next')}>›</button>
        </div>
      )}
    </>
  );
}

function VendorAreaMap({ v }) {
  const center = useMemo(() => [v.lat, v.lng], [v.lat, v.lng]);
  const markers = useMemo(() => [{ id: v.id, lat: v.lat, lng: v.lng, avatar: v.avatar_url, initials: (v.owner_first_name || v.business_name)[0] }], [v]);
  return <MapView height={300} fit={false} zoom={10} center={center} circleKm={v.service_radius_km} markers={markers} />;
}

export function VendorProfile({ id }) {
  const { user, notify, meta } = useApp();
  const t = useT();
  const fmt = useFormat();
  const { data: v, error } = useApi(`/vendors/${id}`, [id]);
  const [month, setMonth] = useState(null);
  const [cal, setCal] = useState(null);
  const [cat, setCat] = useState('');

  useEffect(() => { if (meta && !month) setMonth(meta.today.slice(0, 7)); }, [meta, month]);
  useEffect(() => { if (month) api(`/vendors/${id}/calendar?month=${month}`).then(setCal).catch(() => {}); }, [id, month]);

  if (error) return <div className="container section"><ErrorNote error={error} /></div>;
  if (!v) return <Loading />;

  const message = async () => {
    if (!user) return navigate(`/login?next=/vendors/${id}`);
    if (user.role !== 'customer') return notify(t('Sign in with a customer account to message vendors.'), 'error');
    const th = await api('/messages/threads', { method: 'POST', body: { vendorId: v.id } });
    navigate(`/messages/${th.id}`);
  };
  const flag = async (reviewId) => {
    if (!user) return navigate(`/login?next=/vendors/${id}`);
    const reason = prompt(t('Why should moderators look at this review?'));
    if (reason) {
      await api('/flags', { method: 'POST', body: { type: 'review', id: reviewId, reason } });
      notify(t('Thanks — our moderators will take a look.'));
    }
  };
  const packages = v.packages.filter((p) => !cat || p.category === cat);

  return (
    <div className="profile">
      <div className="container">
        <div className="profile-head">
          <div className="profile-id">
            <Avatar src={v.avatar_url} name={v.owner_first_name || v.business_name} size={88} />
            <div>
            <p className="eyebrow">{v.categories.map((c) => t(CATEGORY_LABEL[c])).join(' · ')}</p>
            <h1>{v.business_name} <TierBadge tier={v.tier} /></h1>
            <p className="muted">
              {v.district ? `${t(v.district)}, ` : ''}{t(v.city)} · <Stars value={v.rating_avg} count={v.rating_count} /> · {t('{n} years experience', { n: v.experience_years })}
              <span className="badge badge-verified">✓ {t('Verified vendor')}</span>
            </p>
            {v.owner_first_name && <p className="small owner-line">{t('Run by {name}', { name: v.owner_first_name })}</p>}
            </div>
          </div>
          <div className="head-actions">
            <button className="btn btn-ghost" onClick={message}>{t('Message')}</button>
            <a className="btn" href="#packages">{t('See packages')}</a>
          </div>
        </div>
        <Gallery media={v.media} />
        <div className="profile-cols">
          <div className="profile-main">
            <section className="section-sm">
              <h2>{t('About')}</h2>
              <p className="prewrap">{v.bio}</p>
              {v.certifications && <p className="small"><strong>{t('Certifications & experience')}:</strong> {v.certifications}</p>}
              <div className="tags">{v.style_tags.map((tag) => <span key={tag} className="tag">{tag}</span>)}</div>
            </section>

            <section className="section-sm" id="packages">
              <div className="section-head">
                <h2>{t('Packages')}</h2>
                {v.categories.length > 1 && (
                  <div className="seg">
                    <button className={!cat ? 'on' : ''} onClick={() => setCat('')}>{t('All')}</button>
                    {v.categories.map((c) => <button key={c} className={cat === c ? 'on' : ''} onClick={() => setCat(c)}>{t(CATEGORY_LABEL[c])}</button>)}
                  </div>
                )}
              </div>
              <div className="packages">
                {packages.map((p) => (
                  <article key={p.id} className="package">
                    <div className="pkg-top">
                      <div>
                        <span className="muted small">{t(CATEGORY_LABEL[p.category])} · {t('{h} hours', { h: p.duration_hours })}</span>
                        <h3>{p.title}</h3>
                      </div>
                      <div className="pkg-price">{fmt.money(p.price, v.currency)}</div>
                    </div>
                    <p>{p.description}</p>
                    <details>
                      <summary className="small">{t('Payment & cancellation terms')}</summary>
                      <PolicySummary policy={p} currency={v.currency} price={p.price} />
                    </details>
                    <div className="pkg-foot">
                      <span className={'badge ' + (p.booking_mode === 'instant' ? 'badge-instant' : 'badge-request')}>
                        {p.booking_mode === 'instant' ? '⚡ ' + t('Instant book') : t('Request to book')}
                      </span>
                      <Link className="btn" to={`/book/${v.id}/${p.id}`}>{p.booking_mode === 'instant' ? t('Book now') : t('Request booking')}</Link>
                    </div>
                  </article>
                ))}
              </div>
            </section>

            {v.lat != null && (
              <section className="section-sm">
                <h2>{t('Location')}</h2>
                <p className="muted">
                  {t('Based in {place}', { place: [v.district && t(v.district), t(v.city)].filter(Boolean).join(', ') })}
                  {v.service_radius_km > 0 && ` · ${t('Travels up to {km} km', { km: v.service_radius_km })}`}
                </p>
                <VendorAreaMap v={v} />
                <p className="small muted">{t('The pin shows the vendor\'s area, not an exact address.')}</p>
              </section>
            )}

            {v.faqs.length > 0 && (
              <section className="section-sm">
                <h2>{t('FAQ')}</h2>
                {v.faqs.map((f) => <details key={f.id} className="faq"><summary>{f.question}</summary><p>{f.answer}</p></details>)}
              </section>
            )}

            <section className="section-sm">
              <h2>{t('Reviews')}</h2>
              <div className="review-summary">
                <div className="big-rating"><span>{v.rating_avg ? v.rating_avg.toFixed(1) : '—'}</span><span className="muted small">{t('{n} reviews', { n: v.rating_count })}</span></div>
                <div className="bars">
                  {v.rating_distribution.map((d) => (
                    <div key={d.stars} className="bar-row"><span>{d.stars}★</span><div className="bar"><i style={{ width: `${v.rating_count ? (d.count / v.rating_count) * 100 : 0}%` }} /></div><span className="muted small">{d.count}</span></div>
                  ))}
                </div>
              </div>
              {v.reviews.length === 0 && <Empty>{t('No reviews yet.')}</Empty>}
              {v.reviews.map((r) => (
                <article key={r.id} className="review">
                  <div className="review-top">
                    <strong>{r.customer_name}</strong>
                    <span className="stars sm"><span className="star-fill">{'★'.repeat(r.rating)}</span><span className="muted">{'★'.repeat(5 - r.rating)}</span></span>
                    <span className="badge badge-verified">✓ {t('Verified booking')}</span>
                  </div>
                  <p className="muted small">{r.package_title} · {fmt.date(r.event_date)}</p>
                  <p>{r.body}</p>
                  {r.vendor_response && <blockquote className="response"><strong>{t('Response from {name}', { name: v.business_name })}</strong><p>{r.vendor_response}</p></blockquote>}
                  <button className="btn-link small" onClick={() => flag(r.id)}>{t('Report')}</button>
                </article>
              ))}
            </section>
          </div>
          <aside className="profile-side">
            <div className="card sticky">
              <h2 className="h-small">{t('Availability')}</h2>
              {cal && month ? <MonthCalendar month={month} days={cal.days} onMonth={setMonth} minMonth={meta?.today.slice(0, 7)} /> : <Loading />}
              <p className="small muted">{t('Working hours')}: {v.work_start}–{v.work_end}</p>
              <a className="btn btn-block" href="#packages">{t('Choose a package')}</a>
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
}

export function Checkout({ vendorId, packageId }) {
  const { user, meta, notify } = useApp();
  const t = useT();
  const fmt = useFormat();
  const { query } = useLocation();
  const { data: v, error } = useApi(`/vendors/${vendorId}`, [vendorId]);
  const [month, setMonth] = useState(null);
  const [cal, setCal] = useState(null);
  const [date, setDate] = useState(query.date || '');
  const [slots, setSlots] = useState(null);
  const [form, setForm] = useState({ startTime: '', location: '', notes: '' });
  const [payment, setPayment] = useState({});
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(null);

  useEffect(() => { if (!user && meta) navigate(`/login?next=/book/${vendorId}/${packageId}`, { replace: true }); }, [user, meta, vendorId, packageId]);
  useEffect(() => { if (meta && !month) setMonth((query.date || meta.today).slice(0, 7)); }, [meta, month, query.date]);
  useEffect(() => { if (month) api(`/vendors/${vendorId}/calendar?month=${month}`).then(setCal).catch(() => {}); }, [vendorId, month]);
  useEffect(() => {
    setSlots(null);
    setForm((f) => ({ ...f, startTime: '' }));
    if (date) api(`/vendors/${vendorId}/slots?packageId=${packageId}&date=${date}`).then((d) => setSlots(d.slots));
  }, [date, vendorId, packageId]);

  if (error) return <div className="container section"><ErrorNote error={error} /></div>;
  if (!v || !meta) return <Loading />;
  const pkg = v.packages.find((p) => String(p.id) === String(packageId));
  if (!pkg) return <div className="container section"><ErrorNote error={{ message: t('Package not found') }} /></div>;

  let deposit = Math.round((pkg.price * pkg.deposit_pct) / 100);
  let due = date ? addDays(date, -pkg.balance_due_days) : null;
  if (due && due <= meta.today) { due = meta.today; deposit = pkg.price; }
  const instant = pkg.booking_mode === 'instant';

  const submit = async (e) => {
    e.preventDefault();
    if (user?.role !== 'customer') return setErr({ message: t('Sign in with a customer account to book.') });
    setBusy(true);
    setErr(null);
    try {
      const b = await api('/bookings', { method: 'POST', body: { packageId: pkg.id, eventDate: date, ...form, payment: { method: meta.paymentMethods[v.country][0], ...payment } } });
      notify(instant ? t('Booked! Your date is confirmed.') : t('Request sent. Your deposit is held until the vendor responds.'));
      navigate(`/bookings/${b.id}`);
    } catch (e2) {
      setErr(e2);
      if (date) api(`/vendors/${vendorId}/slots?packageId=${packageId}&date=${date}`).then((d) => setSlots(d.slots));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="container section checkout">
      <Link to={`/vendors/${v.id}`} className="back">← {v.business_name}</Link>
      <h1>{instant ? t('Book {title}', { title: pkg.title }) : t('Request {title}', { title: pkg.title })}</h1>
      <form className="checkout-cols" onSubmit={submit}>
        <div className="checkout-main">
          <section className="card">
            <h2 className="h-small">1 · {t('Choose a date')}</h2>
            {cal && month && <MonthCalendar month={month} days={cal.days} onMonth={setMonth} selected={date} onSelect={setDate} minMonth={meta.today.slice(0, 7)} />}
          </section>
          {date && (
            <section className="card">
              <h2 className="h-small">2 · {t('Start time on {d}', { d: fmt.date(date) })}</h2>
              {!slots ? <Loading /> : slots.length === 0 ? <Empty>{t('No free time for this package on that day. Pick another date.')}</Empty> : (
                <div className="slots">
                  {slots.map((s) => (
                    <button type="button" key={s} className={'slot' + (form.startTime === s ? ' on' : '')} onClick={() => setForm({ ...form, startTime: s })}>{s}</button>
                  ))}
                </div>
              )}
            </section>
          )}
          <section className="card">
            <h2 className="h-small">3 · {t('Details')}</h2>
            <label className="field">{t('Event location')}<input value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} placeholder={t('Venue name or address')} required /></label>
            <label className="field">{t('Notes for the vendor')}<textarea rows="3" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} placeholder={t('Event type, number of people, style references…')} /></label>
          </section>
          <section className="card">
            <PaymentFields country={v.country} value={payment} onChange={setPayment} />
          </section>
        </div>
        <aside className="checkout-side">
          <div className="card sticky summary">
            <h2 className="h-small">{v.business_name}</h2>
            <p>{pkg.title}</p>
            <p className="muted small">{date ? fmt.date(date) : t('No date yet')}{form.startTime && ` · ${form.startTime}`} · {t('{h} hours', { h: pkg.duration_hours })}</p>
            <dl className="totals">
              <dt>{t('Package price')}</dt><dd>{fmt.money(pkg.price, v.currency)}</dd>
              <dt>{deposit === pkg.price ? t('Pay in full now') : t('Deposit due now ({p}%)', { p: pkg.deposit_pct })}</dt><dd><strong>{fmt.money(deposit, v.currency)}</strong></dd>
              {deposit < pkg.price && <><dt>{t('Balance due by {d}', { d: due ? fmt.date(due) : '—' })}</dt><dd>{fmt.money(pkg.price - deposit, v.currency)}</dd></>}
            </dl>
            <PolicySummary policy={pkg} currency={v.currency} />
            {!instant && <p className="small note">{t('This vendor confirms each request. If they decline or don\'t respond within 48 hours, your deposit is refunded in full.')}</p>}
            <ErrorNote error={err} />
            <button className="btn btn-accent btn-block" disabled={busy || !date || !form.startTime}>
              {busy ? t('Processing…') : instant ? t('Pay {amount} & book', { amount: fmt.money(deposit, v.currency) }) : t('Pay {amount} & send request', { amount: fmt.money(deposit, v.currency) })}
            </button>
          </div>
        </aside>
      </form>
    </div>
  );
}

