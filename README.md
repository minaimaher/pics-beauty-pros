# Pics Beauty Pros — POC

A working proof of concept of the **Pics Beauty Pros** marketplace (PRD v0.2): customers in Egypt and Saudi Arabia find, compare and book photographers, videographers, makeup artists and hair dressers; vendors run their storefront, calendar and payments; the platform team verifies vendors, moderates content and resolves disputes.

Everything runs locally with real storage and business logic — only the payment processor, email and push are simulated (sandbox), so no external accounts are needed.

## Live demo

**https://minaimaher.github.io/pics-beauty-pros/**

GitHub Pages only serves static files, so the Pages build bundles the real server routes and services into the page and runs them on SQLite compiled to WebAssembly (`vite build --mode pages`, see `web/src/demo/`). Each visitor gets their own demo data, saved in their browser; use **Reset demo data** in the footer to start over. Emailed one-time codes are shown on screen. The site is rebuilt from `main` by `.github/workflows/pages.yml`, or manually with `npm run build:pages` and pushing `web/dist-pages` to the `gh-pages` branch.

## Brand

Logo (the PBP monogram: a camera-shaped first P, a woman's face framed by hair in the rose-gold B, a face inside the last P), colours, typography and voice are documented on the in-app **/brand** page. `node scripts/make-logo.mjs` regenerates the logo SVGs; logo files, app icons and the social share image are in `web/public/brand/`. Fonts (Alexandria for headlines and interface, IBM Plex Sans Arabic for body text; both cover Arabic) are self-hosted via Fontsource. Demo portfolio photos are hotlinked from [Pexels](https://www.pexels.com/license/) (`server/photos.js`); a branded placeholder is shown if one fails to load.

## Run it

Requires Node.js 20+.

```bash
npm install
npm run seed     # creates data/pbp.sqlite with demo vendors, bookings, reviews
npm run build    # builds the web app into web/dist
npm start        # http://localhost:3000
```

For development with hot reload: `npm run dev` (API on :3000, web on http://localhost:5173).
Tests: `npm test` (16 end-to-end API tests against a throwaway database).

### Demo accounts (password `password123`)

| Account | Role |
|---|---|
| `customer@pbp.test` | Customer in Egypt (has upcoming, past and disputed bookings) |
| `customer-sa@pbp.test` | Customer in Saudi Arabia (Arabic UI) |
| `vendor@pbp.test` | Lumière Studio — photo + video, Featured plan, has a pending request |
| `vendor-sa@pbp.test` | Layali Bridal — makeup + hair, Jeddah, Pro plan |
| `admin@pbp.test` | Platform admin |

Sandbox payments accept any card number; cards ending in **0002** are declined. Sign-in by one-time code shows the code on screen outside production.

### Suggested demo walkthrough

1. **Customer** — search by service, city radius, date and price; open a profile; book an *instant* package (deposit charged, date confirmed) or *request* one (deposit held).
2. **Vendor** (`vendor@pbp.test`) — accept/decline the pending request; edit packages and their refund terms; block dates; respond to reviews; switch plans.
3. **Admin** — approve the pending application (*Fresh Face by Aya*), hide the flagged review, resolve the open dispute with a partial refund.
4. **Time travel** — on the admin overview use the **Demo clock** (+1/+3/+7/+30 days) to fire balance reminders, overdue flags, event reminders, auto-completion → review prompts, request expiry and subscription renewals. Every email/push the platform "sent" is in **Admin → Email & push log**.
5. Switch the header to **العربية** for the full right-to-left Arabic UI, and the market to **Saudi Arabia** for SAR pricing and mada/STC Pay.

## What the POC covers (PRD §7.1 MVP)

| Area | Implemented |
|---|---|
| Markets & localisation | Egypt / Saudi Arabia markets, EGP / SAR, bilingual English/Arabic UI with full RTL layout |
| Discovery & search | Category, keyword, city + radius (km), date availability, price range, style tags; sort by recommended (tier boost + rating), rating, price, distance |
| Vendor profiles | Portfolio gallery (photos + video, lightbox), bio, certifications, packages per category, availability calendar, FAQ, ratings breakdown, verified reviews with vendor responses |
| Multi-category vendors | One vendor can offer several categories from day one; packages are priced per category |
| Booking | Instant-book and request-to-book per package; time-slot availability prevents double-booking; states requested → confirmed → completed / cancelled / declined; requests auto-expire (48 h, configurable) |
| Payments | Deposit at booking, balance due a fixed number of days before the event (or full payment if already inside that window), market-specific methods (card/Meeza/Fawry/wallet in EG; card/mada/STC Pay/Apple Pay in SA), receipts, payment ledger |
| Cancellation & refunds (§10) | Vendor-set deposit %, balance-due offset and refund tiers, validated against admin-set platform bounds; terms are snapshotted on each booking; refund computed from the due dates; vendor cancellations refund in full; vendor can cancel for non-payment after the balance is overdue |
| Booking management | Upcoming/past/cancelled lists, reschedule (until balance due date), cancel with refund preview, pay balance, report a problem |
| Messaging | Customer ↔ vendor threads, messages can reference a booking, unread counts, polling |
| Reviews | Only after a completed booking, one per booking, verified badge, vendor responses, flagging |
| Notifications | In-app notification centre + simulated email and push outbox for confirmations, requests, receipts, reminders, overdue balances, review prompts, messages |
| Vendor tools | Onboarding application with ID document and portfolio upload, packages, portfolio, calendar (working days/hours, blocked dates), FAQ, dashboard (bookings, earnings, rating, outstanding balances), payout account, transaction history |
| Subscriptions (§6) | Basic / Pro / Featured with per-market prices, free trial, card saved during trial, automatic renewals, past-due handling, tier limits (media, packages, monthly bookings) and search ranking boost — **no booking commission** |
| Admin | Vendor verification queue (ID + portfolio review, approve/reject/suspend), moderation of reviews and media, dispute resolution with capped refunds, platform analytics (supply per category/market, active customers, search→booking conversion, repeat rate, ratings, dispute rate, subscription revenue/renewals/churn), tier pricing & policy bounds, homepage featured slots |
| Auth | Email + password, one-time code sign-in, roles (customer / vendor / admin), httpOnly session cookie |

## Architecture

```
server/            Node.js + Express API (single backend for web and future mobile apps)
  db.js            SQLite schema (better-sqlite3), settings, demo clock
  services/        policy (refund rules), bookings, availability, payments (sandbox), notifications, scheduler
  routes/          auth, public search/profiles, bookings, vendor, messages, notifications, admin
  seed.js          demo data
web/               React 18 + Vite single-page app (no UI framework; custom RTL-aware CSS)
  src/ar.js        Arabic strings
tests/             node:test end-to-end API tests
data/              SQLite database and uploaded media (git-ignored)
```

The API is plain JSON over HTTP so the React Native apps (PRD §12) can share it unchanged.

## Moving from POC to production

- **Database:** swap SQLite for PostgreSQL (schema is plain SQL) and uploads for S3-compatible storage behind a CDN.
- **Payments:** replace `server/services/payments.js` with a processor covering both markets (e.g. Paymob/Fawry for Egypt, HyperPay/Moyasar/Tap for Saudi Arabia) and a recurring-billing provider; payouts to vendors go through the same provider.
- **Notifications:** connect the outbox to an email service, SMS/WhatsApp for OTP, and FCM/APNs for push.
- **Realtime:** move chat from polling to WebSockets.
- **Mobile:** React Native app against the same API.
- Set `PBP_JWT_SECRET` and `NODE_ENV=production` when deploying.

Open PRD items (exact tier prices, deposit/refund bounds, processor choice) are all configurable in **Admin → Plans & policy** rather than hard-coded.
