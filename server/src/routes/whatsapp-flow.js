const express = require('express');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const whatsappFlowRouter = express.Router();


/**
 * Load the RSA private key.
 * Priority:
 * 1. PRIVATE_KEY environment variable (Render)
 * 2. private.pem file on disk (local dev)
 */
function loadPrivatePem() {
  // 1) Check env var first (Render / production)
  if (process.env.PRIVATE_KEY) {
    const key = process.env.PRIVATE_KEY.trim();
    if (key.includes('BEGIN')) return key;
    throw new Error('PRIVATE_KEY env var does not contain a valid PEM header');
  }

  // 2) Fallback to private.pem file on disk
  const candidates = [
    path.join(process.cwd(), 'private.pem'),
    path.join(__dirname, '../../private.pem'),
  ];

  const lastErr = { message: 'private.pem not found in expected locations and PRIVATE_KEY env var not set' };
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

function hasKey(obj, key) {
  if (!obj || typeof obj !== 'object') return false;
  if (Object.prototype.hasOwnProperty.call(obj, key)) return true;
  return false;
}

function containsPingToken(v) {
  if (v === null || v === undefined) return false;
  if (typeof v === 'string') return v.toLowerCase().includes('ping');
  if (typeof v === 'number' || typeof v === 'boolean') return false;
  if (Array.isArray(v)) return v.some(containsPingToken);
  if (typeof v === 'object') return Object.values(v).some(containsPingToken);
  return false;
}

function looksLikePing(body) {
  if (!body || typeof body !== 'object') return false;

  // Direct common variants
  const action =
    body.action ||
    body.type ||
    body.event ||
    body?.request?.action ||
    body?.data?.action;

  if (typeof action === 'string' && action.toLowerCase() === 'ping') return true;
  if (body?.ping === true) return true;

  // If Meta sends some nested structure with "ping" token anywhere
  if (containsPingToken(body)) return true;

  // If it looks like a health check but not an encrypted payload, treat as ping
  if (
    (hasKey(body, 'health_check') || hasKey(body, 'healthCheck') || hasKey(body, 'status')) &&
    !('encrypted_flow_data' in body || 'encrypted_aes_key' in body || 'initial_vector' in body)
  ) {
    return true;
  }

  return false;
}

whatsappFlowRouter.post('/', (req, res) => {
  // express.raw middleware may leave req.body as a Buffer.
  // If so, attempt best-effort JSON parsing.
  let body = req.body || {};
  // DEBUG: confirm what express.raw is giving us for the ping request
  try {
    console.log('[/whatsapp-flow] DEBUG req.body type:', typeof req.body, 'isBuffer:', Buffer.isBuffer(req.body));
    if (Buffer.isBuffer(req.body)) {
      console.log('[/whatsapp-flow] DEBUG raw Buffer length:', req.body.length);
      console.log('[/whatsapp-flow] DEBUG raw Buffer head:', req.body.slice(0, 80).toString('utf8'));
    } else if (req.body instanceof Uint8Array) {
      console.log('[/whatsapp-flow] DEBUG raw Uint8Array length:', req.body.length);
    }
  } catch {}
  // express.raw may produce Buffer or Uint8Array depending on runtime.
  if (Buffer.isBuffer(body)) {
    const asText = body.toString('utf8').trim();
    try {
      body = asText ? JSON.parse(asText) : {};
    } catch {
      body = {};
    }
  } else if (body instanceof Uint8Array) {
    const asText = Buffer.from(body).toString('utf8').trim();
    try {
      body = asText ? JSON.parse(asText) : {};
    } catch {
      body = {};
    }
  } else if (typeof body === 'string') {
    const asText = body.trim();
    console.log('[/whatsapp-flow] DEBUG string body length:', asText.length, 'content:', asText);
    try {
      body = asText ? JSON.parse(asText) : {};
    } catch (e) {
      console.log('[/whatsapp-flow] DEBUG JSON parse error:', e.message);
      body = {};
    }
  }

  const encryptedFlowDataB64 = body.encrypted_flow_data;
  const encryptedAesKeyB64 = body.encrypted_aes_key;
  const initialVectorB64 = body.initial_vector;

  // Health-check / ping: be tolerant to Meta's exact payload shape.
  if (!encryptedFlowDataB64 || !encryptedAesKeyB64 || !initialVectorB64) {
    if (looksLikePing(body)) {
      return res.status(200).json({ data: { status: 'active' } });
    }

    // TEMP DEBUG: helps identify Meta's exact health-check payload shape
    console.log('[/whatsapp-flow] non-encrypted POST received. Parsed body:', body);
    console.log('[/whatsapp-flow] keys:', Object.keys(body));

    return res.status(501).json({
      error:
        'Ping endpoint works, but flow processing/decryption is not implemented for this payload shape.',
      receivedAction:
        body.action || body.type || body.event || body?.request?.action || body?.data?.action || null,
      receivedKeys: Object.keys(body),
    });
  }

  try {
    const privatePem = loadPrivatePem();

    // 1) RSA decrypt AES key
    const encryptedAesKeyBuf = Buffer.from(String(encryptedAesKeyB64), 'base64');

    const aesKey = crypto.privateDecrypt(
      {
        key: privatePem,
        padding: crypto.constants.RSA_PKCS1_OAEP_PADDING,
        oaepHash: 'sha256',
      },
      encryptedAesKeyBuf
    );

    // Meta uses AES-256 (32-byte key). Accept 16/24/32 for AES-128/192/256.
    if (![16, 24, 32].includes(aesKey.length)) {
      return res.status(400).json({
        error: 'Decryption failed: AES key length is invalid.',
        aesKeyLength: aesKey.length,
      });
    }

    // Determine AES cipher algorithm based on key length
    const aesAlgo = `aes-${aesKey.length * 8}-gcm`;

    // 2) AES-GCM decrypt flow data
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

    const decipher = crypto.createDecipheriv(aesAlgo, aesKey, iv);
    decipher.setAuthTag(tag);

    const decrypted = Buffer.concat([decipher.update(ciphertext), decipher.final()]);

    const decryptedText = decrypted.toString('utf8');

    // DEBUG: Log the decrypted request data
    console.log('[/whatsapp-flow] Decrypted flow data:', decryptedText);

    // Best-effort parse JSON
    let decryptedObject = null;
    try {
      decryptedObject = JSON.parse(decryptedText);
      console.log('[/whatsapp-flow] Decrypted object action:', decryptedObject?.action);
      console.log('[/whatsapp-flow] Decrypted object screen:', decryptedObject?.screen);
      console.log('[/whatsapp-flow] Decrypted object data:', JSON.stringify(decryptedObject?.data));
    } catch {
      decryptedObject = null;
    }

    // Build the response data to encrypt
    // Include version and screen from the request if available
    const responseData = {
      version: decryptedObject?.version || '1.0',
      data: {
        status: 'active',
      },
    };
    if (decryptedObject?.screen) {
      responseData.screen = decryptedObject.screen;
    }
    const responseJson = JSON.stringify(responseData);
    console.log('[/whatsapp-flow] Response data to encrypt:', responseJson);

    // 3) Encrypt the response using AES-GCM with the same AES key
    // Generate a new random IV for the response (12 bytes standard for GCM)
    const responseIv = crypto.randomBytes(12);
    console.log('[/whatsapp-flow] AES algorithm:', aesAlgo, 'key length:', aesKey.length, 'bytes');
    console.log('[/whatsapp-flow] Response IV (hex):', responseIv.toString('hex'));
    
    const cipher = crypto.createCipheriv(aesAlgo, aesKey, responseIv);
    const encryptedResponse = Buffer.concat([
      cipher.update(responseJson, 'utf8'),
      cipher.final(),
    ]);
    const authTag = cipher.getAuthTag();

    // Concatenate ciphertext + auth tag (Meta expects tag appended to ciphertext)
    const encryptedResponseWithTag = Buffer.concat([encryptedResponse, authTag]);

    console.log('[/whatsapp-flow] Encrypted response length:', encryptedResponseWithTag.length);
    console.log('[/whatsapp-flow] Response Base64 length:', encryptedResponseWithTag.toString('base64').length);

    // Return encrypted response
    // Meta WhatsApp Flows expects JSON response:
    //   encrypted_flow_data: Base64-encoded ciphertext + GCM tag
    //   encrypted_aes_key: echo back the same encrypted AES key from the request
    //   initial_vector: Base64-encoded new IV used for response encryption
    return res.status(200).json({
      encrypted_flow_data: encryptedResponseWithTag.toString('base64'),
      encrypted_aes_key: encryptedAesKeyB64,
      initial_vector: responseIv.toString('base64'),
    });
  } catch (err) {
    return res.status(500).json({
      error: 'Failed to decrypt encrypted_flow_data with private.pem',
      message: err?.message || String(err),
    });
  }
});

module.exports = { whatsappFlowRouter };
