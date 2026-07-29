const express = require('express');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const { sendWhatsAppMessage } = require('../services/whatsapp');
const { normalizeTenureType } = require('../utils/tenureType');

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

whatsappFlowRouter.post('/', async (req, res) => {
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

    // ----------------------------------------------------------------
    // 1) RSA decrypt the 128-bit AES key (OAEP with SHA-256)
    // ----------------------------------------------------------------
    const encryptedAesKeyBuf = Buffer.from(String(encryptedAesKeyB64), 'base64');

    const aesKey = crypto.privateDecrypt(
      {
        key: privatePem,
        padding: crypto.constants.RSA_PKCS1_OAEP_PADDING,
        oaepHash: 'sha256',
      },
      encryptedAesKeyBuf
    );

    // Meta always uses AES-128 (16-byte key) for WhatsApp Flows
    if (aesKey.length !== 16) {
      console.log('[/whatsapp-flow] WARNING: AES key is', aesKey.length, 'bytes (expected 16 for AES-128)');
      // Still proceed, but log the warning
    }

    // ----------------------------------------------------------------
    // 2) AES-128-GCM decrypt the request payload
    // ----------------------------------------------------------------
    const iv = Buffer.from(String(initialVectorB64), 'base64');
    console.log('[/whatsapp-flow] Request IV length:', iv.length, 'bytes');

    const encFlowBuf = Buffer.from(String(encryptedFlowDataB64), 'base64');

    // GCM authentication tag is the last 16 bytes
    const TAG_LENGTH = 16;
    const tag = encFlowBuf.subarray(encFlowBuf.length - TAG_LENGTH);
    const ciphertext = encFlowBuf.subarray(0, encFlowBuf.length - TAG_LENGTH);

    const decipher = crypto.createDecipheriv('aes-128-gcm', aesKey, iv);
    decipher.setAuthTag(tag);

    const decrypted = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
    const decryptedText = decrypted.toString('utf8');

    console.log('[/whatsapp-flow] Decrypted flow data:', decryptedText);

    // Parse decrypted JSON
    let decryptedObject = null;
    try {
      decryptedObject = JSON.parse(decryptedText);
      console.log('[/whatsapp-flow] Decrypted action:', decryptedObject?.action);
      console.log('[/whatsapp-flow] Decrypted screen:', decryptedObject?.screen);
      console.log('[/whatsapp-flow] Decrypted version:', decryptedObject?.version);
    } catch (parseErr) {
      console.log('[/whatsapp-flow] Failed to parse decrypted JSON:', parseErr.message);
    }

    // ----------------------------------------------------------------
    // 3) Handle data_exchange: save submitted form data
    // ----------------------------------------------------------------
    const action = decryptedObject?.action;
    const screen = decryptedObject?.screen || 'GREETING';
    const flowToken = decryptedObject?.flow_token;

    // Log all submitted form fields for debugging
    if (decryptedObject?.data) {
      console.log('[/whatsapp-flow] Submitted form data:', JSON.stringify(decryptedObject.data, null, 2));
    }

    // If this is a data_exchange (form submission), save to Supabase
    if (action === 'data_exchange' && decryptedObject?.data) {
      try {
        const { upsertLandSubmission } = require('../services/supabase');
        const data = decryptedObject.data;

        // Extract wa_id from flow_token pattern: landbot_{wa_id}_{timestamp}_{random}
        let extractedWaId = null;
        if (flowToken && typeof flowToken === 'string') {
          const parts = flowToken.split('_');
          // Format: landbot_{wa_id}_{timestamp}_{random}
          // wa_id is the second part (index 1)
          if (parts.length >= 2 && parts[0] === 'landbot') {
            extractedWaId = parts[1];
          }
        }
        // Also check if the submitted data contains wa_id or phone number
        const userWaId = data.wa_id || data.phone || data.phone_number || data.tel || extractedWaId || null;

        // --- Input Format Validation ---
        const plotNumber = String(data.plot_number || data.plotNumber || data.plot || '').trim();
        const firstName = data.first_name || data.firstName || data.given_name || null;
        const lastName = data.last_name || data.lastName || data.family_name || null;
        const nationalId = data.national_id || data.nationalId || data.id_number || null;
        const province = data.province || data.province_name || data.provinceName || data.fields?.province || data.fields?.province_name || data.fields?.provinceName || null;
        const district = data.district || data.district_name || data.districtName || data.fields?.district || data.fields?.district_name || data.fields?.districtName || null;
        const tenureType = normalizeTenureType(
          data.tenure_type || data.tenureType || data.farm_particulars_tenure_type || data.farmParticularsTenureType || data.fields?.tenure_type || data.fields?.tenureType || data.fields?.farm_particulars_tenure_type || data.fields?.farmParticularsTenureType || null
        );
        const tenureTypeOther = normalizeTenureType(
          data.tenure_type_other || data.tenureTypeOther || data.other_tenure_type || data.otherTenureType || data.fields?.tenure_type_other || data.fields?.tenureTypeOther || data.fields?.other_tenure_type || data.fields?.otherTenureType || null
        );
        const phoneNumber = userWaId;

        const validationErrors = [];

        // Validate plot_number: required, alphanumeric with dashes
        if (!plotNumber) {
          validationErrors.push('Plot number is required.');
        } else if (!/^[A-Za-z0-9\-/ ]{2,30}$/.test(plotNumber)) {
          validationErrors.push('Plot number format is invalid. Use letters, numbers, dashes, or slashes.');
        }

        // Validate national_id: Zimbabwe format XX-XXXXXXX-X-XX or similar
        if (nationalId && !/^\d{2}-\d{6,8}-\d{1,2}-\d{2}$/.test(nationalId) && !/^\d{6,10}[A-Za-z]?\d{0,2}$/.test(nationalId)) {
          validationErrors.push('National ID format is invalid. Expected format: 12-3456789-0-12 or similar.');
        }

        // Validate phone number: must be a number, at least 10 digits
        if (phoneNumber && !/^\d{10,15}$/.test(phoneNumber.replace(/[^0-9]/g, ''))) {
          validationErrors.push('Phone number format is invalid.');
        }

        // If validation errors, return them to the flow screen
        if (validationErrors.length > 0) {
          console.log('[/whatsapp-flow] Validation errors:', validationErrors);
          responseScreen = screen; // Stay on current screen
          responseDataObj = {
            status: 'error',
            errors: validationErrors,
            message: validationErrors.join('\n'),
          };
        } else {
          const submissionData = {
            plot_number: plotNumber,
            first_name: firstName,
            last_name: lastName,
            farm_name: data.farm_name || data.farmName || null,
            gender: data.gender || data.sex || null,
            province,
            district,
            tenure_type: tenureType,
            tenure_type_other: tenureTypeOther,
            national_id: nationalId,
            wa_id: userWaId,
            wa_flow_token: flowToken || null,
            raw_payload: decryptedObject,
          };

          if (submissionData.plot_number && (submissionData.first_name || submissionData.last_name)) {
            const row = await upsertLandSubmission(submissionData);
            console.log('[/whatsapp-flow] Submission saved from flow:', row?.id);

            // --- Send instant WhatsApp notification ---
            if (userWaId) {
              const name = [firstName, lastName].filter(Boolean).join(' ').trim() || 'there';
              try {
                await sendWhatsAppMessage({
                  toWaId: userWaId,
                  text: 'Thank you for the verification. We’ll let you know once the process is complete.',
                });
                console.log('[/whatsapp-flow] Instant notification sent to:', userWaId);
              } catch (notifyErr) {
                console.error('[/whatsapp-flow] Failed to send instant notification:', notifyErr.message);
              }
            }
          } else {
            console.log('[/whatsapp-flow] Incomplete submission data, skipping save');
            responseScreen = screen; // Stay on current screen
            responseDataObj = {
              status: 'error',
              message: 'Please fill in your plot number and name to complete the submission.',
            };
          }
        }
      } catch (saveErr) {
        console.error('[/whatsapp-flow] Error saving submission:', saveErr.message);
      }
    }

    // ----------------------------------------------------------------
    // 4) Build response data
    // ----------------------------------------------------------------
    // For data_exchange (form submission): navigate to SUCCESS screen
    // Meta Flow spec: response should contain screen + data object
    let responseScreen = screen;
    let responseDataObj = {};

    if (action === 'data_exchange') {
      // After successful form submission, navigate to the success/confirmation screen
      responseScreen = 'SUCCESS';
      responseDataObj = {
        status: 'success',
        message: 'Thank you for the verification. We’ll let you know once the process is complete.',
      };
    } else if (action === 'ping' || action === 'init') {
      // Health check or initial screen
      responseDataObj = {
        status: 'active',
      };
    } else {
      // Default: stay on current screen
      responseDataObj = {
        status: 'active',
      };
    }

    const responseData = {
      screen: responseScreen,
      data: responseDataObj,
    };
    const responseJson = JSON.stringify(responseData);
    console.log('[/whatsapp-flow] Response JSON to encrypt:', responseJson);

    // ----------------------------------------------------------------
    // 5) Encrypt response using AES-128-GCM with FLIPPED IV
    //    Meta spec: XOR each byte of the request IV with 0xFF
    // ----------------------------------------------------------------
    const flippedIv = Buffer.alloc(iv.length);
    for (let i = 0; i < iv.length; i++) {
      flippedIv[i] = ~iv[i] & 0xFF;  // XOR with 0xFF (bitwise NOT)
    }
    console.log('[/whatsapp-flow] Flipped IV (hex):', flippedIv.toString('hex'));

    const cipher = crypto.createCipheriv('aes-128-gcm', aesKey, flippedIv);
    const encryptedResponse = Buffer.concat([
      cipher.update(responseJson, 'utf8'),
      cipher.final(),
    ]);
    const authTag = cipher.getAuthTag();

    // Concatenate ciphertext + 16-byte auth tag
    const encryptedResponseWithTag = Buffer.concat([encryptedResponse, authTag]);

    // Base64 encode the result
    const encryptedBase64 = encryptedResponseWithTag.toString('base64');
    console.log('[/whatsapp-flow] Encrypted response Base64 length:', encryptedBase64.length);

    // ----------------------------------------------------------------
    // 6) Return encrypted response as plain text per Meta spec
    //    Meta expects: Content-Type: text/plain, body = Base64 string
    // ----------------------------------------------------------------
    res.setHeader('Content-Type', 'text/plain');
    return res.status(200).send(encryptedBase64);

  } catch (err) {
    console.log('[/whatsapp-flow] ERROR:', err.message);
    console.log('[/whatsapp-flow] Stack:', err.stack);
    return res.status(500).json({
      error: 'Failed to decrypt encrypted_flow_data with private.pem',
      message: err?.message || String(err),
    });
  }
});

module.exports = { whatsappFlowRouter };
