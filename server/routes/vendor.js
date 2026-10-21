import { Router } from 'express';
import multer from 'multer';
import path from 'node:path';
import fs from 'node:fs';
import crypto from 'node:crypto';
import { db, nowIso, today, addDays, getSetting, UPLOAD_DIR, tx } from '../db.js';
import { requireAuth } from '../auth.js';
import { CATEGORIES, CURRENCY, CITIES, cityCoords } from '../geo.js';
import { ValidationError, validatePolicy } from '../services/policy.js';
import { vendorProfile, effectiveTier, tierLimits, packageOut } from '../services/vendors.js';
import { pay } from '../services/payments.js';
import { notify, notifyAdmins } from '../services/notify.js';

const r = Router();
r.use(requireAuth('vendor'));

const PUBLIC_DIR = path.join(UPLOAD_DIR, 'media');
const PRIVATE_DIR = path.join(UPLOAD_DIR, 'private');
fs.mkdirSync(PUBLIC_DIR, { recursive: true });
fs.mkdirSync(PRIVATE_DIR, { recursive: true });

const storage = (dir) => multer.diskStorage({
  destination: dir,
  filename: (_req, file, cb) => cb(null, crypto.randomBytes(10).toString('hex') + path.extname(file.originalname).toLowerCase())
});
const mediaUpload = multer({
  storage: storage(PUBLIC_DIR),
  limits: { fileSize: 60 * 1024 * 1024, files: 20 },
  fileFilter: (_req, f, cb) => cb(null, /^(image\/(jpeg|png|webp|gif)|video\/(mp4|webm|quicktime))$/.test(f.mimetype))
});
const docUpload = multer({
  storage: storage(PRIVATE_DIR),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (_req, f, cb) => cb(null, /^(image\/(jpeg|png|webp)|application\/pdf)$/.test(f.mimetype))
});

function vendorOrThrow(req) {
  if (!req.vendor) throw new ValidationError('Submit your vendor application first', 404);
  return req.vendor;
}

function cleanCategories(list) {
  const cats = [...new Set((Array.isArray(list) ? list : String(list || '').split(',')).filter((c) => CATEGORIES.includes(c)))];
  if (!cats.length) throw new ValidationError('Choose at least one category');
  return cats;
}

function cleanTags(list) {
  return [...new Set((Array.isArray(list) ? list : String(list || '').split(',')).map((t) => t.trim().toLowerCase()).filter(Boolean))].slice(0, 12);
}

function setCategories(vendorId, cats) {
  db.prepare('DELETE FROM vendor_categories WHERE vendor_id = ?').run(vendorId);
  const ins = db.prepare('INSERT INTO vendor_categories (vendor_id, category) VALUES (?, ?)');
  for (const c of cats) ins.run(vendorId, c);
}

function addMedia(vendorId, files, captions = []) {
  const limit = tierLimits(db.prepare('SELECT * FROM vendors WHERE id = ?').get(vendorId)).maxMedia;
  const have = db.prepare('SELECT COUNT(*) n FROM media WHERE vendor_id = ?').get(vendorId).n;
  if (have + files.length > limit) {
    files.forEach((f) => fs.rmSync(f.path, { force: true }));
    throw new ValidationError(`Your plan allows ${limit} portfolio items. Upgrade to add more.`);
  }
  const ins = db.prepare('INSERT INTO media (vendor_id, kind, url, caption, created_at) VALUES (?,?,?,?,?)');
  files.forEach((f, i) => ins.run(vendorId, f.mimetype.startsWith('video') ? 'video' : 'image', '/uploads/media/' + f.filename, captions[i] || '', nowIso()));
}

