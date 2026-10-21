// Resets the database and loads demo data: an admin, customers in both markets, approved vendors
// across all four categories, a pending application, and bookings in every state.
import fs from 'node:fs';
import path from 'node:path';

const DATA_DIR = process.env.PBP_DATA_DIR || path.resolve('data');
const DB_FILE = process.env.PBP_DB || path.join(DATA_DIR, 'pbp.sqlite');
for (const f of [DB_FILE, DB_FILE + '-wal', DB_FILE + '-shm']) fs.rmSync(f, { force: true });
fs.rmSync(path.join(DATA_DIR, 'uploads'), { recursive: true, force: true });

const { db, nowIso, today, addDays, UPLOAD_DIR, getSetting } = await import('./db.js');
const { cityCoords, CURRENCY } = await import('./geo.js');
const { default: bcrypt } = await import('bcryptjs');
const { recomputeRating } = await import('./services/bookings.js');

const MEDIA = path.join(UPLOAD_DIR, 'media');
const PRIVATE = path.join(UPLOAD_DIR, 'private');
fs.mkdirSync(MEDIA, { recursive: true });
fs.mkdirSync(PRIVATE, { recursive: true });

const PASSWORD = bcrypt.hashSync('password123', 10);
const t = today();

// Placeholder portfolio art: layered gradient compositions so the demo looks like a gallery
// without shipping real photos.
const PALETTES = [
  ['#2b1a3d', '#c0587e', '#f7c59f'], ['#0f2a3f', '#3f88c5', '#f4d35e'], ['#3d1f1f', '#d1495b', '#edae49'],
  ['#1b3a2f', '#66a182', '#f2e8cf'], ['#2d2a32', '#8f6593', '#e7c8dd'], ['#14213d', '#fca311', '#e5e5e5'],
  ['#3c2a21', '#b08968', '#ede0d4'], ['#0b3c49', '#8fbfb4', '#f9dec9']
];
function art(seed, variant) {
  const [a, b, c] = PALETTES[seed % PALETTES.length];
  const shapes = [
    `<circle cx="600" cy="260" r="120" fill="${c}" opacity=".9"/><path d="M0 620 L260 380 L460 560 L700 330 L1000 640 L1000 800 L0 800Z" fill="${a}" opacity=".85"/>`,
    `<ellipse cx="500" cy="420" rx="210" ry="270" fill="${c}" opacity=".85"/><ellipse cx="500" cy="330" rx="120" ry="140" fill="${b}" opacity=".7"/><rect x="0" y="650" width="1000" height="150" fill="${a}" opacity=".6"/>`,
    `<rect x="160" y="140" width="680" height="520" rx="24" fill="${c}" opacity=".25"/><circle cx="380" cy="400" r="160" fill="${c}" opacity=".8"/><circle cx="640" cy="420" r="120" fill="${a}" opacity=".6"/>`,
    `<path d="M0 520 C 250 380, 450 700, 1000 460 L1000 800 L0 800Z" fill="${c}" opacity=".7"/><path d="M0 620 C 300 520, 600 760, 1000 600 L1000 800 L0 800Z" fill="${a}" opacity=".8"/><circle cx="250" cy="220" r="70" fill="${c}"/>`
  ];
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1000 800"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
<stop offset="0" stop-color="${a}"/><stop offset="1" stop-color="${b}"/></linearGradient></defs>
<rect width="1000" height="800" fill="url(#g)"/>${shapes[variant % shapes.length]}</svg>`;
}

const user = (email, name, role, phone = null, locale = 'en') =>
  db.prepare('INSERT INTO users (email, password_hash, name, phone, role, locale, created_at) VALUES (?,?,?,?,?,?,?)')
    .run(email, PASSWORD, name, phone, role, locale, nowIso()).lastInsertRowid;

user('admin@pbp.test', 'Platform Admin', 'admin');
const layla = user('customer@pbp.test', 'Layla Hassan', 'customer', '+201001234567');
const omar = user('customer-sa@pbp.test', 'Omar Al-Harbi', 'customer', '+966501234567', 'ar');
const extraCustomers = {
  EG: [user('nada@pbp.test', 'Nada Samir', 'customer'), user('karim@pbp.test', 'Karim Adel', 'customer'), user('yasmin@pbp.test', 'Yasmin Fouad', 'customer')],
  SA: [user('reem@pbp.test', 'Reem Al-Qahtani', 'customer'), user('faisal@pbp.test', 'Faisal Al-Otaibi', 'customer'), user('dana@pbp.test', 'Dana Al-Shehri', 'customer')]
};

const STANDARD_REFUNDS = [{ days_before: 60, pct: 100 }, { days_before: 30, pct: 50 }, { days_before: 14, pct: 25 }];

const VENDORS = [
  { email: 'vendor@pbp.test', owner: 'Hany Mostafa', name: 'Lumière Studio', country: 'EG', city: 'Cairo', cats: ['photographer', 'videographer'], tier: 'featured', featured: true, years: 9,
    tags: ['wedding', 'editorial', 'cinematic', 'outdoor'], bio: 'Award-winning wedding and engagement team in Cairo. We shoot natural, cinematic stories and deliver edited galleries within three weeks.',
    certs: 'Canon Professional Services member; Wedding Photojournalist Association 2024 award',
    packages: [
      ['photographer', 'Wedding Day Full Coverage', 'Ten hours, two photographers, 600+ edited photos, online gallery and a 40-page album.', 42000, 10, 'request', 30, 14],
      ['photographer', 'Engagement Session', 'Two-hour outdoor session at a location of your choice, 80 edited photos.', 6500, 2, 'instant', 25, 7],
      ['videographer', 'Cinematic Wedding Film', 'Full-day coverage, 5-minute highlight film, and full ceremony edit in 4K.', 38000, 10, 'request', 30, 14]
    ] },
  { email: 'nour@pbp.test', owner: 'Nour El-Sayed', name: 'Nour Glam', country: 'EG', city: 'New Cairo', cats: ['makeup', 'hair'], tier: 'pro', years: 6,
    tags: ['bridal', 'soft glam', 'natural'], bio: 'Bridal makeup and hair styling with long-wear products. I travel to your venue anywhere in Greater Cairo.',
    certs: 'MAC Pro certified', packages: [
      ['makeup', 'Bridal Makeup', 'Trial session plus wedding-day makeup with lashes and touch-up kit.', 9000, 3, 'request', 30, 7],
      ['hair', 'Bridal Hair Styling', 'Updo or soft waves, veil fitting and touch-ups.', 6000, 2, 'instant', 25, 7],
      ['makeup', 'Evening Soft Glam', 'Party or engagement makeup, 90 minutes.', 2500, 1.5, 'instant', 20, 7]
    ] },
  { email: 'sara@pbp.test', owner: 'Sara Ibrahim', name: 'Sara Hair Lab', country: 'EG', city: 'Giza', cats: ['hair'], tier: 'basic', years: 4,
    tags: ['braids', 'curly hair', 'natural'], bio: 'Curly-hair specialist and event styling. Home visits in Giza and Sheikh Zayed.', certs: '',
    packages: [['hair', 'Event Hair Styling', 'Blowout, curls or braids for any event.', 1800, 1.5, 'instant', 20, 7]] },
  { email: 'alex@pbp.test', owner: 'Youssef Nabil', name: 'Alex Frames', country: 'EG', city: 'Alexandria', cats: ['photographer'], tier: 'pro', years: 7,
    tags: ['maternity', 'newborn', 'family', 'beach'], bio: 'Maternity, newborn and family photography by the sea. Calm, safe newborn posing in our Smouha studio.',
    certs: 'Newborn safety certified', packages: [
      ['photographer', 'Maternity Beach Session', 'Sunset shoot on the Alexandria coast, gowns included.', 4500, 2, 'instant', 25, 7],
      ['photographer', 'Newborn Studio Session', 'Up to 4 hours at our studio with props and wraps.', 5200, 4, 'request', 30, 7]
    ] },
  { email: 'reel@pbp.test', owner: 'Mostafa Gamal', name: 'Reel Moments', country: 'EG', city: 'Sheikh Zayed', cats: ['videographer'], tier: 'basic', years: 3,
    tags: ['corporate', 'events', 'drone'], bio: 'Corporate event and conference videography with drone coverage.', certs: 'Licensed drone operator',
    packages: [['videographer', 'Corporate Event Coverage', 'Half-day filming and a 3-minute recap video.', 12000, 5, 'request', 30, 7]] },
  { email: 'mariam@pbp.test', owner: 'Mariam Adel', name: 'Mariam Beauty', country: 'EG', city: 'Cairo', cats: ['makeup'], tier: 'featured', featured: true, years: 11,
    tags: ['bridal', 'editorial', 'full glam'], bio: 'Celebrity and editorial makeup artist. Bridal bookings fill up fast for the summer season.',
    certs: 'Make Up For Ever Academy Paris', packages: [
      ['makeup', 'Signature Bridal Glam', 'Trial, wedding-day full glam, and a second look for the reception.', 15000, 4, 'request', 40, 21],
      ['makeup', 'Photoshoot Makeup', 'Editorial or portrait-session makeup.', 3500, 1.5, 'instant', 25, 7]
    ] },
  { email: 'vendor-sa@pbp.test', owner: 'Lama Al-Ghamdi', name: 'Layali Bridal', country: 'SA', city: 'Jeddah', cats: ['makeup', 'hair'], tier: 'pro', years: 8,
    tags: ['bridal', 'henna night', 'soft glam'], bio: 'Bridal makeup and hair for weddings and henna nights in Jeddah. Women-only team.',
    certs: 'Huda Beauty Academy', packages: [
      ['makeup', 'Bridal Makeup & Lashes', 'Trial plus wedding-night makeup.', 3500, 3, 'request', 30, 14],
      ['hair', 'Bridal Hair & Veil', 'Hair styling with veil and accessory fitting.', 2200, 2, 'instant', 25, 7],
      ['makeup', 'Guest Makeup', 'Soft glam for guests and family.', 650, 1, 'instant', 20, 7]
    ] },
  { email: 'riyadhlens@pbp.test', owner: 'Abdullah Al-Saud', name: 'Riyadh Lens Co.', country: 'SA', city: 'Riyadh', cats: ['photographer'], tier: 'featured', featured: true, years: 10,
    tags: ['wedding', 'corporate', 'portrait'], bio: 'Wedding, portrait and corporate photography across Riyadh with female photographers available on request.',
    certs: 'Saudi Photography Society member', packages: [
      ['photographer', 'Wedding Night Coverage', 'Six hours with two photographers and a printed album.', 9500, 6, 'request', 30, 14],
      ['photographer', 'Professional Headshots', 'Studio headshots for teams or individuals.', 900, 1, 'instant', 20, 7]
    ] },
  { email: 'dune@pbp.test', owner: 'Turki Al-Mutairi', name: 'Dune Films', country: 'SA', city: 'Riyadh', cats: ['videographer', 'photographer'], tier: 'pro', years: 5,
    tags: ['cinematic', 'desert', 'drone', 'engagement'], bio: 'Cinematic films and photos in the desert and across Riyadh. Drone and gimbal included.',
    certs: 'GACA drone licence', packages: [
      ['videographer', 'Engagement Film', 'Half-day desert shoot, 3-minute film.', 4800, 4, 'instant', 30, 7],
      ['photographer', 'Desert Portrait Session', 'Golden-hour portrait session.', 1500, 2, 'instant', 25, 7]
    ] },
  { email: 'coastal@pbp.test', owner: 'Noura Al-Dossary', name: 'Coastal Glam', country: 'SA', city: 'Khobar', cats: ['makeup'], tier: 'basic', years: 3,
    tags: ['natural', 'soft glam'], bio: 'Fresh, natural makeup for graduations and events in Khobar and Dammam.', certs: '',
    packages: [['makeup', 'Graduation Makeup', 'Long-wear natural look.', 450, 1, 'instant', 20, 7]] },
  { email: 'hala@pbp.test', owner: 'Hala Al-Zahrani', name: 'Hala Hair Studio', country: 'SA', city: 'Dammam', cats: ['hair'], tier: 'basic', years: 6,
    tags: ['blowout', 'bridal', 'braids'], bio: 'Hair studio and home visits in Dammam.', certs: '',
    packages: [['hair', 'Event Blowout & Styling', 'Blowout with curls or sleek finish.', 380, 1, 'instant', 20, 7]] }
];

const vendorIds = {};
VENDORS.forEach((spec, i) => {
  const uid = user(spec.email, spec.owner, 'vendor', null, spec.country === 'SA' ? 'ar' : 'en');
  const [lat, lng] = cityCoords(spec.country, spec.city);
  const docName = `seed-id-${i}.svg`;
  fs.writeFileSync(path.join(PRIVATE, docName), art(i, 2).replace('</svg>', `<text x="500" y="420" font-size="48" text-anchor="middle" fill="#fff" font-family="sans-serif">ID document — ${spec.owner}</text></svg>`));
  const trialEnds = addDays(t, 30);
  const vid = db.prepare(`INSERT INTO vendors (user_id, business_name, bio, country, city, lat, lng, currency, experience_years, certifications, style_tags, status,
      id_document, tier, subscription_status, trial_ends_at, renews_at, homepage_featured, payout_method, payout_account, working_days, work_start, work_end, created_at, approved_at)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,'approved',?,?,?,?,?,?,?,?,?,?,?,?,?)`)
    .run(uid, spec.name, spec.bio, spec.country, spec.city, lat, lng, CURRENCY[spec.country], spec.years, spec.certs, JSON.stringify(spec.tags), docName,
      spec.tier, spec.tier === 'basic' ? 'active' : 'active', trialEnds, spec.tier === 'basic' ? null : addDays(t, 12), spec.featured ? 1 : 0,
      'bank', spec.country === 'EG' ? 'EG380019000500000000263180002' : 'SA0380000000608010167519', JSON.stringify(spec.country === 'SA' ? [0, 1, 2, 3, 4, 6] : [0, 1, 2, 3, 4, 5, 6]),
      '10:00', spec.cats.includes('makeup') || spec.cats.includes('hair') ? '22:00' : '23:00', nowIso(), nowIso()).lastInsertRowid;
  vendorIds[spec.email] = vid;
  for (const c of spec.cats) db.prepare('INSERT INTO vendor_categories (vendor_id, category) VALUES (?, ?)').run(vid, c);
  for (const [category, title, desc, price, hours, mode, dep, due] of spec.packages) {
    db.prepare(`INSERT INTO packages (vendor_id, category, title, description, price, duration_hours, booking_mode, deposit_pct, balance_due_days, refund_schedule, late_refund_pct, created_at)
        VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`)
      .run(vid, category, title, desc, price, hours, mode, dep, due, JSON.stringify(STANDARD_REFUNDS.filter((r) => r.days_before >= due)), 0, nowIso());
  }
  const captions = { photographer: 'Golden hour portraits', videographer: 'Film still', makeup: 'Bridal look', hair: 'Styled updo' };
  for (let m = 0; m < 6; m++) {
    const file = `seed-${i}-${m}.svg`;
    fs.writeFileSync(path.join(MEDIA, file), art(i + m, m));
    db.prepare('INSERT INTO media (vendor_id, kind, url, caption, created_at) VALUES (?,?,?,?,?)')
      .run(vid, 'image', '/uploads/media/' + file, captions[spec.cats[m % spec.cats.length]], nowIso());
  }
  db.prepare('INSERT INTO faqs (vendor_id, question, answer) VALUES (?,?,?)').run(vid, 'Do you travel to venues?', `Yes — anywhere in ${spec.city} and nearby cities. Travel outside the city is quoted separately.`);
  db.prepare('INSERT INTO faqs (vendor_id, question, answer) VALUES (?,?,?)').run(vid, 'How do I reserve my date?', 'Book through Pics Beauty Pros and pay the deposit; the balance is due before the event as shown at checkout.');
  if (spec.tier !== 'basic') {
    const price = getSetting('tiers')[spec.tier].price[CURRENCY[spec.country]];
    db.prepare(`INSERT INTO payments (vendor_id, user_id, kind, amount, currency, method, last4, status, provider_ref, description, created_at)
        VALUES (?,?,'subscription',?,?,'card','4242','succeeded',?,?,?)`).run(vid, uid, price, CURRENCY[spec.country], 'sbx_sub_seed_' + vid, `${spec.tier} plan — first month`, addDays(t, -18) + 'T09:00:00.000Z');
  }
});

// A pending application for the admin queue.
const pendingUid = user('fresh@pbp.test', 'Aya Mahmoud', 'vendor');
fs.writeFileSync(path.join(PRIVATE, 'seed-id-pending.svg'), art(3, 2));
const pendingId = db.prepare(`INSERT INTO vendors (user_id, business_name, bio, country, city, lat, lng, currency, experience_years, style_tags, status, id_document, tier,
    subscription_status, trial_ends_at, created_at) VALUES (?,?,?,?,?,?,?,?,?,?,'pending',?,?,?,?,?)`)
  .run(pendingUid, 'Fresh Face by Aya', 'Makeup artist for engagements and graduations in Mansoura.', 'EG', 'Mansoura', ...cityCoords('EG', 'Mansoura'), 'EGP', 2,
    JSON.stringify(['natural', 'graduation']), 'seed-id-pending.svg', 'basic', 'trialing', addDays(t, 90), nowIso()).lastInsertRowid;
db.prepare("INSERT INTO vendor_categories (vendor_id, category) VALUES (?, 'makeup')").run(pendingId);
for (let m = 0; m < 3; m++) {
  fs.writeFileSync(path.join(MEDIA, `seed-pending-${m}.svg`), art(4 + m, m));
  db.prepare('INSERT INTO media (vendor_id, kind, url, caption, created_at) VALUES (?,?,?,?,?)').run(pendingId, 'image', `/uploads/media/seed-pending-${m}.svg`, 'Portfolio sample', nowIso());
}

// Bookings in every state. Amounts follow the package terms exactly as the live flow would.
let seq = 0;
function booking({ vendorEmail, pkgIndex = 0, customer, date, start = '14:00', status, balancePaid = true, review, createdDaysAgo = 20 }) {
  const vid = vendorIds[vendorEmail];
  const v = db.prepare('SELECT * FROM vendors WHERE id = ?').get(vid);
  const pkg = db.prepare('SELECT * FROM packages WHERE vendor_id = ? ORDER BY id').all(vid)[pkgIndex];
  const deposit = Math.round((pkg.price * pkg.deposit_pct) / 100);
  const created = addDays(t, -createdDaysAgo) + 'T10:00:00.000Z';
  const [h, m] = start.split(':').map(Number);
  const endMin = h * 60 + m + pkg.duration_hours * 60;
  const end = `${String(Math.floor(endMin / 60)).padStart(2, '0')}:${String(endMin % 60).padStart(2, '0')}`;
  const policy = { deposit_pct: pkg.deposit_pct, balance_due_days: pkg.balance_due_days, refund_schedule: JSON.parse(pkg.refund_schedule), late_refund_pct: pkg.late_refund_pct };
  const code = 'PBP-' + (0xa10000 + ++seq).toString(16).toUpperCase().slice(-6);
  const id = db.prepare(`INSERT INTO bookings (code, customer_id, vendor_id, package_id, event_date, start_time, end_time, location, notes, status, currency, price,
      deposit_amount, balance_amount, balance_due_date, deposit_paid_at, balance_paid_at, policy, created_at, updated_at)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`)
    .run(code, customer, vid, pkg.id, date, start, end, `${v.city} — venue details in chat`, '', status, v.currency, pkg.price, deposit, pkg.price - deposit,
      addDays(date, -pkg.balance_due_days), created, balancePaid ? created : null, JSON.stringify(policy), created, created).lastInsertRowid;
  const pay = db.prepare(`INSERT INTO payments (booking_id, vendor_id, user_id, kind, amount, currency, method, last4, status, provider_ref, description, created_at)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`);
  pay.run(id, vid, customer, 'deposit', deposit, v.currency, 'card', '4242', 'succeeded', `sbx_seed_${id}_d`, `Deposit for ${code}`, created);
  if (balancePaid) pay.run(id, vid, customer, 'balance', pkg.price - deposit, v.currency, 'card', '4242', 'succeeded', `sbx_seed_${id}_b`, `Balance for ${code}`, created);
  if (review) {
    db.prepare('INSERT INTO reviews (booking_id, vendor_id, customer_id, rating, body, vendor_response, responded_at, created_at) VALUES (?,?,?,?,?,?,?,?)')
      .run(id, vid, customer, review[0], review[1], review[2] || null, review[2] ? addDays(date, 3) + 'T12:00:00Z' : null, addDays(date, 2) + 'T12:00:00Z');
  }
  return id;
}

const REVIEWS = [
  [5, 'Absolutely professional from the first message to delivery. Worth every pound.', 'Thank you! It was a joy to be part of your day.'],
  [5, 'On time, calm and so talented. Our families loved the results.'],
  [4, 'Great work. Delivery took a few days longer than promised but quality was excellent.', 'Thanks for your patience — we have added an editor to speed things up.'],
  [5, 'Made me feel so comfortable. Will book again for our anniversary.'],
  [4, 'Lovely experience and fair pricing.']
];
const pastBookings = [
  ['vendor@pbp.test', 1, 'EG'], ['vendor@pbp.test', 0, 'EG'], ['nour@pbp.test', 0, 'EG'], ['nour@pbp.test', 2, 'EG'], ['alex@pbp.test', 0, 'EG'],
  ['mariam@pbp.test', 1, 'EG'], ['sara@pbp.test', 0, 'EG'], ['reel@pbp.test', 0, 'EG'],
  ['vendor-sa@pbp.test', 0, 'SA'], ['vendor-sa@pbp.test', 2, 'SA'], ['riyadhlens@pbp.test', 1, 'SA'], ['dune@pbp.test', 0, 'SA'], ['coastal@pbp.test', 0, 'SA'], ['hala@pbp.test', 0, 'SA']
];
pastBookings.forEach(([email, pkgIndex, market], i) => {
  for (let k = 0; k < 2; k++) {
    booking({ vendorEmail: email, pkgIndex, customer: extraCustomers[market][(i + k) % 3], date: addDays(t, -(15 + i * 6 + k * 40)), status: 'completed',
      review: REVIEWS[(i * 2 + k) % REVIEWS.length], createdDaysAgo: 60 + i * 6 + k * 40 });
  }
});

// Layla (EG demo customer): one completed booking awaiting her review, one upcoming with balance due soon,
// one upcoming fully paid, and a cancelled one under dispute.
booking({ vendorEmail: 'nour@pbp.test', pkgIndex: 2, customer: layla, date: addDays(t, -4), status: 'completed', createdDaysAgo: 30 });
booking({ vendorEmail: 'vendor@pbp.test', pkgIndex: 1, customer: layla, date: addDays(t, 9), start: '16:00', status: 'confirmed', balancePaid: false, createdDaysAgo: 12 });
booking({ vendorEmail: 'mariam@pbp.test', pkgIndex: 0, customer: layla, date: addDays(t, 75), start: '12:00', status: 'confirmed', balancePaid: false, createdDaysAgo: 5 });
const disputed = booking({ vendorEmail: 'alex@pbp.test', pkgIndex: 1, customer: layla, date: addDays(t, 20), status: 'cancelled', balancePaid: false, createdDaysAgo: 25 });
db.prepare("UPDATE bookings SET cancelled_by = 'customer', cancelled_at = ?, cancel_reason = 'Baby arrived early', refund_amount = 0 WHERE id = ?").run(addDays(t, -2) + 'T09:00:00Z', disputed);
db.prepare('INSERT INTO disputes (booking_id, opened_by, reason, created_at) VALUES (?,?,?,?)')
  .run(disputed, layla, 'Our baby arrived three weeks early so we had to cancel. We were inside the no-refund window but would appreciate a partial refund or a move to a newborn session.', addDays(t, -2) + 'T10:00:00Z');

// A pending request for the EG demo vendor to accept/decline, and SA bookings for Omar.
booking({ vendorEmail: 'vendor@pbp.test', pkgIndex: 0, customer: extraCustomers.EG[0], date: addDays(t, 60), start: '13:00', status: 'requested', balancePaid: false, createdDaysAgo: 0 });
booking({ vendorEmail: 'vendor-sa@pbp.test', pkgIndex: 0, customer: omar, date: addDays(t, 40), start: '17:00', status: 'confirmed', balancePaid: false, createdDaysAgo: 6 });
booking({ vendorEmail: 'vendor-sa@pbp.test', pkgIndex: 1, customer: extraCustomers.SA[0], date: addDays(t, 25), start: '15:00', status: 'requested', balancePaid: false, createdDaysAgo: 0 });

// Some blocked dates and a flagged review for moderation.
db.prepare('INSERT INTO blocked_dates (vendor_id, date) VALUES (?, ?)').run(vendorIds['vendor@pbp.test'], addDays(t, 14));
db.prepare('INSERT INTO blocked_dates (vendor_id, date) VALUES (?, ?)').run(vendorIds['vendor@pbp.test'], addDays(t, 15));
db.prepare("UPDATE reviews SET flagged = 1, flag_reason = 'Contains a phone number' WHERE id = (SELECT MIN(id) FROM reviews WHERE rating = 4)").run();

// Conversation history.
const th = db.prepare('INSERT INTO threads (customer_id, vendor_id, last_message_at) VALUES (?,?,?)').run(layla, vendorIds['vendor@pbp.test'], nowIso()).lastInsertRowid;
const msg = db.prepare('INSERT INTO messages (thread_id, sender_id, body, created_at, read_at) VALUES (?,?,?,?,?)');
const lumiereUser = db.prepare('SELECT user_id FROM vendors WHERE id = ?').get(vendorIds['vendor@pbp.test']).user_id;
msg.run(th, layla, 'Hi! Do you shoot engagement sessions at Al-Azhar Park?', addDays(t, -13) + 'T18:00:00Z', addDays(t, -13) + 'T18:05:00Z');
msg.run(th, lumiereUser, 'Yes, it is one of our favourite spots. Late afternoon light is beautiful there.', addDays(t, -13) + 'T18:20:00Z', addDays(t, -13) + 'T18:30:00Z');
msg.run(th, layla, 'Perfect, booking now!', addDays(t, -12) + 'T09:00:00Z', null);

for (const id of Object.values(vendorIds)) recomputeRating(id);
// Search history so the conversion KPI has a realistic denominator.
const searchIns = db.prepare("INSERT INTO search_events (query, results, created_at) VALUES ('{}', 6, ?)");
for (let i = 0; i < 140; i++) searchIns.run(addDays(t, -(i % 28)) + `T${String(8 + (i % 12)).padStart(2, '0')}:00:00Z`);

console.log(`Seeded ${Object.keys(vendorIds).length + 1} vendors, ${db.prepare('SELECT COUNT(*) n FROM bookings').get().n} bookings.`);
console.log('Sign in with password "password123":');
console.log('  admin@pbp.test · customer@pbp.test (Egypt) · customer-sa@pbp.test (Saudi) · vendor@pbp.test (Lumière Studio) · vendor-sa@pbp.test (Layali Bridal)');
