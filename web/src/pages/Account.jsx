import { useEffect, useRef, useState } from 'react';
import { api, useApi, useApp, useT, useFormat, navigate, useLocation, Link, CATEGORY_LABEL } from '../lib.jsx';
import { Loading, ErrorNote, Empty, StatusBadge, PaymentFields, Modal, StarInput, MonthCalendar, Avatar } from '../components.jsx';
import { PolicySummary } from './Vendor.jsx';

function afterLogin(user, next) {
  if (next && next.startsWith('/') && !next.startsWith('//')) return navigate(next, { replace: true });
  navigate(user.role === 'admin' ? '/admin' : user.role === 'vendor' ? '/vendor' : '/', { replace: true });
}

export function Login() {
  const { refreshSession, setLocale } = useApp();
  const t = useT();
  const { query } = useLocation();
  const [mode, setMode] = useState('password');
  const [form, setForm] = useState({ email: '', password: '', code: '' });
  const [otpSent, setOtpSent] = useState(null);
  const [err, setErr] = useState(null);
  const [busy, setBusy] = useState(false);
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  const done = async (d) => {
    await refreshSession();
    if (d.user.locale) setLocale(d.user.locale);
    afterLogin(d.user, query.next);
  };
  const submit = async (e) => {
    e.preventDefault();
    setErr(null);
    setBusy(true);
    try {
      if (mode === 'password') await done(await api('/auth/login', { method: 'POST', body: form }));
      else if (!otpSent) setOtpSent(await api('/auth/otp/request', { method: 'POST', body: { email: form.email } }));
      else await done(await api('/auth/otp/verify', { method: 'POST', body: { email: form.email, code: form.code } }));
    } catch (e2) {
      setErr(e2);
    } finally {
      setBusy(false);
    }
  };
  const demo = (email) => setForm({ ...form, email, password: 'password123' });

  return (
    <div className="container auth-page">
      <form className="card auth-card" onSubmit={submit}>
        <h1>{t('Sign in')}</h1>
        <div className="seg full">
          <button type="button" className={mode === 'password' ? 'on' : ''} onClick={() => { setMode('password'); setOtpSent(null); }}>{t('Password')}</button>
          <button type="button" className={mode === 'otp' ? 'on' : ''} onClick={() => setMode('otp')}>{t('One-time code')}</button>
        </div>
        <label className="field">{t('Email')}<input type="email" autoComplete="email" value={form.email} onChange={set('email')} required /></label>
        {mode === 'password' && <label className="field">{t('Password')}<input type="password" autoComplete="current-password" value={form.password} onChange={set('password')} required /></label>}
        {mode === 'otp' && otpSent && (
          <>
            <label className="field">{t('6-digit code')}<input inputMode="numeric" autoComplete="one-time-code" value={form.code} onChange={set('code')} required /></label>
            <p className="small muted">{t('We sent a code to your email.')} {otpSent.devCode && <>{t('Demo code')}: <strong>{otpSent.devCode}</strong></>}</p>
          </>
        )}
        <ErrorNote error={err} />
        <button className="btn btn-block" disabled={busy}>{mode === 'otp' && !otpSent ? t('Send code') : t('Sign in')}</button>
        <p className="small">{t('New here?')} <Link to={'/register' + (query.next ? `?next=${encodeURIComponent(query.next)}` : '')}>{t('Create an account')}</Link></p>
        <div className="demo-accounts">
          <p className="small muted">{t('Demo accounts (password: password123)')}</p>
          {[['customer@pbp.test', 'Customer · Egypt'], ['customer-sa@pbp.test', 'Customer · Saudi'], ['vendor@pbp.test', 'Vendor · Lumière Studio'], ['vendor-sa@pbp.test', 'Vendor · Layali Bridal'], ['admin@pbp.test', 'Admin']].map(([e, l]) => (
            <button type="button" key={e} className="chip" onClick={() => demo(e)}>{t(l)}</button>
          ))}
        </div>
      </form>
    </div>
  );
}