// Vendor onboarding (PRD §8.2): business info, categories, ID document and starter portfolio,
// then the application waits in the admin review queue.
r.post('/apply', docUpload.single('id_document'), (req, res) => {
  if (req.vendor) throw new ValidationError('You already have a vendor profile', 409);
  const b = req.body || {};
  const country = b.country === 'SA' ? 'SA' : 'EG';
  if (!b.business_name?.trim()) throw new ValidationError('Enter your business name');
  if (!CITIES[country][b.city]) throw new ValidationError('Choose a city');
  if (!req.file) throw new ValidationError('Upload an ID document for verification');
  const cats = cleanCategories(b.categories);
  const coords = cityCoords(country, b.city);
  const trialEnds = addDays(today(), getSetting('trialDays'));
  const id = tx(() => {
    const info = db.prepare(`INSERT INTO vendors (user_id, business_name, bio, country, city, lat, lng, currency, experience_years, certifications,
        style_tags, id_document, tier, subscription_status, trial_ends_at, created_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`)
      .run(req.user.id, b.business_name.trim(), b.bio || '', country, b.city, coords[0], coords[1], CURRENCY[country], Number(b.experience_years) || 0,
        b.certifications || '', JSON.stringify(cleanTags(b.style_tags)), req.file.filename, 'basic', 'trialing', trialEnds, nowIso());
    setCategories(info.lastInsertRowid, cats);
    return info.lastInsertRowid;
  })();
  notifyAdmins({ type: 'vendor_application', title: 'New vendor application', body: `${b.business_name} (${cats.join(', ')}) in ${b.city}`, link: '/admin/vendors' });
  res.status(201).json(vendorProfile(db.prepare('SELECT * FROM vendors WHERE id = ?').get(id), { includeHidden: true }));
});

r.get('/profile', (req, res) => {
  const v = vendorOrThrow(req);
  res.json({
    ...vendorProfile(v, { includeHidden: true }),
    review_notes: v.review_notes,
    tier_selected: v.tier,
    subscription_status: v.subscription_status,
    trial_ends_at: v.trial_ends_at,
    renews_at: v.renews_at,
    payout_method: v.payout_method,
    payout_account: v.payout_account,
    limits: tierLimits(v),
    blocked_dates: db.prepare('SELECT date FROM blocked_dates WHERE vendor_id = ? AND date >= ? ORDER BY date').all(v.id, today()).map((d) => d.date)
  });
});

r.patch('/profile', (req, res) => {
  const v = vendorOrThrow(req);
  const b = req.body || {};
  const country = v.country;
  if (b.city && !CITIES[country][b.city]) throw new ValidationError('Choose a city in your market');
  const coords = b.city ? cityCoords(country, b.city) : [v.lat, v.lng];
  tx(() => {
    db.prepare(`UPDATE vendors SET business_name = ?, bio = ?, city = ?, lat = ?, lng = ?, experience_years = ?, certifications = ?, style_tags = ?,
        service_radius_km = ? WHERE id = ?`)
      .run(b.business_name?.trim() || v.business_name, b.bio ?? v.bio, b.city || v.city, coords[0], coords[1],
        b.experience_years != null ? Number(b.experience_years) || 0 : v.experience_years, b.certifications ?? v.certifications,
        b.style_tags ? JSON.stringify(cleanTags(b.style_tags)) : v.style_tags,
        b.service_radius_km != null ? Math.max(0, Math.min(500, Number(b.service_radius_km) || 0)) : v.service_radius_km, v.id);
    if (b.categories) setCategories(v.id, cleanCategories(b.categories));
  })();
  res.json({ ok: true });
});

// Packages: priced per category, each with its own booking mode and payment/refund terms.
function packageInput(v, b) {
  const cats = db.prepare('SELECT category FROM vendor_categories WHERE vendor_id = ?').all(v.id).map((c) => c.category);
  if (!cats.includes(b.category)) throw new ValidationError('Pick one of your categories');
  if (!b.title?.trim()) throw new ValidationError('Give the package a title');
  const price = Math.round(Number(b.price));
  if (!(price > 0)) throw new ValidationError('Enter a price');
  const duration = Number(b.duration_hours);
  if (!(duration >= 0.5 && duration <= 16)) throw new ValidationError('Duration must be between 0.5 and 16 hours');
  if (!['instant', 'request'].includes(b.booking_mode)) throw new ValidationError('Choose instant-book or request-to-book');
  const policy = validatePolicy({
    deposit_pct: Number(b.deposit_pct),
    balance_due_days: Number(b.balance_due_days),
    late_refund_pct: Number(b.late_refund_pct ?? 0),
    refund_schedule: (b.refund_schedule || []).map((t) => ({ days_before: Number(t.days_before), pct: Number(t.pct) }))
  });
  return { category: b.category, title: b.title.trim(), description: b.description || '', price, duration_hours: duration, booking_mode: b.booking_mode, ...policy };
}

