import { Router } from 'express';
import path from 'node:path';
import { db, nowIso, today, getSetting, setSetting, UPLOAD_DIR, tx, addDays } from '../db.js';
import { requireAuth } from '../auth.js';
import { ValidationError } from '../services/policy.js';
import { vendorProfile, vendorSummary, effectiveTier } from '../services/vendors.js';
import { notify, notifyVendor } from '../services/notify.js';
import { refund } from '../services/payments.js';
import { getBooking, recomputeRating } from '../services/bookings.js';
import { runScheduler } from '../services/scheduler.js';
import { CATEGORIES } from '../geo.js';

const r = Router();

// Any signed-in user can flag a review or portfolio item for moderation.
export const flags = Router();
flags.post('/', requireAuth(), (req, res) => {
  const { type, id, reason } = req.body || {};
  const table = { review: 'reviews', media: 'media' }[type];
  if (!table) throw new ValidationError('Unknown content type');
  const info = db.prepare(`UPDATE ${table} SET flagged = 1, flag_reason = ? WHERE id = ?`).run(String(reason || 'Reported').slice(0, 300), id);
  if (!info.changes) throw new ValidationError('Not found', 404);
  res.json({ ok: true });
});

r.use(requireAuth('admin'));

r.get('/overview', (_req, res) => {
  const t = today();
  const month = t.slice(0, 7);
  const one = (sql, ...p) => db.prepare(sql).get(...p);
  const all = (sql, ...p) => db.prepare(sql).all(...p);
  const searches30 = one('SELECT COUNT(*) n FROM search_events WHERE created_at >= ?', addDays(t, -30)).n;
  const bookings30 = one("SELECT COUNT(*) n FROM bookings WHERE created_at >= ? AND status != 'declined'", addDays(t, -30)).n;
  const customersWithRepeat = one(`SELECT COUNT(*) n FROM (SELECT customer_id FROM bookings WHERE status = 'completed' GROUP BY customer_id HAVING COUNT(*) > 1)`).n;
  const customersWithAny = one(`SELECT COUNT(DISTINCT customer_id) n FROM bookings WHERE status = 'completed'`).n;
  const completed = one("SELECT COUNT(*) n FROM bookings WHERE status = 'completed'").n;
  const reviewed = one('SELECT COUNT(*) n FROM reviews').n;
  const vendorsByTier = all("SELECT tier, subscription_status, COUNT(*) n FROM vendors WHERE status = 'approved' GROUP BY tier, subscription_status");
  const signups = one("SELECT COUNT(*) n FROM vendors WHERE status = 'approved'").n;
  const paying = one("SELECT COUNT(*) n FROM vendors WHERE status = 'approved' AND tier != 'basic' AND subscription_status = 'active'").n;
  const disputes = one('SELECT COUNT(*) n FROM disputes').n;
  res.json({
    today: t,
    clockOffsetDays: getSetting('clockOffsetDays'),
    supply: CATEGORIES.flatMap((c) => ['EG', 'SA'].map((country) => ({
      category: c, country,
      n: one(`SELECT COUNT(*) n FROM vendors v JOIN vendor_categories vc ON vc.vendor_id = v.id WHERE vc.category = ? AND v.country = ? AND v.status = 'approved'`, c, country).n
    }))),
    pendingApplications: one("SELECT COUNT(*) n FROM vendors WHERE status = 'pending'").n,
    activeCustomers30: one('SELECT COUNT(DISTINCT customer_id) n FROM bookings WHERE created_at >= ?', addDays(t, -30)).n,
    customers: one("SELECT COUNT(*) n FROM users WHERE role = 'customer'").n,
    searches30,
    bookings30,
    searchToBooking: searches30 ? Math.round((bookings30 / searches30) * 1000) / 10 : 0,
    bookingsByStatus: all('SELECT status, COUNT(*) n FROM bookings GROUP BY status'),
    completedThisMonth: one("SELECT COUNT(*) n FROM bookings WHERE status = 'completed' AND substr(event_date, 1, 7) = ?", month).n,
    repeatRate: customersWithAny ? Math.round((customersWithRepeat / customersWithAny) * 1000) / 10 : 0,
    avgRating: one("SELECT ROUND(AVG(rating), 2) a FROM reviews WHERE status = 'visible'").a || 0,
    reviewCompletion: completed ? Math.round((reviewed / completed) * 1000) / 10 : 0,
    disputeRate: one('SELECT COUNT(*) n FROM bookings').n ? Math.round((disputes / one('SELECT COUNT(*) n FROM bookings').n) * 1000) / 10 : 0,
    openDisputes: one("SELECT COUNT(*) n FROM disputes WHERE status = 'open'").n,
    flaggedItems: one('SELECT (SELECT COUNT(*) FROM reviews WHERE flagged = 1) + (SELECT COUNT(*) FROM media WHERE flagged = 1) n').n,
    subscription: {
      vendorsByTier,
      signUpToPaid: signups ? Math.round((paying / signups) * 1000) / 10 : 0,
      revenue: all("SELECT currency, SUM(amount) total, COUNT(*) n FROM payments WHERE kind = 'subscription' AND status = 'succeeded' AND amount > 0 GROUP BY currency"),
      revenueThisMonth: all("SELECT currency, SUM(amount) total FROM payments WHERE kind = 'subscription' AND status = 'succeeded' AND substr(created_at, 1, 7) = ? GROUP BY currency", month),
      renewals: one("SELECT COUNT(*) n FROM payments WHERE kind = 'subscription' AND provider_ref LIKE 'sbx_renew_%'").n,
      churned: one("SELECT COUNT(*) n FROM vendors WHERE subscription_status IN ('cancelled','past_due')").n
    },
    gmv: all("SELECT currency, SUM(CASE WHEN kind = 'refund' THEN -amount ELSE amount END) total FROM payments WHERE kind IN ('deposit','balance','refund') AND status = 'succeeded' GROUP BY currency")
  });
});

