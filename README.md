# Landbot WhatsApp Verification (Meta WhatsApp Cloud API + Supabase)

This project provides:
- **WhatsApp Flow webhook ingestion** (Meta WhatsApp Cloud API)
- **Supabase schema** to store land verification submissions
- **Bank/admin UI** to **Verify/Reject** submissions
- When admin verifies/rejects, the backend **sends a WhatsApp message** back to the user (best-effort)

---

## Architecture

**[WhatsApp Flow Form] → [Meta WhatsApp Cloud API Webhook] → [Node.js Backend] → [Supabase]**

Admin UI:
- **[Admin React UI] → [Node.js Admin API] → [Supabase + WhatsApp message send]**

---

## 1) Supabase Setup

### Apply database schema
1. Open **Supabase Dashboard**
2. Go to **SQL Editor** → **New query**
3. Paste the contents of `supabase/schema.sql` (from this repo)
4. Click **Run**

### Verify the tables exist
After running, you should see:
- Table: `public.land_submissions`
- (Optional) Table: `public.land_records`

Also confirm `land_submissions.status` is constrained to:
- `Pending`, `Verified`, `Rejected`

### Notes about tables
- `land_records` (optional) holds existing land plots
- `land_submissions` holds incoming WhatsApp Flow submissions
- `land_submissions.status` is one of: `Pending | Verified | Rejected`


---

## 2) Configure Environment Variables

Copy `.env.example` to `.env` (or set equivalent env vars).

```bash
# at repo root (where server/ and admin/ are)
copy .env.example .env
```

Edit the values:
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `WHATSAPP_TOKEN`
- `WHATSAPP_PHONE_NUMBER_ID`
- `ADMIN_TOKEN` (optional; if set, admin endpoints are protected)

---

## 3) Run Backend (Node.js/Express)

### Install dependencies
```bash
cd server
npm install
```

### Start
```bash
npm start
```

Backend will expose:
- `GET /healthz`
- `POST /webhook` (mounted at `/webhook` by router; see backend routes)
- `GET /admin/submissions?status=Pending`
- `POST /admin/submissions/:id/verify`
- `POST /admin/submissions/:id/reject`

> If required env vars are missing, the server will still start in “limited mode” and only `/healthz` will work.

---

## 4) Run Admin UI (React)

### Install dependencies
```bash
cd admin
npm install
```

### Start dev server
```bash
npm run dev
```

### Build
```bash
npm run build
```

Admin UI calls the backend using `VITE_API_BASE_URL` if set; otherwise it defaults to:
- `http://localhost:8080`

---

## 5) WhatsApp Flow Wiring (Meta)

### Webhook endpoint
Configure your Meta WhatsApp setup so Flow submissions are delivered to your backend webhook URL:

- Base path is mounted at: `/webhook`
- The backend webhook route expects the Flow submission payload and will persist a `land_submissions` row.

**You must point Meta to:**
- `https://YOUR_DOMAIN/webhook/...` (exact sub-path depends on Meta routing; see backend route implementation in `server/src/routes/webhook.js`)

### What the backend stores
For each Flow submission the backend will store:
- `plot_number`
- `owner_name`
- `national_id`
- the user identifier (`wa_id`)
- raw payload (`raw_payload`) for trace/debugging
- `status = Pending` initially

---

## 6) Admin Verify/Reject Behavior

When admin clicks:
- **Verify**
  - Backend updates `land_submissions.status = 'Verified'`
  - Backend sends a WhatsApp message:
    - “your land at Plot [Number] is currently Verified.”
- **Reject**
  - Backend updates `land_submissions.status = 'Rejected'`
  - Backend sends a WhatsApp message with the rejection reason (best-effort)

WhatsApp messaging failures do **not** block DB updates (best-effort).

---

## Files Overview

- **Supabase schema**
  - `supabase/schema.sql`
- **Backend**
  - `server/src/index.js`
  - `server/src/routes/webhook.js`
  - `server/src/routes/admin.js`
  - `server/src/services/supabase.js`
  - `server/src/services/whatsapp.js`
  - `server/src/config/env.js`
- **Admin UI**
  - `admin/src/pages/PendingSubmissions.tsx`
  - `admin/src/pages/SubmissionDetails.tsx`
  - `admin/src/api.ts`

---

## Production checklist (recommended)
- Tighten Supabase **RLS policies** (currently schema enables RLS but service role typically bypasses)
- Add request signature verification for webhook payloads (Meta webhook validation)
- Validate WhatsApp Flow schema fields more strictly (based on your exact Flow)
- Secure admin endpoints properly (ADMIN_TOKEN + HTTPS + IP allowlists if needed)
