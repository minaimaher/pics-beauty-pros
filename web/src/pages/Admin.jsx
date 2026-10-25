import { useState } from 'react';
import { api, useApi, useApp, useT, useFormat, Link, CATEGORY_LABEL, COUNTRY_LABEL, TIER_LABEL } from '../lib.jsx';
import { Loading, ErrorNote, Empty, Tabs, Modal, Stars, StatusBadge, Avatar } from '../components.jsx';

function Kpi({ label, value, sub }) {
  return <div className="stat"><span>{label}</span><strong>{value}</strong>{sub && <small>{sub}</small>}</div>;
}

function DemoClock({ data, reload }) {
  const t = useT();
  const fmt = useFormat();
  const { notify, refreshMeta } = useApp();
  const [result, setResult] = useState(null);
  const advance = async (days, reset = false) => {
    const r = await api('/admin/clock', { method: 'POST', body: { days, reset } });
    setResult(r.summary);
    notify(t('Platform date is now {d}', { d: fmt.date(r.today) }));
    refreshMeta();
    reload();
  };
  return (
    <div className="card demo-clock">
      <h2 className="h-small">{t('Demo clock')}</h2>
      <p className="small muted">{t('Fast-forward platform time to trigger balance reminders, overdue flags, event reminders, auto-completion (then review prompts), request expiry and subscription renewals.')}</p>
      <p>{t('Platform date')}: <strong>{fmt.date(data.today)}</strong>{data.clockOffsetDays ? ` (+${data.clockOffsetDays} ${t('days')})` : ''}</p>
      <div className="actions">
        {[1, 3, 7, 30].map((d) => <button key={d} className="btn btn-ghost btn-small" onClick={() => advance(d)}>+{d} {t('days')}</button>)}
        <button className="btn btn-ghost btn-small" onClick={() => advance(0)}>{t('Run jobs now')}</button>
        {data.clockOffsetDays > 0 && <button className="btn-link small" onClick={() => advance(0, true)}>{t('Reset to real time')}</button>}
      </div>
      {result && <p className="small">{Object.entries(result).filter(([, n]) => n).map(([k, n]) => `${t(k)}: ${n}`).join(' · ') || t('Nothing was due.')}</p>}
    </div>
  );
}

