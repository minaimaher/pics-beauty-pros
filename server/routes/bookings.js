import { Router } from 'express';
import { db, nowIso, today } from '../db.js';
import { requireAuth } from '../auth.js';
import { ValidationError, computeRefund } from '../services/policy.js';
import {
  getBooking, createBooking, respondToRequest, cancelBooking, cancelForNonPayment, payBalance, rescheduleBooking, recomputeRating
} from '../services/bookings.js';
import { notifyVendor, notifyAdmins } from '../services/notify.js';

const r = Router();
r.use(requireAuth());

// Loads a booking the signed-in user is party to (admins see everything).
function access(req) {
  const b = getBooking(req.params.id);
  if (!b) throw new ValidationError('Booking not found', 404);
  const isCustomer = b.customer_id === req.user.id;
  const isVendor = req.vendor?.id === b.vendor_id;
  if (!isCustomer && !isVendor && req.user.role !== 'admin') throw new ValidationError('Booking not found', 404);
  return { b, isCustomer, isVendor };
}

function detail(b, viewer) {
  const v = db.prepare('SELECT id, business_name, city, country, user_id FROM vendors WHERE id = ?').get(b.vendor_id);
  const c = db.prepare('SELECT id, name, email, phone FROM users WHERE id = ?').get(b.customer_id);
  const pkg = db.prepare('SELECT id, title, category, duration_hours, booking_mode FROM packages WHERE id = ?').get(b.package_id);
  const t = today();
  return {
    ...b,
    policy: JSON.parse(b.policy),
    vendor: { id: v.id, business_name: v.business_name, city: v.city, country: v.country },
    customer: viewer === 'customer' ? { id: c.id, name: c.name } : c,
    package: pkg,
    payments: db.prepare('SELECT id, kind, amount, currency, method, last4, status, provider_ref, created_at FROM payments WHERE booking_id = ? ORDER BY id').all(b.id),
    review: db.prepare('SELECT * FROM reviews WHERE booking_id = ?').get(b.id) || null,
    dispute: db.prepare('SELECT * FROM disputes WHERE booking_id = ? ORDER BY id DESC').get(b.id) || null,
    refund_preview: ['requested', 'confirmed'].includes(b.status) ? computeRefund(b, t, 'customer') : null,
    can: {
      payBalance: viewer === 'customer' && b.status === 'confirmed' && !b.balance_paid_at,
      cancel: ['requested', 'confirmed'].includes(b.status),
      reschedule: viewer === 'customer' && ['requested', 'confirmed'].includes(b.status) && t < b.balance_due_date,
      respond: viewer === 'vendor' && b.status === 'requested',
      cancelNonPayment: viewer === 'vendor' && b.status === 'confirmed' && !b.balance_paid_at && t > b.balance_due_date,
      review: viewer === 'customer' && b.status === 'completed' && !db.prepare('SELECT 1 FROM reviews WHERE booking_id = ?').get(b.id),
      dispute: ['cancelled', 'completed', 'confirmed', 'declined'].includes(b.status) && !db.prepare("SELECT 1 FROM disputes WHERE booking_id = ? AND status = 'open'").get(b.id)
    }
  };
}

r.get('/', (req, res) => {
  const asVendor = req.query.as === 'vendor' && req.vendor;
  const rows = db.prepare(`SELECT b.*, v.business_name, u.name customer_name, p.title package_title, p.category FROM bookings b
      JOIN vendors v ON v.id = b.vendor_id JOIN users u ON u.id = b.customer_id JOIN packages p ON p.id = b.package_id
      WHERE ${asVendor ? 'b.vendor_id = ?' : 'b.customer_id = ?'} ORDER BY b.event_date DESC, b.start_time`)
    .all(asVendor ? req.vendor.id : req.user.id);
  res.json({ bookings: rows.map(({ policy, ...rest }) => rest) });
});

