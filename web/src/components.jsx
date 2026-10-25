import { useEffect, useRef, useState } from 'react';
import { api, Link, navigate, useApp, useT, useFormat, useLocation, DEMO, CATEGORY_LABEL, COUNTRY_LABEL, METHOD_LABEL, STATUS_LABEL } from './lib.jsx';

// Brand mark "aperture bloom": six petals arranged like aperture blades around a lens.
const PETAL = 'M32 7.5c7.6 5.3 9.8 12.9 6.1 19.6L32 32l-6.1-4.9C22.2 20.4 24.4 12.8 32 7.5z';
export function BrandMark({ size = 32, app = false, title }) {
  return (
    <svg viewBox={app ? '0 0 64 64' : '5 5 54 54'} width={size} height={size} role={title ? 'img' : undefined} aria-hidden={title ? undefined : true} aria-label={title}>
      <defs>
        <linearGradient id="pbp-g0" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#F6D3C2" /><stop offset="1" stopColor="#D98E6E" /></linearGradient>
        <linearGradient id="pbp-g1" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#EDBBA5" /><stop offset="1" stopColor="#B7613F" /></linearGradient>
      </defs>
      {app && <rect width="64" height="64" rx="16" fill="#1F1830" />}
      {[0, 60, 120, 180, 240, 300].map((a, i) => <path key={a} d={PETAL} transform={`rotate(${a} 32 32)`} fill={`url(#pbp-g${i % 2})`} />)}
      <circle cx="32" cy="32" r="5.6" fill="#1F1830" stroke="#F6D3C2" strokeWidth="1.8" />
      <circle cx="33.7" cy="30.3" r="1.4" fill="#F6D3C2" />
    </svg>
  );
}

// Round profile photo; shows initials if there is no photo or it fails to load.
export function Avatar({ src, name = '', size = 40, className = '' }) {
  const [failed, setFailed] = useState(false);
  const initials = name.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]).join('').toUpperCase();
  const style = { width: size, height: size, fontSize: Math.round(size * 0.38) };
  return src && !failed
    ? <img className={'avatar ' + className} style={style} src={src} alt={name} loading="lazy" data-fallback="1" onError={() => setFailed(true)} />
    : <span className={'avatar avatar-initials ' + className} style={style} aria-label={name}>{initials}</span>;
}

export function Wordmark() {
  const { locale } = useApp();
  return locale === 'ar' ? <span className="wordmark">بيكس بيوتي <b>برو</b></span> : <span className="wordmark">Pics Beauty <b>Pros</b></span>;
}

export function Logo() {
  return (
    <Link to="/" className="logo" aria-label="Pics Beauty Pros">
      <BrandMark size={34} />
      <Wordmark />
    </Link>
  );
}

function NotificationsBell({ showMessages }) {
  const t = useT();
  const fmt = useFormat();
  const [open, setOpen] = useState(false);
  const [data, setData] = useState({ items: [], unread: 0, unreadMessages: 0 });
  const ref = useRef(null);
  const load = () => api('/notifications').then(setData).catch(() => {});
  useEffect(() => {
    load();
    const id = setInterval(load, 15000);
    return () => clearInterval(id);
  }, []);
  useEffect(() => {
    const close = (e) => ref.current && !ref.current.contains(e.target) && setOpen(false);
    document.addEventListener('click', close);
    return () => document.removeEventListener('click', close);
  }, []);
  const toggle = () => {
    setOpen(!open);
    if (!open && data.unread) api('/notifications/read', { method: 'POST' }).then(() => setTimeout(load, 1500));
  };
  return (
    <>
      {showMessages && (
        <Link to="/messages" className="icon-btn" aria-label={t('Messages')}>
          <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M4 5h16v11H8l-4 4z" /></svg>
          {data.unreadMessages > 0 && <span className="dot">{data.unreadMessages}</span>}
        </Link>
      )}
      <div className="menu-wrap" ref={ref}>
        <button className="icon-btn" onClick={toggle} aria-label={t('Notifications')} aria-expanded={open}>
          <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M6 16V11a6 6 0 0 1 12 0v5l2 2H4zM10 20a2 2 0 0 0 4 0" /></svg>
          {data.unread > 0 && <span className="dot">{data.unread}</span>}
        </button>
        {open && (
          <div className="dropdown notif-list">
            <div className="dropdown-head">{t('Notifications')}</div>
            {data.items.length === 0 && <p className="muted pad">{t('Nothing yet.')}</p>}
            {data.items.map((n) => (
              <button key={n.id} className={'notif' + (n.read_at ? '' : ' unread')} onClick={() => { setOpen(false); if (n.link) navigate(n.link); }}>
                <strong>{n.title}</strong>
                {n.body && <span>{n.body}</span>}
                <small className="muted">{fmt.dateTime(n.created_at)}</small>
              </button>
            ))}
          </div>
        )}
      </div>
    </>
  );
}

