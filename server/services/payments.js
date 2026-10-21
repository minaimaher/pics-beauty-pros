import crypto from 'node:crypto';
import { db, nowIso } from '../db.js';
import { ValidationError } from './policy.js';

// Payment methods offered per market (PRD §12). The provider below is a sandbox stand-in
// for a real processor: it never sees or stores full card numbers, only the last four digits.
export const METHODS = {
  EG: ['card', 'meeza', 'fawry', 'wallet'],
  SA: ['card', 'mada', 'stcpay', 'applepay']
};

// Card numbers ending in 0002 are declined so failures can be demonstrated.
const DECLINE_SUFFIX = '0002';

function charge({ method, card }) {
  if (['card', 'meeza', 'mada'].includes(method)) {
    const digits = String(card?.number || '').replace(/\D/g, '');
    if (digits.length < 12) throw new ValidationError('Enter a valid card number');
    if (digits.endsWith(DECLINE_SUFFIX)) return { ok: false, last4: digits.slice(-4), error: 'Card declined by issuer' };
    return { ok: true, last4: digits.slice(-4) };
  }
  if (method === 'wallet' || method === 'stcpay') {
    if (!/^\+?\d{8,15}$/.test(String(card?.phone || '').replace(/\s/g, ''))) throw new ValidationError('Enter the wallet phone number');
  }
  return { ok: true, last4: null };
}

export function pay({ country, method, card, amount, currency, kind, bookingId = null, vendorId, userId, description }) {
  if (!METHODS[country].includes(method)) throw new ValidationError(`Payment method ${method} is not available in this market`);
  const result = charge({ method, card });
  const ref = 'sbx_' + crypto.randomBytes(8).toString('hex');
  db.prepare(`INSERT INTO payments (booking_id, vendor_id, user_id, kind, amount, currency, method, last4, status, provider_ref, description, created_at)
              VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`)
    .run(bookingId, vendorId, userId, kind, amount, currency, method, result.last4, result.ok ? 'succeeded' : 'failed', ref, description || '', nowIso());
  if (!result.ok) throw new ValidationError(result.error, 402);
  return { ref, last4: result.last4 };
}

export function refund({ booking, amount, description }) {
  if (amount <= 0) return null;
  const ref = 'sbx_rf_' + crypto.randomBytes(8).toString('hex');
  db.prepare(`INSERT INTO payments (booking_id, vendor_id, user_id, kind, amount, currency, method, status, provider_ref, description, created_at)
              VALUES (?,?,?,?,?,?,?,?,?,?,?)`)
    .run(booking.id, booking.vendor_id, booking.customer_id, 'refund', amount, booking.currency, 'original', 'succeeded', ref, description || '', nowIso());
  return ref;
}