r.post('/packages', (req, res) => {
  const v = vendorOrThrow(req);
  const count = db.prepare('SELECT COUNT(*) n FROM packages WHERE vendor_id = ? AND active = 1').get(v.id).n;
  if (count >= tierLimits(v).maxPackages) throw new ValidationError(`Your plan allows ${tierLimits(v).maxPackages} active packages. Upgrade to add more.`);
  const p = packageInput(v, req.body || {});
  const info = db.prepare(`INSERT INTO packages (vendor_id, category, title, description, price, duration_hours, booking_mode, deposit_pct, balance_due_days,
      refund_schedule, late_refund_pct, created_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`)
    .run(v.id, p.category, p.title, p.description, p.price, p.duration_hours, p.booking_mode, p.deposit_pct, p.balance_due_days,
      JSON.stringify(p.refund_schedule), p.late_refund_pct, nowIso());
  res.status(201).json(packageOut(db.prepare('SELECT * FROM packages WHERE id = ?').get(info.lastInsertRowid)));
});

// Edits apply to new bookings only; existing bookings keep the terms captured when they were made.
r.put('/packages/:id', (req, res) => {
  const v = vendorOrThrow(req);
  const existing = db.prepare('SELECT * FROM packages WHERE id = ? AND vendor_id = ?').get(req.params.id, v.id);
  if (!existing) throw new ValidationError('Package not found', 404);
  const p = packageInput(v, req.body || {});
  db.prepare(`UPDATE packages SET category = ?, title = ?, description = ?, price = ?, duration_hours = ?, booking_mode = ?, deposit_pct = ?,
      balance_due_days = ?, refund_schedule = ?, late_refund_pct = ?, active = ? WHERE id = ?`)
    .run(p.category, p.title, p.description, p.price, p.duration_hours, p.booking_mode, p.deposit_pct, p.balance_due_days,
      JSON.stringify(p.refund_schedule), p.late_refund_pct, req.body.active === false ? 0 : 1, existing.id);
  res.json(packageOut(db.prepare('SELECT * FROM packages WHERE id = ?').get(existing.id)));
});

r.delete('/packages/:id', (req, res) => {
  const v = vendorOrThrow(req);
  db.prepare('UPDATE packages SET active = 0 WHERE id = ? AND vendor_id = ?').run(req.params.id, v.id);
  res.json({ ok: true });
});

r.post('/media', mediaUpload.array('files', 20), (req, res) => {
  const v = vendorOrThrow(req);
  if (!req.files?.length) throw new ValidationError('Choose JPG, PNG, WebP, GIF, MP4, WebM or MOV files');
  const captions = [].concat(req.body?.captions || []);
  addMedia(v.id, req.files, captions);
  res.status(201).json({ media: vendorProfile(v, { includeHidden: true }).media });
});

r.patch('/media/:id', (req, res) => {
  const v = vendorOrThrow(req);
  db.prepare('UPDATE media SET caption = ? WHERE id = ? AND vendor_id = ?').run(String(req.body?.caption || ''), req.params.id, v.id);
  res.json({ ok: true });
});

r.delete('/media/:id', (req, res) => {
  const v = vendorOrThrow(req);
  const m = db.prepare('SELECT * FROM media WHERE id = ? AND vendor_id = ?').get(req.params.id, v.id);
  if (!m) throw new ValidationError('Not found', 404);
  db.prepare('DELETE FROM media WHERE id = ?').run(m.id);
  if (m.url.startsWith('/uploads/media/')) fs.rmSync(path.join(PUBLIC_DIR, path.basename(m.url)), { force: true });
  res.json({ ok: true });
});