export function Header() {
  const { user, vendor, market, setMarket, locale, setLocale, refreshSession } = useApp();
  const t = useT();
  const [menu, setMenu] = useState(false);
  const { path } = useLocation();
  useEffect(() => setMenu(false), [path]);
  const logout = async () => {
    await api('/auth/logout', { method: 'POST' });
    await refreshSession();
    navigate('/');
  };
  return (
    <header className="site-header">
      <div className="container header-row">
        <Logo />
        <nav className={'main-nav' + (menu ? ' open' : '')}>
          <Link to="/search">{t('Browse')}</Link>
          {user?.role === 'customer' && <Link to="/bookings">{t('My bookings')}</Link>}
          {user?.role === 'vendor' && <Link to={vendor ? '/vendor' : '/vendor/apply'}>{t('Vendor dashboard')}</Link>}
          {user?.role === 'admin' && <Link to="/admin">{t('Admin')}</Link>}
          {!user && <Link to="/join-vendor">{t('List your business')}</Link>}
          <div className="switchers">
            <select aria-label={t('Market')} value={market} onChange={(e) => setMarket(e.target.value)}>
              <option value="EG">🇪🇬 {t('Egypt')} · EGP</option>
              <option value="SA">🇸🇦 {t('Saudi Arabia')} · SAR</option>
            </select>
            <button className="btn-link lang" onClick={() => setLocale(locale === 'ar' ? 'en' : 'ar')}>{locale === 'ar' ? 'English' : 'العربية'}</button>
          </div>
          {user ? (
            <button className="btn-link" onClick={logout}>{t('Sign out')}</button>
          ) : (
            <Link to="/login" className="btn btn-small">{t('Sign in')}</Link>
          )}
        </nav>
        <div className="header-actions">
          {user && <NotificationsBell showMessages={user.role !== 'admin'} />}
          <button className="icon-btn burger" aria-label={t('Menu')} onClick={() => setMenu(!menu)}>
            <svg viewBox="0 0 24 24" width="22" height="22" stroke="currentColor" strokeWidth="2"><path d="M4 7h16M4 12h16M4 17h16" /></svg>
          </button>
        </div>
      </div>
    </header>
  );
}

export function Footer() {
  const t = useT();
  return (
    <footer className="site-footer">
      <div className="container footer-row">
        <div>
          <Logo />
          <p className="muted small">{t('Book vetted photographers, videographers, makeup artists and hair dressers in Egypt and Saudi Arabia.')}</p>
          <p className="small"><Link to="/brand">{t('Brand guidelines')}</Link> · <span className="muted">{t('Photos: Pexels')}</span></p>
        </div>
        <div>
          <p className="muted small">{t('Proof of concept · payments run in sandbox mode, no real money moves.')}</p>
          {DEMO && (
            <p className="muted small">
              {t('Demo mode: the app runs entirely in your browser and your changes are saved on this device only.')}{' '}
              <button className="btn-link small" onClick={async () => { if (confirm(t('Reset all demo data?'))) (await import('pbp-demo-backend')).resetDemo(); }}>{t('Reset demo data')}</button>
            </p>
          )}
        </div>
      </div>
    </footer>
  );
}

export function Toast() {
  const { toast } = useApp();
  if (!toast) return null;
  return <div className={'toast ' + toast.kind} role="status">{toast.message}</div>;
}

