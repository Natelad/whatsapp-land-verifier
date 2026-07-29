# Supabase: start + create project data for Landbot verification

## 1) Create tables
1. Open **Supabase Dashboard**
2. Select your project
3. Go to **SQL Editor** → **New query**
4. Paste and run: `supabase/schema.sql`

After running, confirm:
- Table exists: `public.land_submissions`
- `public.land_submissions` includes columns: `province`, `district`, `tenure_type`, `tenure_type_other`
- (Optional) Table exists: `public.land_records`

## 2) Confirm schema integrity
In SQL Editor, run this quick check:

```sql
select table_name
from information_schema.tables
where table_schema = 'public'
order by table_name;
```

Also confirm status values (enum) exist:

```sql
select enumlabel
from pg_enum
join pg_type on pg_type.oid = pg_enum.enumtypid
where pg_type.typname = 'land_submission_status'
order by enumlabel;
```

You should see: `Pending`, `Rejected`, `Verified`.

## 3) Set backend environment variables
Create a `.env` file in the repo root (same level as `server/` and `admin/`).

Required values (from Supabase Dashboard):
- `SUPABASE_URL` (Project Settings → API)
- `SUPABASE_SERVICE_ROLE_KEY` (Project Settings → API → Project API keys)

Set:

```bash
SUPABASE_URL=...
SUPABASE_SERVICE_ROLE_KEY=...
```

(WhatsApp vars are required later when you start the backend, but Supabase setup is independent.)

## 4) Start backend (only after tables exist)
Then:
- `cd server`
- `npm install`
- `npm start`

Check:
- `GET http://localhost:8080/healthz` → `{ "ok": true }`

## 5) Next critical step
Once Supabase is ready and backend is running with env vars:
- test `POST /webhook/whatsapp` using a sample payload (or your real Meta webhook payload)