export function Register() {
  const { refreshSession, locale } = useApp();
  const t = useT();
  const { query } = useLocation();
  const [form, setForm] = useState({ name: '', email: '', phone: '', password: '', role: query.role === 'vendor' ? 'vendor' : 'customer' });
  const [err, setErr] = useState(null);
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });
  const submit = async (e) => {
    e.preventDefault();
    setErr(null);
    try {
      const d = await api('/auth/register', { method: 'POST', body: { ...form, locale } });
      await refreshSession();
      if (d.user.role === 'vendor') navigate('/vendor/apply', { replace: true });
      else afterLogin(d.user, query.next);
    } catch (e2) {
      setErr(e2);
    }
  };
  return (
    <div className="container auth-page">
      <form className="card auth-card" onSubmit={submit}>
        <h1>{t('Create your account')}</h1>
        <div className="seg full">
          <button type="button" className={form.role === 'customer' ? 'on' : ''} onClick={() => setForm({ ...form, role: 'customer' })}>{t('I want to book')}</button>
          <button type="button" className={form.role === 'vendor' ? 'on' : ''} onClick={() => setForm({ ...form, role: 'vendor' })}>{t("I'm a vendor")}</button>
        </div>
        <label className="field">{t('Full name')}<input autoComplete="name" value={form.name} onChange={set('name')} required /></label>
        <label className="field">{t('Email')}<input type="email" autoComplete="email" value={form.email} onChange={set('email')} required /></label>
        <label className="field">{t('Mobile number')}<input type="tel" autoComplete="tel" value={form.phone} onChange={set('phone')} placeholder="+20… / +966…" /></label>
        <label className="field">{t('Password')}<input type="password" autoComplete="new-password" minLength={8} value={form.password} onChange={set('password')} required /></label>
        <ErrorNote error={err} />
        <button className="btn btn-block">{t('Create account')}</button>
        <p className="small">{t('Already have an account?')} <Link to="/login">{t('Sign in')}</Link></p>
      </form>
    </div>
  );
}

export function JoinVendor() {
  const t = useT();
  const fmt = useFormat();
  const { meta, market } = useApp();
  const cur = meta?.currency?.[market] || 'EGP';
  return (
    <div className="container section join">
      <h1>{t('Grow your photography, video or beauty business')}</h1>
      <p className="lead">{t('A professional storefront, a booking calendar that prevents double-bookings, and deposits collected for you — with no commission on bookings.')}</p>
      {meta && (
        <div className="tier-grid">
          {['basic', 'pro', 'featured'].map((k) => {
            const tier = meta.tiers[k];
            return (
              <div key={k} className={'tier-card' + (k === 'pro' ? ' highlight' : '')}>
                <h3>{t({ basic: 'Basic', pro: 'Pro', featured: 'Featured' }[k])}</h3>
                <p className="tier-price">{tier.price[cur] ? fmt.money(tier.price[cur], cur) : t('Free')}<span className="muted small">{tier.price[cur] ? ' / ' + t('month') : ''}</span></p>
                <ul>
                  <li>{t('{n} portfolio items', { n: tier.maxMedia })}</li>
                  <li>{t('{n} active packages', { n: tier.maxPackages })}</li>
                  <li>{tier.maxBookingsPerMonth ? t('{n} bookings per month', { n: tier.maxBookingsPerMonth }) : t('Unlimited bookings')}</li>
                  {k !== 'basic' && <li>{t('Higher placement in search')}</li>}
                  {k === 'featured' && <li>{t('Homepage slot and promoted badge')}</li>}
                </ul>
              </div>
            );
          })}
        </div>
      )}
      <p className="muted">{t('Paid plans start with a {d}-day free trial. 0% commission — customers pay you directly through the app.', { d: meta?.trialDays ?? 90 })}</p>
      <Link className="btn btn-accent" to="/register?role=vendor">{t('Apply as a vendor')}</Link>
    </div>
  );
}