export function Stars({ value, count, size = 'sm' }) {
  const fmt = useFormat();
  return (
    <span className={'stars ' + size} aria-label={`${value} / 5`}>
      <span className="star-fill">★</span> {value ? value.toFixed(1) : '—'}
      {count != null && <span className="muted"> ({fmt.number(count)})</span>}
    </span>
  );
}

export function StarInput({ value, onChange }) {
  return (
    <div className="star-input" role="radiogroup">
      {[1, 2, 3, 4, 5].map((n) => (
        <button type="button" key={n} role="radio" aria-checked={value === n} className={n <= value ? 'on' : ''} onClick={() => onChange(n)} aria-label={`${n}`}>★</button>
      ))}
    </div>
  );
}

export function TierBadge({ tier }) {
  const t = useT();
  if (tier === 'featured') return <span className="badge badge-featured">★ {t('Featured')}</span>;
  if (tier === 'pro') return <span className="badge badge-pro">{t('Pro')}</span>;
  return null;
}

export function StatusBadge({ status }) {
  const t = useT();
  return <span className={'badge status-' + status}>{t(STATUS_LABEL[status] || status)}</span>;
}

export function VendorCard({ v }) {
  const t = useT();
  const fmt = useFormat();
  return (
    <Link to={`/vendors/${v.id}`} className="vendor-card">
      <div className="vc-cover">
        {v.cover && <img src={v.cover} alt="" loading="lazy" />}
        <TierBadge tier={v.tier} />
      </div>
      <Avatar src={v.avatar_url} name={v.owner_first_name || v.business_name} size={52} className="vc-avatar" />
      <div className="vc-body">
        <div className="vc-top">
          <h3>{v.business_name}</h3>
          <Stars value={v.rating_avg} count={v.rating_count} />
        </div>
        <p className="muted small">
          {v.categories.map((c) => t(CATEGORY_LABEL[c])).join(' · ')} — {v.district ? `${t(v.district)}, ` : ''}{t(v.city)}
          {v.distance_km != null && ` · ${fmt.number(v.distance_km)} ${t('km')}`}
        </p>
        <div className="tags">{v.style_tags.slice(0, 3).map((tag) => <span key={tag} className="tag">{tag}</span>)}</div>
        {(v.from_price ?? v.min_price) != null && (
          <p className="vc-price">{t('From')} <strong>{fmt.money(v.from_price ?? v.min_price, v.currency)}</strong></p>
        )}
      </div>
    </Link>
  );
}

export function Modal({ title, onClose, children, wide }) {
  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);
  return (
    <div className="modal-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className={'modal' + (wide ? ' wide' : '')} role="dialog" aria-modal="true" aria-label={title}>
        <div className="modal-head">
          <h2>{title}</h2>
          <button className="icon-btn" onClick={onClose} aria-label="Close">✕</button>
        </div>
        {children}
      </div>
    </div>
  );
}

export function Loading() {
  const t = useT();
  return <div className="loading" aria-busy="true">{t('Loading…')}</div>;
}

export function ErrorNote({ error }) {
  if (!error) return null;
  return <div className="error-note" role="alert">{error.message || String(error)}</div>;
}

export function Empty({ children }) {
  return <div className="empty">{children}</div>;
}

// Month grid showing a vendor's availability; clicking a selectable day calls onSelect.
export function MonthCalendar({ month, days, onMonth, selected, onSelect, minMonth, renderDay }) {
  const t = useT();
  const fmt = useFormat();
  const [y, m] = month.split('-').map(Number);
  const firstDow = new Date(Date.UTC(y, m - 1, 1)).getUTCDay();
  const shift = (delta) => {
    const d = new Date(Date.UTC(y, m - 1 + delta, 1));
    onMonth(d.toISOString().slice(0, 7));
  };
  const weekdays = [...Array(7)].map((_, i) => fmt.date(`2026-02-${String(1 + i).padStart(2, '0')}`, { weekday: 'narrow' }));
  return (
    <div className="calendar">
      <div className="cal-head">
        <button type="button" className="icon-btn" onClick={() => shift(-1)} disabled={minMonth && month <= minMonth} aria-label={t('Previous month')}>‹</button>
        <strong>{fmt.date(month + '-01', { month: 'long', year: 'numeric' })}</strong>
        <button type="button" className="icon-btn" onClick={() => shift(1)} aria-label={t('Next month')}>›</button>
      </div>
      <div className="cal-grid">
        {weekdays.map((w, i) => <span key={i} className="cal-dow">{w}</span>)}
        {[...Array(firstDow)].map((_, i) => <span key={'b' + i} />)}
        {days.map((d) => {
          const selectable = onSelect && (d.state === 'available' || d.state === 'partial' || d.selectable);
          return (
            <button type="button" key={d.date} disabled={!selectable && !renderDay} onClick={() => onSelect?.(d.date)}
              className={`cal-day ${d.state}${selected === d.date ? ' selected' : ''}`} title={t(d.state)}>
              {Number(d.date.slice(8))}
              {renderDay?.(d)}
            </button>
          );
        })}
      </div>
      <div className="cal-legend small muted">
        <span><i className="lg available" />{t('Available')}</span>
        <span><i className="lg partial" />{t('Partly booked')}</span>
        <span><i className="lg unavailable" />{t('Unavailable')}</span>
      </div>
    </div>
  );
}

