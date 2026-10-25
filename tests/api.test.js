// End-to-end API tests against a freshly seeded, throwaway database.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'pbp-test-'));
process.env.PBP_DATA_DIR = dir;
await import('../server/seed.js');
const { createApp } = await import('../server/app.js');
const { db, today, addDays } = await import('../server/db.js');
const { computeRefund } = await import('../server/services/policy.js');

let server;
let base;
before(async () => {
  server = createApp().listen(0);
  await new Promise((r) => server.once('listening', r));
  base = `http://127.0.0.1:${server.address().port}/api`;
});
after(() => {
  server.close();
  db.close();
  fs.rmSync(dir, { recursive: true, force: true });
});

// Minimal client that keeps the session cookie.
function client() {
  let cookie = '';
  const call = async (method, p, body) => {
    const res = await fetch(base + p, {
      method,
      headers: { ...(body ? { 'Content-Type': 'application/json' } : {}), ...(cookie ? { Cookie: cookie } : {}) },
      body: body ? JSON.stringify(body) : undefined
    });
    const set = res.headers.get('set-cookie');
    if (set) cookie = set.split(';')[0];
    return { status: res.status, body: await res.json().catch(() => ({})) };
  };
  return {
    get: (p) => call('GET', p),
    post: (p, b) => call('POST', p, b || {}),
    put: (p, b) => call('PUT', p, b),
    login: (email) => call('POST', '/auth/login', { email, password: 'password123' })
  };
}

const card = { method: 'card', number: '4242424242424242' };
const vendorId = (email) => db.prepare('SELECT v.id FROM vendors v JOIN users u ON u.id = v.user_id WHERE u.email = ?').get(email).id;
const pkgOf = (email, mode) => db.prepare('SELECT * FROM packages WHERE vendor_id = ? AND booking_mode = ? AND active = 1 ORDER BY id').get(vendorId(email), mode);

async function firstSlot(c, vid, pkgId, fromDays = 20) {
  for (let d = fromDays; d < fromDays + 60; d++) {
    const date = addDays(today(), d);
    const { body } = await c.get(`/vendors/${vid}/slots?packageId=${pkgId}&date=${date}`);
    if (body.slots?.length) return { date, time: body.slots[0] };
  }
  throw new Error('no slot found');
}

test('auth: login, wrong password, and one-time code', async () => {
  const c = client();
  assert.equal((await c.post('/auth/login', { email: 'customer@pbp.test', password: 'nope' })).status, 401);
  const ok = await c.login('customer@pbp.test');
  assert.equal(ok.body.user.role, 'customer');
  const otp = client();
  const req = await otp.post('/auth/otp/request', { email: 'customer@pbp.test' });
  assert.match(req.body.devCode, /^\d{6}$/);
  assert.equal((await otp.post('/auth/otp/verify', { email: 'customer@pbp.test', code: '000000' })).status, 401);
  assert.equal((await otp.post('/auth/otp/verify', { email: 'customer@pbp.test', code: req.body.devCode })).status, 200);
});

test('search filters by market, category, price and city radius', async () => {
  const c = client();
  const eg = await c.get('/search?country=EG');
  assert.ok(eg.body.results.length >= 6);
  assert.ok(eg.body.results.every((v) => v.currency === 'EGP'));
  const sa = await c.get('/search?country=SA&category=hair');
  assert.ok(sa.body.results.length >= 2 && sa.body.results.every((v) => v.categories.includes('hair')));
  const cheap = await c.get('/search?country=EG&maxPrice=2000');
  assert.ok(cheap.body.results.every((v) => v.from_price <= 2000));
  const alex = await c.get('/search?country=EG&city=Alexandria&radiusKm=20&sort=distance');
  assert.deepEqual(alex.body.results.map((v) => v.business_name), ['Alex Frames']);
  const pending = eg.body.results.find((v) => v.business_name === 'Fresh Face by Aya');
  assert.equal(pending, undefined, 'pending vendors are not listed');
});

test('instant booking confirms, charges the deposit, and blocks the slot', async () => {
  const c = client();
  await c.login('customer@pbp.test');
  const pkg = pkgOf('nour@pbp.test', 'instant');
  const { date, time } = await firstSlot(c, pkg.vendor_id, pkg.id, 30);
  const r = await c.post('/bookings', { packageId: pkg.id, eventDate: date, startTime: time, location: 'Cairo', payment: card });
  assert.equal(r.status, 201, JSON.stringify(r.body));
  assert.equal(r.body.status, 'confirmed');
  assert.equal(r.body.deposit_amount, Math.round((pkg.price * pkg.deposit_pct) / 100));
  assert.equal(r.body.balance_due_date, addDays(date, -pkg.balance_due_days));
  assert.equal(r.body.payments[0].last4, '4242');

  const again = await c.post('/bookings', { packageId: pkg.id, eventDate: date, startTime: time, location: 'Cairo', payment: card });
  assert.equal(again.status, 400, 'double booking is rejected');
});

