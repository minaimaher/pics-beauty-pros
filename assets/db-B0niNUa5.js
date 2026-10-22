import{p as s}from"./path-CZzDmXWO.js";const a=T=>T.length===1&&T[0]&&typeof T[0]=="object"&&!Array.isArray(T[0])?Object.fromEntries(Object.entries(T[0]).map(([E,e])=>["@"+E,r(e)])):T.map(r),r=T=>T===void 0?null:typeof T=="boolean"?T?1:0:T;class d{constructor(E,e){this.db=E,this.sql=e}#E(E,e){const N=this.db.raw.prepare(this.sql);try{N.bind(a(E));const t=[];for(;(e==null||t.length<e)&&N.step();)t.push(N.getAsObject());return t}finally{N.free()}}get(...E){return this.#E(E,1)[0]}all(...E){return this.#E(E)}run(...E){const e=this.db.raw.prepare(this.sql);try{e.bind(a(E)),e.step()}finally{e.free()}const N=this.db.raw.getRowsModified(),t=this.db.raw.exec("SELECT last_insert_rowid()")[0].values[0][0];return{changes:N,lastInsertRowid:t}}}class o{constructor(){const{SQL:E,bytes:e}=globalThis.__PBP_SQL;this.raw=new E.Database(e||void 0),this.depth=0}prepare(E){return new d(this,E)}exec(E){return this.raw.exec(E),this}pragma(E){return/journal_mode/i.test(E)?[]:this.raw.exec("PRAGMA "+E)}transaction(E){return(...e)=>{const N="sp"+this.depth++;this.raw.exec("SAVEPOINT "+N);try{const t=E(...e);return this.raw.exec("RELEASE "+N),t}catch(t){throw this.raw.exec("ROLLBACK TO "+N),this.raw.exec("RELEASE "+N),t}finally{this.depth--}}}close(){this.raw.close()}}const n=s.resolve("data"),I=s.join(n,"uploads"),R=s.join(n,"pbp.sqlite"),L=new o(R);L.pragma("journal_mode = WAL");L.pragma("foreign_keys = ON");L.exec(`
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
`);const U={tiers:{basic:{price:{EGP:0,SAR:0},maxMedia:12,maxPackages:3,maxBookingsPerMonth:10,rankBoost:0},pro:{price:{EGP:750,SAR:99},maxMedia:60,maxPackages:20,maxBookingsPerMonth:null,rankBoost:1},featured:{price:{EGP:1500,SAR:199},maxMedia:200,maxPackages:50,maxBookingsPerMonth:null,rankBoost:2}},trialDays:90,featuredSlots:6,policyBounds:{depositPct:[20,50],balanceDueDays:[7,30],minEarlyRefundPct:50,lateRefundPct:[0,50]},requestExpiryHours:48,clockOffsetDays:0};function c(T){const E=L.prepare("SELECT value FROM settings WHERE key = ?").get(T);return E?JSON.parse(E.value):U[T]}function u(T,E){L.prepare("INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value").run(T,JSON.stringify(E))}function i(){const T=c("clockOffsetDays")||0;return new Date(Date.now()+T*864e5)}const A=()=>i().toISOString(),_=()=>i().toISOString().slice(0,10);function X(T,E){const e=new Date(T+"T00:00:00Z");return e.setUTCDate(e.getUTCDate()+E),e.toISOString().slice(0,10)}function l(T,E){return Math.round((new Date(E+"T00:00:00Z")-new Date(T+"T00:00:00Z"))/864e5)}const C=T=>L.transaction(T);export{U as DEFAULT_SETTINGS,I as UPLOAD_DIR,X as addDays,l as daysBetween,L as db,c as getSetting,i as now,A as nowIso,u as setSetting,_ as today,C as tx};
