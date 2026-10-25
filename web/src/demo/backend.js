// Browser-only backend used by the GitHub Pages build. It runs the real server routes and
// services against SQLite compiled to WebAssembly, and saves the database and uploaded files
// to IndexedDB so each visitor keeps their own demo data.
import initSqlJs from 'sql.js/dist/sql-wasm.js';
import wasmUrl from 'sql.js/dist/sql-wasm.wasm?url';
import { files } from './shims/fs.js';

const STORE = 'pbp-demo';
const COOKIE_KEY = 'pbp.demo.session';
// Bump when the seed data changes so returning visitors get the new demo data.
const DATA_VERSION = 5;

function idb(mode, fn) {
  return new Promise((resolve, reject) => {
    const open = indexedDB.open(STORE, 1);
    open.onupgradeneeded = () => open.result.createObjectStore('kv');
    open.onerror = () => reject(open.error);
    open.onsuccess = () => {
      const tx = open.result.transaction('kv', mode);
      const req = fn(tx.objectStore('kv'));
      tx.oncomplete = () => resolve(req?.result);
      tx.onerror = () => reject(tx.error);
    };
  });
}

let ready;
let app;
let lastSaved = -1;

async function boot() {
  const SQL = await initSqlJs({ locateFile: () => wasmUrl });
  let saved = null;
  try {
    saved = await idb('readonly', (s) => s.get('state'));
  } catch {
    saved = null;
  }
  if (saved && saved.version !== DATA_VERSION) {
    saved = null;
    try { localStorage.removeItem(COOKIE_KEY); } catch { /* ignore */ }
  }
  globalThis.__PBP_SQL = { SQL, bytes: saved?.db || null };
  if (saved) {
    for (const [k, v] of Object.entries(saved.files || {})) files.set(k, v);
  } else {
    await import('../../../server/seed.js');
  }
  const [{ db, UPLOAD_DIR }, { loadUser }, auth, pub, bookings, vendor, messages, notifications, admin, { runScheduler }, { Router }] = await Promise.all([
    import('../../../server/db.js'),
    import('../../../server/auth.js'),
    import('../../../server/routes/auth.js'),
    import('../../../server/routes/public.js'),
    import('../../../server/routes/bookings.js'),
    import('../../../server/routes/vendor.js'),
    import('../../../server/routes/messages.js'),
    import('../../../server/routes/notifications.js'),
    import('../../../server/routes/admin.js'),
    import('../../../server/services/scheduler.js'),
    import('./shims/express.js')
  ]);

  // Same mounting as server/app.js.
  const root = Router();
  root.use(loadUser);
  root.use('/api/auth', auth.default);
  root.use('/api', pub.default);
  root.use('/api/bookings', bookings.default);
  root.use('/api/vendor', vendor.default);
  root.use('/api/messages', messages.default);
  root.use('/api/notifications', notifications.default);
  root.use('/api/flags', admin.flags);
  root.use('/api/admin', admin.default);

  const tick = () => { try { runScheduler(); } catch (err) { console.error(err); } };
  tick();
  setInterval(tick, 10 * 60 * 1000);

  app = { root, db, UPLOAD_DIR };
  await persist(true);
}

async function persist(force = false) {
  const changes = app.db.raw.exec('SELECT total_changes()')[0].values[0][0];
  if (!force && changes === lastSaved) return;
  // sql.js closes and reopens the database to export it, which resets connection pragmas and counters.
  const state = { version: DATA_VERSION, db: app.db.raw.export(), files: Object.fromEntries(files) };
  app.db.raw.exec('PRAGMA foreign_keys = ON');
  lastSaved = app.db.raw.exec('SELECT total_changes()')[0].values[0][0];
  try {
    await idb('readwrite', (s) => s.put(state, 'state'));
  } catch (err) {
    console.warn('Could not save demo data', err);
  }
}

// Files are served as blob: URLs; API responses refer to them by their server paths.
const blobUrls = new Map();
function fileUrl(p) {
  if (!files.has(p)) return null;
  if (!blobUrls.has(p)) blobUrls.set(p, URL.createObjectURL(files.get(p)));
  return blobUrls.get(p);
}
function rewrite(value) {
  if (typeof value === 'string') {
    if (value.startsWith('/uploads/')) return fileUrl(app.UPLOAD_DIR + value.slice('/uploads'.length)) || value;
    if (value.startsWith('/api/admin/documents/')) return fileUrl(app.UPLOAD_DIR + '/private/' + value.split('/').pop()) || value;
    return value;
  }
  if (Array.isArray(value)) return value.map(rewrite);
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, rewrite(v)]));
  return value;
}

function readCookies() {
  try {
    const v = localStorage.getItem(COOKIE_KEY);
    return v ? { pbp_session: v } : {};
  } catch {
    return {};
  }
}

export async function request(method, url, { body, form } = {}) {
  ready ||= boot();
  await ready;
  const u = new URL(url, 'http://demo');
  const query = {};
  for (const [k, v] of u.searchParams) query[k] = v;
  const req = { method, url, query, params: {}, body: form ? {} : body || {}, form, cookies: readCookies() };
  const res = {
    statusCode: 200,
    done: false,
    payload: undefined,
    status(n) { this.statusCode = n; return this; },
    json(obj) { this.payload = obj; this.done = true; return this; },
    cookie(name, value) { if (name === 'pbp_session') try { localStorage.setItem(COOKIE_KEY, value); } catch { /* ignore */ } return this; },
    clearCookie(name) { if (name === 'pbp_session') try { localStorage.removeItem(COOKIE_KEY); } catch { /* ignore */ } return this; }
  };
  try {
    await app.root.handle(req, res, '/api' + u.pathname);
    if (!res.done) res.status(404).json({ error: 'Not found' });
  } catch (err) {
    const status = err.status || 500;
    if (status >= 500) console.error(err);
    res.status(status).json({ error: status >= 500 ? 'Something went wrong' : err.message });
  }
  await persist();
  if (res.statusCode >= 400) {
    const err = new Error(res.payload?.error || `Request failed (${res.statusCode})`);
    err.status = res.statusCode;
    throw err;
  }
  return rewrite(res.payload);
}

export async function resetDemo() {
  try {
    await idb('readwrite', (s) => s.delete('state'));
    localStorage.removeItem(COOKIE_KEY);
  } catch { /* ignore */ }
  location.reload();
}
