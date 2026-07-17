# TODO - Landbot WhatsApp Verification (Meta WhatsApp Cloud API)

## Supabase
- [ ] Create SQL schema for:
  - land_records (optional; can start without)
  - land_submissions with status: Pending | Verified | Rejected
  - Index on plot_number
  - Store user identifiers needed to reply via WhatsApp (phone, wa_id, etc.)

## Backend (Node.js/Express)
- [x] Create backend project scaffolding under `server/`
- [x] Implement WhatsApp webhook endpoint(s) under `server/src/routes/`
- [x] Implement logic to receive WhatsApp Flows submission payload:
  - validate required fields
  - upsert into `land_submissions`
- [x] Implement admin endpoints:
  - `POST /admin/submissions/:id/verify`
  - `POST /admin/submissions/:id/reject`
- [x] Implement WhatsApp sender using Meta WhatsApp Cloud API:
  - send message to user that submitted the form
- [x] Add env config (`SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `WHATSAPP_TOKEN`, etc.) to README + .env.example

## Admin UI (React)
- [ ] Scaffold under `admin/`
- [ ] Create pages to:
  - list Pending submissions
  - view submission details
  - click Verify / Reject
- [ ] Wire UI actions to backend admin endpoints

## Docs / Run Instructions
- [x] Add root `README.md` with:
  - how to apply Supabase SQL
  - env vars needed
  - how to run backend + admin
  - how to configure Meta WhatsApp webhook + Flow submission callback

## Verification / Testing
- [ ] Smoke test:
  - simulate a webhook payload locally (or via sample curl)
  - confirm DB row is created
  - confirm admin verify updates status
  - confirm WhatsApp message send request is made
