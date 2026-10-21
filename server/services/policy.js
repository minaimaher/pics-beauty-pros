import { getSetting, addDays, daysBetween } from '../db.js';

export class ValidationError extends Error {
  constructor(message, status = 400) {
    super(message);
    this.status = status;
  }
}

// Checks a package's payment and refund terms against the platform-wide bounds (PRD §10).
export function validatePolicy({ deposit_pct, balance_due_days, refund_schedule, late_refund_pct }) {
  const b = getSetting('policyBounds');
  const errors = [];
  const inRange = (v, [lo, hi]) => Number.isFinite(v) && v >= lo && v <= hi;

  if (!inRange(deposit_pct, b.depositPct)) errors.push(`Deposit must be between ${b.depositPct[0]}% and ${b.depositPct[1]}%`);
  if (!inRange(balance_due_days, b.balanceDueDays)) errors.push(`Balance due date must be ${b.balanceDueDays[0]}–${b.balanceDueDays[1]} days before the event`);
  if (!inRange(late_refund_pct, b.lateRefundPct)) errors.push(`Late-cancellation refund must be between ${b.lateRefundPct[0]}% and ${b.lateRefundPct[1]}%`);

  if (!Array.isArray(refund_schedule) || refund_schedule.length === 0) {
    errors.push('Refund schedule needs at least one tier');
  } else {
    for (const tier of refund_schedule) {
      if (!Number.isInteger(tier.days_before) || tier.days_before < balance_due_days) {
        errors.push('Each refund tier must start on or before the balance due date');
        break;
      }
      if (!inRange(tier.pct, [0, 100])) {
        errors.push('Refund percentages must be between 0 and 100');
        break;
      }
    }
    const best = Math.max(...refund_schedule.map((t) => t.pct));
    if (best < b.minEarlyRefundPct) errors.push(`The earliest refund tier must refund at least ${b.minEarlyRefundPct}% of the deposit`);
  }
  if (errors.length) throw new ValidationError(errors.join('. '));
  return {
    deposit_pct,
    balance_due_days,
    late_refund_pct,
    refund_schedule: [...refund_schedule].sort((a, b2) => b2.days_before - a.days_before)
  };
}

// Amounts and dates fixed at booking time. If the event is already inside the balance window,
// the full price is due up front.
export function bookingTerms(pkg, eventDate, todayStr) {
  let balanceDue = addDays(eventDate, -pkg.balance_due_days);
  let deposit = Math.round((pkg.price * pkg.deposit_pct) / 100);
  if (balanceDue <= todayStr) {
    balanceDue = todayStr;
    deposit = pkg.price;
  }
  return { deposit_amount: deposit, balance_amount: pkg.price - deposit, balance_due_date: balanceDue };
}

// Refund owed to the customer if they cancel today (PRD §10). Vendor cancellations always refund in full.
export function computeRefund(booking, todayStr, cancelledBy = 'customer') {
  const policy = JSON.parse(booking.policy);
  const depositPaid = booking.deposit_paid_at ? booking.deposit_amount : 0;
  const balancePaid = booking.balance_paid_at ? booking.balance_amount : 0;
  const paid = depositPaid + balancePaid;

  if (cancelledBy === 'vendor' || booking.status === 'requested') {
    return { amount: paid, paid, rule: 'full_refund' };
  }
  const daysBefore = daysBetween(todayStr, booking.event_date);
  if (daysBefore <= 0) return { amount: 0, paid, rule: 'same_day_no_refund' };

  if (todayStr >= booking.balance_due_date) {
    return { amount: Math.round((paid * policy.late_refund_pct) / 100), paid, rule: 'after_balance_due', pct: policy.late_refund_pct };
  }
  const tier = policy.refund_schedule.find((t) => daysBefore >= t.days_before);
  const pct = tier ? tier.pct : 0;
  // Anything paid toward the balance before its due date is returned in full.
  return { amount: Math.round((depositPaid * pct) / 100) + balancePaid, paid, rule: 'before_balance_due', pct, daysBefore };
}
