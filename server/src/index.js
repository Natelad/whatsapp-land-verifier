require('dotenv').config();
const express = require('express');
const helmet = require('helmet');

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

// Meta webhook payloads are JSON
app.use(express.json({ limit: '2mb' }));

app.get('/healthz', (req, res) => {
  res.status(200).json({ ok: true });
});

if (webhookRouter) {
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
