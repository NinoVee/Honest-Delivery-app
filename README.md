# Honest Care Medical Delivery

Chain-of-custody delivery tracking with proof of delivery (signature + photos) and automatic email
confirmation, built for **Honest Care Medical Delivery** — delivering care, delivering trust.

- **Driver Console** (`/`) — create orders, advance status (In Transit → Onsite → Completed), capture
  signature + photos on completion
- **Client Tracking** (`/track` or `/track/[code]`) — client looks up a delivery by its tracking code
  (in production this is a link they'd get automatically by email)
- Real email is sent via **Resend** with the signature and photos attached, when an order is completed
- Data is stored in **Redis** (Vercel's managed Redis storage) so it persists across requests/deploys,
  unlike the earlier in-browser prototype

## Deploy to Vercel (for testing)

### 1. Push this project to GitHub
```bash
cd honest-care-app
git init
git add .
git commit -m "Honest Care Medical Delivery"
gh repo create honest-care-delivery --source=. --push
# or create a repo on github.com and follow its "push an existing repo" instructions
```

### 2. Import into Vercel
Go to [vercel.com/new](https://vercel.com/new), import the GitHub repo. Framework preset ("Next.js")
is auto-detected — no build config changes needed.

### 3. Add storage: Redis
In your Vercel project: **Storage → Create Database → Redis**. Once it's created, open the database and
click **Connect to Project**, select this project, and leave all environments (Production/Preview/
Development) checked. This automatically sets the `REDIS_URL` environment variable for you.

### 4. Add email: Resend
1. Create a free account at [resend.com](https://resend.com) and copy an API key.
2. In Vercel, add environment variables:
   - `RESEND_API_KEY` = your key
   - `EMAIL_FROM` = `onboarding@resend.dev` (for testing)

**Important testing limitation:** without a verified sending domain, Resend's shared
`onboarding@resend.dev` address can only deliver to the email address on your own Resend account —
not to arbitrary hospital/clinic inboxes. For a real test with the hospital's actual email, either:
- send the test order to your own email address, or
- verify a sending domain in Resend (Domains tab, a few DNS records) and set `EMAIL_FROM` to an
  address on that domain (e.g. `delivery@honestcaremedical.com`) — takes a few minutes and then you
  can send to anyone.

### 5. Deploy
Click **Deploy**. Once it finishes, client tracking is at `https://your-app.vercel.app/` and the
driver console (now login-protected) is at `https://your-app.vercel.app/driver`.

### 6. Set up driver login
Add two more env vars in Vercel:
- `DRIVER_PASSWORD` — a shared password your drivers use to sign in. Each driver still enters
  their own name at login (recorded on every order/completion they touch).
- `AUTH_SECRET` — a long random string that signs the login session cookie. Generate one with
  `openssl rand -hex 32` (or any long random string) — never reuse this across projects.

Redeploy after adding these. Drivers now sign in at `/login` before reaching `/driver`.

### 7. Set up the Retell voice dispatch agent
This app includes a full backend for the phone dispatch agent described in `agent-prompt.md`
(driver-console side auth is separate from this — this is the *voice* side):

1. **Add env vars:**
   - `RETELL_API_KEY` — from Retell dashboard > API Keys. Must be a key with the **webhook**
     badge — this same key both signs and verifies every request between Retell and this app.
   - `ADMIN_API_KEY` — any long random value you choose. Protects the client-account admin API.
2. **Redeploy** so the new env vars take effect.
3. **Create your Retell agent** using the Welcome Message and Universal Prompt from
   `agent-prompt.md`.
4. **Add the 7 custom functions** listed in `docs/retell-function-config.json` — that file has
   the exact name/description/URL/parameters for each one to paste into Retell's dashboard
   (Agent > Tools > + Add > Custom Function). Replace `https://your-app.vercel.app` with your
   real deployed domain in each URL. Turn on **"Payload: args only"** for each function.
5. **Set the webhook URL** (agent-level or account-level, in the Webhooks tab) to
   `https://your-app.vercel.app/api/voice/webhook`.
6. **Wire up live call transfer separately** — `request_human_transfer` only *logs* the
   transfer request in this app (for dispatcher audit). The actual call transfer to a real
   phone number is Retell's own **Transfer Call** feature; pair it with this function in the
   Retell dashboard and point it at your dispatcher's number.
7. **Register verified client accounts** so `verify_client` has something to check against —
   there's no admin UI for this yet, just a protected API:
   ```bash
   curl -X POST https://your-app.vercel.app/api/admin/clients \
     -H "x-admin-key: YOUR_ADMIN_API_KEY" \
     -H "Content-Type: application/json" \
     -d '{"phone":"9095551234","facilityName":"St. Bernadette Clinic","accountNumber":"ACC-104"}'
   ```
8. **Phone-created orders land in the driver console** with a **"Pending Review"** badge and a
   **Phone Intake Details** panel showing everything the caller gave (pickup info, service
   type, temperature requirement, special instructions, etc). Click **Approve Order** to
   release it into the normal In Transit → Onsite → Completed flow.

A few honest limitations worth knowing:
- **Address validation and route estimates use OpenStreetMap's free Nominatim service** — no
  API key needed, but it's rate-limited (~1 req/sec) and route estimates are a straight-line
  distance/speed approximation, not real turn-by-turn routing. Fine for a single dispatch line;
  swap in Google Maps or Mapbox in `lib/geo.js` if you need production-accurate ETAs.
- **The client registry has no admin UI** — just the curl-based API above. Worth building a
  simple screen for this before handing account management to non-technical staff.

## Local development
```bash
npm install
cp .env.example .env.local   # fill in your Redis + Resend + auth + Retell values
npm run dev
```
Open http://localhost:3000

## Branding
The logo lives at `public/logo-icon.png` (also used as the favicon via `public/favicon.png`). Colors are
set as CSS variables at the top of `styles/globals.css` — `--ink` (navy) and `--teal` were sampled
directly from the Honest Care Medical Logistics branding, so any new UI you add should pull from those
same variables to stay on-brand.

## What's still simplified (fine for testing, revisit before real use)
- Signatures/photos are stored as base64 directly in Redis. For heavier use, move them to object
  storage (S3/R2) and store URLs instead.
- Driver login is a single shared password, not per-driver accounts — fine for a small team,
  but doesn't give you per-driver audit trails or the ability to revoke one driver's access
  without changing the password for everyone. Consider Auth.js/Clerk/Supabase Auth if that
  matters to you.
- Tracking codes are short (8 chars) for readability during testing. If order data is ever sensitive,
  swap in a long random token (32+ bytes) so it can't be guessed.
- If any order details could include patient-identifiable information, treat this as HIPAA-relevant:
  you'll need a Business Associate Agreement with your hosting, storage, and email providers before
  using it with real patient data. This now matters for Retell too if calls could include PHI —
  check Retell's BAA/compliance offerings before using this with real patient-related calls.