r.get('/vendors', (req, res) => {
  const status = ['pending', 'approved', 'rejected', 'suspended'].includes(req.query.status) ? req.query.status : null;
  const rows = db.prepare(`SELECT v.*, u.email, u.name owner_name FROM vendors v JOIN users u ON u.id = v.user_id ${status ? 'WHERE v.status = ?' : ''} ORDER BY v.created_at DESC`)
    .all(...(status ? [status] : []));
  res.json({
    vendors: rows.map((v) => ({
      ...vendorSummary(v), status: v.status, email: v.email, owner_name: v.owner_name, created_at: v.created_at,
      tier_selected: v.tier, subscription_status: v.subscription_status, media_count: db.prepare('SELECT COUNT(*) n FROM media WHERE vendor_id = ?').get(v.id).n
    })),
    featuredSlots: getSetting('featuredSlots'),
    featuredUsed: db.prepare('SELECT COUNT(*) n FROM vendors WHERE homepage_featured = 1').get().n
  });
});

r.get('/vendors/:id', (req, res) => {
  const v = db.prepare('SELECT v.*, u.email, u.name owner_name, u.phone FROM vendors v JOIN users u ON u.id = v.user_id WHERE v.id = ?').get(req.params.id);
  if (!v) throw new ValidationError('Vendor not found', 404);
  res.json({
    ...vendorProfile(v, { includeHidden: true }), email: v.email, owner_name: v.owner_name, phone: v.phone, review_notes: v.review_notes,
    id_document_url: v.id_document ? `/api/admin/documents/${v.id_document}` : null, created_at: v.created_at, tier_selected: v.tier,
    subscription_status: v.subscription_status
  });
});

r.get('/documents/:file', (req, res) => {
  res.sendFile(path.join(UPLOAD_DIR, 'private', path.basename(req.params.file)));
});

r.post('/vendors/:id/decision', (req, res) => {
  const v = db.prepare('SELECT * FROM vendors WHERE id = ?').get(req.params.id);
  if (!v) throw new ValidationError('Vendor not found', 404);
  const { decision, notes = '' } = req.body || {};
  const next = { approve: 'approved', reject: 'rejected', suspend: 'suspended', reinstate: 'approved' }[decision];
  if (!next) throw new ValidationError('Unknown decision');
  if (decision === 'reject' && !notes.trim()) throw new ValidationError('Tell the vendor why the application was rejected');
  db.prepare('UPDATE vendors SET status = ?, review_notes = ?, approved_at = COALESCE(approved_at, CASE WHEN ? = \'approved\' THEN ? END) WHERE id = ?')
    .run(next, notes, next, nowIso(), v.id);
  const titles = { approved: 'Your profile is live!', rejected: 'Your application needs changes', suspended: 'Your profile has been suspended' };
  notify(v.user_id, { type: 'vendor_status', title: titles[next], body: notes || 'Add packages and availability to start receiving bookings.', link: '/vendor' });
  res.json({ ok: true });
});

