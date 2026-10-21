import crypto from 'node:crypto';
import { db, nowIso, today, getSetting, tx } from '../db.js';
import { bookingTerms, computeRefund, ValidationError } from './policy.js';
import { freeSlots, addHours } from './availability.js';
import { pay, refund } from './payments.js';
import { notify, notifyVendor } from './notify.js';

export const getBooking = (id) => db.prepare('SELECT * FROM bookings WHERE id = ?').get(id);
const getVendor = (id) => db.prepare('SELECT * FROM vendors WHERE id = ?').get(id);

function setStatus(id, fields) {
  const keys = Object.keys(fields);
  db.prepare(`UPDATE bookings SET ${keys.map((k) => `${k} = @${k}`).join(', ')}, updated_at = @updated_at WHERE id = @id`)
    .run({ ...fields, updated_at: nowIso(), id });
  return getBooking(id);
}

function monthlyBookingCount(vendorId) {
  return db.prepare(`SELECT COUNT(*) n FROM bookings WHERE vendor_id = ? AND status IN ('requested','confirmed','completed')
    AND substr(created_at, 1, 7) = ?`).get(vendorId, today().slice(0, 7)).n;
}

// Customer creates a booking and pays the deposit in one step. Instant-book packages confirm
// straight away; request-to-book packages hold the deposit until the vendor accepts or declines.
export function createBooking({ customer, packageId, eventDate, startTime, location, notes, payment }) {
  const pkg = db.prepare('SELECT * FROM packages WHERE id = ? AND active = 1').get(packageId);
  if (!pkg) throw new ValidationError('Package not found', 404);
  const vendor = getVendor(pkg.vendor_id);
  if (vendor.status !== 'approved') throw new ValidationError('This vendor is not accepting bookings');
  if (vendor.user_id === customer.id) throw new ValidationError('You cannot book your own package');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(eventDate || '') || eventDate <= today()) throw new ValidationError('Pick a future date');
  if (!freeSlots(vendor, eventDate, pkg.duration_hours).includes(startTime)) throw new ValidationError('That time is no longer available');

  const tier = getSetting('tiers')[vendor.tier];
  if (tier.maxBookingsPerMonth && monthlyBookingCount(vendor.id) >= tier.maxBookingsPerMonth) {
    throw new ValidationError('This vendor has reached their booking limit for the month');
  }

  const terms = bookingTerms(pkg, eventDate, today());
  const policy = {
    deposit_pct: pkg.deposit_pct,
    balance_due_days: pkg.balance_due_days,
    refund_schedule: JSON.parse(pkg.refund_schedule),
    late_refund_pct: pkg.late_refund_pct
  };
  const status = pkg.booking_mode === 'instant' ? 'confirmed' : 'requested';
  const code = 'PBP-' + crypto.randomBytes(3).toString('hex').toUpperCase();

  const run = tx(() => {
    const ts = nowIso();
    const info = db.prepare(`INSERT INTO bookings (code, customer_id, vendor_id, package_id, event_date, start_time, end_time, location, notes,
        status, currency, price, deposit_amount, balance_amount, balance_due_date, policy, created_at, updated_at)
        VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`)
      .run(code, customer.id, vendor.id, pkg.id, eventDate, startTime, addHours(startTime, pkg.duration_hours), location || '', notes || '',
        status, vendor.currency, pkg.price, terms.deposit_amount, terms.balance_amount, terms.balance_due_date, JSON.stringify(policy), ts, ts);
    const id = info.lastInsertRowid;
    const fullUpfront = terms.balance_amount === 0;
    pay({ country: vendor.country, method: payment?.method, card: payment, amount: terms.deposit_amount, currency: vendor.currency,
      kind: 'deposit', bookingId: id, vendorId: vendor.id, userId: customer.id, description: `${fullUpfront ? 'Full payment' : 'Deposit'} for ${code}` });
    db.prepare('UPDATE bookings SET deposit_paid_at = ?, balance_paid_at = ? WHERE id = ?').run(ts, fullUpfront ? ts : null, id);
    return id;
  });

  let id;
  try {
    id = run();
  } catch (err) {
    // The failed charge is rolled back with the booking; keep a record of the attempt.
    if (err.status === 402) {
      db.prepare(`INSERT INTO payments (vendor_id, user_id, kind, amount, currency, method, status, provider_ref, description, created_at)
        VALUES (?,?,?,?,?,?,?,?,?,?)`).run(vendor.id, customer.id, 'deposit', terms.deposit_amount, vendor.currency, payment?.method || 'card',
        'failed', 'sbx_declined', `Declined deposit for ${pkg.title}`, nowIso());
    }
    throw err;
  }

  const booking = getBooking(id);
  const link = `/bookings/${id}`;
  if (status === 'confirmed') {
    notify(customer.id, { type: 'booking_confirmed', title: `Booking ${code} confirmed`, body: `${vendor.business_name} on ${eventDate} at ${startTime}. Receipt: deposit paid.`, link });
    notifyVendor(vendor.id, { type: 'booking_new', title: `New booking ${code}`, body: `${customer.name} booked ${pkg.title} on ${eventDate}.`, link: `/vendor/bookings/${id}` });
  } else {
    notify(customer.id, { type: 'booking_requested', title: `Request ${code} sent`, body: `Your deposit is held until ${vendor.business_name} responds.`, link });
    notifyVendor(vendor.id, { type: 'booking_request', title: `Booking request ${code}`, body: `${customer.name} requested ${pkg.title} on ${eventDate}. Accept or decline within ${getSetting('requestExpiryHours')} hours.`, link: `/vendor/bookings/${id}` });
  }
  return booking;
}

