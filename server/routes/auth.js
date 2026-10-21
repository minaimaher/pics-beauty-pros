import { Router } from 'express';
import bcrypt from 'bcryptjs';
import crypto from 'node:crypto';
import { db, nowIso, now } from '../db.js';
import { setSession, clearSession } from '../auth.js';
import { ValidationError } from '../services/policy.js';
import { notify } from '../services/notify.js';

const r = Router();
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function publicUser(u) {
  return { id: u.id, email: u.email, name: u.name, phone: u.phone, role: u.role, locale: u.locale };
}

r.post('/register', (req, res) => {
  const { email, password, name, phone, role = 'customer', locale = 'en' } = req.body || {};
  if (!EMAIL_RE.test(email || '')) throw new ValidationError('Enter a valid email');
  if (!name?.trim()) throw new ValidationError('Enter your name');
  if ((password || '').length < 8) throw new ValidationError('Password must be at least 8 characters');
  if (!['customer', 'vendor'].includes(role)) throw new ValidationError('Invalid account type');
  const lower = email.trim().toLowerCase();
  if (db.prepare('SELECT 1 FROM users WHERE email = ?').get(lower)) throw new ValidationError('An account with this email already exists', 409);
  const info = db.prepare('INSERT INTO users (email, password_hash, name, phone, role, locale, created_at) VALUES (?,?,?,?,?,?,?)')
    .run(lower, bcrypt.hashSync(password, 10), name.trim(), phone || null, role, locale === 'ar' ? 'ar' : 'en', nowIso());
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(info.lastInsertRowid);
  notify(user.id, { type: 'welcome', title: 'Welcome to Pics Beauty Pros', body: role === 'vendor' ? 'Finish your vendor application to go live.' : 'Find and book your next session.', push: false });
  setSession(res, user);
  res.status(201).json({ user: publicUser(user) });
});

r.post('/login', (req, res) => {
  const { email, password } = req.body || {};
  const user = db.prepare('SELECT * FROM users WHERE email = ?').get(String(email || '').trim().toLowerCase());
  if (!user || !user.password_hash || !bcrypt.compareSync(password || '', user.password_hash)) {
    throw new ValidationError('Wrong email or password', 401);
  }
  setSession(res, user);
  res.json({ user: publicUser(user) });
});

// One-time code sign-in. The code is delivered through the outbox (simulated email/SMS);
// outside production it is also returned in the response so the demo works without a mail provider.
r.post('/otp/request', (req, res) => {
  const user = db.prepare('SELECT * FROM users WHERE email = ?').get(String(req.body?.email || '').trim().toLowerCase());
  const code = String(crypto.randomInt(100000, 1000000));
  if (user) {
    db.prepare('UPDATE users SET otp_hash = ?, otp_expires_at = ? WHERE id = ?')
      .run(bcrypt.hashSync(code, 8), new Date(now().getTime() + 10 * 60000).toISOString(), user.id);
    db.prepare("INSERT INTO outbox (channel, recipient, subject, body, created_at) VALUES ('email', ?, 'Your sign-in code', ?, ?)")
      .run(user.email, `Your Pics Beauty Pros code is ${code}. It expires in 10 minutes.`, nowIso());
  }
  // Same response whether or not the account exists, so emails can't be enumerated.
  res.json({ sent: true, ...(process.env.NODE_ENV !== 'production' && user ? { devCode: code } : {}) });
});

r.post('/otp/verify', (req, res) => {
  const user = db.prepare('SELECT * FROM users WHERE email = ?').get(String(req.body?.email || '').trim().toLowerCase());
  const ok = user?.otp_hash && user.otp_expires_at > now().toISOString() && bcrypt.compareSync(String(req.body?.code || ''), user.otp_hash);
  if (!ok) throw new ValidationError('That code is wrong or has expired', 401);
  db.prepare('UPDATE users SET otp_hash = NULL, otp_expires_at = NULL WHERE id = ?').run(user.id);
  setSession(res, user);
  res.json({ user: publicUser(user) });
});

r.post('/logout', (_req, res) => {
  clearSession(res);
  res.json({ ok: true });
});

r.get('/me', (req, res) => {
  if (!req.user) return res.json({ user: null });
  res.json({ user: req.user, vendor: req.vendor ? { id: req.vendor.id, status: req.vendor.status, business_name: req.vendor.business_name } : null });
});

r.patch('/me', (req, res) => {
  if (!req.user) throw new ValidationError('Please sign in', 401);
  const { name, phone, locale } = req.body || {};
  db.prepare('UPDATE users SET name = COALESCE(?, name), phone = COALESCE(?, phone), locale = COALESCE(?, locale) WHERE id = ?')
    .run(name?.trim() || null, phone ?? null, ['en', 'ar'].includes(locale) ? locale : null, req.user.id);
  res.json({ user: db.prepare('SELECT id, email, name, phone, role, locale FROM users WHERE id = ?').get(req.user.id) });
});

export default r;
