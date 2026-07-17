# Supabase: verify schema was created (Landbot)

Supabase may show **“Success. No rows returned”** for DDL statements. The tables/enums still get created; you just need to verify them.

## 1) Check that tables exist
Run:
```sql
select table_schema, table_name
from information_schema.tables
where table_schema = 'public'
order by table_name;
```

You should see:
- `land_submissions` (required)
- `land_records` (optional)

## 2) Check the enum exists and values
Run:
```sql
select enumlabel
from pg_enum
join pg_type on pg_type.oid = pg_enum.enumtypid
where pg_type.typname = 'land_submission_status'
order by enumlabel;
```

You should see:
- Pending
- Rejected
- Verified

## 3) Check land_submissions columns
Run:
```sql
select column_name, data_type
from information_schema.columns
where table_schema = 'public'
  and table_name = 'land_submissions'
order by ordinal_position;
```

You should see columns like:
- id, plot_number, owner_name, national_id
- wa_id
- status
- verified_at / verified_by
- rejected_at / rejected_by / rejection_reason
- raw_payload

## If anything is missing
Tell me which Step (1/2/3) failed and paste the output you got—then I’ll adjust the SQL accordingly.
