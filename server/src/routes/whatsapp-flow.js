const express = require('express');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const whatsappFlowRouter = express.Router();

/**
 * Load Render secret file: private.pem
 * Auto-detect whether it ends up at:
 * - process.cwd()/private.pem  (often "server/")
 * - ../../private.pem          (repo root)
 */
function loadPrivatePem() {
  const candidates = [
    path.join(process.cwd(), 'private.pem'),
    path.join(__dirname, '../../private.pem'),
  ];

  const lastErr = { message: 'private.pem not found in expected locations' };
  for (const p of candidates) {
    try {
      if (fs.existsSync(p)) return fs.readFileSync(p, 'utf8');
    } catch (err) {
      lastErr.message = err.message || String(err);
    }
  }
  throw new Error(lastErr.message);
}

// Meta "ping" health check for WhatsApp Flows.
// Render will be hit to confirm the backend is awake and properly configured.
whatsappFlowRouter.get('/', (req, res) => {
  return res.status(200).json({ data: { status: 'active' } });
});

whatsappFlowRouter.post('/', (req, res) => {
  // express.raw middleware may leave req.body as a Buffer.
  // If so, attempt best-effort JSON parsing.
  let body = req.body || {};
  if (Buffer.isBuffer(body)) {
    const asText = body.toString('utf8').trim();
    try {
      body = asText ? JSON.parse(asText) : {};
    } catch {
      body = {};
    }
  }

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

  // Expected encrypted payload shape (per your provided spec)
  // {
  //   encrypted_flow_data: base64 string (ciphertext + 16-byte tag appended at end),
  //   encrypted_aes_key: base64 string (RSA-OAEP SHA-256 encrypted AES key),
  //   initial_vector: base64 string (used as IV for AES-128-GCM)
  // }
  const encryptedFlowDataB64 = body.encrypted_flow_data;
  const encryptedAesKeyB64 = body.encrypted_aes_key;
  const initialVectorB64 = body.initial_vector;

  if (!encryptedFlowDataB64 || !encryptedAesKeyB64 || !initialVectorB64) {
    return res.status(501).json({
      error:
        'Ping endpoint works, but flow processing/decryption is not implemented for this payload shape.',
      receivedAction: action || null,
      receivedKeys: Object.keys(body),
    });
  }

  try {
    const privatePem = loadPrivatePem();

    // 1) RSA decrypt AES key
    const encryptedAesKey = Buffer.from(String(encryptedAesKeyB64), 'base64');

    const aesKey = crypto.privateDecrypt(
      {
        key: privatePem,
        padding: crypto.constants.RSA_PKCS1_OAEP_PADDING,
        oaepHash: 'sha256',
      },
      encryptedAesKey
    );

    if (aesKey.length !== 16) {
      return res.status(400).json({
        error: 'Decryption failed: AES key is not 16 bytes (AES-128 expected).',
        aesKeyLength: aesKey.length,
      });
    }

    // 2) AES-128-GCM decrypt flow data
    const iv = Buffer.from(String(initialVectorB64), 'base64');

    const encFlowBuf = Buffer.from(String(encryptedFlowDataB64), 'base64');
    if (encFlowBuf.length < 16) {
      return res.status(400).json({
        error: 'Decryption failed: encrypted_flow_data too short to contain GCM tag.',
        length: encFlowBuf.length,
      });
    }

    const tag = encFlowBuf.subarray(encFlowBuf.length - 16);
    const ciphertext = encFlowBuf.subarray(0, encFlowBuf.length - 16);

    const decipher = crypto.createDecipheriv('aes-128-gcm', aesKey, iv);
    decipher.setAuthTag(tag);

    const decrypted = Buffer.concat([decipher.update(ciphertext), decipher.final()]);

    const decryptedText = decrypted.toString('utf8');

    // Best-effort parse JSON
    let decryptedObject = null;
    try {
      decryptedObject = JSON.parse(decryptedText);
    } catch {
      decryptedObject = null;
    }

    return res.status(200).json({
      data: { status: 'active' },
      decrypted: decryptedObject ?? decryptedText,
    });
  } catch (err) {
    return res.status(500).json({
      error: 'Failed to decrypt encrypted_flow_data with private.pem',
      message: err?.message || String(err),
    });
  }
});

module.exports = { whatsappFlowRouter };
