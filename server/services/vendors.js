import { db, getSetting } from '../db.js';

export const categoriesOf = (vendorId) =>
  db.prepare('SELECT category FROM vendor_categories WHERE vendor_id = ? ORDER BY category').all(vendorId).map((r) => r.category);

// A paid tier only counts while its subscription is in good standing.
export function effectiveTier(v) {
  return ['trialing', 'active'].includes(v.subscription_status) ? v.tier : 'basic';
}

export function tierLimits(v) {
  return getSetting('tiers')[effectiveTier(v)];
}

export function packageOut(p) {
  return { ...p, refund_schedule: JSON.parse(p.refund_schedule), active: !!p.active };
}

export function vendorSummary(v) {
  const cover = db.prepare("SELECT url FROM media WHERE vendor_id = ? AND status = 'visible' AND kind = 'image' ORDER BY id LIMIT 1").get(v.id);
  const minPrice = db.prepare('SELECT MIN(price) p FROM packages WHERE vendor_id = ? AND active = 1').get(v.id).p;
  const owner = db.prepare('SELECT name FROM users WHERE id = ?').get(v.user_id);
  return {
    id: v.id,
    business_name: v.business_name,
    avatar_url: v.avatar_url || null,
    owner_first_name: owner?.name.split(' ')[0] || '',
    city: v.city,
    district: v.district || null,
    lat: v.lat,
    lng: v.lng,
    country: v.country,
    currency: v.currency,
    categories: categoriesOf(v.id),
    style_tags: JSON.parse(v.style_tags),
    rating_avg: v.rating_avg,
    rating_count: v.rating_count,
    tier: effectiveTier(v),
    homepage_featured: !!v.homepage_featured,
    cover: cover?.url || null,
    min_price: minPrice,
    experience_years: v.experience_years
  };
}

export function vendorProfile(v, { includeHidden = false } = {}) {
  const mediaWhere = includeHidden ? '' : "AND status = 'visible'";
  const reviews = db.prepare(`SELECT r.*, u.name customer_name, b.event_date, p.title package_title FROM reviews r
      JOIN users u ON u.id = r.customer_id JOIN bookings b ON b.id = r.booking_id JOIN packages p ON p.id = b.package_id
      WHERE r.vendor_id = ? ${includeHidden ? '' : "AND r.status = 'visible'"} ORDER BY r.created_at DESC`).all(v.id);
  const dist = [5, 4, 3, 2, 1].map((n) => ({ stars: n, count: reviews.filter((r) => r.rating === n && r.status === 'visible').length }));
  return {
    ...vendorSummary(v),
    bio: v.bio,
    certifications: v.certifications,
    working_days: JSON.parse(v.working_days),
    work_start: v.work_start,
    work_end: v.work_end,
    service_radius_km: v.service_radius_km,
    status: v.status,
    packages: db.prepare(`SELECT * FROM packages WHERE vendor_id = ? ${includeHidden ? '' : 'AND active = 1'} ORDER BY category, price`).all(v.id).map(packageOut),
    media: db.prepare(`SELECT id, kind, url, caption, status, flagged FROM media WHERE vendor_id = ? ${mediaWhere} ORDER BY id`).all(v.id),
    faqs: db.prepare('SELECT id, question, answer FROM faqs WHERE vendor_id = ? ORDER BY id').all(v.id),
    reviews: reviews.map((r) => ({
      id: r.id, rating: r.rating, body: r.body, customer_name: r.customer_name.split(' ')[0], package_title: r.package_title,
      event_date: r.event_date, vendor_response: r.vendor_response, created_at: r.created_at, verified: true, status: r.status, flagged: !!r.flagged
    })),
    rating_distribution: dist
  };
}