r.post('/vendors/:id/featured', (req, res) => {
  const v = db.prepare('SELECT * FROM vendors WHERE id = ?').get(req.params.id);
  if (!v) throw new ValidationError('Vendor not found', 404);
  if (req.body?.on) {
    if (effectiveTier(v) !== 'featured') throw new ValidationError('Only vendors on the Featured plan can take a homepage slot');
    const used = db.prepare('SELECT COUNT(*) n FROM vendors WHERE homepage_featured = 1 AND id != ?').get(v.id).n;
    if (used >= getSetting('featuredSlots')) throw new ValidationError('All featured slots are taken');
  }
  db.prepare('UPDATE vendors SET homepage_featured = ? WHERE id = ?').run(req.body?.on ? 1 : 0, v.id);
  res.json({ ok: true });
});

r.get('/moderation', (_req, res) => {
  res.json({
    reviews: db.prepare(`SELECT r.*, v.business_name, u.name customer_name FROM reviews r JOIN vendors v ON v.id = r.vendor_id JOIN users u ON u.id = r.customer_id
        ORDER BY r.flagged DESC, r.created_at DESC LIMIT 100`).all(),
    media: db.prepare(`SELECT m.*, v.business_name FROM media m JOIN vendors v ON v.id = m.vendor_id
        ORDER BY m.flagged DESC, m.created_at DESC LIMIT 200`).all()
  });
});

r.post('/moderation/:type/:id', (req, res) => {
  const table = { review: 'reviews', media: 'media' }[req.params.type];
  if (!table) throw new ValidationError('Unknown content type');
  const row = db.prepare(`SELECT * FROM ${table} WHERE id = ?`).get(req.params.id);
  if (!row) throw new ValidationError('Not found', 404);
  const action = req.body?.action;
  if (action === 'hide') db.prepare(`UPDATE ${table} SET status = 'hidden', flagged = 0 WHERE id = ?`).run(row.id);
  else if (action === 'restore') db.prepare(`UPDATE ${table} SET status = 'visible', flagged = 0 WHERE id = ?`).run(row.id);
  else if (action === 'dismiss') db.prepare(`UPDATE ${table} SET flagged = 0, flag_reason = NULL WHERE id = ?`).run(row.id);
  else throw new ValidationError('Unknown action');
  if (table === 'reviews') recomputeRating(row.vendor_id);
  if (action === 'hide') notifyVendor(row.vendor_id, { type: 'moderation', title: `A ${req.params.type} was hidden by moderators`, body: row.flag_reason || '', push: false });
  res.json({ ok: true });
});

r.get('/disputes', (_req, res) => {
  const rows = db.prepare(`SELECT d.*, b.code, b.status booking_status, b.currency, b.price, b.event_date, b.refund_amount booking_refund,
      v.business_name, c.name customer_name, o.name opened_by_name, o.role opened_by_role
    FROM disputes d JOIN bookings b ON b.id = d.booking_id JOIN vendors v ON v.id = b.vendor_id JOIN users c ON c.id = b.customer_id JOIN users o ON o.id = d.opened_by
    ORDER BY d.status = 'open' DESC, d.created_at DESC`).all();
  res.json({
    disputes: rows.map((d) => {
      const paid = db.prepare("SELECT COALESCE(SUM(CASE WHEN kind = 'refund' THEN -amount ELSE amount END), 0) s FROM payments WHERE booking_id = ? AND status = 'succeeded'").get(d.booking_id).s;
      return { ...d, net_paid: paid };
    })
  });
});