export function respondToRequest(booking, accept, reason = '') {
  if (booking.status !== 'requested') throw new ValidationError('Only pending requests can be accepted or declined');
  if (accept) {
    const b = setStatus(booking.id, { status: 'confirmed' });
    notify(b.customer_id, { type: 'booking_confirmed', title: `Booking ${b.code} confirmed`, body: `Your request for ${b.event_date} was accepted.`, link: `/bookings/${b.id}` });
    return b;
  }
  return tx(() => {
    const amount = computeRefund(booking, today(), 'vendor').amount;
    refund({ booking, amount, description: `Refund for declined request ${booking.code}` });
    const b = setStatus(booking.id, { status: 'declined', cancel_reason: reason || 'Declined by vendor', refund_amount: amount, cancelled_by: 'vendor', cancelled_at: nowIso() });
    notify(b.customer_id, { type: 'booking_declined', title: `Request ${b.code} declined`, body: `Your deposit has been refunded in full.${reason ? ' Reason: ' + reason : ''}`, link: `/bookings/${b.id}` });
    return b;
  })();
}

export function cancelBooking(booking, by, reason = '') {
  if (!['requested', 'confirmed'].includes(booking.status)) throw new ValidationError('This booking can no longer be cancelled');
  const { amount } = computeRefund(booking, today(), by === 'customer' ? 'customer' : 'vendor');
  return tx(() => {
    refund({ booking, amount, description: `Cancellation refund for ${booking.code}` });
    const b = setStatus(booking.id, { status: 'cancelled', cancelled_by: by, cancelled_at: nowIso(), cancel_reason: reason, refund_amount: amount });
    const msg = `Booking ${b.code} on ${b.event_date} was cancelled by the ${by}. Refund: ${amount} ${b.currency}.`;
    notify(b.customer_id, { type: 'booking_cancelled', title: `Booking ${b.code} cancelled`, body: msg, link: `/bookings/${b.id}` });
    notifyVendor(b.vendor_id, { type: 'booking_cancelled', title: `Booking ${b.code} cancelled`, body: msg, link: `/vendor/bookings/${b.id}` });
    return b;
  })();
}

