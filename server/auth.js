import jwt from 'jsonwebtoken';
import crypto from 'node:crypto';
import { db } from './db.js';

// In production set PBP_JWT_SECRET; the fallback is generated per data directory so local runs work.
const SECRET = process.env.PBP_JWT_SECRET || (() => {
  const row = db.prepare("SELECT value FROM settings WHERE key = 'jwtSecret'").get();
  if (row) return JSON.parse(row.value);
  const s = crypto.randomBytes(32).toString('hex');
  db.prepare("INSERT INTO settings (key, value) VALUES ('jwtSecret', ?)").run(JSON.stringify(s));
  return s;
})();

const COOKIE = 'pbp_session';

export function setSession(res, user) {
  const token = jwt.sign({ uid: user.id }, SECRET, { expiresIn: '14d' });
  res.cookie(COOKIE, token, { httpOnly: true, sameSite: 'lax', secure: process.env.NODE_ENV === 'production', maxAge: 14 * 86400000 });
}

export function clearSession(res) {
  res.clearCookie(COOKIE);
}

export function loadUser(req, _res, next) {
  const token = req.cookies?.[COOKIE];
  if (token) {
    try {
      const { uid } = jwt.verify(token, SECRET);
      req.user = db.prepare('SELECT id, email, name, phone, role, locale FROM users WHERE id = ?').get(uid) || null;
      if (req.user?.role === 'vendor') req.vendor = db.prepare('SELECT * FROM vendors WHERE user_id = ?').get(uid) || null;
    } catch {
      req.user = null;
    }
  }
  next();
}

export function requireAuth(...roles) {
  return (req, res, next) => {
    if (!req.user) return res.status(401).json({ error: 'Please sign in' });
    if (roles.length && !roles.includes(req.user.role)) return res.status(403).json({ error: 'Not allowed' });
    next();
  };
}