// Admin settles a dispute; an optional extra refund (capped at what the customer still has paid in)
// is issued, and an active booking can be cancelled at the same time.
r.post('/disputes/:id/resolve', (req, res) => {
  const d = db.prepare("SELECT * FROM disputes WHERE id = ? AND status = 'open'").get(req.params.id);
  if (!d) throw new ValidationError('Open dispute not found', 404);
  const b = getBooking(d.booking_id);
  const resolution = String(req.body?.resolution || '').trim();
  if (!resolution) throw new ValidationError('Write the resolution');
  const amount = Math.max(0, Math.round(Number(req.body?.refund_amount) || 0));
  const net = db.prepare("SELECT COALESCE(SUM(CASE WHEN kind = 'refund' THEN -amount ELSE amount END), 0) s FROM payments WHERE booking_id = ? AND status = 'succeeded'").get(b.id).s;
  if (amount > net) throw new ValidationError(`Refund can't exceed the ${net} ${b.currency} still held for this booking`);
  tx(() => {
    refund({ booking: b, amount, description: `Dispute resolution for ${b.code}` });
    db.prepare("UPDATE disputes SET status = 'resolved', resolution = ?, refund_amount = ?, resolved_by = ?, resolved_at = ? WHERE id = ?")
      .run(resolution, amount, req.user.id, nowIso(), d.id);
    const cancel = req.body?.cancel_booking && ['requested', 'confirmed'].includes(b.status);
    db.prepare(`UPDATE bookings SET refund_amount = refund_amount + ?, updated_at = ? ${cancel ? ", status = 'cancelled', cancelled_by = 'admin', cancelled_at = ?, cancel_reason = 'Dispute resolution'" : ''} WHERE id = ?`)
      .run(...(cancel ? [amount, nowIso(), nowIso(), b.id] : [amount, nowIso(), b.id]));
  })();
  const msg = `${resolution}${amount ? ` Refund issued: ${amount} ${b.currency}.` : ''}`;
  notify(b.customer_id, { type: 'dispute_resolved', title: `Dispute on ${b.code} resolved`, body: msg, link: `/bookings/${b.id}` });
  notifyVendor(b.vendor_id, { type: 'dispute_resolved', title: `Dispute on ${b.code} resolved`, body: msg, link: `/vendor/bookings/${b.id}` });
  res.json({ ok: true });
});

r.get('/bookings', (_req, res) => {
  res.json({
    bookings: db.prepare(`SELECT b.id, b.code, b.status, b.event_date, b.price, b.currency, b.balance_paid_at, b.balance_due_date, b.balance_overdue,
        v.business_name, u.name customer_name FROM bookings b JOIN vendors v ON v.id = b.vendor_id JOIN users u ON u.id = b.customer_id
        ORDER BY b.created_at DESC LIMIT 200`).all()
  });
});

const SETTING_KEYS = ['tiers', 'trialDays', 'featuredSlots', 'policyBounds', 'requestExpiryHours'];

r.get('/settings', (_req, res) => {
  res.json(Object.fromEntries(SETTING_KEYS.map((k) => [k, getSetting(k)])));
});

r.put('/settings', (req, res) => {
  const b = req.body || {};
  if (b.tiers) {
    for (const k of ['basic', 'pro', 'featured']) {
      const t = b.tiers[k];
      if (!t || !(t.price?.EGP >= 0) || !(t.price?.SAR >= 0) || !(t.maxMedia > 0) || !(t.maxPackages > 0)) throw new ValidationError(`Check the ${k} tier values`);
    }
  }
  if (b.policyBounds) {
    const pb = b.policyBounds;
    const pair = (p, lo, hi) => Array.isArray(p) && p[0] >= lo && p[1] <= hi && p[0] <= p[1];
    if (!pair(pb.depositPct, 0, 100) || !pair(pb.balanceDueDays, 0, 365) || !pair(pb.lateRefundPct, 0, 100) || !(pb.minEarlyRefundPct >= 0 && pb.minEarlyRefundPct <= 100)) {
      throw new ValidationError('Check the cancellation policy bounds');
    }
  }
  for (const k of SETTING_KEYS) if (b[k] !== undefined) setSetting(k, b[k]);
  res.json(Object.fromEntries(SETTING_KEYS.map((k) => [k, getSetting(k)])));
});

r.get('/outbox', (_req, res) => {
  res.json({ items: db.prepare('SELECT * FROM outbox ORDER BY id DESC LIMIT 200').all() });
});

// Demo clock: fast-forward platform time so reminders, completions and renewals can be shown.
r.post('/clock', (req, res) => {
  const days = Number(req.body?.days);
  if (!Number.isInteger(days) || days < 0 || days > 365) throw new ValidationError('Advance by 0–365 days');
  if (req.body?.reset) setSetting('clockOffsetDays', 0);
  else setSetting('clockOffsetDays', (getSetting('clockOffsetDays') || 0) + days);
  const summary = runScheduler();
  res.json({ today: today(), clockOffsetDays: getSetting('clockOffsetDays'), summary });
});

r.post('/scheduler', (_req, res) => {
  res.json({ summary: runScheduler() });
});

export default r;
