# Landbot WhatsApp Land Verification System

**Land Verification via WhatsApp Flows** — A full-stack system enabling land owners to submit verification details through an interactive WhatsApp form, with a bank/admin panel to review, verify, or reject submissions.

### Architecture

```
[WhatsApp User] ↔ [Meta WhatsApp Cloud API] ↔ [Backend (Node.js/Express)] ↔ [Supabase DB]
                                        ↕
                              [WhatsApp Flow (Encrypted)]
                                        ↕
                              [Admin React UI] → [Admin API Routes]
```

### Flow Summary

1. User sends a text message (e.g. "hi") to the configured WhatsApp number
2. Backend receives the webhook via `POST /webhook/whatsapp` and sends a **WhatsApp Flow** interactive message back
3. User opens the Flow form, fills in land details (plot number, name, national ID, etc.)
4. WhatsApp sends the encrypted Flow submission to `POST /whatsapp-flow`
5. Backend decrypts the payload using RSA + AES-128-GCM, extracts form data, and stores a **Pending** submission in Supabase
6. Bank admin logs into the Admin UI, reviews pending submissions, and clicks **Verify** or **Reject**
7. Backend updates the status in Supabase and sends a WhatsApp notification back to the user (best-effort)

---

## Prerequisites

Before proceeding, ensure you have:

- **Node.js** v18+ installed
- A **Supabase** account and project (free tier works)
- A **Meta WhatsApp Business Account** (WABA) with:
  - Access to **WhatsApp Cloud API**
  - At least one **phone number** configured (test or production)
  - Ability to create/manage **WhatsApp Flows** in Meta Business Manager
- A hosting platform (e.g. **Render**, Railway, or your own server) to deploy the backend
- (Optional) A hosting platform for the Admin UI (or run locally)

---

## Step 1: Supabase Database Setup

### 1.1 Create a Supabase Project