export function BookingsList({ asVendor }) {
  const t = useT();
  const fmt = useFormat();
  const { meta } = useApp();
  const { data, error } = useApi('/bookings' + (asVendor ? '?as=vendor' : ''), [asVendor]);
  const [tab, setTab] = useState('upcoming');
  if (error) return <ErrorNote error={error} />;
  if (!data || !meta) return <Loading />;
  const today = meta.today;
  const groups = {
    upcoming: data.bookings.filter((b) => ['requested', 'confirmed'].includes(b.status)).sort((a, b) => a.event_date.localeCompare(b.event_date)),
    past: data.bookings.filter((b) => b.status === 'completed'),
    cancelled: data.bookings.filter((b) => ['cancelled', 'declined'].includes(b.status))
  };
  const base = asVendor ? '/vendor/bookings/' : '/bookings/';
  return (
    <>
      <div className="seg">
        {[['upcoming', 'Upcoming'], ['past', 'Past'], ['cancelled', 'Cancelled']].map(([k, l]) => (
          <button key={k} className={tab === k ? 'on' : ''} onClick={() => setTab(k)}>{t(l)} ({groups[k].length})</button>
        ))}
      </div>
      {groups[tab].length === 0 && <Empty>{t('No bookings here yet.')} {!asVendor && <Link to="/search">{t('Find a vendor')}</Link>}</Empty>}
      <div className="booking-list">
        {groups[tab].map((b) => (
          <Link key={b.id} to={base + b.id} className="booking-row">
            <div className="date-chip"><strong>{fmt.date(b.event_date, { day: 'numeric' })}</strong><span>{fmt.date(b.event_date, { month: 'short' })}</span></div>
            <div className="grow">
              <strong>{asVendor ? b.customer_name : b.business_name}</strong>
              <p className="muted small">{b.package_title} · {b.start_time}–{b.end_time} · {b.code}</p>
              {b.status === 'confirmed' && !b.balance_paid_at && (
                <p className={'small ' + (b.balance_due_date < today ? 'danger' : 'warn')}>
                  {b.balance_due_date < today ? t('Balance overdue') : t('Balance {amount} due {d}', { amount: fmt.money(b.balance_amount, b.currency), d: fmt.date(b.balance_due_date) })}
                </p>
              )}
            </div>
            <div className="end">
              <StatusBadge status={b.status} />
              <span className="small">{fmt.money(b.price, b.currency)}</span>
            </div>
          </Link>
        ))}
      </div>
    </>
  );
}

export function CustomerBookings() {
  const t = useT();
  return (
    <div className="container section">
      <h1>{t('My bookings')}</h1>
      <BookingsList />
    </div>
  );
}

function RescheduleModal({ b, onClose, onDone }) {
  const t = useT();
  const { meta } = useApp();
  const [month, setMonth] = useState(b.event_date.slice(0, 7));
  const [cal, setCal] = useState(null);
  const [date, setDate] = useState('');
  const [slots, setSlots] = useState(null);
  const [time, setTime] = useState('');
  const [err, setErr] = useState(null);
  useEffect(() => { api(`/vendors/${b.vendor.id}/calendar?month=${month}`).then(setCal); }, [month, b.vendor.id]);
  useEffect(() => { setTime(''); if (date) api(`/vendors/${b.vendor.id}/slots?packageId=${b.package.id}&date=${date}`).then((d) => setSlots(d.slots)); }, [date, b]);
  const save = async () => {
    try {
      onDone(await api(`/bookings/${b.id}/reschedule`, { method: 'POST', body: { eventDate: date, startTime: time } }));
    } catch (e) { setErr(e); }
  };
  return (
    <Modal title={t('Reschedule')} onClose={onClose}>
      <p className="small muted">{t('Pick a new date. The price and terms stay the same; the balance due date moves with the event.')}</p>
      {cal && <MonthCalendar month={month} days={cal.days} onMonth={setMonth} selected={date} onSelect={setDate} minMonth={meta.today.slice(0, 7)} />}
      {slots && <div className="slots">{slots.map((s) => <button key={s} type="button" className={'slot' + (time === s ? ' on' : '')} onClick={() => setTime(s)}>{s}</button>)}</div>}
      {slots?.length === 0 && <Empty>{t('No free time on that day.')}</Empty>}
      <ErrorNote error={err} />
      <div className="modal-actions"><button className="btn" disabled={!date || !time} onClick={save}>{t('Confirm new date')}</button></div>
    </Modal>
  );
}

