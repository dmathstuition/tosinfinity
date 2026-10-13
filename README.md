# Tosinfinity Academy

Public website, learning portal and academy management system for Tosinfinity Academy, an owner-managed private tutoring academy offering home and online tutoring in Mathematics, Science and examination preparation.

One **Owner** runs everything. **Students** and **parents** get their own portals. There are no tutor, staff or marketplace features.

| Area | Route | Who |
| --- | --- | --- |
| Public website, blog, enrolment form | `/` | Everyone |
| Owner control centre | `/owner` | The Owner |
| Student portal | `/portal` | Students |
| Parent portal | `/parent` | Parents (linked children only) |
| Read-only guardian link (optional) | `/guardian/<token>` | Whoever the Owner gives a link to |

The day-to-day manual for the Owner is in **[docs/OWNER_GUIDE.md](docs/OWNER_GUIDE.md)**.

## Contents

1. [What you need](#1-what-you-need)
2. [Set up the database (Supabase)](#2-set-up-the-database-supabase)
3. [Run it on your computer](#3-run-it-on-your-computer)
4. [Create the Owner account](#4-create-the-owner-account)
5. [Environment variables](#5-environment-variables)
6. [Deploy to Vercel](#6-deploy-to-vercel)
7. [Email, payments, AI and push](#7-email-payments-ai-and-push)
8. [Demo data](#8-demo-data)
9. [Tests and checks](#9-tests-and-checks)
10. [Security model](#10-security-model)
11. [Brand assets and images](#11-brand-assets-and-images)
12. [Project layout](#12-project-layout)
13. [Known limits](#13-known-limits)

---

## 1. What you need

- Node.js 20.6 or newer
- A free [Supabase](https://supabase.com) project (database, sign-in and file storage)
- A [Vercel](https://vercel.com) account for hosting
- Optional: Resend (email), Paystack (online payments), an AI provider key

Nothing optional is required to run the site. Each integration reports its own status in **Owner → Settings → Integrations** and the app says plainly when something is not configured rather than pretending it works.

## 2. Set up the database (Supabase)

1. Create a Supabase project. Note the **Project URL**, the **anon public** key and the **service_role** key (Project Settings → API).
2. Open **SQL Editor**, paste the whole of [`supabase/setup_all.sql`](supabase/setup_all.sql) and press **Run**.
   This creates every table, the security rules (Row Level Security), the storage buckets and their access rules, and the programme catalogue from the flyer. It is safe to run again.
3. **Authentication → Sign In / Providers → Email**: turn **off** "Allow new users to sign up". Accounts are created only by the Owner.
4. **Authentication → URL Configuration**: set **Site URL** to your website address (for local work, `http://localhost:3000`).
5. **Authentication → Multi-factor**: make sure **TOTP** is enabled (it is by default). This powers the Owner's two-step verification.
6. Optional but recommended: **Authentication → Email → Email OTP expiration**, set to `86400` (24 hours) so activation links sent to families do not expire within the hour.

`supabase/setup_all.sql` is generated from the numbered files in `supabase/migrations`. If you change a migration, regenerate it with `npm run db:setup-sql`. If you use the Supabase CLI instead, `supabase db push` applies the same migrations.

**Resetting a development database:** in the SQL editor run `drop schema public cascade; create schema public; grant usage on schema public to anon, authenticated, service_role;` then run `setup_all.sql` again and re-create the Owner. Never do this on the live project.

## 3. Run it on your computer

```bash
npm install
```

Copy `.env.example` to `.env.local` and fill in at least the three Supabase values:

```bash
cp .env.example .env.local
```

```bash
npm run dev
```

Open http://localhost:3000. Without Supabase configured the public website still renders (using built-in content) and the portals show a "not connected" notice.

**Development mode for email:** with `EMAIL_PROVIDER=console`, emails are printed to the terminal instead of being sent, so you can copy activation and password links while testing. In production an unconfigured provider sends nothing and says so.

## 4. Create the Owner account

After the database is set up and `.env.local` has the service-role key:

```bash
npm run owner:create -- you@yourdomain.com "Your Full Name"
```

The script prints a single-use link. Open it and choose your password. Then sign in at `/login` and turn on two-step verification under **Settings → Security**.

The database allows exactly one Owner. No password is ever generated or emailed for any account: students, parents and the Owner all choose their own through a single-use link.

## 5. Environment variables

All names are listed in [`.env.example`](.env.example). Variables beginning `NEXT_PUBLIC_` are visible to browsers; everything else stays on the server.

| Variable | Needed for | Notes |
| --- | --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | Everything | Project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Everything | Public key; safe in the browser because Row Level Security applies |
| `SUPABASE_SERVICE_ROLE_KEY` | Creating accounts, payments, scheduled jobs, newsletter, guardian links | **Secret.** Bypasses security rules. Server only |
| `NEXT_PUBLIC_SITE_URL` | Links in emails, SEO, payment return | e.g. `https://www.yourdomain.com`, no trailing slash |
| `CRON_SECRET` | Scheduled invoices and reminders | Any long random string (16+ characters). Vercel sends it automatically |
| `EMAIL_PROVIDER` | Email | `resend`, `relay` or `console` |
| `RESEND_API_KEY`, `EMAIL_FROM` | Email via Resend | `EMAIL_FROM` must be on a domain verified in Resend |
| `EMAIL_RELAY_URL`, `EMAIL_RELAY_SECRET` | Email via Gmail (Apps Script) or your own relay | Receives a JSON POST `{secret,template,from,to,subject,html,text}` and replies `{ok:true}` |
| `OWNER_NOTIFY_EMAIL` | Emails to the Owner about new applications and messages | Optional; in-app notifications work without it |
| `PAYSTACK_SECRET_KEY` | Online payments and webhook verification | **Secret.** Use the test key until you are ready to go live |
| `NEXT_PUBLIC_PAYSTACK_PUBLIC_KEY` | Reserved for future inline checkout | Not required by the current redirect checkout |
| `AI_API_KEY`, `AI_MODEL`, `AI_BASE_URL` | Optional AI features | Any OpenAI-compatible chat endpoint |
| `NEXT_PUBLIC_VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT` | Optional device notifications | Generate with `npx web-push generate-vapid-keys`; subject is `mailto:you@yourdomain.com` |
| `SENTRY_DSN` | Optional error reports | Server-side errors from jobs, webhooks and failed pages |
| `NEXT_PUBLIC_GA_MEASUREMENT_ID` | Optional Google Analytics | Loaded after the page is interactive, with IP anonymisation |
| `JITSI_DOMAIN` | Reference only | Meeting links are pasted per class (Jitsi, Google Meet or any https link) |

Missing variables are reported at the point of use with a message naming the variable. Never commit `.env.local`; it is in `.gitignore`.

## 6. Deploy to Vercel

1. Put this folder in a Git repository and push it to GitHub.
2. In Vercel choose **Add New → Project**, import the repository and keep the detected **Next.js** settings.
3. Under **Environment Variables** add the values from section 5 (at minimum the three Supabase values, `NEXT_PUBLIC_SITE_URL` and `CRON_SECRET`). Add them for **Production** (and Preview if you want previews to work).
4. Press **Deploy**.
5. Add your domain under **Settings → Domains**, then update `NEXT_PUBLIC_SITE_URL` in Vercel and **Site URL** in Supabase to match, and redeploy.
6. Create the Owner (section 4). You can run the script from your computer against the live project by putting the production values in `.env.local` temporarily.

**Scheduled jobs.** [`vercel.json`](vercel.json) registers two daily jobs. Vercel calls them with `Authorization: Bearer <CRON_SECRET>`; any other caller gets `401`.

| Job | When (UTC) | What it does |
| --- | --- | --- |
| `/api/cron/invoices` | 05:00 daily | On the invoice day set in Settings, drafts last month's tuition invoices |
| `/api/cron/reminders` | 06:00 daily | Marks overdue invoices, sends payment reminders, sends next-day lesson reminders |

Both are safe to re-run: the same invoice or reminder is never produced twice. Every run is recorded in the `job_runs` table.

**Launch checklist**

- [ ] `setup_all.sql` has been run and public sign-ups are turned off in Supabase
- [ ] Owner created, signed in, two-step verification on
- [ ] **Settings**: contact details, time zone and currency checked; founder biography and qualifications entered
- [ ] **Programmes**: only programmes you offer are shown on the website
- [ ] Email provider configured and a test application submitted end to end
- [ ] Privacy, terms and refund policies reviewed (Settings → Policies)
- [ ] If taking online payments: Paystack live key set and the webhook URL registered (section 7)
- [ ] A real photograph added for the homepage (section 11)

## 7. Email, payments, AI and push

### Email through Gmail (Google Apps Script)

No paid email service is needed. [`scripts/gmail-relay.gs`](scripts/gmail-relay.gs) is a small Google Apps Script that sends the platform's email from a Gmail account. Full step-by-step setup is in the comment at the top of that file. In short:

1. At https://script.google.com create a project and paste in the file.
2. Add a script property `RELAY_SECRET` (a long random password).
3. Run `testSend` once to grant permission.
4. Deploy as a **Web app** (Execute as: Me, Who has access: Anyone) and copy the `/exec` URL.
5. Set `EMAIL_PROVIDER=relay`, `EMAIL_RELAY_URL` and `EMAIL_RELAY_SECRET` on the server and redeploy.

Gmail allows about 100 recipients a day on a free account (1,500 on Google Workspace). The script stops at a configurable daily limit and the website reports any email it could not send. After editing the script, publish a **new version** of the deployment or the change does not take effect.

### Email (Resend)

1. Create a Resend account, verify your sending domain, create an API key.
2. Set `EMAIL_PROVIDER=resend`, `RESEND_API_KEY`, and `EMAIL_FROM="Tosinfinity Academy <no-reply@yourdomain.com>"`.

Delivery outcomes are logged by template name and status only. Message bodies, links and tokens are never logged.

### Payments (Paystack)

1. Set `PAYSTACK_SECRET_KEY` (start with the **test** key).
2. In the Paystack dashboard set the **Webhook URL** to `https://www.yourdomain.com/api/webhooks/paystack`.
3. Make sure your Paystack account supports the currency chosen in **Settings → Time zone and currency**.

How a payment is handled:

- The amount is never taken from the browser. The server reads the invoice balance, records a payment attempt, and starts a Paystack checkout.
- A payment is credited only after the server asks Paystack directly whether that reference was paid, and the amount and currency match the invoice. This happens from **both** the webhook and the page the payer returns to, so closing the tab does not lose a payment and visiting the "success" page proves nothing by itself.
- Webhook requests must carry a valid `x-paystack-signature` (HMAC-SHA512 of the raw body).
- Each reference can be credited once. Repeated webhook deliveries change nothing.
- The payments table is append-only. Corrections are new adjustment rows, never edits.

**Development workflow without live credentials:** use Paystack test keys and [test cards](https://paystack.com/docs/payments/test-payments/). With no key set, the pay button is replaced by a notice and you can record bank-transfer and cash payments manually.

The provider sits behind a small interface in [`lib/payments/index.ts`](lib/payments/index.ts). To add Stripe or another gateway, implement `PaymentProvider` and return it from `getProvider()`.

### AI assistant (optional)

Set `AI_API_KEY`, `AI_MODEL` and, for providers other than OpenAI, `AI_BASE_URL` (any OpenAI-compatible `/chat/completions` endpoint). This enables:

- a student study assistant (explanations, hints, practice questions, revision summaries), clearly labelled as AI;
- "draft with AI" buttons for the Owner's feedback and report comments.

AI output is always a draft: nothing is saved, marked or published without the Owner pressing save. Requests are rate-limited and length-limited. Only the text typed into the assistant is sent; no names or records. With no key the rest of the platform is unaffected.

### Online classes

Each class has a lesson room (`/owner/classes/<id>/room` for the Owner, `/portal/classes/<id>` for the learner, `/parent/classes/<id>` for a parent) with attendance confirmation, quick checks, private questions, materials, recap, homework and an understanding check-in. It is the same for home and online lessons.

For the video call itself the platform stores a link per class and shows a **Join class** button from 15 minutes before the start:

- Paste any `https://` meeting link (Google Meet, Zoom, Jitsi), **or**
- press **Create online room**, which generates an unguessable room on `JITSI_DOMAIN` (default `meet.jit.si`). On the public `meet.jit.si` service the first person in a room must sign in to Jitsi as moderator; that will be the Owner.

The meeting opens in a new tab while the lesson room stays open for quick checks and questions. If you run **your own** Jitsi server, set `NEXT_PUBLIC_JITSI_EMBED_DOMAIN` to its host name and the meeting is shown inside the lesson room instead; the security headers then allow camera and microphone for that host only. Do not point this at `meet.jit.si`, which does not permit long embedded calls.

### Device notifications (optional)

Generate keys with `npx web-push generate-vapid-keys` and set the three `VAPID` variables. Users then see a "Turn on notifications" button on their Account page. In-app notifications (the bell) always work without this.

## 8. Demo data

For local development or a throwaway staging project only:

```bash
npm run demo:seed
```

```bash
npm run demo:remove
```

Demo records are labelled `[DEMO]`, use the reserved `@demo.tosinfinity.test` domain, and include placeholder rates that are **not** the academy's prices. The script prints a one-time random password for the demo accounts and refuses to run when `VERCEL_ENV=production`.

## 9. Tests and checks

```bash
npm run check
```

runs type checking, ESLint, the test suite and a production build. Individually: `npm run typecheck`, `npm run lint`, `npm test`, `npm run build`.

The tests need no Supabase project. The database tests (`tests/db`) load the **real migrations** into an in-process Postgres (PGlite) with stand-ins for Supabase's roles and `auth.uid()`, then run queries as each kind of user, the same way the live API does.

| File | What it proves |
| --- | --- |
| `tests/db/smoke.test.ts` | Migrations apply, can be re-run, and every table has Row Level Security |
| `tests/db/access.test.ts` | Students see only their own records; parents see only linked children (including a parent with two children); changing an ID in a request returns nothing; the public can submit but never read applications; private files and messages are isolated |
| `tests/db/workflows.test.ts` | Application approval is all-or-nothing and cannot run twice; payments cannot be forged; duplicate webhook deliveries credit once; the ledger is append-only; issued invoices are locked; quiz answers never reach students; resubmission rules |
| `tests/db/engagement.test.ts` | Lesson room: only a learner or their own parent can confirm attendance; questions stay private within a shared class; quick-check answers are hidden until closed and limited to one per learner; class materials are visible to that class only |
| `tests/unit/billing.test.ts` | Hourly and flat invoice calculations, absence policy, money parsing |
| `tests/unit/security.test.ts` | Webhook signature checks, cron authentication, cross-site request checks, safe Markdown, upload rules, email escaping |
| `tests/unit/time-and-validation.test.ts` | Time zones and daylight saving, scheduling conflicts, enrolment validation, CSV import and export |

There is no browser-automation (end-to-end) suite yet; see [Known limits](#13-known-limits).

## 10. Security model

- **Row Level Security on every table.** The browser and ordinary server code use the visitor's own session, so the database itself decides what each person can read or change. Hiding a button is never the control.
- **Three roles**, checked on the server for every private page and action: middleware verifies the session with Supabase and the role for the area; each layout and action checks again.
- **The service-role key** is used only in server code that has already verified the Owner, a webhook signature or the cron secret, or for narrow system tasks (rate limiting, resolving a student ID at sign-in). It is never imported by client code.
- **Student ID sign-in** resolves the ID to an email on the server, then performs normal password authentication. An ID alone grants nothing.
- **Owner two-step verification (TOTP).** Once enrolled, every Owner page requires a verified second factor.
- **Rate limits** on sign-in, password reset, applications, contact, newsletter, messages, submissions, payments and AI, stored in Postgres so they hold across serverless instances.
- **Public forms** are validated on the server with shared schemas, rate-limited, and protected with a honeypot and a minimum-time check.
- **Private files** live in private buckets and are served through 60-second signed links created with the requester's own session.
- **Headers:** Content Security Policy, `X-Frame-Options: DENY`, HSTS, `nosniff`, strict referrer policy. Private pages and all API responses are `no-store`.
- **The service worker** caches only static public assets and an offline page. It never caches pages, API responses or files. Private pages re-check the session when a tab regains focus or is restored from the back-forward cache.
- **Audit log** of approvals, account changes, grade changes, invoices, payments, settings and deletions. It cannot be edited or deleted, even by the Owner.
- **Retention:** issued invoices and payments cannot be deleted. A student with financial history is deactivated rather than removed, which blocks sign-in while keeping records.

Passwords, tokens, keys and payment details are never logged.

## 11. Brand assets and images

- The logo in `public/brand` was prepared from the supplied `logo.jpeg`: `emblem.png` (cap and infinity, transparent) and `wordmark-navy.png` / `wordmark-white.png` (the original lettering, recoloured for light and dark backgrounds). `logo-original.jpeg` is kept for reference. **The supplied file is small (410 × 261 pixels)**, so it will look soft on large or high-density screens. Replace those three files with exports from the original artwork when you have them; keep the same file names and proportions.
- Colours are design tokens in `app/globals.css` (mirrored in `lib/design-tokens.ts`). The Owner can also change the four brand colours in **Settings → Brand colours**.
- **Homepage photograph.** No photograph was supplied, so the hero shows a brand panel. Add a licensed photo of learners with books or learning materials at `public/images/hero.jpg` (portrait, roughly 4:5, at least 1200 px tall) and it is used automatically.
- App icons and the social sharing image in `public/icons` are generated from the emblem.

## 12. Project layout

```
app/
  (marketing)/      public website, blog, enrolment and contact forms
  (auth)/           sign in, two-step verification, password links
  owner/            Owner control centre
  portal/           Student portal
  parent/           Parent portal
  guardian/         optional read-only guardian link
  api/              files, payments, webhook, cron, newsletter, push
components/
  brand/            Logo
  marketing/        public site sections
  portal/           portal shell, messaging, documents, uploads
  family/           views shared by the student and parent portals
  ui/               buttons, cards, forms
lib/
  supabase/         browser, server and service-role clients
  security/         rate limiting, request checks
  validation/       shared schemas (enrolment, students, CSV)
  email/            delivery adapter and templates
  payments/         provider interface, Paystack, signature check
  ai/               AI abstraction
  billing.ts        invoice maths (pure, unit-tested)
  invoicing.ts      invoice creation and issue
  time.ts           time-zone handling
supabase/
  migrations/       numbered SQL migrations
  setup_all.sql     all migrations in one file
scripts/            create-owner, seed-demo, build-setup-sql
tests/              unit and database tests
docs/OWNER_GUIDE.md the Owner's manual
```

## 13. Known limits

These are stated plainly so nothing is assumed to exist that does not.

- **Not yet run against a live Supabase project.** The SQL, security rules and workflows are tested against an in-process Postgres, and the app builds and type-checks, but sign-in, email, storage uploads and Paystack have not been exercised against real services. Do one full pass (apply → approve → class → attendance → assignment → invoice → payment) on a test project before launch.
- **No browser end-to-end tests.** Critical rules are covered at the database and unit level instead.
- **Logo upload and email-template editing are not in Settings.** The logo is replaced by swapping files (section 11) and email wording lives in `lib/email/templates.ts`.
- **Scheduled articles** are hidden until their time by a database rule, but the public blog list is cached for up to two minutes, so an article can appear slightly after its scheduled time.
- **Term tuition** is invoiced manually (Billing → Create invoice, with optional instalments); only hourly and flat monthly billing are drafted automatically each month.
- **Device push** is sent for Owner-initiated updates and messages. Notifications raised inside the database (work submitted, payment received) appear in the bell but are not pushed.
- **Lesson reminders** go out once a day for the following day (Vercel's Hobby plan allows daily jobs only).
- **Sentry** reporting is a minimal server-side sender, not the full SDK: no browser error capture or performance tracing.
- **Video is not built in.** Online lessons use a meeting link (Meet, Zoom or Jitsi) opened in a new tab, or an embedded call only with your own Jitsi server. There is no built-in whiteboard, and recordings are links you paste, not files the platform records or stores.
- **The lesson room refreshes every few seconds** rather than instantly; a quick check can take up to about ten seconds to appear on a learner's screen.
- **Public comments and reactions on articles** are not built.

**Updating an existing database.** When a new file appears in `supabase/migrations` (for example `0008_class_engagement.sql`, which adds the lesson room), run `supabase/setup_all.sql` again in the Supabase SQL editor. It is safe to re-run and only adds what is missing. Until you do, pages that use the new tables will show an error.
