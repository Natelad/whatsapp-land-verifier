# TODO - Landbot WhatsApp Verification (Meta WhatsApp Cloud API)

## Supabase
- [x] SQL schema created (`supabase/schema.sql`)
  - `land_submissions` table with status: Pending | Verified | Rejected
  - `land_records` table (optional)
  - Index on `plot_number`
  - RLS policies (service role bypass)

## Backend (Node.js/Express)
- [x] Backend project scaffolding under `server/`
- [x] WhatsApp webhook endpoint (`POST /webhook`) under `server/src/routes/webhook.js`
  - Validates required fields (`wa_id`, `plot_number`)
  - Upserts into `land_submissions`
- [x] WhatsApp Flow endpoint (`/whatsapp-flow`) under `server/src/routes/whatsapp-flow.js`
  - Accepts encrypted payloads from Meta (`encrypted_flow_data`, `encrypted_aes_key`, `initial_vector`)
  - RSA-OAEP decrypt + AES-128-GCM decrypt
  - Loads `PRIVATE_KEY` from env var (Render) or `private.pem` file (local)
  - Returns encrypted response back to Meta
- [x] Admin endpoints:
  - `GET /admin/submissions?status=Pending`
  - `POST /admin/submissions/:id/verify`
  - `POST /admin/submissions/:id/reject`
- [x] WhatsApp sender using Meta Cloud API (`server/src/services/whatsapp.js`)
- [x] Env config (`server/src/config/env.js`) + README

## Admin UI (React)
- [x] Scaffolded under `admin/` using Vite + React + TypeScript
- [x] Pages created:
  - **Login** — modern gradient design, admin token input
  - **PendingSubmissions** — two-panel grid (list + detail), loading/empty/error states
  - **SubmissionDetails** — fields display, **Verify & Notify** / **Reject & Notify** buttons, rejection reason input, WhatsApp notification banner, toast feedback
- [x] Wired to backend admin endpoints via `admin/src/api.ts`
- [x] Professional CSS design system (`admin/src/styles.css`)
- [x] Vite production build passes (156.9 kB JS, 10.6 kB CSS gzipped)

## Docs / Run Instructions
- [x] Root `README.md` with complete setup guide (Supabase, env vars, run backend + admin, Meta configuration)
- [x] `docs/START_SUPABASE.md`
- [x] `docs/SUPABASE_VERIFY_SCHEMA.md`

## Key Generation (Meta WhatsApp Flow Encryption)
- [x] `generate-keys.js` — Node.js script to create RSA 2048-bit keypair
- [x] `loadPrivatePem()` supports both `PRIVATE_KEY` env var and local `private.pem` file

## Verification / Testing
- [ ] End-to-end test with live Meta payload:
  - Generate keys (run `node generate-keys.js`)
  - Upload `public.pem` to Meta Flow → **Sign public key**
  - Set `PRIVATE_KEY` = contents of `private.pem` in Render env vars
  - Submit a test WhatsApp Flow form
  - Verify decryption works and a `land_submissions` row is created in Supabase