r.put('/faqs', (req, res) => {
  const v = vendorOrThrow(req);
  const list = (req.body?.faqs || []).filter((f) => f.question?.trim() && f.answer?.trim()).slice(0, 20);
  tx(() => {
    db.prepare('DELETE FROM faqs WHERE vendor_id = ?').run(v.id);
    const ins = db.prepare('INSERT INTO faqs (vendor_id, question, answer) VALUES (?,?,?)');
    for (const f of list) ins.run(v.id, f.question.trim(), f.answer.trim());
  })();
  res.json({ faqs: db.prepare('SELECT id, question, answer FROM faqs WHERE vendor_id = ?').all(v.id) });
});

r.put('/calendar', (req, res) => {
  const v = vendorOrThrow(req);
  const { working_days, work_start, work_end } = req.body || {};
  const days = [...new Set((working_days || []).map(Number).filter((d) => d >= 0 && d <= 6))];
  const timeRe = /^([01]\d|2[0-3]):[0-5]\d$/;
  if (!timeRe.test(work_start) || !timeRe.test(work_end) || work_start >= work_end) throw new ValidationError('Working hours must start before they end');
  db.prepare('UPDATE vendors SET working_days = ?, work_start = ?, work_end = ? WHERE id = ?').run(JSON.stringify(days), work_start, work_end, v.id);
  res.json({ ok: true });
});

r.post('/blocked-dates', (req, res) => {
  const v = vendorOrThrow(req);
  const { date, blocked } = req.body || {};
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date || '')) throw new ValidationError('Invalid date');
  if (blocked) db.prepare('INSERT OR IGNORE INTO blocked_dates (vendor_id, date) VALUES (?, ?)').run(v.id, date);
  else db.prepare('DELETE FROM blocked_dates WHERE vendor_id = ? AND date = ?').run(v.id, date);
  res.json({ ok: true });
});

r.post('/reviews/:id/respond', (req, res) => {
  const v = vendorOrThrow(req);
  const rev = db.prepare('SELECT * FROM reviews WHERE id = ? AND vendor_id = ?').get(req.params.id, v.id);
  if (!rev) throw new ValidationError('Review not found', 404);
  const text = String(req.body?.response || '').trim();
  if (!text) throw new ValidationError('Write a response');
  db.prepare('UPDATE reviews SET vendor_response = ?, responded_at = ? WHERE id = ?').run(text.slice(0, 1500), nowIso(), rev.id);
  notify(rev.customer_id, { type: 'review_response', title: `${v.business_name} responded to your review`, body: text.slice(0, 140), link: `/vendors/${v.id}` });
  res.json({ ok: true });
});

r.get('/dashboard', (req, res) => {
  const v = vendorOrThrow(req);
  const t = today();
  const count = (where, ...p) => db.prepare(`SELECT COUNT(*) n FROM bookings WHERE vendor_id = ? AND ${where}`).get(v.id, ...p).n;
  const money = db.prepare(`SELECT
      COALESCE(SUM(CASE WHEN kind IN ('deposit','balance') AND status = 'succeeded' THEN amount END), 0) received,
      COALESCE(SUM(CASE WHEN kind = 'refund' THEN amount END), 0) refunded
    FROM payments WHERE vendor_id = ?`).get(v.id);
  const monthly = db.prepare(`SELECT substr(created_at, 1, 7) month,
      SUM(CASE WHEN kind IN ('deposit','balance') AND status = 'succeeded' THEN amount ELSE 0 END) -
      SUM(CASE WHEN kind = 'refund' THEN amount ELSE 0 END) net
    FROM payments WHERE vendor_id = ? AND kind != 'subscription' GROUP BY month ORDER BY month DESC LIMIT 6`).all(v.id).reverse();
  const outstanding = db.prepare("SELECT COALESCE(SUM(balance_amount), 0) s FROM bookings WHERE vendor_id = ? AND status = 'confirmed' AND balance_paid_at IS NULL").get(v.id).s;
  res.json({
    currency: v.currency,
    status: v.status,
    tier: effectiveTier(v),
    rating_avg: v.rating_avg,
    rating_count: v.rating_count,
    bookings: {
      requested: count("status = 'requested'"),
      upcoming: count("status = 'confirmed' AND event_date >= ?", t),
      completed: count("status = 'completed'"),
      cancelled: count("status IN ('cancelled','declined')"),
      this_month: count("substr(created_at, 1, 7) = ? AND status IN ('requested','confirmed','completed')", t.slice(0, 7))
    },
    earnings: { received: money.received, refunded: money.refunded, net: money.received - money.refunded, outstanding_balances: outstanding, monthly },
    unread_messages: db.prepare(`SELECT COUNT(*) n FROM messages m JOIN threads th ON th.id = m.thread_id
      WHERE th.vendor_id = ? AND m.sender_id != ? AND m.read_at IS NULL`).get(v.id, req.user.id).n
  });
});