test('declined card rolls the booking back', async () => {
  const c = client();
  await c.login('customer@pbp.test');
  const pkg = pkgOf('sara@pbp.test', 'instant');
  const { date, time } = await firstSlot(c, pkg.vendor_id, pkg.id, 40);
  const before = db.prepare('SELECT COUNT(*) n FROM bookings').get().n;
  const r = await c.post('/bookings', { packageId: pkg.id, eventDate: date, startTime: time, location: 'Giza', payment: { method: 'card', number: '4000000000000002' } });
  assert.equal(r.status, 402);
  assert.equal(db.prepare('SELECT COUNT(*) n FROM bookings').get().n, before);
});

test('payment methods are limited to the vendor market', async () => {
  const c = client();
  await c.login('customer@pbp.test');
  const pkg = pkgOf('coastal@pbp.test', 'instant');
  const { date, time } = await firstSlot(c, pkg.vendor_id, pkg.id);
  const r = await c.post('/bookings', { packageId: pkg.id, eventDate: date, startTime: time, location: 'Khobar', payment: { method: 'fawry' } });
  assert.equal(r.status, 400);
  const ok = await c.post('/bookings', { packageId: pkg.id, eventDate: date, startTime: time, location: 'Khobar', payment: { method: 'stcpay', phone: '+966501112233' } });
  assert.equal(ok.status, 201);
  assert.equal(ok.body.currency, 'SAR');
});

test('request-to-book: vendor declines and the deposit is refunded in full', async () => {
  const cust = client();
  await cust.login('customer@pbp.test');
  const pkg = pkgOf('vendor@pbp.test', 'request');
  const { date, time } = await firstSlot(cust, pkg.vendor_id, pkg.id, 70);
  const b = (await cust.post('/bookings', { packageId: pkg.id, eventDate: date, startTime: time, location: 'Cairo', payment: card })).body;
  assert.equal(b.status, 'requested');

  const vend = client();
  await vend.login('vendor@pbp.test');
  const declined = await vend.post(`/bookings/${b.id}/respond`, { accept: false, reason: 'Fully booked' });
  assert.equal(declined.body.status, 'declined');
  assert.equal(declined.body.refund_amount, b.deposit_amount);

  const other = client();
  await other.login('vendor-sa@pbp.test');
  assert.equal((await other.get(`/bookings/${b.id}`)).status, 404, 'other vendors cannot see the booking');
});

test('refund rules follow the payment due dates', () => {
  const policy = JSON.stringify({ deposit_pct: 30, balance_due_days: 14, late_refund_pct: 10, refund_schedule: [{ days_before: 60, pct: 100 }, { days_before: 30, pct: 50 }, { days_before: 14, pct: 25 }] });
  const b = { status: 'confirmed', policy, event_date: '2027-06-30', balance_due_date: '2027-06-16', deposit_amount: 300, balance_amount: 700, deposit_paid_at: 'x', balance_paid_at: null };
  assert.equal(computeRefund(b, '2027-04-01').amount, 300, '60+ days: full deposit');
  assert.equal(computeRefund(b, '2027-05-20').amount, 150, '30–59 days: half');
  assert.equal(computeRefund(b, '2027-06-10').amount, 75, '14–29 days: quarter');
  assert.equal(computeRefund({ ...b, balance_paid_at: 'x' }, '2027-06-10').amount, 775, 'early balance payment returned in full');
  assert.equal(computeRefund({ ...b, balance_paid_at: 'x' }, '2027-06-20').amount, 100, 'after balance due: late %');
  assert.equal(computeRefund(b, '2027-06-30').amount, 0, 'same day: nothing');
  assert.equal(computeRefund(b, '2027-06-30', 'vendor').amount, 300, 'vendor cancels: everything paid');
});