export function BookingDetail({ id, asVendor }) {
  const t = useT();
  const fmt = useFormat();
  const { notify } = useApp();
  const { data: b, error, reload } = useApi(`/bookings/${id}`, [id]);
  const [modal, setModal] = useState(null);
  const [payment, setPayment] = useState({});
  const [text, setText] = useState('');
  const [rating, setRating] = useState(5);
  const [err, setErr] = useState(null);
  const [busy, setBusy] = useState(false);

  if (error) return <div className="container section"><ErrorNote error={error} /></div>;
  if (!b) return <Loading />;

  const act = async (path, body, msg) => {
    setErr(null);
    setBusy(true);
    try {
      await api(`/bookings/${b.id}/${path}`, { method: 'POST', body });
      setModal(null);
      setText('');
      notify(msg);
      reload();
    } catch (e) {
      setErr(e);
    } finally {
      setBusy(false);
    }
  };
  const openChat = async () => {
    if (asVendor) {
      const threads = await api('/messages/threads');
      const th = threads.threads.find((x) => x.customer_id === b.customer.id);
      return navigate(th ? `/messages/${th.id}` : '/messages');
    }
    const th = await api('/messages/threads', { method: 'POST', body: { vendorId: b.vendor.id } });
    navigate(`/messages/${th.id}`);
  };
  const net = b.payments.reduce((s, p) => s + (p.status !== 'succeeded' ? 0 : p.kind === 'refund' ? -p.amount : p.kind === 'subscription' ? 0 : p.amount), 0);
  const steps = [
    ['Booked', b.created_at],
    ...(b.status === 'requested' || b.package.booking_mode === 'request' ? [['Vendor confirmed', ['confirmed', 'completed'].includes(b.status) ? true : null]] : []),
    ['Deposit paid', b.deposit_paid_at],
    ['Balance paid', b.balance_paid_at],
    ['Event', b.status === 'completed' ? true : null],
    ['Reviewed', b.review ? b.review.created_at : null]
  ];

  return (
    <div className="container section booking-detail">
      <Link to={asVendor ? '/vendor/bookings' : '/bookings'} className="back">← {t('All bookings')}</Link>
      <div className="bd-head">
        <div>
          <p className="eyebrow">{b.code}</p>
          <h1>{asVendor ? b.customer.name : b.vendor.business_name}</h1>
          <p className="muted">{b.package.title} · {t(CATEGORY_LABEL[b.package.category])}</p>
        </div>
        <StatusBadge status={b.status} />
      </div>

      {!['cancelled', 'declined'].includes(b.status) && (
        <ol className="timeline">
          {steps.map(([label, done]) => <li key={label} className={done ? 'done' : ''}>{t(label)}</li>)}
        </ol>
      )}

      <div className="bd-cols">
        <div className="bd-main">
          <section className="card">
            <dl className="facts">
              <dt>{t('Date')}</dt><dd>{fmt.date(b.event_date, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}</dd>
              <dt>{t('Time')}</dt><dd>{b.start_time}–{b.end_time}</dd>
              <dt>{t('Location')}</dt><dd>{b.location || '—'}</dd>
              {b.notes && <><dt>{t('Notes')}</dt><dd className="prewrap">{b.notes}</dd></>}
              {asVendor && <><dt>{t('Contact')}</dt><dd>{b.customer.email}{b.customer.phone && ` · ${b.customer.phone}`}</dd></>}
              {b.cancel_reason && <><dt>{t('Reason')}</dt><dd>{b.cancel_reason}</dd></>}
            </dl>
          </section>

          {b.status === 'requested' && !asVendor && <div className="note">{t('Waiting for {name} to accept. Your deposit is held and refunded in full if they decline.', { name: b.vendor.business_name })}</div>}
          {b.balance_overdue === 1 && b.status === 'confirmed' && <div className="note danger">{asVendor ? t('The balance is overdue. You can cancel for non-payment and keep the deposit.') : t('Your balance is overdue. Pay now to keep your date.')}</div>}
          {b.dispute && <div className={'note' + (b.dispute.status === 'open' ? '' : ' ok')}><strong>{b.dispute.status === 'open' ? t('Dispute under review') : t('Dispute resolved')}</strong><p>{b.dispute.status === 'open' ? b.dispute.reason : b.dispute.resolution}</p></div>}

          {b.can.respond && (
            <section className="card">
              <h2 className="h-small">{t('Respond to this request')}</h2>
              <div className="actions">
                <button className="btn" disabled={busy} onClick={() => act('respond', { accept: true }, t('Booking confirmed'))}>{t('Accept')}</button>
                <button className="btn btn-ghost" onClick={() => setModal('decline')}>{t('Decline')}</button>
              </div>
            </section>
          )}

          {b.can.review && (
            <section className="card">
              <h2 className="h-small">{t('Leave a review')}</h2>
              <StarInput value={rating} onChange={setRating} />
              <textarea rows="3" value={text} onChange={(e) => setText(e.target.value)} placeholder={t('What was great? What could be better?')} />
              <ErrorNote error={err} />
              <button className="btn" disabled={busy} onClick={() => act('review', { rating, body: text }, t('Thanks for your review!'))}>{t('Post review')}</button>
            </section>
          )}
          {b.review && (
            <section className="card">
              <h2 className="h-small">{t('Review')}</h2>
              <p className="stars"><span className="star-fill">{'★'.repeat(b.review.rating)}</span></p>
              <p>{b.review.body}</p>
              {b.review.vendor_response && <blockquote className="response"><p>{b.review.vendor_response}</p></blockquote>}
            </section>
          )}

          <section className="card">
            <h2 className="h-small">{t('Payments')}</h2>
            <table className="table">
              <tbody>
                {b.payments.map((p) => (
                  <tr key={p.id}>
                    <td>{t({ deposit: 'Deposit', balance: 'Balance', refund: 'Refund' }[p.kind])}</td>
                    <td className="muted small">{fmt.dateTime(p.created_at)}</td>
                    <td className="muted small">{p.method}{p.last4 && ` ··${p.last4}`}</td>
                    <td className={'num' + (p.kind === 'refund' ? ' ok-text' : '')}>{p.kind === 'refund' ? '−' : ''}{fmt.money(p.amount, p.currency)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot><tr><td colSpan="3">{t('Net paid')}</td><td className="num"><strong>{fmt.money(net, b.currency)}</strong></td></tr></tfoot>
            </table>
          </section>
        </div>

        <aside className="bd-side">
          <div className="card">
            <dl className="totals">
              <dt>{t('Total')}</dt><dd>{fmt.money(b.price, b.currency)}</dd>
              <dt>{t('Deposit')}</dt><dd>{fmt.money(b.deposit_amount, b.currency)} {b.deposit_paid_at && '✓'}</dd>
              {b.balance_amount > 0 && <><dt>{t('Balance due {d}', { d: fmt.date(b.balance_due_date) })}</dt><dd>{fmt.money(b.balance_amount, b.currency)} {b.balance_paid_at && '✓'}</dd></>}
              {b.refund_amount > 0 && <><dt>{t('Refunded')}</dt><dd>{fmt.money(b.refund_amount, b.currency)}</dd></>}
            </dl>
            {b.can.payBalance && <button className="btn btn-accent btn-block" onClick={() => setModal('pay')}>{t('Pay balance {amount}', { amount: fmt.money(b.balance_amount, b.currency) })}</button>}
            <button className="btn btn-ghost btn-block" onClick={openChat}>{asVendor ? t('Message customer') : t('Message vendor')}</button>
            {b.can.reschedule && <button className="btn btn-ghost btn-block" onClick={() => setModal('reschedule')}>{t('Reschedule')}</button>}
            {b.can.cancelNonPayment && <button className="btn btn-danger btn-block" onClick={() => act('cancel-nonpayment', {}, t('Booking cancelled'))}>{t('Cancel for non-payment')}</button>}
            {b.can.cancel && <button className="btn-link danger" onClick={() => setModal('cancel')}>{t('Cancel booking')}</button>}
            {b.can.dispute && <button className="btn-link" onClick={() => setModal('dispute')}>{t('Report a problem')}</button>}
          </div>
          <div className="card">
            <h2 className="h-small">{t('Your terms')}</h2>
            <PolicySummary policy={b.policy} currency={b.currency} />
          </div>
        </aside>
      </div>

      {modal === 'pay' && (
        <Modal title={t('Pay balance')} onClose={() => setModal(null)}>
          <PaymentFields country={b.vendor.country} value={payment} onChange={setPayment} />
          <ErrorNote error={err} />
          <div className="modal-actions">
            <button className="btn btn-accent" disabled={busy} onClick={() => act('pay-balance', { payment: { method: 'card', ...payment } }, t('Payment received — thank you!'))}>
              {t('Pay {amount}', { amount: fmt.money(b.balance_amount, b.currency) })}
            </button>
          </div>
        </Modal>
      )}
      {modal === 'cancel' && (
        <Modal title={t('Cancel booking')} onClose={() => setModal(null)}>
          {asVendor ? (
            <p>{t('Cancelling as the vendor refunds the customer in full ({amount}).', { amount: fmt.money(b.refund_preview?.paid, b.currency) })}</p>
          ) : (
            <p>{t('Based on your terms, you will be refunded {amount} of the {paid} you have paid.', { amount: fmt.money(b.refund_preview?.amount, b.currency), paid: fmt.money(b.refund_preview?.paid, b.currency) })}</p>
          )}
          <textarea rows="2" value={text} onChange={(e) => setText(e.target.value)} placeholder={t('Reason (optional)')} />
          <ErrorNote error={err} />
          <div className="modal-actions"><button className="btn btn-danger" disabled={busy} onClick={() => act('cancel', { reason: text }, t('Booking cancelled'))}>{t('Cancel booking')}</button></div>
        </Modal>
      )}
      {modal === 'decline' && (
        <Modal title={t('Decline request')} onClose={() => setModal(null)}>
          <p>{t('The customer\'s deposit will be refunded in full.')}</p>
          <textarea rows="2" value={text} onChange={(e) => setText(e.target.value)} placeholder={t('Reason (shared with the customer)')} />
          <div className="modal-actions"><button className="btn btn-danger" disabled={busy} onClick={() => act('respond', { accept: false, reason: text }, t('Request declined'))}>{t('Decline')}</button></div>
        </Modal>
      )}
      {modal === 'dispute' && (
        <Modal title={t('Report a problem')} onClose={() => setModal(null)}>
          <p className="small muted">{t('Our team reviews disputes about cancellations, refunds and service quality, and may issue a refund.')}</p>
          <textarea rows="4" value={text} onChange={(e) => setText(e.target.value)} placeholder={t('What happened?')} />
          <ErrorNote error={err} />
          <div className="modal-actions"><button className="btn" disabled={busy} onClick={() => act('dispute', { reason: text }, t('Dispute submitted'))}>{t('Submit')}</button></div>
        </Modal>
      )}
      {modal === 'reschedule' && <RescheduleModal b={b} onClose={() => setModal(null)} onDone={() => { setModal(null); notify(t('Booking rescheduled')); reload(); }} />}
    </div>
  );
}

export function Messages({ threadId }) {
  const t = useT();
  const fmt = useFormat();
  const { user } = useApp();
  const { data, reload } = useApi('/messages/threads');
  const [thread, setThread] = useState(null);
  const [text, setText] = useState('');
  const [bookingId, setBookingId] = useState('');
  const endRef = useRef(null);

  useEffect(() => {
    if (!threadId) return setThread(null);
    const load = () => api(`/messages/threads/${threadId}`).then(setThread).catch(() => {});
    load();
    const id = setInterval(load, 4000);
    return () => clearInterval(id);
  }, [threadId]);
  useEffect(() => { endRef.current?.scrollIntoView({ block: 'end' }); }, [thread?.messages.length]);

  const send = async (e) => {
    e.preventDefault();
    if (!text.trim()) return;
    await api(`/messages/threads/${threadId}/messages`, { method: 'POST', body: { body: text, bookingId: bookingId || null } });
    setText('');
    setThread(await api(`/messages/threads/${threadId}`));
    reload();
  };
  const other = (th) => (user.role === 'vendor' ? th.customer_name : th.business_name);

  return (
    <div className="container section">
      <h1>{t('Messages')}</h1>
      <div className={'chat' + (threadId ? ' has-thread' : '')}>
        <aside className="thread-list">
          {!data ? <Loading /> : data.threads.length === 0 ? <Empty>{t('No conversations yet. Message a vendor from their profile.')}</Empty> : data.threads.map((th) => (
            <Link key={th.id} to={`/messages/${th.id}`} className={'thread' + (String(th.id) === String(threadId) ? ' on' : '')}>
              <Avatar src={user.role === 'vendor' ? null : th.vendor_avatar} name={other(th)} size={40} />
              <span className="thread-text">
                <strong>{other(th)}</strong>
                {th.unread > 0 && <span className="dot inline">{th.unread}</span>}
                <span className="muted small ellipsis">{th.last_body || t('No messages yet')}</span>
              </span>
            </Link>
          ))}
        </aside>
        <section className="thread-view">
          {!threadId && <Empty>{t('Choose a conversation.')}</Empty>}
          {threadId && !thread && <Loading />}
          {thread && (
            <>
              <div className="thread-head">
                <Link to="/messages" className="back only-mobile">←</Link>
                <Avatar src={user.role === 'vendor' ? null : thread.vendor.avatar_url} name={user.role === 'vendor' ? thread.customer.name : thread.vendor.business_name} size={36} />
                <strong>{user.role === 'vendor' ? thread.customer.name : <Link to={`/vendors/${thread.vendor.id}`}>{thread.vendor.business_name}</Link>}</strong>
              </div>
              <div className="msgs">
                {thread.messages.length === 0 && <p className="muted small center">{t('Say hello and ask about dates, packages or style.')}</p>}
                {thread.messages.map((m) => (
                  <div key={m.id} className={'msg' + (m.sender_id === user.id ? ' mine' : '')}>
                    {m.booking_code && <span className="msg-tag">{m.booking_code}</span>}
                    <p>{m.body}</p>
                    <small>{fmt.dateTime(m.created_at)}{m.sender_id === user.id && m.read_at && ' · ' + t('Seen')}</small>
                  </div>
                ))}
                <div ref={endRef} />
              </div>
              <form className="composer" onSubmit={send}>
                {thread.bookings.length > 0 && (
                  <select value={bookingId} onChange={(e) => setBookingId(e.target.value)} aria-label={t('About booking')}>
                    <option value="">{t('General')}</option>
                    {thread.bookings.map((b) => <option key={b.id} value={b.id}>{b.code} · {fmt.date(b.event_date)}</option>)}
                  </select>
                )}
                <input value={text} onChange={(e) => setText(e.target.value)} placeholder={t('Write a message…')} aria-label={t('Message')} />
                <button className="btn">{t('Send')}</button>
              </form>
            </>
          )}
        </section>
      </div>
    </div>
  );
}
