import Database from 'better-sqlite3';
import fs from 'node:fs';
import path from 'node:path';

const DATA_DIR = process.env.PBP_DATA_DIR || path.resolve('data');
fs.mkdirSync(DATA_DIR, { recursive: true });

export const UPLOAD_DIR = path.join(DATA_DIR, 'uploads');
fs.mkdirSync(UPLOAD_DIR, { recursive: true });

const DB_FILE = process.env.PBP_DB || path.join(DATA_DIR, 'pbp.sqlite');
export const db = new Database(DB_FILE);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

db.exec(`
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT,
  name TEXT NOT NULL,
  phone TEXT,
  role TEXT NOT NULL CHECK (role IN ('customer','vendor','admin')),
  locale TEXT NOT NULL DEFAULT 'en',
  otp_hash TEXT,
  otp_expires_at TEXT,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS vendors (
  id INTEGER PRIMARY KEY,
  user_id INTEGER NOT NULL UNIQUE REFERENCES users(id),
  business_name TEXT NOT NULL,
  avatar_url TEXT,
  district TEXT,
  bio TEXT NOT NULL DEFAULT '',
  country TEXT NOT NULL CHECK (country IN ('EG','SA')),
  city TEXT NOT NULL,
  lat REAL,
  lng REAL,
  service_radius_km INTEGER NOT NULL DEFAULT 30,
  currency TEXT NOT NULL CHECK (currency IN ('EGP','SAR')),
  experience_years INTEGER NOT NULL DEFAULT 0,
  certifications TEXT NOT NULL DEFAULT '',
  style_tags TEXT NOT NULL DEFAULT '[]',
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected','suspended')),
  review_notes TEXT,
  id_document TEXT,
  tier TEXT NOT NULL DEFAULT 'basic' CHECK (tier IN ('basic','pro','featured')),
  subscription_status TEXT NOT NULL DEFAULT 'trialing' CHECK (subscription_status IN ('trialing','active','past_due','cancelled')),
  trial_ends_at TEXT,
  renews_at TEXT,
  homepage_featured INTEGER NOT NULL DEFAULT 0,
  payout_method TEXT,
  payout_account TEXT,
  working_days TEXT NOT NULL DEFAULT '[0,1,2,3,4,5,6]',
  work_start TEXT NOT NULL DEFAULT '09:00',
  work_end TEXT NOT NULL DEFAULT '21:00',
  rating_avg REAL NOT NULL DEFAULT 0,
  rating_count INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  approved_at TEXT
);

CREATE TABLE IF NOT EXISTS vendor_categories (
  vendor_id INTEGER NOT NULL REFERENCES vendors(id) ON DELETE CASCADE,
  category TEXT NOT NULL CHECK (category IN ('photographer','videographer','makeup','hair')),
  PRIMARY KEY (vendor_id, category)
);

CREATE TABLE IF NOT EXISTS packages (
  id INTEGER PRIMARY KEY,
  vendor_id INTEGER NOT NULL REFERENCES vendors(id) ON DELETE CASCADE,
  category TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  price INTEGER NOT NULL,
  duration_hours REAL NOT NULL DEFAULT 2,
  booking_mode TEXT NOT NULL CHECK (booking_mode IN ('instant','request')),
  deposit_pct INTEGER NOT NULL,
  balance_due_days INTEGER NOT NULL,
  refund_schedule TEXT NOT NULL,
  late_refund_pct INTEGER NOT NULL DEFAULT 0,
  active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS media (
  id INTEGER PRIMARY KEY,
  vendor_id INTEGER NOT NULL REFERENCES vendors(id) ON DELETE CASCADE,
  kind TEXT NOT NULL CHECK (kind IN ('image','video')),
  url TEXT NOT NULL,
  caption TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'visible' CHECK (status IN ('visible','hidden')),
  flagged INTEGER NOT NULL DEFAULT 0,
  flag_reason TEXT,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS faqs (
  id INTEGER PRIMARY KEY,
  vendor_id INTEGER NOT NULL REFERENCES vendors(id) ON DELETE CASCADE,
  question TEXT NOT NULL,
  answer TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS blocked_dates (
  vendor_id INTEGER NOT NULL REFERENCES vendors(id) ON DELETE CASCADE,
  date TEXT NOT NULL,
  PRIMARY KEY (vendor_id, date)
);

CREATE TABLE IF NOT EXISTS bookings (
  id INTEGER PRIMARY KEY,
  code TEXT NOT NULL UNIQUE,
  customer_id INTEGER NOT NULL REFERENCES users(id),
  vendor_id INTEGER NOT NULL REFERENCES vendors(id),
  package_id INTEGER NOT NULL REFERENCES packages(id),
  event_date TEXT NOT NULL,
  start_time TEXT NOT NULL,
  end_time TEXT NOT NULL,
  location TEXT NOT NULL DEFAULT '',
  notes TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL CHECK (status IN ('requested','confirmed','completed','cancelled','declined')),
  currency TEXT NOT NULL,
  price INTEGER NOT NULL,
  deposit_amount INTEGER NOT NULL,
  balance_amount INTEGER NOT NULL,
  balance_due_date TEXT NOT NULL,
  deposit_paid_at TEXT,
  balance_paid_at TEXT,
  balance_overdue INTEGER NOT NULL DEFAULT 0,
  policy TEXT NOT NULL,
  cancelled_by TEXT,
  cancelled_at TEXT,
  cancel_reason TEXT,
  refund_amount INTEGER NOT NULL DEFAULT 0,
  reminded_balance INTEGER NOT NULL DEFAULT 0,
  reminded_event INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS bookings_vendor_date ON bookings(vendor_id, event_date);

CREATE TABLE IF NOT EXISTS payments (
  id INTEGER PRIMARY KEY,
  booking_id INTEGER REFERENCES bookings(id),
  vendor_id INTEGER NOT NULL REFERENCES vendors(id),
  user_id INTEGER REFERENCES users(id),
  kind TEXT NOT NULL CHECK (kind IN ('deposit','balance','refund','subscription')),
  amount INTEGER NOT NULL,
  currency TEXT NOT NULL,
  method TEXT NOT NULL,
  last4 TEXT,
  status TEXT NOT NULL CHECK (status IN ('succeeded','failed')),
  provider_ref TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS threads (
  id INTEGER PRIMARY KEY,
  customer_id INTEGER NOT NULL REFERENCES users(id),
  vendor_id INTEGER NOT NULL REFERENCES vendors(id),
  last_message_at TEXT NOT NULL,
  UNIQUE (customer_id, vendor_id)
);

CREATE TABLE IF NOT EXISTS messages (
  id INTEGER PRIMARY KEY,
  thread_id INTEGER NOT NULL REFERENCES threads(id) ON DELETE CASCADE,
  sender_id INTEGER NOT NULL REFERENCES users(id),
  booking_id INTEGER REFERENCES bookings(id),
  body TEXT NOT NULL,
  read_at TEXT,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS reviews (
  id INTEGER PRIMARY KEY,
  booking_id INTEGER NOT NULL UNIQUE REFERENCES bookings(id),
  vendor_id INTEGER NOT NULL REFERENCES vendors(id),
  customer_id INTEGER NOT NULL REFERENCES users(id),
  rating INTEGER NOT NULL CHECK (rating BETWEEN 1 AND 5),
  body TEXT NOT NULL DEFAULT '',
  vendor_response TEXT,
  responded_at TEXT,
  status TEXT NOT NULL DEFAULT 'visible' CHECK (status IN ('visible','hidden')),
  flagged INTEGER NOT NULL DEFAULT 0,
  flag_reason TEXT,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS disputes (
  id INTEGER PRIMARY KEY,
  booking_id INTEGER NOT NULL REFERENCES bookings(id),
  opened_by INTEGER NOT NULL REFERENCES users(id),
  reason TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open','resolved')),
  resolution TEXT,
  refund_amount INTEGER NOT NULL DEFAULT 0,
  resolved_by INTEGER REFERENCES users(id),
  created_at TEXT NOT NULL,
  resolved_at TEXT
);

CREATE TABLE IF NOT EXISTS notifications (
  id INTEGER PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id),
  type TEXT NOT NULL,
  title TEXT NOT NULL,
  body TEXT NOT NULL DEFAULT '',
  link TEXT,
  read_at TEXT,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS outbox (
  id INTEGER PRIMARY KEY,
  channel TEXT NOT NULL CHECK (channel IN ('email','push')),
  recipient TEXT NOT NULL,
  subject TEXT NOT NULL,
  body TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS search_events (
  id INTEGER PRIMARY KEY,
  user_id INTEGER,
  query TEXT NOT NULL,
  results INTEGER NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);
`);

