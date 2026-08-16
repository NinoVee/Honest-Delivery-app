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
Click **Deploy**. Once it finishes, your driver console is at `https://your-app.vercel.app/` and client
tracking at `https://your-app.vercel.app/track`.

## Local development
```bash
npm install
cp .env.example .env.local   # fill in your Redis + Resend values
npm run dev
```
Open http://localhost:3000

## Branding
The logo lives at `public/logo.png` (also used as the favicon via `public/favicon.png`). Colors are
set as CSS variables at the top of `styles/globals.css` — `--ink` (navy) and `--teal` were sampled
directly from the Honest Care Medical Logistics logo, so any new UI you add should pull from those
same variables to stay on-brand.

## What's still simplified (fine for testing, revisit before real use)
- Signatures/photos are stored as base64 directly in Redis. For heavier use, move them to object
  storage (S3/R2) and store URLs instead.
- No driver login yet — anyone with the deployed URL can create/complete orders. Add auth (Auth.js,
  Clerk, or Supabase Auth) before giving this to real drivers.
- Tracking codes are short (8 chars) for readability during testing. If order data is ever sensitive,
  swap in a long random token (32+ bytes) so it can't be guessed.
- If any order details could include patient-identifiable information, treat this as HIPAA-relevant:
  you'll need a Business Associate Agreement with your hosting, storage, and email providers before
  using it with real patient data.
