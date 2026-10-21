import { Router } from 'express';
import { db, nowIso } from '../db.js';
import { requireAuth } from '../auth.js';

const r = Router();
r.use(requireAuth());

r.get('/', (req, res) => {
  const items = db.prepare('SELECT * FROM notifications WHERE user_id = ? ORDER BY id DESC LIMIT 50').all(req.user.id);
  const unread = db.prepare('SELECT COUNT(*) n FROM notifications WHERE user_id = ? AND read_at IS NULL').get(req.user.id).n;
  const unreadMessages = db.prepare(`SELECT COUNT(*) n FROM messages m JOIN threads th ON th.id = m.thread_id
      WHERE (th.customer_id = ? OR th.vendor_id = ?) AND m.sender_id != ? AND m.read_at IS NULL`)
    .get(req.user.id, req.vendor?.id ?? -1, req.user.id).n;
  res.json({ items, unread, unreadMessages });
});

r.post('/read', (req, res) => {
  db.prepare('UPDATE notifications SET read_at = ? WHERE user_id = ? AND read_at IS NULL').run(nowIso(), req.user.id);
  res.json({ ok: true });
});

export default r;
