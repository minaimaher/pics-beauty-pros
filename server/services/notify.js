import { db, nowIso } from '../db.js';

// Writes an in-app notification and records the matching email and push message in the outbox.
// The outbox stands in for real email/push providers and is visible to admins.
export function notify(userId, { type, title, body = '', link = null, email = true, push = true }) {
  const user = db.prepare('SELECT id, email FROM users WHERE id = ?').get(userId);
  if (!user) return;
  const ts = nowIso();
  db.prepare('INSERT INTO notifications (user_id, type, title, body, link, created_at) VALUES (?,?,?,?,?,?)')
    .run(userId, type, title, body, link, ts);
  const out = db.prepare('INSERT INTO outbox (channel, recipient, subject, body, created_at) VALUES (?,?,?,?,?)');
  if (email) out.run('email', user.email, title, body, ts);
  if (push) out.run('push', `user:${user.id}`, title, body, ts);
}

export function notifyVendor(vendorId, payload) {
  const v = db.prepare('SELECT user_id FROM vendors WHERE id = ?').get(vendorId);
  if (v) notify(v.user_id, payload);
}

export function notifyAdmins(payload) {
  for (const a of db.prepare("SELECT id FROM users WHERE role = 'admin'").all()) notify(a.id, { ...payload, push: false });
}