r.get('/payments', (req, res) => {
  const v = vendorOrThrow(req);
  res.json({ payments: db.prepare(`SELECT p.*, b.code FROM payments p LEFT JOIN bookings b ON b.id = p.booking_id WHERE p.vendor_id = ? ORDER BY p.id DESC`).all(v.id) });
});

r.put('/payout', (req, res) => {
  const v = vendorOrThrow(req);
  const { payout_method, payout_account } = req.body || {};
  if (!['bank', 'wallet'].includes(payout_method)) throw new ValidationError('Choose bank account or mobile wallet');
  if (String(payout_account || '').trim().length < 6) throw new ValidationError('Enter the IBAN or wallet number');
  db.prepare('UPDATE vendors SET payout_method = ?, payout_account = ? WHERE id = ?').run(payout_method, payout_account.trim(), v.id);
  res.json({ ok: true });
});

// Subscription billing (PRD §6) is separate from customer booking payments.
// During the free trial a card is saved and first charged when the trial ends.
r.post('/subscription', (req, res) => {
  const v = vendorOrThrow(req);
  const { tier, payment } = req.body || {};
  const tiers = getSetting('tiers');
  if (!tiers[tier]) throw new ValidationError('Unknown plan');
  const t = today();
  if (tier === 'basic') {
    db.prepare("UPDATE vendors SET tier = 'basic', subscription_status = 'active', renews_at = NULL, homepage_featured = 0 WHERE id = ?").run(v.id);
  } else {
    const inTrial = v.subscription_status === 'trialing' && v.trial_ends_at > t;
    const amount = inTrial ? 0 : tiers[tier].price[v.currency];
    pay({ country: v.country, method: 'card', card: payment, amount, currency: v.currency, kind: 'subscription', vendorId: v.id, userId: req.user.id,
      description: inTrial ? `${tier} plan — card saved, free until ${v.trial_ends_at}` : `${tier} plan — first month` });
    if (inTrial) db.prepare('UPDATE vendors SET tier = ? WHERE id = ?').run(tier, v.id);
    else db.prepare("UPDATE vendors SET tier = ?, subscription_status = 'active', renews_at = ? WHERE id = ?").run(tier, addDays(t, 30), v.id);
    if (tier !== 'featured') db.prepare('UPDATE vendors SET homepage_featured = 0 WHERE id = ?').run(v.id);
    notify(req.user.id, { type: 'subscription', title: `You're on the ${tier} plan`, body: inTrial ? `Free until ${v.trial_ends_at}.` : `Receipt: ${amount} ${v.currency}.`, link: '/vendor/subscription' });
  }
  res.json({ ok: true });
});

r.post('/subscription/cancel', (req, res) => {
  const v = vendorOrThrow(req);
  db.prepare("UPDATE vendors SET subscription_status = 'cancelled', homepage_featured = 0 WHERE id = ?").run(v.id);
  res.json({ ok: true });
});

export default r;
