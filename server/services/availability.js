import { db } from '../db.js';

const toMin = (t) => {
  const [h, m] = t.split(':').map(Number);
  return h * 60 + m;
};
const toTime = (min) => `${String(Math.floor(min / 60)).padStart(2, '0')}:${String(min % 60).padStart(2, '0')}`;

export const addHours = (time, hours) => toTime(toMin(time) + Math.round(hours * 60));

const weekday = (date) => new Date(date + 'T00:00:00Z').getUTCDay();

// Bookings that hold a vendor's time: pending requests and confirmed bookings.
function busy(vendorId, date, excludeBookingId = null) {
  return db.prepare(`SELECT start_time, end_time FROM bookings
    WHERE vendor_id = ? AND event_date = ? AND status IN ('requested','confirmed') AND id IS NOT ?`)
    .all(vendorId, date, excludeBookingId)
    .map((b) => [toMin(b.start_time), toMin(b.end_time)]);
}

export function dayInfo(vendor, date, excludeBookingId = null) {
  const days = JSON.parse(vendor.working_days);
  const blocked = !!db.prepare('SELECT 1 FROM blocked_dates WHERE vendor_id = ? AND date = ?').get(vendor.id, date);
  const working = days.includes(weekday(date));
  const intervals = busy(vendor.id, date, excludeBookingId);
  const open = toMin(vendor.work_end) - toMin(vendor.work_start);
  const bookedMin = intervals.reduce((s, [a, b]) => s + (b - a), 0);
  return { date, working, blocked, bookedMinutes: bookedMin, openMinutes: open, intervals };
}

// Start times (30-minute steps) at which a package of the given length fits inside working hours
// without overlapping another booking.
export function freeSlots(vendor, date, durationHours, excludeBookingId = null) {
  const info = dayInfo(vendor, date, excludeBookingId);
  if (!info.working || info.blocked) return [];
  const len = Math.round(durationHours * 60);
  const start = toMin(vendor.work_start);
  const end = toMin(vendor.work_end);
  const slots = [];
  for (let s = start; s + len <= end; s += 30) {
    if (!info.intervals.some(([a, b]) => s < b && s + len > a)) slots.push(toTime(s));
  }
  return slots;
}

export function isAvailableOn(vendor, date, minHours = 1) {
  return freeSlots(vendor, date, minHours).length > 0;
}

export function monthCalendar(vendor, month) {
  const [y, m] = month.split('-').map(Number);
  const daysInMonth = new Date(Date.UTC(y, m, 0)).getUTCDate();
  const out = [];
  for (let d = 1; d <= daysInMonth; d++) {
    const date = `${month}-${String(d).padStart(2, '0')}`;
    const info = dayInfo(vendor, date);
    let state = 'available';
    if (!info.working || info.blocked) state = 'unavailable';
    else if (info.bookedMinutes >= info.openMinutes) state = 'full';
    else if (info.bookedMinutes > 0) state = 'partial';
    out.push({ date, state });
  }
  return out;
}
