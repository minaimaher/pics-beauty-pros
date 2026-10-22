import { createContext, useCallback, useContext, useEffect, useState, useSyncExternalStore } from 'react';
import { flushSync } from 'react-dom';
import { AR } from './ar.js';

// ---- API ----
// The GitHub Pages build has no server: requests go to the in-browser backend instead.
export const DEMO = import.meta.env.MODE === 'pages';
export const BASE = import.meta.env.BASE_URL.replace(/\/$/, '');

export async function api(path, { method = 'GET', body, form } = {}) {
  if (DEMO) {
    const { request } = await import('pbp-demo-backend');
    return request(method, path, { body, form });
  }
  const res = await fetch('/api' + path, {
    method,
    credentials: 'same-origin',
    headers: body ? { 'Content-Type': 'application/json' } : undefined,
    body: form || (body ? JSON.stringify(body) : undefined)
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(data.error || `Request failed (${res.status})`);
    err.status = res.status;
    throw err;
  }
  return data;
}

// Loads data for a component and exposes a reload function.
export function useApi(path, deps = []) {
  const [state, setState] = useState({ data: null, error: null, loading: true });
  const load = useCallback(() => {
    if (!path) return Promise.resolve();
    setState((s) => ({ ...s, loading: true }));
    return api(path).then(
      (data) => setState({ data, error: null, loading: false }),
      (error) => setState({ data: null, error, loading: false })
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [path, ...deps]);
  useEffect(() => { load(); }, [load]);
  return { ...state, reload: load };
}

// ---- Router (history API) ----
const listeners = new Set();
const subscribe = (fn) => {
  listeners.add(fn);
  window.addEventListener('popstate', fn);
  return () => { listeners.delete(fn); window.removeEventListener('popstate', fn); };
};
export function navigate(to, { replace = false } = {}) {
  if (replace) history.replaceState(null, '', BASE + to);
  else history.pushState(null, '', BASE + to);
  listeners.forEach((fn) => fn());
  window.scrollTo(0, 0);
}
export function useLocation() {
  const href = useSyncExternalStore(subscribe, () => location.pathname + location.search);
  const url = new URL(href, location.origin);
  const path = url.pathname.startsWith(BASE) ? url.pathname.slice(BASE.length) || '/' : url.pathname;
  return { path, query: Object.fromEntries(url.searchParams) };
}
export function matchRoute(pattern, path) {
  const p = pattern.split('/').filter(Boolean);
  const s = path.split('/').filter(Boolean);
  if (p.length !== s.length) return null;
  const params = {};
  for (let i = 0; i < p.length; i++) {
    if (p[i].startsWith(':')) params[p[i].slice(1)] = decodeURIComponent(s[i]);
    else if (p[i] !== s[i]) return null;
  }
  return params;
}
export function Link({ to, children, className, onClick, ...rest }) {
  return (
    <a
      href={BASE + to}
      className={className}
      onClick={(e) => {
        if (e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return;
        e.preventDefault();
        onClick?.(e);
        navigate(to);
      }}
      {...rest}
    >
      {children}
    </a>
  );
}

// ---- App context: session, market, language ----
export const AppCtx = createContext(null);
export const useApp = () => useContext(AppCtx);

const read = (k, d) => {
  try { return localStorage.getItem(k) || d; } catch { return d; }
};
const write = (k, v) => {
  try { localStorage.setItem(k, v); } catch { /* storage unavailable */ }
};

export function AppProvider({ children }) {
  const [session, setSession] = useState({ user: null, vendor: null, ready: false });
  const [meta, setMeta] = useState(null);
  const [locale, setLocaleState] = useState(read('pbp.locale', 'en'));
  const [market, setMarketState] = useState(read('pbp.market', 'EG'));
  const [toast, setToast] = useState(null);

  // Committed synchronously so a navigate() right after sign-in already sees the new user.
  const refreshSession = useCallback(() => api('/auth/me').then((d) => flushSync(() => setSession({ user: d.user, vendor: d.vendor || null, ready: true }))), []);
  const refreshMeta = useCallback(() => api('/meta').then(setMeta), []);
  useEffect(() => { refreshSession(); refreshMeta(); }, [refreshSession, refreshMeta]);

  useEffect(() => {
    document.documentElement.lang = locale;
    document.documentElement.dir = locale === 'ar' ? 'rtl' : 'ltr';
  }, [locale]);

  const setLocale = (l) => {
    setLocaleState(l);
    write('pbp.locale', l);
    if (session.user) api('/auth/me', { method: 'PATCH', body: { locale: l } }).catch(() => {});
  };
  const setMarket = (m) => { setMarketState(m); write('pbp.market', m); };
  const notify = (message, kind = 'ok') => setToast({ message, kind, id: Date.now() });
  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(null), 4000);
    return () => clearTimeout(timer);
  }, [toast]);

  const value = { ...session, refreshSession, meta, refreshMeta, locale, setLocale, market, setMarket, toast, notify };
  return <AppCtx.Provider value={value}>{children}</AppCtx.Provider>;
}

// ---- i18n ----
// English strings double as keys; ar.js maps them to Arabic. {name} placeholders are filled from vars.
export function useT() {
  const { locale } = useApp();
  return useCallback((s, vars) => {
    let out = (locale === 'ar' && AR[s]) || s;
    if (vars) for (const [k, v] of Object.entries(vars)) out = out.replaceAll(`{${k}}`, v);
    return out;
  }, [locale]);
}

export function useFormat() {
  const { locale } = useApp();
  const tag = locale === 'ar' ? 'ar-EG' : 'en-GB';
  return {
    money: (amount, currency) =>
      new Intl.NumberFormat(tag, { style: 'currency', currency, maximumFractionDigits: 0 }).format(amount || 0),
    date: (d, opts = { day: 'numeric', month: 'short', year: 'numeric' }) =>
      d ? new Intl.DateTimeFormat(tag, { ...opts, timeZone: 'UTC' }).format(new Date(d.length === 10 ? d + 'T00:00:00Z' : d)) : '',
    dateTime: (d) => (d ? new Intl.DateTimeFormat(tag, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(d)) : ''),
    number: (n) => new Intl.NumberFormat(tag).format(n || 0)
  };
}

export const CATEGORY_LABEL = { photographer: 'Photographer', videographer: 'Videographer', makeup: 'Makeup artist', hair: 'Hair dresser' };
export const CATEGORY_PLURAL = { photographer: 'Photographers', videographer: 'Videographers', makeup: 'Makeup artists', hair: 'Hair dressers' };
export const COUNTRY_LABEL = { EG: 'Egypt', SA: 'Saudi Arabia' };
export const METHOD_LABEL = { card: 'Credit/debit card', meeza: 'Meeza card', fawry: 'Fawry reference', wallet: 'Mobile wallet', mada: 'mada card', stcpay: 'STC Pay', applepay: 'Apple Pay' };
export const TIER_LABEL = { basic: 'Basic', pro: 'Pro', featured: 'Featured' };
export const STATUS_LABEL = { requested: 'Requested', confirmed: 'Confirmed', completed: 'Completed', cancelled: 'Cancelled', declined: 'Declined' };