1. Go to [supabase.com](https://supabase.com) and create an account or log in
2. Create a new project (choose a region close to your users)
3. Wait for the database to provision (about 1 minute)

### 1.2 Apply the Schema

1. Open **Supabase Dashboard** → **SQL Editor** → **New query**
2. Paste the entire contents of `supabase/schema.sql` from this repo
3. Click **Run**

### 1.3 Verify Tables

After running, confirm these objects exist in your Supabase project:

**Table: `public.land_submissions`**
- Stores incoming WhatsApp Flow submissions awaiting admin review
- Columns: `id` (UUID), `plot_number`, `first_name`, `last_name`, `farm_name`, `gender`, `province`, `district`, `tenure_type`, `tenure_type_other`, `national_id`, `wa_id`, `from_phone`, `status`, `verified_by`, `verified_at`, `rejected_by`, `rejected_at`, `rejection_reason`, `wa_message_id`, `wa_flow_token`, `raw_payload`, `created_at`, `updated_at`
- Status constraint: `'Pending' | 'Verified' | 'Rejected'`

**Table: `public.land_records`** (optional)
- Stores master land records for cross-referencing
- Columns: `id`, `plot_number`, `owner_name`, `national_id`, `status`, `created_at`, `updated_at`

**Triggers & Indexes:**
- `trg_land_submissions_updated_at` — automatically updates `updated_at` on row changes
- Indexes on `plot_number`, `status`, and `wa_id` for fast lookups

### 1.4 Get Supabase Credentials

1. In Supabase Dashboard, go to **Project Settings** → **API**
2. Note down:
   - **Project URL** (`SUPABASE_URL`)
   - **Service Role Key** (`anon` key is public; use the **service_role** key for backend operations)

---

## Step 2: RSA Key Generation & PEM Setup (WhatsApp Flow Encryption)

WhatsApp Flows use end-to-end encryption. You must generate an RSA key pair:
- **`public.pem`** — uploaded to Meta WhatsApp Manager so Meta can encrypt Flow payloads
- **`private.pem`** — kept on your server to decrypt incoming Flow payloads

### 2.1 Generate the Key Pair

```bash
# From the project root (where generate-keys.js lives)
node generate-keys.js
```

This creates two files:
- `public.pem` — your public key (share with Meta)
- `private.pem` — your private key (KEEP SECRET, never commit to Git)

Both files are added to `.gitignore` to prevent accidental commits.

### 2.2 Understanding the PEM Files

**`public.pem`** (upload to Meta WhatsApp Manager):
```
-----BEGIN PUBLIC KEY-----
MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEA...
-----END PUBLIC KEY-----
```

**`private.pem`** (keep on your server):
```
-----BEGIN PRIVATE KEY-----
MIIEvQIBADANBgkqhkiG9w0BAQEFAASCBKcwggSjAgEAAoIBAQ...
-----END PRIVATE KEY-----
```

### 2.3 Private Key Configuration — Two Methods

#### Method A: Local Development (File-based)

For local dev, simply keep `private.pem` in the project root or `server/` directory. The server auto-detects it:

```javascript
// whatsapp-flow.js checks these locations:
// 1. process.cwd() + '/private.pem'
// 2. path.join(__dirname, '../../private.pem')
```

#### Method B: Production / Render (Environment Variable)

On Render (or any production platform), you **cannot** upload a file directly. Instead, paste the entire PEM contents into an environment variable called `PRIVATE_KEY`.

**How to convert PEM to an env var:**

Option 1 — Single-line (escape newlines with `\n`):
```bash
# Use a tool like Node.js to create a single-line string
node -e "const fs=require('fs'); const pem=fs.readFileSync('private.pem','utf8'); console.log(pem.split('\n').join('\\n'))"
```
Copy the output and paste it as the value of the `PRIVATE_KEY` environment variable in your hosting dashboard (e.g. Render).

Option 2 — Multi-line (if the platform supports multi-line env vars):
- Render supports multi-line environment variables
- Simply copy-paste the entire `private.pem` content (with line breaks) into the `PRIVATE_KEY` field

**How the server loads `PRIVATE_KEY`:**
```javascript
// whatsapp-flow.js
function loadPrivatePem() {
  // 1) Check PRIVATE_KEY env var first (Render/production)
  if (process.env.PRIVATE_KEY) {
    const key = process.env.PRIVATE_KEY.trim();
    if (key.includes('BEGIN')) return key;
    throw new Error('PRIVATE_KEY env var does not contain a valid PEM header');
  }
  // 2) Fallback to private.pem file on disk (local dev)
  ...
}
```

### 2.4 Upload Public Key to Meta

1. Go to **Meta WhatsApp Manager** → your WABA → **WhatsApp Flows**
2. Select or create your Flow
3. In the Flow settings, find **Encryption** or **Public Key** section
4. Upload (or paste) the contents of `public.pem`
5. Save the configuration

---

## Step 3: Environment Variables

Copy the example env file (if available) or create a `.env` file at the project root:

```bash
# From project root
# No .env.example provided, so create server/.env manually
```

Create `server/.env` with the following content:

```ini
# === REQUIRED: Backend Configuration ===

# Port the server listens on (default: 8080)
PORT=8080

# === REQUIRED: Supabase ===
# Find these in Supabase Dashboard → Project Settings → API
SUPABASE_URL=https://your-project-id.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key-here

# === REQUIRED: Meta WhatsApp Cloud API ===
# Generate this token in your Meta Business Manager WhatsApp settings
WHATSAPP_TOKEN=your-whatsapp-api-token

# The phone number ID assigned to your WhatsApp sender number (find in Meta Business Manager)
WHATSAPP_PHONE_NUMBER_ID=123456789012345

# === OPTIONAL: Meta WhatsApp Configuration ===
# Graph API version (default: 20.0)
WHATSAPP_GRAPH_API_VERSION=20.0

# WhatsApp message template settings
WHATSAPP_TEMPLATE_NAME=land_verification_form
# Use default English if that is the language configured in WhatsApp Manager.
WHATSAPP_TEMPLATE_LANGUAGE_CODE=en
WHATSAPP_TEMPLATE_HEADER_TYPE=IMAGE
WHATSAPP_TEMPLATE_HEADER_IMAGE_ID=
WHATSAPP_TEMPLATE_HEADER_IMAGE_URL=https://www.zlc.co.zw/img/logo1.png
WHATSAPP_TEMPLATE_BODY_TEXT=Applicant
WHATSAPP_TEMPLATE_FOOTER_TEXT=

# Your Flow ID from WhatsApp Manager (default provided, replace with yours)
WHATSAPP_FLOW_ID=1030716066135048

# === OPTIONAL: Admin Security ===
# If set, admin endpoints require this token in x-admin-token header.
# If NOT set, admin endpoints are open (dev convenience only — set in production!)
ADMIN_TOKEN=your-secret-admin-token

# === REQUIRED for Production: WhatsApp Flow Private Key ===
# Paste the ENTIRE contents of private.pem into this variable
# (For local dev, keep private.pem file instead — this env var is optional locally)
PRIVATE_KEY=-----BEGIN PRIVATE KEY-----\nMIIEvQIBADANBgkqhkiG9w0BAQEFAASCBKcwggSjAgEAAoIBAQ...
```

### Environment Variables Reference

| Variable | Required | Description |
|---|---|---|
| `PORT` | No | Server port (default: 8080) |
| `SUPABASE_URL` | **Yes** | Your Supabase project URL |
| `SUPABASE_SERVICE_ROLE_KEY` | **Yes** | Supabase service_role key (bypasses RLS) |
| `WHATSAPP_TOKEN` | **Yes** | WhatsApp Cloud API access token |
| `WHATSAPP_PHONE_NUMBER_ID` | **Yes** | Phone number ID for sending messages |
| `WHATSAPP_GRAPH_API_VERSION` | No | Meta Graph API version (default: 20.0) |
| `WHATSAPP_TEMPLATE_NAME` | No | WhatsApp template name to send, e.g. `land_verification_form` |
| `WHATSAPP_TEMPLATE_LANGUAGE_CODE` | No | WhatsApp template language code, e.g. `en_US` |
| `WHATSAPP_TEMPLATE_HEADER_IMAGE_ID` | No | Optional WhatsApp uploaded media ID for template header images |
| `WHATSAPP_FLOW_ID` | No | WhatsApp Flow ID (default: 1030716066135048) |
| `ADMIN_TOKEN` | No (but **recommended**) | Secret token for admin API protection |
| `PRIVATE_KEY` | **Yes** (production) / No (local) | RSA private key for Flow decryption |

> **Important:** If required env vars (`SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `WHATSAPP_TOKEN`, `WHATSAPP_PHONE_NUMBER_ID`) are missing, the server starts in **limited mode** and only `GET /healthz` works.

---

## Step 4: Backend Deployment — Node.js/Express

### 4.1 Local Development

```bash
# Navigate to server directory
cd server

# Install dependencies
npm install

# Start development server (with auto-reload via nodemon)
npm run dev

# OR start production server
npm start
```

The server will start on `http://localhost:8080` (or the port you configured).

### 4.2 Deploy to Render (Recommended)

1. Push this repository to GitHub
2. Go to [dashboard.render.com](https://dashboard.render.com) → **New** → **Web Service**
3. Connect your GitHub repository
4. Configure the service:
   - **Name:** `landbot-server` (or any name)
   - **Root Directory:** `server` (important — Render will look in the `server/` subfolder)
   - **Runtime:** Node
   - **Build Command:** `npm install`
   - **Start Command:** `npm start`
   - **Instance Type:** Free (or paid)
5. Add all **Environment Variables** from Step 3 (especially `PRIVATE_KEY` with the PEM content)
6. Click **Create Web Service**
7. Wait for deployment to finish. Note the public URL (e.g. `https://your-app.onrender.com`)

> **Important for Render:** The `PRIVATE_KEY` env var must contain the full PEM content. If using single-line format with `\n`, Render will interpret it correctly.

---

## Step 5: Admin UI Deployment — React (Vite)

### 5.1 Local Development

```bash
# Navigate to admin directory
cd admin

# Install dependencies
npm install

# Start dev server
npm run dev
```

The admin UI will start on `http://localhost:5173` (default Vite port).

**Configure the API base URL:** Create `admin/.env`:

```ini
VITE_API_BASE_URL=http://localhost:8080
```

### 5.2 Build for Production

```bash
cd admin
npm run build
```

The `dist/` folder will contain static files ready for deployment.

### 5.3 Deploy to Render (Static Site)

1. On Render Dashboard → **New** → **Static Site**
2. Connect your GitHub repository
3. Configure:
   - **Name:** `landbot-admin`
   - **Root Directory:** `admin`
   - **Build Command:** `npm install && npm run build`
   - **Publish Directory:** `dist`
4. Add an environment variable:
   - `VITE_API_BASE_URL` = your Render backend URL (e.g. `https://landbot-server.onrender.com`)
5. Click **Create Static Site**

### 5.4 Login to Admin UI

1. Navigate to your admin URL
2. If `ADMIN_TOKEN` is set on the backend, enter it in the login screen
3. If `ADMIN_TOKEN` is not set, you can access the dashboard directly (dev mode only)
4. View **Dashboard** for stats or **Pending Submissions** for review queue

---

## Step 6: Meta WhatsApp Configuration

### 6.1 Webhook Setup

1. Go to **Meta Business Manager** → **WhatsApp** → **API Setup**
2. Under **Webhook**, click **Configure**
3. Set the **Callback URL** to: `https://your-backend-url.onrender.com/webhook/whatsapp`
4. Set the **Verify Token** to your `WHATSAPP_TOKEN` value (same token used in env vars)
5. Subscribe to the following fields:
   - `messages`
   - `message_deliveries`
   - `message_reads`
6. Click **Verify and Save**

### 6.2 Webhook Verification Flow

When Meta sends a verification request:
- Meta hits `GET /webhook/whatsapp?hub.mode=subscribe&hub.verify_token=YOUR_TOKEN&hub.challenge=12345`
- The backend checks `verifyToken === config.WHATSAPP_TOKEN`
- If they match, the backend returns the challenge value
- Meta confirms and the webhook is active

### 6.3 WhatsApp Flow Configuration

1. In **WhatsApp Manager**, go to **WhatsApp Flows** and create a new Flow (or use existing)
2. Design your Flow form with fields (examples: `plot_number`, `first_name`, `last_name`, `national_id`, `farm_name`, `gender`)
3. Note the **Flow ID** (visible in the Flow URL or settings)
4. Set `WHATSAPP_FLOW_ID` env var to this ID
5. Under Flow **Encryption Settings**, upload your `public.pem` file
6. Configure the Flow's **data exchange endpoint** to: `https://your-backend-url.onrender.com/whatsapp-flow`
7. Set the **Health check endpoint** to: `https://your-backend-url.onrender.com/whatsapp-flow`

### 6.4 How the Text Message → Flow Trigger Works

When a user sends any text message (e.g. "hi") to your WhatsApp number:
1. Meta sends a webhook `POST /webhook/whatsapp` with the text message payload
2. Backend identifies it as a text message (not a Flow submission)
3. Backend calls `sendWhatsAppFlowMessage()` which sends an interactive Flow message to the user
4. User receives the form and can fill in their land details
5. Upon submission, Meta sends encrypted data to `POST /whatsapp-flow`

---

## Complete API Endpoints Reference

### Health Check

| Method | Endpoint | Description | Auth |
|---|---|---|---|
| `GET` | `/healthz` | Server health check. Returns `{ ok: true }`. Works even in limited mode. | None |

### WhatsApp Webhook (Meta Cloud API)

| Method | Endpoint | Description | Auth |
|---|---|---|---|
| `GET` | `/webhook/whatsapp` | Meta webhook verification handshake (hub.mode, hub.verify_token, hub.challenge) | Token match |
| `POST` | `/webhook/whatsapp` | Receive incoming WhatsApp messages and Flow submissions from Meta | None (Meta IPs) |

**`POST /webhook/whatsapp` behavior:**
- If the payload is a **text message** (type: "text"), backend sends an interactive Flow message back to the user, triggering the land verification form
- If the payload is a **Flow submission** (contains interactive flow data), backend extracts `plot_number`, `first_name`, `last_name`, `national_id`, `farm_name`, `gender`, etc. and persists a `land_submissions` row with status `Pending`
- Always responds `200 OK` immediately, then processes asynchronously

### WhatsApp Flows (Encrypted Data Exchange)

| Method | Endpoint | Description | Auth |
|---|---|---|---|
| `GET` | `/whatsapp-flow` | Health check for WhatsApp Flows. Returns `{ data: { status: 'active' } }` | None |
| `POST` | `/whatsapp-flow` | Encrypted data exchange endpoint. Meta sends encrypted payloads here. | RSA decryption |

**`POST /whatsapp-flow` encryption flow:**
1. Meta sends: `{ encrypted_flow_data, encrypted_aes_key, initial_vector }`
2. Backend RSA-decrypts `encrypted_aes_key` using `private.pem` (OAEP with SHA-256) to obtain AES key
3. Backend AES-128-GCM decrypts `encrypted_flow_data` using the AES key and IV
4. Backend parses the decrypted JSON to extract `action`, `screen`, `flow_token`, and form `data`
5. For `action: "data_exchange"`, the form data is saved to Supabase
6. Backend builds a response JSON, encrypts it with AES-128-GCM using a **flipped IV** (XOR each byte with 0xFF)
7. Returns the encrypted response as Base64 text (`Content-Type: text/plain`)

**Supported form fields in Flow data:**
- `plot_number` / `plotNumber` / `plot`
- `first_name` / `firstName` / `given_name`
- `last_name` / `lastName` / `family_name`
- `national_id` / `nationalId` / `id_number`
- `farm_name` / `farmName`
- `gender` / `sex`
- `wa_id` / `phone` / `phone_number` / `tel`

### Admin API

All admin endpoints require the `x-admin-token` header (if `ADMIN_TOKEN` is configured).

| Method | Endpoint | Description | Auth |
|---|---|---|---|
| `GET` | `/admin/stats` | Dashboard statistics (totals by status, approval rate, turnaround time) | Admin token |
| `GET` | `/admin/submissions` | List all submissions with filters, search, and pagination | Admin token |
| `GET` | `/admin/submissions/pending` | List pending submissions (backward compatible) | Admin token |
| `GET` | `/admin/export` | Export submissions as CSV | Admin token |
| `POST` | `/admin/submissions/:id/verify` | Verify a pending submission | Admin token |
| `POST` | `/admin/submissions/:id/reject` | Reject a pending submission (requires rejection_reason in body) | Admin token |
| `POST` | `/admin/submissions/:id/message` | Send a custom WhatsApp message to the submission owner | Admin token |

#### `GET /admin/submissions` Query Parameters

| Parameter | Type | Default | Description |
|---|---|---|---|
| `status` | string | `all` | Filter by status: `all`, `Pending`, `Verified`, `Rejected` |
| `search` | string | `''` | Search across plot_number, first_name, last_name, national_id, wa_id, farm_name, from_phone |
| `date_from` | string (ISO) | `''` | Filter by created_at >= this date |
| `date_to` | string (ISO) | `''` | Filter by created_at <= this date |
| `sort_by` | string | `created_at` | Sort field (e.g. `created_at`, `plot_number`, `status`) |
| `sort_order` | string | `desc` | Sort order: `asc` or `desc` |
| `page` | number | `1` | Page number (1-indexed) |
| `limit` | number | `20` | Items per page (max: 100) |

#### `POST /admin/submissions/:id/verify`

**Request body (optional):**
```json
{
  "admin_name": "Bank Admin"
}
```

**Behavior:**
- Updates `land_submissions.status = 'Verified'`
- Records `verified_by` and `verified_at`
- Sends WhatsApp notification: "your land at Plot [Number] is currently Verified."

#### `POST /admin/submissions/:id/reject`

**Request body (required):**
```json
{
  "admin_name": "Bank Admin",
  "rejection_reason": "Incorrect plot number"
}
```

**Behavior:**
- Updates `land_submissions.status = 'Rejected'`
- Records `rejected_by`, `rejected_at`, and `rejection_reason`
- Sends WhatsApp notification with the rejection reason

#### `POST /admin/submissions/:id/message`

**Request body (required):**
```json
{
  "message": "Please provide additional documentation for your plot."
}
```

**Behavior:**
- Sends a custom WhatsApp message to the submission owner
- Prepends: `Hi [Name], regarding your submission for Plot [Number]:\n\n[message]`

---

## Admin Verify/Reject Behavior Details

When an admin verifies or rejects a submission, the backend:

1. **Checks current status** — only `Pending` submissions can be verified/rejected (returns `409 Conflict` otherwise)
2. **Updates Supabase** — sets status, admin name, timestamp, and (for reject) rejection reason
3. **Sends WhatsApp notification** — best-effort; if the WhatsApp API call fails, the DB update is still committed
4. **Returns the updated submission** to the admin UI

**WhatsApp notification templates:**

- **Verify:** `Hi [Name], your land verification for Plot [Plot] is currently *Verified*. Our team will reach out if we need anything else.`
- **Reject:** `Hi [Name], thank you for submitting details for Plot [Plot]. Your verification request is currently *Rejected*. Reason: [Reason].`
- **Custom message:** `Hi [Name], regarding your submission for Plot [Plot]:\n\n[custom message]`

---

## WhatsApp Flow Encryption Details

For developers who need to understand the encryption mechanism:

### Inbound Decryption (Request from Meta)

```
Meta sends: { encrypted_flow_data, encrypted_aes_key, initial_vector }

1. RSA-OAEP decrypt encrypted_aes_key with private.pem  →  AES-128 key (16 bytes)
2. AES-128-GCM decrypt encrypted_flow_data with AES key + IV
3. Last 16 bytes of encrypted_flow_data = GCM authentication tag
4. Parse decrypted JSON payload
```

### Outbound Encryption (Response to Meta)

```
Response JSON: { "screen": "SUCCESS", "data": { ... } }

1. Flip the request IV: flippedIv[i] = ~iv[i] & 0xFF  (XOR with 0xFF)
2. AES-128-GCM encrypt response JSON with AES key + flipped IV
3. Append 16-byte GCM authentication tag to ciphertext
4. Base64 encode the result
5. Return with Content-Type: text/plain
```

### Key Points

- AES key is always 128-bit (16 bytes) per Meta's WhatsApp Flows specification
- The response IV is the **bitwise NOT** of the request IV (each byte XORed with 0xFF)
- The GCM authentication tag is the **last 16 bytes** of the encrypted payload (both request and response)
- Content-Type for the response must be `text/plain` (not `application/json`)

---

## CORS Configuration

The backend uses CORS to allow requests from specific origins:

```
Allowed origins (configured in server/src/index.js):
- http://localhost:5173        (local admin dev)
- https://whatsapp-land-verifier-1.onrender.com  (admin UI)
- https://whatsapp-land-verifier.onrender.com    (backend domain)

Allowed methods: GET, POST, OPTIONS
Allowed headers: Content-Type, x-admin-token
Credentials: true
```

To add additional origins, edit the `cors` configuration in `server/src/index.js`.

---

## Production Checklist

- [ ] **Set `ADMIN_TOKEN`** — Without it, admin endpoints are open to anyone
- [ ] **Set `PRIVATE_KEY` env var** — Required on Render; ensure the PEM content is complete (including header/footer)
- [ ] **Upload `public.pem` to Meta** — Meta must have your public key for Flow encryption to work
- [ ] **Tighten Supabase RLS policies** — The schema enables RLS but the service role bypasses it. Add policies if exposing Supabase directly
- [ ] **Verify webhook signatures** — Meta can sign webhook payloads; add signature validation for extra security
- [ ] **Validate Flow fields** — The backend accepts multiple field name variants; ensure your Flow's field names match the expected ones
- [ ] **Secure the admin UI** — Add HTTPS and IP allowlists for admin endpoints if needed
- [ ] **Monitor WhatsApp API limits** — Free tier has message sending limits; monitor for rate limiting
- [ ] **Set up logging** — Consider adding a logging service (e.g., Logtail, Papertrail) for production monitoring

---

## Files Overview

### Root
| File | Description |
|---|---|
| `generate-keys.js` | Utility to generate RSA key pair (public.pem + private.pem) |
| `README.md` | This documentation |

### Backend (`server/`)
| File | Description |
|---|---|
| `server/src/index.js` | Express app entry — mounts routes, CORS, body parsers |
| `server/src/config/env.js` | Environment variable validation and configuration |
| `server/src/routes/webhook.js` | Meta WhatsApp webhook (GET verify + POST receive) |
| `server/src/routes/whatsapp-flow.js` | WhatsApp Flows encrypted data exchange endpoint |
| `server/src/routes/admin.js` | Admin API (stats, submissions, verify, reject, message, export) |
| `server/src/services/supabase.js` | Supabase client and all DB operations |
| `server/src/services/whatsapp.js` | WhatsApp message sending (text + Flow interactive messages) |

### Admin UI (`admin/`)
| File | Description |
|---|---|
| `admin/src/App.tsx` | React app entry with routing |
| `admin/src/api.ts` | API client for backend calls |
| `admin/src/types.ts` | TypeScript type definitions |
| `admin/src/pages/Login.tsx` | Admin login page (token-based) |
| `admin/src/pages/Dashboard.tsx` | Statistics dashboard |
| `admin/src/pages/PendingSubmissions.tsx` | Pending submissions list |
| `admin/src/pages/AllSubmissions.tsx` | All submissions with filters/search |
| `admin/src/pages/SubmissionDetails.tsx` | Single submission detail with verify/reject actions |

### Database
| File | Description |
|---|---|
| `supabase/schema.sql` | Full PostgreSQL schema for Supabase |

---

## Troubleshooting

### Server starts in "limited mode"
→ Missing required env vars (`SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `WHATSAPP_TOKEN`, `WHATSAPP_PHONE_NUMBER_ID`). Check your `.env` file or Render env vars.

### Flow submissions not being saved
→ Verify the `private.pem` (or `PRIVATE_KEY` env var) matches the `public.pem` uploaded to Meta. Mismatched keys cause decryption failures.

### Meta webhook verification fails
→ Ensure the verify token in Meta settings matches the `WHATSAPP_TOKEN` env var exactly.
→ Ensure the callback URL is correctly formatted: `https://your-domain.com/webhook/whatsapp`

### Admin UI shows "Unauthorized"
→ If `ADMIN_TOKEN` is set on the backend, enter the same token in the admin login screen.
→ If `ADMIN_TOKEN` is not set, you can proceed without entering a token.

### WhatsApp message sending fails
→ Check that `WHATSAPP_TOKEN` is valid (not expired) and `WHATSAPP_PHONE_NUMBER_ID` is correct.
→ Verify the recipient's WhatsApp number is opted in (test numbers work with Meta test tokens).

### "private.pem not found" error
→ For local dev: Run `node generate-keys.js` to create the key files.
→ For production: Ensure `PRIVATE_KEY` env var is set with the full PEM content.