function Overview() {
  const t = useT();
  const fmt = useFormat();
  const { data: d, reload } = useApi('/admin/overview');
  if (!d) return <Loading />;
  const money = (list) => list.length ? list.map((x) => fmt.money(x.total, x.currency)).join(' · ') : '—';
  return (
    <>
      <div className="stat-grid">
        <Kpi label={t('Pending applications')} value={d.pendingApplications} sub={<Link to="/admin/vendors">{t('Review')} →</Link>} />
        <Kpi label={t('Open disputes')} value={d.openDisputes} sub={<Link to="/admin/disputes">{t('Resolve')} →</Link>} />
        <Kpi label={t('Flagged content')} value={d.flaggedItems} sub={<Link to="/admin/moderation">{t('Moderate')} →</Link>} />
        <Kpi label={t('Active customers (30d)')} value={d.activeCustomers30} sub={t('{n} registered', { n: d.customers })} />
        <Kpi label={t('Search → booking (30d)')} value={`${d.searchToBooking}%`} sub={t('{b} bookings / {s} searches', { b: d.bookings30, s: d.searches30 })} />
        <Kpi label={t('Completed this month')} value={d.completedThisMonth} />
        <Kpi label={t('Repeat-booking rate')} value={`${d.repeatRate}%`} />
        <Kpi label={t('Average rating')} value={d.avgRating || '—'} sub={t('Review completion {p}%', { p: d.reviewCompletion })} />
        <Kpi label={t('Dispute rate')} value={`${d.disputeRate}%`} />
        <Kpi label={t('Subscription revenue (all time)')} value={money(d.subscription.revenue)} sub={t('This month: {x}', { x: money(d.subscription.revenueThisMonth) })} />
        <Kpi label={t('Sign-up → paid')} value={`${d.subscription.signUpToPaid}%`} sub={t('{r} renewals · {c} churned', { r: d.subscription.renewals, c: d.subscription.churned })} />
        <Kpi label={t('Booking value processed')} value={money(d.gmv)} sub={t('0% platform commission')} />
      </div>
      <div className="two-col">
        <div className="card">
          <h2 className="h-small">{t('Verified vendors by category')}</h2>
          <table className="table">
            <thead><tr><th>{t('Category')}</th><th className="num">{t('Egypt')}</th><th className="num">{t('Saudi Arabia')}</th></tr></thead>
            <tbody>
              {Object.keys(CATEGORY_LABEL).map((c) => (
                <tr key={c}><td>{t(CATEGORY_LABEL[c])}</td>{['EG', 'SA'].map((m) => <td key={m} className="num">{d.supply.find((s) => s.category === c && s.country === m)?.n}</td>)}</tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="card">
          <h2 className="h-small">{t('Bookings by status')}</h2>
          <table className="table"><tbody>{d.bookingsByStatus.map((s) => <tr key={s.status}><td><StatusBadge status={s.status} /></td><td className="num">{s.n}</td></tr>)}</tbody></table>
          <h2 className="h-small spaced">{t('Tier mix')}</h2>
          <table className="table"><tbody>{d.subscription.vendorsByTier.map((s) => <tr key={s.tier + s.subscription_status}><td>{t(TIER_LABEL[s.tier])} · <span className="muted small">{t(s.subscription_status)}</span></td><td className="num">{s.n}</td></tr>)}</tbody></table>
        </div>
      </div>
      <DemoClock data={d} reload={reload} />
    </>
  );
}

function VendorReview({ id, onClose, onDone }) {
  const t = useT();
  const fmt = useFormat();
  const { data: v } = useApi(`/admin/vendors/${id}`, [id]);
  const [notes, setNotes] = useState('');
  const [err, setErr] = useState(null);
  const decide = async (decision) => {
    setErr(null);
    try {
      await api(`/admin/vendors/${id}/decision`, { method: 'POST', body: { decision, notes } });
      onDone();
    } catch (e) { setErr(e); }
  };
  return (
    <Modal title={v ? v.business_name : t('Vendor')} onClose={onClose} wide>
      {!v ? <Loading /> : (
        <div className="vendor-review">
          <dl className="facts">
            <dt>{t('Owner')}</dt><dd>{v.owner_name} · {v.email}{v.phone && ` · ${v.phone}`}</dd>
            <dt>{t('Market')}</dt><dd>{t(v.city)}, {t(COUNTRY_LABEL[v.country])}</dd>
            <dt>{t('Services')}</dt><dd>{v.categories.map((c) => t(CATEGORY_LABEL[c])).join(', ')}</dd>
            <dt>{t('Experience')}</dt><dd>{t('{n} years experience', { n: v.experience_years })}{v.certifications && ` · ${v.certifications}`}</dd>
            <dt>{t('Applied')}</dt><dd>{fmt.dateTime(v.created_at)}</dd>
            <dt>{t('Status')}</dt><dd>{t(v.status)}</dd>
          </dl>
          <p className="prewrap">{v.bio}</p>
          <h3 className="h-small">{t('Identity document')}</h3>
          {v.id_document_url ? <a href={v.id_document_url} target="_blank" rel="noreferrer" className="doc-link">{t('Open ID document')} ↗</a> : <p className="muted">{t('None uploaded')}</p>}
          <h3 className="h-small">{t('Portfolio quality')} ({v.media.length})</h3>
          <div className="media-grid small-grid">
            {v.media.map((m) => m.kind === 'video' ? <video key={m.id} src={m.url} controls preload="metadata" /> : <img key={m.id} src={m.url} alt={m.caption} />)}
          </div>
          <label className="field">{t('Notes to the vendor')}<textarea rows="2" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder={t('Required when rejecting or suspending')} /></label>
          <ErrorNote error={err} />
          <div className="modal-actions">
            {v.status !== 'approved' && <button className="btn" onClick={() => decide(v.status === 'suspended' ? 'reinstate' : 'approve')}>{v.status === 'suspended' ? t('Reinstate') : t('Approve')}</button>}
            {v.status === 'pending' && <button className="btn btn-danger" onClick={() => decide('reject')}>{t('Reject')}</button>}
            {v.status === 'approved' && <button className="btn btn-danger" onClick={() => decide('suspend')}>{t('Suspend')}</button>}
          </div>
        </div>
      )}
    </Modal>
  );
}

function Vendors() {
  const t = useT();
  const { notify } = useApp();
  const [status, setStatus] = useState('pending');
  const { data, reload } = useApi(`/admin/vendors?status=${status}`, [status]);
  const [open, setOpen] = useState(null);
  const feature = async (v, on) => {
    try {
      await api(`/admin/vendors/${v.id}/featured`, { method: 'POST', body: { on } });
      reload();
    } catch (e) { notify(e.message, 'error'); }
  };
  return (
    <>
      <div className="section-head">
        <div className="seg">
          {['pending', 'approved', 'rejected', 'suspended'].map((s) => <button key={s} className={status === s ? 'on' : ''} onClick={() => setStatus(s)}>{t(s)}</button>)}
        </div>
        {data && <p className="small muted">{t('Homepage featured slots: {u} of {n} used', { u: data.featuredUsed, n: data.featuredSlots })}</p>}
      </div>
      {!data ? <Loading /> : data.vendors.length === 0 ? <Empty>{t('Nothing here.')}</Empty> : (
        <div className="table-wrap">
          <table className="table">
            <thead><tr><th>{t('Vendor')}</th><th>{t('Services')}</th><th>{t('City')}</th><th>{t('Plan')}</th><th>{t('Rating')}</th><th /></tr></thead>
            <tbody>
              {data.vendors.map((v) => (
                <tr key={v.id}>
                  <td><span className="who"><Avatar src={v.avatar_url} name={v.owner_name} size={36} /><span><strong>{v.business_name}</strong><br /><span className="muted small">{v.email}</span></span></span></td>
                  <td className="small">{v.categories.map((c) => t(CATEGORY_LABEL[c])).join(', ')}</td>
                  <td className="small">{t(v.city)}</td>
                  <td className="small">{t(TIER_LABEL[v.tier_selected])} · {t(v.subscription_status)}</td>
                  <td><Stars value={v.rating_avg} count={v.rating_count} /></td>
                  <td className="end">
                    {status === 'approved' && v.tier === 'featured' && (
                      <label className="small check-inline"><input type="checkbox" checked={v.homepage_featured} onChange={(e) => feature(v, e.target.checked)} /> {t('Homepage')}</label>
                    )}
                    <button className="btn btn-small" onClick={() => setOpen(v.id)}>{status === 'pending' ? t('Review') : t('Open')}</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {open && <VendorReview id={open} onClose={() => setOpen(null)} onDone={() => { setOpen(null); notify(t('Decision saved')); reload(); }} />}
    </>
  );
}

function Moderation() {
  const t = useT();
  const fmt = useFormat();
  const { data, reload } = useApi('/admin/moderation');
  const [onlyFlagged, setOnlyFlagged] = useState(true);
  if (!data) return <Loading />;
  const act = async (type, id, action) => {
    await api(`/admin/moderation/${type}/${id}`, { method: 'POST', body: { action } });
    reload();
  };
  const reviews = data.reviews.filter((r) => !onlyFlagged || r.flagged);
  const media = data.media.filter((m) => !onlyFlagged || m.flagged);
  const Controls = ({ type, item }) => (
    <div className="actions">
      {item.status === 'visible' ? <button className="btn btn-danger btn-small" onClick={() => act(type, item.id, 'hide')}>{t('Hide')}</button>
        : <button className="btn btn-small" onClick={() => act(type, item.id, 'restore')}>{t('Restore')}</button>}
      {item.flagged ? <button className="btn btn-ghost btn-small" onClick={() => act(type, item.id, 'dismiss')}>{t('Dismiss flag')}</button> : null}
    </div>
  );
  return (
    <>
      <label className="check-inline"><input type="checkbox" checked={onlyFlagged} onChange={(e) => setOnlyFlagged(e.target.checked)} /> {t('Flagged only')}</label>
      <h2 className="h-small">{t('Reviews')}</h2>
      {reviews.length === 0 && <Empty>{t('No flagged reviews.')}</Empty>}
      {reviews.map((r) => (
        <article key={r.id} className={'card review' + (r.status === 'hidden' ? ' hidden-item' : '')}>
          <div className="review-top">
            <strong>{r.business_name}</strong><span className="star-fill">{'★'.repeat(r.rating)}</span>
            <span className="muted small">{r.customer_name} · {fmt.date(r.created_at)}</span>
            {r.flagged ? <span className="badge status-requested">⚑ {r.flag_reason}</span> : null}
            {r.status === 'hidden' && <span className="badge status-cancelled">{t('Hidden')}</span>}
          </div>
          <p>{r.body}</p>
          <Controls type="review" item={r} />
        </article>
      ))}
      <h2 className="h-small">{t('Portfolio media')}</h2>
      {media.length === 0 && <Empty>{t('No flagged media.')}</Empty>}
      <div className="media-grid">
        {media.map((m) => (
          <figure key={m.id} className={'media-item' + (m.status === 'hidden' ? ' hidden-item' : '')}>
            {m.kind === 'video' ? <video src={m.url} controls preload="metadata" /> : <img src={m.url} alt={m.caption} loading="lazy" />}
            <figcaption className="small"><strong>{m.business_name}</strong>{m.flagged ? ` · ⚑ ${m.flag_reason}` : ''}</figcaption>
            <Controls type="media" item={m} />
          </figure>
        ))}
      </div>
    </>
  );
}

function Disputes() {
  const t = useT();
  const fmt = useFormat();
  const { notify } = useApp();
  const { data, reload } = useApi('/admin/disputes');
  const [open, setOpen] = useState(null);
  const [form, setForm] = useState({ resolution: '', refund_amount: 0, cancel_booking: false });
  const [err, setErr] = useState(null);
  if (!data) return <Loading />;
  const resolve = async () => {
    setErr(null);
    try {
      await api(`/admin/disputes/${open.id}/resolve`, { method: 'POST', body: form });
      setOpen(null);
      notify(t('Dispute resolved'));
      reload();
    } catch (e) { setErr(e); }
  };
  return (
    <>
      {data.disputes.length === 0 && <Empty>{t('No disputes.')}</Empty>}
      {data.disputes.map((d) => (
        <article key={d.id} className="card dispute">
          <div className="review-top">
            <strong>{d.code}</strong>
            <span className={'badge ' + (d.status === 'open' ? 'status-requested' : 'status-confirmed')}>{t(d.status)}</span>
            <StatusBadge status={d.booking_status} />
            <span className="muted small">{d.business_name} ↔ {d.customer_name} · {fmt.date(d.event_date)}</span>
          </div>
          <p><span className="muted small">{t('Opened by {name} ({role})', { name: d.opened_by_name, role: t(d.opened_by_role) })}:</span> {d.reason}</p>
          <p className="small">{t('Price')} {fmt.money(d.price, d.currency)} · {t('Still held')}: <strong>{fmt.money(d.net_paid, d.currency)}</strong></p>
          {d.status === 'resolved' ? <p className="note ok">{d.resolution}{d.refund_amount ? ` — ${t('Refunded')} ${fmt.money(d.refund_amount, d.currency)}` : ''}</p>
            : <button className="btn btn-small" onClick={() => { setOpen(d); setForm({ resolution: '', refund_amount: 0, cancel_booking: false }); }}>{t('Resolve')}</button>}
        </article>
      ))}
      {open && (
        <Modal title={t('Resolve dispute {code}', { code: open.code })} onClose={() => setOpen(null)}>
          <label className="field">{t('Resolution (shared with both parties)')}<textarea rows="3" value={form.resolution} onChange={(e) => setForm({ ...form, resolution: e.target.value })} /></label>
          <label className="field">{t('Refund to customer')} ({open.currency}, {t('max')} {fmt.money(open.net_paid, open.currency)})
            <input type="number" min="0" max={open.net_paid} value={form.refund_amount} onChange={(e) => setForm({ ...form, refund_amount: e.target.value })} />
          </label>
          {['requested', 'confirmed'].includes(open.booking_status) && (
            <label className="check-inline"><input type="checkbox" checked={form.cancel_booking} onChange={(e) => setForm({ ...form, cancel_booking: e.target.checked })} /> {t('Also cancel the booking')}</label>
          )}
          <ErrorNote error={err} />
          <div className="modal-actions"><button className="btn" onClick={resolve}>{t('Resolve')}</button></div>
        </Modal>
      )}
    </>
  );
}

function Settings() {
  const t = useT();
  const { notify, refreshMeta } = useApp();
  const { data } = useApi('/admin/settings');
  const [s, setS] = useState(null);
  const [err, setErr] = useState(null);
  const cur = s || data;
  if (!cur) return <Loading />;
  const upd = (fn) => setS(fn(structuredClone(cur)));
  const num = (v) => (v === '' ? '' : Number(v));
  const save = async () => {
    setErr(null);
    try {
      setS(await api('/admin/settings', { method: 'PUT', body: cur }));
      refreshMeta();
      notify(t('Settings saved'));
    } catch (e) { setErr(e); }
  };
  const pb = cur.policyBounds;
  return (
    <>
      <div className="card">
        <h2 className="h-small">{t('Subscription tiers')}</h2>
        <div className="table-wrap">
          <table className="table">
            <thead><tr><th /><th>EGP / {t('month')}</th><th>SAR / {t('month')}</th><th>{t('Portfolio items')}</th><th>{t('Packages')}</th><th>{t('Bookings / month')}</th><th>{t('Search boost')}</th></tr></thead>
            <tbody>
              {['basic', 'pro', 'featured'].map((k) => (
                <tr key={k}>
                  <th>{t({ basic: 'Basic', pro: 'Pro', featured: 'Featured' }[k])}</th>
                  <td><input type="number" min="0" value={cur.tiers[k].price.EGP} onChange={(e) => upd((c) => { c.tiers[k].price.EGP = num(e.target.value); return c; })} /></td>
                  <td><input type="number" min="0" value={cur.tiers[k].price.SAR} onChange={(e) => upd((c) => { c.tiers[k].price.SAR = num(e.target.value); return c; })} /></td>
                  <td><input type="number" min="1" value={cur.tiers[k].maxMedia} onChange={(e) => upd((c) => { c.tiers[k].maxMedia = num(e.target.value); return c; })} /></td>
                  <td><input type="number" min="1" value={cur.tiers[k].maxPackages} onChange={(e) => upd((c) => { c.tiers[k].maxPackages = num(e.target.value); return c; })} /></td>
                  <td><input type="number" min="0" placeholder={t('Unlimited')} value={cur.tiers[k].maxBookingsPerMonth ?? ''} onChange={(e) => upd((c) => { c.tiers[k].maxBookingsPerMonth = e.target.value ? Number(e.target.value) : null; return c; })} /></td>
                  <td><input type="number" min="0" step="0.5" value={cur.tiers[k].rankBoost} onChange={(e) => upd((c) => { c.tiers[k].rankBoost = num(e.target.value); return c; })} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="row-3">
          <label className="field">{t('Free trial (days)')}<input type="number" min="0" value={cur.trialDays} onChange={(e) => upd((c) => { c.trialDays = num(e.target.value); return c; })} /></label>
          <label className="field">{t('Homepage featured slots')}<input type="number" min="0" value={cur.featuredSlots} onChange={(e) => upd((c) => { c.featuredSlots = num(e.target.value); return c; })} /></label>
          <label className="field">{t('Request expiry (hours)')}<input type="number" min="1" value={cur.requestExpiryHours} onChange={(e) => upd((c) => { c.requestExpiryHours = num(e.target.value); return c; })} /></label>
        </div>
      </div>
      <div className="card">
        <h2 className="h-small">{t('Cancellation policy bounds')}</h2>
        <p className="small muted">{t('Vendors set their own terms per package, within these limits.')}</p>
        <div className="row-3">
          {[['depositPct', 'Deposit % (min–max)'], ['balanceDueDays', 'Balance due, days before (min–max)'], ['lateRefundPct', 'Refund after balance due % (min–max)']].map(([k, l]) => (
            <div key={k} className="field">
              <span>{t(l)}</span>
              <div className="row-2">
                <input type="number" value={pb[k][0]} onChange={(e) => upd((c) => { c.policyBounds[k][0] = num(e.target.value); return c; })} aria-label="min" />
                <input type="number" value={pb[k][1]} onChange={(e) => upd((c) => { c.policyBounds[k][1] = num(e.target.value); return c; })} aria-label="max" />
              </div>
            </div>
          ))}
        </div>
        <label className="field">{t('Earliest refund tier must refund at least (%)')}<input type="number" value={pb.minEarlyRefundPct} onChange={(e) => upd((c) => { c.policyBounds.minEarlyRefundPct = num(e.target.value); return c; })} /></label>
      </div>
      <ErrorNote error={err} />
      <button className="btn" onClick={save}>{t('Save settings')}</button>
    </>
  );
}

function Outbox() {
  const t = useT();
  const fmt = useFormat();
  const { data } = useApi('/admin/outbox');
  if (!data) return <Loading />;
  return (
    <>
      <p className="small muted">{t('Emails and push notifications the platform would send. In production these go to an email provider and to the mobile apps.')}</p>
      <div className="table-wrap">
        <table className="table">
          <thead><tr><th>{t('Sent')}</th><th>{t('Channel')}</th><th>{t('To')}</th><th>{t('Subject')}</th></tr></thead>
          <tbody>
            {data.items.map((o) => (
              <tr key={o.id}>
                <td className="small">{fmt.dateTime(o.created_at)}</td>
                <td><span className="badge">{o.channel}</span></td>
                <td className="small">{o.recipient}</td>
                <td><strong>{o.subject}</strong><br /><span className="small muted">{o.body}</span></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

function AllBookings() {
  const t = useT();
  const fmt = useFormat();
  const { data } = useApi('/admin/bookings');
  if (!data) return <Loading />;
  return (
    <div className="table-wrap">
      <table className="table">
        <thead><tr><th>{t('Code')}</th><th>{t('Event')}</th><th>{t('Vendor')}</th><th>{t('Customer')}</th><th>{t('Status')}</th><th>{t('Balance')}</th><th className="num">{t('Price')}</th></tr></thead>
        <tbody>
          {data.bookings.map((b) => (
            <tr key={b.id}>
              <td className="small">{b.code}</td>
              <td className="small">{fmt.date(b.event_date)}</td>
              <td>{b.business_name}</td>
              <td>{b.customer_name}</td>
              <td><StatusBadge status={b.status} /></td>
              <td className="small">{b.balance_paid_at ? t('Paid') : b.balance_overdue ? <span className="danger">{t('Overdue')}</span> : t('Due {d}', { d: fmt.date(b.balance_due_date) })}</td>
              <td className="num">{fmt.money(b.price, b.currency)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function Admin({ section }) {
  const t = useT();
  const tabs = [['', 'Overview'], ['vendors', 'Vendors'], ['moderation', 'Moderation'], ['disputes', 'Disputes'], ['bookings', 'Bookings'], ['settings', 'Plans & policy'], ['outbox', 'Email & push log']];
  return (
    <div className="container section dash">
      <p className="eyebrow">{t('Platform admin')}</p>
      <h1>{t('Admin console')}</h1>
      <Tabs tabs={tabs} active={section || ''} base="/admin" />
      <div className="tab-body">
        {!section && <Overview />}
        {section === 'vendors' && <Vendors />}
        {section === 'moderation' && <Moderation />}
        {section === 'disputes' && <Disputes />}
        {section === 'bookings' && <AllBookings />}
        {section === 'settings' && <Settings />}
        {section === 'outbox' && <Outbox />}
      </div>
    </div>
  );
}
