import { Router } from 'express';
import { db, getSetting, nowIso, today } from '../db.js';
import { CITIES, CATEGORIES, CURRENCY, cityCoords, distanceKm } from '../geo.js';
import { METHODS } from '../services/payments.js';
import { vendorSummary, vendorProfile, effectiveTier, tierLimits } from '../services/vendors.js';
import { isAvailableOn, monthCalendar, freeSlots } from '../services/availability.js';
import { ValidationError } from '../services/policy.js';

const r = Router();

r.get('/meta', (_req, res) => {
  const tiers = getSetting('tiers');
  res.json({
    cities: CITIES,
    categories: CATEGORIES,
    currency: CURRENCY,
    paymentMethods: METHODS,
    tiers,
    trialDays: getSetting('trialDays'),
    policyBounds: getSetting('policyBounds'),
    today: today(),
    styleTags: [...new Set(db.prepare("SELECT style_tags FROM vendors WHERE status = 'approved'").all().flatMap((v) => JSON.parse(v.style_tags)))].sort()
  });
});

r.get('/home', (req, res) => {
  const country = req.query.country === 'SA' ? 'SA' : 'EG';
  const slots = getSetting('featuredSlots');
  const featured = db.prepare("SELECT * FROM vendors WHERE status = 'approved' AND country = ? AND homepage_featured = 1 ORDER BY rating_avg DESC LIMIT ?")
    .all(country, slots).filter((v) => effectiveTier(v) === 'featured');
  const topRated = db.prepare("SELECT * FROM vendors WHERE status = 'approved' AND country = ? ORDER BY rating_avg DESC, rating_count DESC LIMIT 8").all(country);
  const counts = Object.fromEntries(CATEGORIES.map((c) => [c, db.prepare(`SELECT COUNT(*) n FROM vendor_categories vc JOIN vendors v ON v.id = vc.vendor_id
      WHERE vc.category = ? AND v.status = 'approved' AND v.country = ?`).get(c, country).n]));
  res.json({ featured: featured.map(vendorSummary), topRated: topRated.map(vendorSummary), categoryCounts: counts });
});

r.get('/search', (req, res) => {
  const started = Date.now();
  const q = req.query;
  const country = q.country === 'SA' ? 'SA' : 'EG';
  const where = ["v.status = 'approved'", 'v.country = ?'];
  const params = [country];
  if (q.category) {
    where.push('EXISTS (SELECT 1 FROM vendor_categories vc WHERE vc.vendor_id = v.id AND vc.category = ?)');
    params.push(q.category);
  }
  if (q.q) {
    where.push('(v.business_name LIKE ? OR v.bio LIKE ? OR v.style_tags LIKE ?)');
    params.push(`%${q.q}%`, `%${q.q}%`, `%${q.q}%`);
  }
  let vendors = db.prepare(`SELECT v.* FROM vendors v WHERE ${where.join(' AND ')}`).all(...params);

  const tags = String(q.tags || '').split(',').filter(Boolean);
  if (tags.length) vendors = vendors.filter((v) => tags.every((t) => JSON.parse(v.style_tags).includes(t)));

  // Price filters apply to packages in the chosen category (or any category).
  const minP = q.minPrice ? Number(q.minPrice) : null;
  const maxP = q.maxPrice ? Number(q.maxPrice) : null;
  const pkgPrice = db.prepare(`SELECT MIN(price) p FROM packages WHERE vendor_id = ? AND active = 1 ${q.category ? 'AND category = ?' : ''}
      AND (? IS NULL OR price >= ?) AND (? IS NULL OR price <= ?)`);
  vendors = vendors
    .map((v) => ({ v, from: pkgPrice.get(...[v.id, ...(q.category ? [q.category] : []), minP, minP, maxP, maxP]).p }))
    .filter((x) => x.from != null);

  if (q.date) vendors = vendors.filter((x) => isAvailableOn(x.v, q.date));

  const origin = q.city ? cityCoords(country, q.city) : null;
  const radius = Number(q.radiusKm) || 50;
  vendors = vendors.map((x) => ({ ...x, distance: origin && x.v.lat != null ? Math.round(distanceKm(origin, [x.v.lat, x.v.lng])) : null }));
  if (origin) vendors = vendors.filter((x) => x.distance != null && x.distance <= radius + x.v.service_radius_km);

  const tiers = getSetting('tiers');
  const score = (x) => tiers[effectiveTier(x.v)].rankBoost * 1.5 + x.v.rating_avg + Math.log10(x.v.rating_count + 1);
  const sorters = {
    recommended: (a, b) => score(b) - score(a),
    rating: (a, b) => b.v.rating_avg - a.v.rating_avg || b.v.rating_count - a.v.rating_count,
    price_asc: (a, b) => a.from - b.from,
    price_desc: (a, b) => b.from - a.from,
    distance: (a, b) => (a.distance ?? 1e9) - (b.distance ?? 1e9)
  };
  vendors.sort(sorters[q.sort] || sorters.recommended);

  const results = vendors.map((x) => ({ ...vendorSummary(x.v), from_price: x.from, distance_km: x.distance }));
  db.prepare('INSERT INTO search_events (user_id, query, results, created_at) VALUES (?,?,?,?)')
    .run(req.user?.id || null, JSON.stringify(q), results.length, nowIso());
  res.json({ results, took_ms: Date.now() - started });
});

function approvedVendor(id) {
  const v = db.prepare("SELECT * FROM vendors WHERE id = ? AND status = 'approved'").get(id);
  if (!v) throw new ValidationError('Vendor not found', 404);
  return v;
}

r.get('/vendors/:id', (req, res) => {
  const v = approvedVendor(req.params.id);
  const profile = vendorProfile(v);
  profile.media = profile.media.slice(0, tierLimits(v).maxMedia);
  res.json(profile);
});

r.get('/vendors/:id/calendar', (req, res) => {
  const v = approvedVendor(req.params.id);
  const month = /^\d{4}-\d{2}$/.test(req.query.month || '') ? req.query.month : today().slice(0, 7);
  res.json({ month, days: monthCalendar(v, month).map((d) => (d.date <= today() ? { ...d, state: 'past' } : d)) });
});

r.get('/vendors/:id/slots', (req, res) => {
  const v = approvedVendor(req.params.id);
  const pkg = db.prepare('SELECT * FROM packages WHERE id = ? AND vendor_id = ? AND active = 1').get(req.query.packageId, v.id);
  if (!pkg) throw new ValidationError('Package not found', 404);
  const date = String(req.query.date || '');
  res.json({ date, slots: date > today() ? freeSlots(v, date, pkg.duration_hours) : [] });
});

export default r;
