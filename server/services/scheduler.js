import { db, today, addDays, nowIso, getSetting } from '../db.js';
import { respondToRequest, completeBooking } from './bookings.js';
import { notify, notifyVendor } from './notify.js';

// Time-based rules: request expiry, balance reminders and overdue flags, day-before event
// reminders, auto-completion after the event, and subscription trial/renewal billing.
export function runScheduler() {
  const t = today();
  const summary = { expired: 0, balanceReminders: 0, overdue: 0, eventReminders: 0, completed: 0, renewed: 0, pastDue: 0 };

  const expiryMs = getSetting('requestExpiryHours') * 3600000;
  const cutoff = new Date(new Date(nowIso()).getTime() - expiryMs).toISOString();
  for (const b of db.prepare("SELECT * FROM bookings WHERE status = 'requested' AND (created_at < ? OR event_date <= ?)").all(cutoff, t)) {
    respondToRequest(b, false, 'The vendor did not respond in time');
    summary.expired++;
  }

  const confirmed = db.prepare("SELECT * FROM bookings WHERE status = 'confirmed'").all();
  for (const b of confirmed) {
    if (!b.balance_paid_at && !b.reminded_balance && addDays(b.balance_due_date, -3) <= t && t <= b.balance_due_date) {
      notify(b.customer_id, { type: 'balance_reminder', title: `Balance due ${b.balance_due_date} for ${b.code}`, body: `Please pay ${b.balance_amount} ${b.currency} by ${b.balance_due_date} to keep your date.`, link: `/bookings/${b.id}` });
      notifyVendor(b.vendor_id, { type: 'balance_reminder', title: `Balance for ${b.code} due ${b.balance_due_date}`, body: 'The customer has been reminded.', email: false });
      db.prepare('UPDATE bookings SET reminded_balance = 1 WHERE id = ?').run(b.id);
      summary.balanceReminders++;
    }
    if (!b.balance_paid_at && !b.balance_overdue && t > b.balance_due_date) {
      db.prepare('UPDATE bookings SET balance_overdue = 1 WHERE id = ?').run(b.id);
      notify(b.customer_id, { type: 'balance_overdue', title: `Balance overdue for ${b.code}`, body: 'Your balance is overdue. The vendor may cancel and keep the deposit.', link: `/bookings/${b.id}` });
      notifyVendor(b.vendor_id, { type: 'balance_overdue', title: `Balance overdue for ${b.code}`, body: 'You can cancel this booking for non-payment and keep the deposit.', link: `/vendor/bookings/${b.id}` });
      summary.overdue++;
    }
    if (!b.reminded_event && addDays(b.event_date, -1) <= t && t <= b.event_date) {
      const msg = `${b.event_date} at ${b.start_time}${b.location ? ' — ' + b.location : ''}`;
      notify(b.customer_id, { type: 'event_reminder', title: `Reminder: ${b.code} is coming up`, body: msg, link: `/bookings/${b.id}` });
      notifyVendor(b.vendor_id, { type: 'event_reminder', title: `Reminder: ${b.code} is coming up`, body: msg, link: `/vendor/bookings/${b.id}` });
      db.prepare('UPDATE bookings SET reminded_event = 1 WHERE id = ?').run(b.id);
      summary.eventReminders++;
    }
    if (b.event_date < t) {
      completeBooking(b);
      summary.completed++;
    }
  }

  // Subscriptions: trials convert to the chosen tier; paid tiers renew every 30 days.
  // Payment is simulated against the vendor's card on file.
  const tiers = getSetting('tiers');
  for (const v of db.prepare("SELECT * FROM vendors WHERE subscription_status IN ('trialing','active') AND tier != 'basic'").all()) {
    const due = v.subscription_status === 'trialing' ? v.trial_ends_at : v.renews_at;
    if (!due || due.slice(0, 10) > t) continue;
    const price = tiers[v.tier].price[v.currency];
    const card = db.prepare("SELECT last4 FROM payments WHERE vendor_id = ? AND kind = 'subscription' AND status = 'succeeded' ORDER BY id DESC LIMIT 1").get(v.id);
    if (!card) {
      db.prepare("UPDATE vendors SET subscription_status = 'past_due' WHERE id = ?").run(v.id);
      notify(v.user_id, { type: 'subscription_past_due', title: 'Subscription payment needed', body: `Add a payment method to keep your ${v.tier} plan.`, link: '/vendor/subscription' });
      summary.pastDue++;
      continue;
    }
    db.prepare(`INSERT INTO payments (vendor_id, user_id, kind, amount, currency, method, last4, status, provider_ref, description, created_at)
      VALUES (?,?,?,?,?,?,?,?,?,?,?)`).run(v.id, v.user_id, 'subscription', price, v.currency, 'card', card.last4, 'succeeded',
      'sbx_renew_' + v.id + '_' + t, `${v.tier} plan renewal`, nowIso());
    db.prepare("UPDATE vendors SET subscription_status = 'active', renews_at = ? WHERE id = ?").run(addDays(t, 30), v.id);
    notify(v.user_id, { type: 'subscription_renewed', title: `Receipt: ${v.tier} plan renewed`, body: `${price} ${v.currency} charged. Next renewal ${addDays(t, 30)}.`, link: '/vendor/subscription' });
    summary.renewed++;
  }
  return summary;
}