r.post('/', requireAuth('customer'), (req, res) => {
  const { packageId, eventDate, startTime, location, notes, payment } = req.body || {};
  const b = createBooking({ customer: req.user, packageId, eventDate, startTime, location, notes, payment });
  res.status(201).json(detail(b, 'customer'));
});

r.get('/:id', (req, res) => {
  const { b, isVendor } = access(req);
  res.json(detail(b, isVendor ? 'vendor' : 'customer'));
});

r.post('/:id/pay-balance', (req, res) => {
  const { b, isCustomer } = access(req);
  if (!isCustomer) throw new ValidationError('Only the customer can pay', 403);
  res.json(detail(payBalance(b, req.user, req.body?.payment), 'customer'));
});

r.post('/:id/cancel', (req, res) => {
  const { b, isCustomer, isVendor } = access(req);
  if (!isCustomer && !isVendor) throw new ValidationError('Not allowed', 403);
  res.json(detail(cancelBooking(b, isCustomer ? 'customer' : 'vendor', req.body?.reason || ''), isCustomer ? 'customer' : 'vendor'));
});

r.post('/:id/reschedule', (req, res) => {
  const { b, isCustomer } = access(req);
  if (!isCustomer) throw new ValidationError('Only the customer can reschedule', 403);
  res.json(detail(rescheduleBooking(b, req.body?.eventDate, req.body?.startTime), 'customer'));
});

r.post('/:id/respond', (req, res) => {
  const { b, isVendor } = access(req);
  if (!isVendor) throw new ValidationError('Not allowed', 403);
  res.json(detail(respondToRequest(b, !!req.body?.accept, req.body?.reason), 'vendor'));
});

r.post('/:id/cancel-nonpayment', (req, res) => {
  const { b, isVendor } = access(req);
  if (!isVendor) throw new ValidationError('Not allowed', 403);
  res.json(detail(cancelForNonPayment(b), 'vendor'));
});

r.post('/:id/review', (req, res) => {
  const { b, isCustomer } = access(req);
  if (!isCustomer) throw new ValidationError('Only the customer can review', 403);
  if (b.status !== 'completed') throw new ValidationError('You can review once the booking is completed');
  if (db.prepare('SELECT 1 FROM reviews WHERE booking_id = ?').get(b.id)) throw new ValidationError('Already reviewed', 409);
  const rating = Number(req.body?.rating);
  if (!Number.isInteger(rating) || rating < 1 || rating > 5) throw new ValidationError('Choose 1 to 5 stars');
  db.prepare('INSERT INTO reviews (booking_id, vendor_id, customer_id, rating, body, created_at) VALUES (?,?,?,?,?,?)')
    .run(b.id, b.vendor_id, req.user.id, rating, String(req.body?.body || '').slice(0, 2000), nowIso());
  recomputeRating(b.vendor_id);
  notifyVendor(b.vendor_id, { type: 'review_new', title: `New ${rating}-star review`, body: `${req.user.name} reviewed booking ${b.code}.`, link: '/vendor/reviews' });
  res.status(201).json(detail(getBooking(b.id), 'customer'));
});

r.post('/:id/dispute', (req, res) => {
  const { b, isCustomer, isVendor } = access(req);
  if (!isCustomer && !isVendor) throw new ValidationError('Not allowed', 403);
  const reason = String(req.body?.reason || '').trim();
  if (reason.length < 10) throw new ValidationError('Describe the problem in a sentence or two');
  if (db.prepare("SELECT 1 FROM disputes WHERE booking_id = ? AND status = 'open'").get(b.id)) throw new ValidationError('A dispute is already open', 409);
  db.prepare('INSERT INTO disputes (booking_id, opened_by, reason, created_at) VALUES (?,?,?,?)').run(b.id, req.user.id, reason, nowIso());
  notifyAdmins({ type: 'dispute_opened', title: `Dispute opened on ${b.code}`, body: reason, link: '/admin/disputes' });
  res.status(201).json(detail(getBooking(b.id), isVendor ? 'vendor' : 'customer'));
});

export default r;
