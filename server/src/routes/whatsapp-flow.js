const express = require('express');

const whatsappFlowRouter = express.Router();

// Meta "ping" health check for WhatsApp Flows.
// Render will be hit to confirm the backend is awake and properly configured.
whatsappFlowRouter.get('/', (req, res) => {
  return res.status(200).json({ data: { status: 'active' } });
});

whatsappFlowRouter.post('/', (req, res) => {
  const body = req.body || {};

  // Commonly Meta sends something like: { action: "ping" } or similar.
  // We accept a few variants to be tolerant.
  const action =
    body.action ||
    body.type ||
    body.event ||
    body?.request?.action ||
    body?.data?.action;

  if (action === 'ping' || action === 'PING' || body?.ping === true) {
    return res.status(200).json({ data: { status: 'active' } });
  }

  // If Meta is sending actual encrypted/interactive flow payloads,
  // decryption logic is not present in this repo yet, so we fail gracefully.
  return res.status(501).json({
    error: 'Ping endpoint works, but flow processing/decryption is not implemented in this backend scaffold.',
    receivedAction: action || null,
  });
});

module.exports = { whatsappFlowRouter };