// Sandbox payment form: method choice per market plus the fields that method needs.
export function PaymentFields({ country, value, onChange, methods }) {
  const t = useT();
  const { meta } = useApp();
  const list = methods || meta?.paymentMethods?.[country] || ['card'];
  const m = value.method || list[0];
  const set = (k, v) => onChange({ ...value, method: m, [k]: v });
  return (
    <fieldset className="payment">
      <legend>{t('Payment')}</legend>
      <div className="method-grid">
        {list.map((x) => (
          <label key={x} className={'method' + (m === x ? ' on' : '')}>
            <input type="radio" name="method" checked={m === x} onChange={() => onChange({ ...value, method: x })} />
            {t(METHOD_LABEL[x])}
          </label>
        ))}
      </div>
      {['card', 'meeza', 'mada'].includes(m) && (
        <div className="row-2">
          <label className="field">{t('Card number')}
            <input inputMode="numeric" autoComplete="cc-number" placeholder="4242 4242 4242 4242" value={value.number || ''} onChange={(e) => set('number', e.target.value)} required />
          </label>
          <div className="row-2">
            <label className="field">{t('Expiry')}<input placeholder="12/28" autoComplete="cc-exp" value={value.exp || ''} onChange={(e) => set('exp', e.target.value)} required /></label>
            <label className="field">CVC<input inputMode="numeric" placeholder="123" autoComplete="cc-csc" value={value.cvc || ''} onChange={(e) => set('cvc', e.target.value)} required /></label>
          </div>
        </div>
      )}
      {['wallet', 'stcpay'].includes(m) && (
        <label className="field">{t('Wallet phone number')}
          <input inputMode="tel" placeholder={country === 'SA' ? '+9665…' : '+2010…'} value={value.phone || ''} onChange={(e) => set('phone', e.target.value)} required />
        </label>
      )}
      {m === 'fawry' && <p className="small muted">{t('A Fawry reference is generated; in sandbox mode it is marked paid immediately.')}</p>}
      {m === 'applepay' && <p className="small muted">{t('Apple Pay is simulated in sandbox mode.')}</p>}
      <p className="small muted sandbox-note">{t('Sandbox: any card number works; cards ending in 0002 are declined.')}</p>
    </fieldset>
  );
}

export function Tabs({ tabs, active, base }) {
  const t = useT();
  return (
    <nav className="tabs" aria-label="Sections">
      {tabs.map(([key, label, badge]) => (
        <Link key={key} to={key ? `${base}/${key}` : base} className={'tab' + (active === key ? ' on' : '')}>
          {t(label)}{badge ? <span className="dot inline">{badge}</span> : null}
        </Link>
      ))}
    </nav>
  );
}

export function RequireRole({ role, children }) {
  const { user, ready } = useApp();
  const { path } = useLocation();
  useEffect(() => {
    if (ready && (!user || (role && user.role !== role))) navigate('/login?next=' + encodeURIComponent(path), { replace: true });
  }, [ready, user, role, path]);
  if (!ready || !user || (role && user.role !== role)) return <Loading />;
  return children;
}

export { CATEGORY_LABEL, COUNTRY_LABEL };
