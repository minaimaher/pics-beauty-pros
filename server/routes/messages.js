import { Router } from 'express';
import { db, nowIso } from '../db.js';
import { requireAuth } from '../auth.js';
import { ValidationError } from '../services/policy.js';
import { notify } from '../services/notify.js';

const r = Router();
r.use(requireAuth('customer', 'vendor'));

// One thread per customer–vendor pair; messages can reference a booking.
function threadFor(req, id) {
  const th = db.prepare('SELECT * FROM threads WHERE id = ?').get(id);
  if (!th || (th.customer_id !== req.user.id && req.vendor?.id !== th.vendor_id)) throw new ValidationError('Conversation not found', 404);
  return th;
}

r.get('/threads', (req, res) => {
  const asVendor = req.user.role === 'vendor' && req.vendor;
  const rows = db.prepare(`SELECT th.*, v.business_name, u.name customer_name,
      (SELECT body FROM messages WHERE thread_id = th.id ORDER BY id DESC LIMIT 1) last_body,
      (SELECT COUNT(*) FROM messages WHERE thread_id = th.id AND sender_id != ? AND read_at IS NULL) unread
    FROM threads th JOIN vendors v ON v.id = th.vendor_id JOIN users u ON u.id = th.customer_id
    WHERE ${asVendor ? 'th.vendor_id = ?' : 'th.customer_id = ?'} ORDER BY th.last_message_at DESC`)
    .all(req.user.id, asVendor ? req.vendor.id : req.user.id);
  res.json({ threads: rows });
});

// Customers open (or reuse) a thread with a vendor, e.g. from the profile's "Message" button.
r.post('/threads', requireAuth('customer'), (req, res) => {
  const vendor = db.prepare("SELECT id FROM vendors WHERE id = ? AND status = 'approved'").get(req.body?.vendorId);
  if (!vendor) throw new ValidationError('Vendor not found', 404);
  db.prepare('INSERT OR IGNORE INTO threads (customer_id, vendor_id, last_message_at) VALUES (?,?,?)').run(req.user.id, vendor.id, nowIso());
  res.json(db.prepare('SELECT * FROM threads WHERE customer_id = ? AND vendor_id = ?').get(req.user.id, vendor.id));
});

r.get('/threads/:id', (req, res) => {
  const th = threadFor(req, req.params.id);
  db.prepare('UPDATE messages SET read_at = ? WHERE thread_id = ? AND sender_id != ? AND read_at IS NULL').run(nowIso(), th.id, req.user.id);
  const v = db.prepare('SELECT id, business_name FROM vendors WHERE id = ?').get(th.vendor_id);
  const c = db.prepare('SELECT id, name FROM users WHERE id = ?').get(th.customer_id);
  const bookings = db.prepare("SELECT id, code, event_date, status FROM bookings WHERE customer_id = ? AND vendor_id = ? ORDER BY event_date DESC").all(c.id, v.id);
  const messages = db.prepare(`SELECT m.id, m.sender_id, m.body, m.booking_id, m.created_at, m.read_at, b.code booking_code FROM messages m
      LEFT JOIN bookings b ON b.id = m.booking_id WHERE m.thread_id = ? ORDER BY m.id`).all(th.id);
  res.json({ thread: th, vendor: v, customer: c, bookings, messages });
});

r.post('/threads/:id/messages', (req, res) => {
  const th = threadFor(req, req.params.id);
  const body = String(req.body?.body || '').trim();
  if (!body) throw new ValidationError('Type a message');
  const bookingId = req.body?.bookingId
    ? db.prepare('SELECT id FROM bookings WHERE id = ? AND customer_id = ? AND vendor_id = ?').get(req.body.bookingId, th.customer_id, th.vendor_id)?.id ?? null
    : null;
  const ts = nowIso();
  db.prepare('INSERT INTO messages (thread_id, sender_id, booking_id, body, created_at) VALUES (?,?,?,?,?)').run(th.id, req.user.id, bookingId, body.slice(0, 4000), ts);
  db.prepare('UPDATE threads SET last_message_at = ? WHERE id = ?').run(ts, th.id);
  const recipient = th.customer_id === req.user.id ? db.prepare('SELECT user_id FROM vendors WHERE id = ?').get(th.vendor_id).user_id : th.customer_id;
  notify(recipient, { type: 'message', title: `New message from ${req.user.name}`, body: body.slice(0, 140), link: `/messages/${th.id}`, email: false });
  res.status(201).json({ ok: true });
});

export default r;
