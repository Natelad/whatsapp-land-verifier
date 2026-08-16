require('dotenv').config();
const express = require('express');
const helmet = require('helmet');
const cors = require('cors');

let adminRouter = null
let webhookRouter = null
let port = 8080

try {
  // env validation happens inside config/env.js
  const { config } = require('./config/env')
  port = config.PORT || 8080

  // Load routers only after env is valid
  ;({ adminRouter } = require('./routes/admin'))
  ;({ webhookRouter } = require('./routes/webhook'))
} catch (err) {
  // eslint-disable-next-line no-console
  console.warn(
    'landbot-server starting in limited mode (missing env vars). /healthz will work; /webhook and /admin will not be mounted.'
  )
}
const app = express()
app.use(helmet())

// Log every incoming request so webhook traffic can be confirmed in Render logs.
app.use((req, res, next) => {
  console.log('[Request] incoming', req.method, req.originalUrl)
  next()
})

// CORS (needed for browser preflight and for x-admin-token header)
app.use(
  cors({
    origin: [
      // local dev (if you run admin locally)
      'http://localhost:5173',
      // render admin UI domain (yours)
      'https://whatsapp-land-verifier-1.onrender.com',
      // also allow the backend domain itself
      'https://whatsapp-land-verifier.onrender.com',
    ],
    methods: ['GET', 'POST', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'x-admin-token'],
    credentials: true,
  })
)

/**
 * Route-specific body parsing:
 * /whatsapp-flow must not crash on non-JSON bodies, since Meta ping payloads
 * can sometimes arrive in formats that break strict JSON parsing.
 * Using express.text() gives us a string that the router can parse as JSON.
 */
app.use(
  '/whatsapp-flow',
  express.raw({ type: '*/*', limit: '2mb' })
)

// Meta webhook payloads are JSON (configured later, after /whatsapp-flow is mounted)

// Explicit OPTIONS 204 for any route (preflight)
app.options('*', (req, res) => res.sendStatus(204))

app.get('/healthz', (req, res) => {
  res.status(200).json({ ok: true });
});


/**
 * WhatsApp Flows health check endpoint
 * Meta will call this path to ensure the server is awake/configured.
 */
app.use('/whatsapp-flow', require('./routes/whatsapp-flow').whatsappFlowRouter)

if (webhookRouter) {
  // Meta webhook payloads are JSON (webhook endpoint only).
  // Keep the raw body so the webhook route can validate X-Hub-Signature-256.
  app.use(
    express.json({
      limit: '2mb',
      verify: (req, res, buf) => {
        req.rawBody = buf
      },
    })
  );
  // WhatsApp/Meta webhook endpoint(s)
  app.use('/webhook', webhookRouter)
}

if (adminRouter) {
  // Admin endpoints (used by admin UI)
  app.use('/admin', adminRouter)
}

app.listen(port, () => {
  // eslint-disable-next-line no-console
  console.log(`landbot-server listening on http://localhost:${port}`);
});