test('customer pays the balance, reschedules, then cancels with the policy refund', async () => {
  const c = client();
  await c.login('customer-sa@pbp.test');
  const pkg = pkgOf('dune@pbp.test', 'instant');
  const { date, time } = await firstSlot(c, pkg.vendor_id, pkg.id, 90);
  const b = (await c.post('/bookings', { packageId: pkg.id, eventDate: date, startTime: time, location: 'Riyadh', payment: { method: 'mada', number: '5888888888888888' } })).body;

  const later = await firstSlot(c, pkg.vendor_id, pkg.id, 100);
  const moved = await c.post(`/bookings/${b.id}/reschedule`, { eventDate: later.date, startTime: later.time });
  assert.equal(moved.status, 200, JSON.stringify(moved.body));
  assert.equal(moved.body.balance_due_date, addDays(later.date, -pkg.balance_due_days));

  const paid = await c.post(`/bookings/${b.id}/pay-balance`, { payment: card });
  assert.ok(paid.body.balance_paid_at);
  assert.equal((await c.post(`/bookings/${b.id}/pay-balance`, { payment: card })).status, 400);

  const cancelled = await c.post(`/bookings/${b.id}/cancel`, { reason: 'Change of plans' });
  assert.equal(cancelled.body.status, 'cancelled');
  assert.equal(cancelled.body.refund_amount, b.deposit_amount + b.balance_amount, '100+ days out: deposit tier 100% plus early balance');
});

test('reviews only after completion; scheduler completes past events', async () => {
  const c = client();
  await c.login('customer@pbp.test');
  const upcoming = db.prepare("SELECT id FROM bookings WHERE customer_id = (SELECT id FROM users WHERE email = 'customer@pbp.test') AND status = 'confirmed' LIMIT 1").get();
  assert.equal((await c.post(`/bookings/${upcoming.id}/review`, { rating: 5 })).status, 400);
  const done = db.prepare("SELECT id, vendor_id FROM bookings WHERE customer_id = (SELECT id FROM users WHERE email = 'customer@pbp.test') AND status = 'completed' LIMIT 1").get();
  const r = await c.post(`/bookings/${done.id}/review`, { rating: 4, body: 'Lovely' });
  assert.equal(r.status, 201);
  assert.equal((await c.post(`/bookings/${done.id}/review`, { rating: 4 })).status, 409);
  const profile = (await c.get(`/vendors/${done.vendor_id}`)).body;
  assert.ok(profile.reviews.some((x) => x.body === 'Lovely' && x.verified));

  const admin = client();
  await admin.login('admin@pbp.test');
  const res = await admin.post('/admin/clock', { days: 12 });
  assert.ok(res.body.summary.completed >= 1);
  assert.ok(res.body.summary.overdue >= 1, 'unpaid balances past due are flagged');
  await admin.post('/admin/clock', { days: 0, reset: true });
});

test('vendor package terms must respect the platform bounds', async () => {
  const v = client();
  await v.login('vendor@pbp.test');
  const bad = await v.post('/vendor/packages', { category: 'photographer', title: 'Too cheap deposit', price: 1000, duration_hours: 2, booking_mode: 'instant', deposit_pct: 5, balance_due_days: 7, late_refund_pct: 0, refund_schedule: [{ days_before: 30, pct: 100 }] });
  assert.equal(bad.status, 400);
  assert.match(bad.body.error, /Deposit/);
  const stingy = await v.post('/vendor/packages', { category: 'photographer', title: 'No refunds', price: 1000, duration_hours: 2, booking_mode: 'instant', deposit_pct: 30, balance_due_days: 7, late_refund_pct: 0, refund_schedule: [{ days_before: 30, pct: 10 }] });
  assert.equal(stingy.status, 400);
  const wrongCat = await v.post('/vendor/packages', { category: 'hair', title: 'Hair', price: 1000, duration_hours: 2, booking_mode: 'instant', deposit_pct: 30, balance_due_days: 7, late_refund_pct: 0, refund_schedule: [{ days_before: 30, pct: 100 }] });
  assert.equal(wrongCat.status, 400, 'packages must belong to one of the vendor categories');
  const good = await v.post('/vendor/packages', { category: 'videographer', title: 'Teaser film', price: 8000, duration_hours: 3, booking_mode: 'request', deposit_pct: 30, balance_due_days: 10, late_refund_pct: 20, refund_schedule: [{ days_before: 45, pct: 100 }, { days_before: 10, pct: 40 }] });
  assert.equal(good.status, 201);
});