// The vendor may cancel a booking whose balance is overdue and keep what was paid (PRD §10).
export function cancelForNonPayment(booking) {
  if (booking.status !== 'confirmed' || booking.balance_paid_at || today() <= booking.balance_due_date) {
    throw new ValidationError('Only bookings with an overdue balance can be cancelled for non-payment');
  }
  const b = setStatus(booking.id, { status: 'cancelled', cancelled_by: 'vendor', cancelled_at: nowIso(), cancel_reason: 'Balance not paid by the due date', refund_amount: 0 });
  notify(b.customer_id, { type: 'booking_cancelled', title: `Booking ${b.code} cancelled`, body: 'The balance was not paid by the due date, so the vendor released the date. The deposit is non-refundable.', link: `/bookings/${b.id}` });
  return b;
}

export function payBalance(booking, customer, payment) {
  if (booking.status !== 'confirmed') throw new ValidationError('Balance can only be paid on confirmed bookings');
  if (booking.balance_paid_at) throw new ValidationError('Balance already paid');
  const vendor = getVendor(booking.vendor_id);
  pay({ country: vendor.country, method: payment?.method, card: payment, amount: booking.balance_amount, currency: booking.currency,
    kind: 'balance', bookingId: booking.id, vendorId: vendor.id, userId: customer.id, description: `Balance for ${booking.code}` });
  const b = setStatus(booking.id, { balance_paid_at: nowIso(), balance_overdue: 0 });
  notify(customer.id, { type: 'payment_receipt', title: `Receipt: balance paid for ${b.code}`, body: `${b.balance_amount} ${b.currency} received. You're all set for ${b.event_date}.`, link: `/bookings/${b.id}` });
  notifyVendor(vendor.id, { type: 'payment_received', title: `Balance received for ${b.code}`, body: `${b.balance_amount} ${b.currency} paid by the customer.`, link: `/vendor/bookings/${b.id}` });
  return b;
}

// Moving the date is allowed until the balance due date; amounts stay the same and the balance
// due date moves with the event.
export function rescheduleBooking(booking, eventDate, startTime) {
  if (!['requested', 'confirmed'].includes(booking.status)) throw new ValidationError('This booking cannot be rescheduled');
  if (today() >= booking.balance_due_date) throw new ValidationError('Rescheduling closes on the balance due date');
  if (!eventDate || eventDate <= today()) throw new ValidationError('Pick a future date');
  const pkg = db.prepare('SELECT * FROM packages WHERE id = ?').get(booking.package_id);
  const vendor = getVendor(booking.vendor_id);
  if (!freeSlots(vendor, eventDate, pkg.duration_hours, booking.id).includes(startTime)) throw new ValidationError('That time is not available');
  const policy = JSON.parse(booking.policy);
  const terms = bookingTerms({ ...pkg, ...policy, price: booking.price }, eventDate, today());
  if (!booking.balance_paid_at && terms.balance_amount === 0) throw new ValidationError('That date is inside the balance window; pay the balance first or choose a later date');
  const b = setStatus(booking.id, {
    event_date: eventDate, start_time: startTime, end_time: addHours(startTime, pkg.duration_hours),
    balance_due_date: terms.balance_due_date, reminded_balance: 0, reminded_event: 0, balance_overdue: 0
  });
  const msg = `Booking ${b.code} moved to ${eventDate} at ${startTime}. Balance due by ${b.balance_due_date}.`;
  notify(b.customer_id, { type: 'booking_rescheduled', title: `Booking ${b.code} rescheduled`, body: msg, link: `/bookings/${b.id}` });
  notifyVendor(b.vendor_id, { type: 'booking_rescheduled', title: `Booking ${b.code} rescheduled`, body: msg, link: `/vendor/bookings/${b.id}` });
  return b;
}

export function completeBooking(booking) {
  const b = setStatus(booking.id, { status: 'completed' });
  notify(b.customer_id, { type: 'review_prompt', title: `How was your session? (${b.code})`, body: 'Leave a review to help others book with confidence.', link: `/bookings/${b.id}` });
  return b;
}

export function recomputeRating(vendorId) {
  const r = db.prepare("SELECT AVG(rating) avg, COUNT(*) n FROM reviews WHERE vendor_id = ? AND status = 'visible'").get(vendorId);
  db.prepare('UPDATE vendors SET rating_avg = ?, rating_count = ? WHERE id = ?').run(r.avg ? Math.round(r.avg * 10) / 10 : 0, r.n, vendorId);
}