// Columns added after the first release, for databases created before them.
const vendorCols = db.prepare('PRAGMA table_info(vendors)').all().map((c) => c.name);
if (!vendorCols.includes('avatar_url')) db.exec('ALTER TABLE vendors ADD COLUMN avatar_url TEXT');
if (!vendorCols.includes('district')) db.exec('ALTER TABLE vendors ADD COLUMN district TEXT');

export const DEFAULT_SETTINGS = {
  tiers: {
    basic: { price: { EGP: 0, SAR: 0 }, maxMedia: 12, maxPackages: 3, maxBookingsPerMonth: 10, rankBoost: 0 },
    pro: { price: { EGP: 750, SAR: 99 }, maxMedia: 60, maxPackages: 20, maxBookingsPerMonth: null, rankBoost: 1 },
    featured: { price: { EGP: 1500, SAR: 199 }, maxMedia: 200, maxPackages: 50, maxBookingsPerMonth: null, rankBoost: 2 }
  },
  trialDays: 90,
  featuredSlots: 6,
  policyBounds: {
    depositPct: [20, 50],
    balanceDueDays: [7, 30],
    minEarlyRefundPct: 50,
    lateRefundPct: [0, 50]
  },
  requestExpiryHours: 48,
  clockOffsetDays: 0
};

export function getSetting(key) {
  const row = db.prepare('SELECT value FROM settings WHERE key = ?').get(key);
  return row ? JSON.parse(row.value) : DEFAULT_SETTINGS[key];
}

export function setSetting(key, value) {
  db.prepare('INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value')
    .run(key, JSON.stringify(value));
}

// The demo clock lets an admin fast-forward time to show reminders, completions and reviews.
export function now() {
  const offset = getSetting('clockOffsetDays') || 0;
  return new Date(Date.now() + offset * 86400000);
}

export const nowIso = () => now().toISOString();
export const today = () => now().toISOString().slice(0, 10);

export function addDays(dateStr, days) {
  const d = new Date(dateStr + 'T00:00:00Z');
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

export function daysBetween(fromDate, toDate) {
  return Math.round((new Date(toDate + 'T00:00:00Z') - new Date(fromDate + 'T00:00:00Z')) / 86400000);
}

export const tx = (fn) => db.transaction(fn);