test('vendor onboarding: apply, admin approves, profile goes live', async () => {
  const v = client();
  const reg = await v.post('/auth/register', { email: 'newpro@pbp.test', password: 'password123', name: 'New Pro', role: 'vendor' });
  assert.equal(reg.status, 201);
  const fd = new FormData();
  fd.append('business_name', 'New Pro Studio');
  fd.append('country', 'SA');
  fd.append('city', 'Jeddah');
  fd.append('categories', 'photographer,makeup');
  fd.append('id_document', new Blob(['%PDF-1.4'], { type: 'application/pdf' }), 'id.pdf');
  const cookie = (await fetch(base + '/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: 'newpro@pbp.test', password: 'password123' }) }))
    .headers.get('set-cookie').split(';')[0];
  const applied = await fetch(base + '/vendor/apply', { method: 'POST', headers: { Cookie: cookie }, body: fd });
  assert.equal(applied.status, 201);
  const vendor = await applied.json();
  assert.deepEqual(vendor.categories, ['makeup', 'photographer'], 'multi-category from day one');
  assert.equal(vendor.currency, 'SAR');

  const anon = client();
  assert.equal((await anon.get(`/vendors/${vendor.id}`)).status, 404, 'not public before approval');
  const admin = client();
  await admin.login('admin@pbp.test');
  const queue = await admin.get('/admin/vendors?status=pending');
  assert.ok(queue.body.vendors.some((x) => x.id === vendor.id));
  assert.equal((await admin.post(`/admin/vendors/${vendor.id}/decision`, { decision: 'reject' })).status, 400, 'rejection needs a reason');
  await admin.post(`/admin/vendors/${vendor.id}/decision`, { decision: 'approve' });
  assert.equal((await anon.get(`/vendors/${vendor.id}`)).status, 200);
});

test('admin resolves a dispute with a capped refund', async () => {
  const admin = client();
  await admin.login('admin@pbp.test');
  const { body } = await admin.get('/admin/disputes');
  const d = body.disputes.find((x) => x.status === 'open');
  assert.ok(d);
  assert.equal((await admin.post(`/admin/disputes/${d.id}/resolve`, { resolution: 'Too much', refund_amount: d.net_paid + 1 })).status, 400);
  const ok = await admin.post(`/admin/disputes/${d.id}/resolve`, { resolution: 'Partial goodwill refund', refund_amount: Math.floor(d.net_paid / 2) });
  assert.equal(ok.status, 200);
  const cust = client();
  await cust.login('customer@pbp.test');
  assert.equal((await cust.get(`/bookings/${d.booking_id}`)).body.dispute.status, 'resolved');
});

test('roles are enforced', async () => {
  const c = client();
  await c.login('customer@pbp.test');
  assert.equal((await c.get('/admin/overview')).status, 403);
  assert.equal((await c.get('/vendor/profile')).status, 403);
  assert.equal((await client().get('/bookings')).status, 401);
});

test('messaging between customer and vendor', async () => {
  const c = client();
  await c.login('customer-sa@pbp.test');
  const th = (await c.post('/messages/threads', { vendorId: vendorId('vendor-sa@pbp.test') })).body;
  await c.post(`/messages/threads/${th.id}/messages`, { body: 'Are you free for a henna night?' });
  const v = client();
  await v.login('vendor-sa@pbp.test');
  const list = (await v.get('/messages/threads')).body.threads;
  const mine = list.find((x) => x.id === th.id);
  assert.equal(mine.unread, 1);
  const view = (await v.get(`/messages/threads/${th.id}`)).body;
  assert.equal(view.messages.at(-1).body, 'Are you free for a henna night?');
  const outsider = client();
  await outsider.login('customer@pbp.test');
  assert.equal((await outsider.get(`/messages/threads/${th.id}`)).status, 404);
});

test('vendors have profile photos and can replace them', async () => {
  const anon = client();
  const profile = (await anon.get(`/vendors/${vendorId('vendor@pbp.test')}`)).body;
  assert.match(profile.avatar_url, /^https:\/\/images\.pexels\.com\//);
  assert.equal(profile.owner_first_name, 'Hany');

  const login = await fetch(base + '/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: 'vendor@pbp.test', password: 'password123' }) });
  const cookie = login.headers.get('set-cookie').split(';')[0];
  const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8DwHwAFBQIAX8jx0gAAAABJRU5ErkJggg==', 'base64');
  const fd = new FormData();
  fd.append('avatar', new Blob([png], { type: 'image/png' }), 'me.png');
  const res = await fetch(base + '/vendor/avatar', { method: 'POST', headers: { Cookie: cookie }, body: fd });
  assert.equal(res.status, 200);
  const { avatar_url } = await res.json();
  assert.match(avatar_url, /^\/uploads\/media\/.+\.png$/);
  assert.equal((await anon.get(`/vendors/${vendorId('vendor@pbp.test')}`)).body.avatar_url, avatar_url);
});
