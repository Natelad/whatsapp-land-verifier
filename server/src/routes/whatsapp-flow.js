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
function normalizePem(value) {
  if (value === undefined || value === null) return '';
  let normalized = String(value).trim();
  if (normalized.includes('\\n')) {
    normalized = normalized.replace(/\\r\\n/g, '\r\n').replace(/\\n/g, '\n');
  }
  return normalized;
}

function loadPrivatePem() {
  // 1) Check env var first (Render / production)
  if (process.env.PRIVATE_KEY) {
    const key = normalizePem(process.env.PRIVATE_KEY);
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

function parseRequestBody(rawBody) {
  if (Buffer.isBuffer(rawBody)) {
    const asText = rawBody.toString('utf8').trim();
    if (!asText) return {};
    try {
      return JSON.parse(asText);
    } catch (err) {
      console.warn('[/whatsapp-flow] Failed to parse request body as JSON:', err.message);
      return {};
    }
  }

  if (rawBody instanceof Uint8Array) {
    return parseRequestBody(Buffer.from(rawBody));
  }

  if (typeof rawBody === 'string') {
    const asText = rawBody.trim();
    if (!asText) return {};
    try {
      return JSON.parse(asText);
    } catch (err) {
      console.warn('[/whatsapp-flow] Failed to parse request body as JSON:', err.message);
      return {};
    }
  }

  if (typeof rawBody === 'object' && rawBody !== null) {
    return rawBody;
  }

  return {};
}

function normalizeFlowFieldName(fieldName) {
  if (fieldName === undefined || fieldName === null) return '';
  return String(fieldName)
    .trim()
    .toLowerCase()
    .replace(/[\s\-()]+/g, '_')
    .replace(/[^a-z0-9_]/g, '');
}

function normalizeFlowData(rawData) {
  if (!rawData || typeof rawData !== 'object') return {};

  if (Array.isArray(rawData)) {
    return rawData.reduce((acc, item) => {
      if (!item || typeof item !== 'object') return acc;

      const key =
        item.name ||
        item.id ||
        item.field ||
        item.field_name ||
        item.field_id ||
        item.label ||
        item.label_name ||
        item?.metadata?.name ||
        item?.payload?.name;

      let value = item.value ?? item.text ?? item?.payload?.text ?? item?.payload?.value;
      if (value && typeof value === 'object') {
        value = value.text ?? value.value ?? value.display_text ?? value.number ?? JSON.stringify(value);
      }

      if (key) {
        acc[normalizeFlowFieldName(key)] = value;
      }
      return acc;
    }, {});
  }

  if (rawData.fields) {
    return normalizeFlowData(rawData.fields);
  }

  if (rawData.field_data) {
    return normalizeFlowData(rawData.field_data);
  }

  return Object.entries(rawData).reduce((acc, [key, value]) => {
    acc[normalizeFlowFieldName(key)] = value;
    return acc;
  }, {});
}

// Meta "ping" health check for WhatsApp Flows.
// Render will be hit to confirm the backend is awake and properly configured.
whatsappFlowRouter.get('/', (req, res) => {
  return res.status(200).json({ data: { status: 'active' } });
});

async function handleEncryptedFlowPayload(body) {
  const encryptedFlowDataB64 = body.encrypted_flow_data;
  const encryptedAesKeyB64 = body.encrypted_aes_key;
  const initialVectorB64 = body.initial_vector;

  if (!encryptedFlowDataB64 || !encryptedAesKeyB64 || !initialVectorB64) {
    throw new Error('Missing encrypted flow payload fields');
  }

  const privatePem = loadPrivatePem();
  const encryptedAesKeyBuf = Buffer.from(String(encryptedAesKeyB64), 'base64');

  const aesKey = crypto.privateDecrypt(
    {
      key: privatePem,
      padding: crypto.constants.RSA_PKCS1_OAEP_PADDING,
      oaepHash: 'sha256',
    },
    encryptedAesKeyBuf
  );

  if (aesKey.length !== 16) {
    console.log('[/whatsapp-flow] WARNING: AES key is', aesKey.length, 'bytes (expected 16 for AES-128)');
  }

  const iv = Buffer.from(String(initialVectorB64), 'base64');
  console.log('[/whatsapp-flow] Request IV length:', iv.length, 'bytes');

  const encFlowBuf = Buffer.from(String(encryptedFlowDataB64), 'base64');
  const TAG_LENGTH = 16;
  const tag = encFlowBuf.subarray(encFlowBuf.length - TAG_LENGTH);
  const ciphertext = encFlowBuf.subarray(0, encFlowBuf.length - TAG_LENGTH);

  const decipher = crypto.createDecipheriv('aes-128-gcm', aesKey, iv);
  decipher.setAuthTag(tag);

  const decrypted = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
  const decryptedText = decrypted.toString('utf8');

  console.log('[/whatsapp-flow] Decrypted flow data:', decryptedText);

  let decryptedObject = null;
  try {
    decryptedObject = JSON.parse(decryptedText);
    console.log('[/whatsapp-flow] Decrypted action:', decryptedObject?.action);
    console.log('[/whatsapp-flow] Decrypted screen:', decryptedObject?.screen);
    console.log('[/whatsapp-flow] Decrypted version:', decryptedObject?.version);
  } catch (parseErr) {
    console.log('[/whatsapp-flow] Failed to parse decrypted JSON:', parseErr.message);
    throw parseErr;
  }

  const action = decryptedObject?.action;
  const screen = decryptedObject?.screen || 'GREETING';
  const flowToken = decryptedObject?.flow_token;

  if (decryptedObject?.data) {
    console.log('[/whatsapp-flow] Submitted form data:', JSON.stringify(decryptedObject.data, null, 2));
  }

  let responseScreen = screen;
  let responseDataObj = {};

  if (action === 'data_exchange' && decryptedObject?.data) {
    try {
      const { upsertLandSubmission } = require('../services/supabase');
      const data = normalizeFlowData(decryptedObject.data);

      let extractedWaId = null;
      if (flowToken && typeof flowToken === 'string') {
        const parts = flowToken.split('_');
        if (parts.length >= 2 && parts[0] === 'landbot') {
          extractedWaId = parts[1];
        }
      }
      const userWaId = data.wa_id || data.phone || data.phone_number || data.tel || extractedWaId || null;

      const plotNumber = String(
        data.plot_number ||
        data.plotnumber ||
        data.plot ||
        data.plot_farm_number ||
        data.plotfarmnumber ||
        data.title_deed ||
        data.deed ||
        ''
      ).trim();
      const firstName =
        data.first_name ||
        data.firstname ||
        data.given_name ||
        data.givenname ||
        data.name_first ||
        data.namefirst ||
        null;
      const lastName =
        data.last_name ||
        data.lastname ||
        data.family_name ||
        data.familyname ||
        data.name_last ||
        data.namelast ||
        null;
      const fullName =
        data.name ||
        data.full_name ||
        data.fullname ||
        data.owner_name ||
        data.ownername ||
        data.contact_name ||
        data.contactname ||
        null;
      const nationalId =
        data.national_id ||
        data.nationalid ||
        data.id_number ||
        data.identification_farm_id ||
        data.identificationfarmid ||
        data.identification ||
        data.farm_id ||
        null;
      const province =
        data.province ||
        data.province_name ||
        data.provincename ||
        data.fields?.province ||
        data.fields?.province_name ||
        data.fields?.provinceName ||
        null;
      const district =
        data.district ||
        data.district_name ||
        data.districtname ||
        data.fields?.district ||
        data.fields?.district_name ||
        data.fields?.districtName ||
        null;
      const tenureType = normalizeTenureType(
        data.tenure_type || data.tenureType || data.farm_particulars_tenure_type || data.farmParticularsTenureType || data.fields?.tenure_type || data.fields?.tenureType || data.fields?.farm_particulars_tenure_type || data.fields?.farmParticularsTenureType || null
      );
      const tenureTypeOther = normalizeTenureType(
        data.tenure_type_other || data.tenureTypeOther || data.other_tenure_type || data.otherTenureType || data.fields?.tenure_type_other || data.fields?.tenureTypeOther || data.fields?.other_tenure_type || data.fields?.otherTenureType || null
      );
      const phoneNumber = userWaId;

      const validationErrors = [];
      if (!plotNumber) {
        validationErrors.push('Plot number is required.');
      } else if (!/^[A-Za-z0-9\-/ ]{2,30}$/.test(plotNumber)) {
        validationErrors.push('Plot number format is invalid. Use letters, numbers, dashes, or slashes.');
      }
      if (nationalId && !/^\d{2}-\d{6,8}-\d{1,2}-\d{2}$/.test(nationalId) && !/^\d{6,10}[A-Za-z]?\d{0,2}$/.test(nationalId)) {
        validationErrors.push('National ID format is invalid. Expected format: 12-3456789-0-12 or similar.');
      }
      if (phoneNumber && !/^\d{10,15}$/.test(String(phoneNumber).replace(/[^0-9]/g, ''))) {
        validationErrors.push('Phone number format is invalid.');
      }

      if (validationErrors.length > 0) {
        console.log('[/whatsapp-flow] Validation errors:', validationErrors);
        responseScreen = screen;
        responseDataObj = {
          status: 'error',
          errors: validationErrors,
          message: validationErrors.join('\n'),
        };
      } else {
        const submissionData = {
          plot_number: plotNumber,
          first_name: firstName || (fullName ? fullName.split(' ')[0] : null),
          last_name: lastName || (fullName ? fullName.split(' ').slice(1).join(' ') : null),
          farm_name: data.farm_name || data.farmName || data.farmname || null,
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
          responseScreen = 'SUCCESS';
          responseDataObj = {
            status: 'success',
            message: 'Thank you for the verification. We’ll let you know once the process is complete.',
          };
          if (userWaId) {
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
          console.log('[/whatsapp-flow] Field debug:', {
            plotNumber,
            firstName,
            lastName,
            fullName,
            dataKeys: Object.keys(data || {}),
          });
          responseScreen = screen;
          responseDataObj = {
            status: 'error',
            message: 'Please fill in your plot number and name to complete the submission.',
          };
        }
      }
    } catch (saveErr) {
      console.error('[/whatsapp-flow] Error saving submission:', saveErr);
      responseScreen = screen;
      responseDataObj = {
        status: 'error',
        message: 'We could not save your submission. Please try again shortly.',
      };
    }
  } else if (action === 'data_exchange') {
    console.warn('[/whatsapp-flow] data_exchange received without form data');
    responseDataObj = {
      status: 'error',
      message: 'No form data was received. Please fill in the form and try again.',
    };
  } else {
    responseDataObj = { status: 'active' };
  }

  const responseData = {
    screen: responseScreen,
    data: responseDataObj,
  };
  const responseJson = JSON.stringify(responseData);
  console.log('[/whatsapp-flow] Response JSON to encrypt:', responseJson);

  const flippedIv = Buffer.alloc(iv.length);
  for (let i = 0; i < iv.length; i++) {
    flippedIv[i] = ~iv[i] & 0xFF;
  }
  console.log('[/whatsapp-flow] Flipped IV (hex):', flippedIv.toString('hex'));

  const cipher = crypto.createCipheriv('aes-128-gcm', aesKey, flippedIv);
  const encryptedResponse = Buffer.concat([
    cipher.update(responseJson, 'utf8'),
    cipher.final(),
  ]);
  const authTag = cipher.getAuthTag();

  const encryptedResponseWithTag = Buffer.concat([encryptedResponse, authTag]);
  const encryptedBase64 = encryptedResponseWithTag.toString('base64');
  console.log('[/whatsapp-flow] Encrypted response Base64 length:', encryptedBase64.length);

  return {
    status: 200,
    contentType: 'text/plain',
    body: encryptedBase64,
  };
}

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
  const body = parseRequestBody(req.body);
  const encryptedFlowDataB64 = body.encrypted_flow_data;
  const encryptedAesKeyB64 = body.encrypted_aes_key;
  const initialVectorB64 = body.initial_vector;

  // Health-check / ping: be tolerant to Meta's exact payload shape.
  if (!encryptedFlowDataB64 || !encryptedAesKeyB64 || !initialVectorB64) {
    if (looksLikePing(body)) {
      return res.status(200).json({ data: { status: 'active' } });
    }

    console.log('[/whatsapp-flow] non-encrypted POST received. Parsed body:', body);
    console.log('[/whatsapp-flow] keys:', Object.keys(body));

    return res.status(501).json({
      error: 'Ping endpoint works, but flow processing/decryption is not implemented for this payload shape.',
      receivedAction: body.action || body.type || body.event || body?.request?.action || body?.data?.action || null,
      receivedKeys: Object.keys(body),
    });
  }

  try {
    const response = await handleEncryptedFlowPayload(body);
    res.setHeader('Content-Type', response.contentType);
    return res.status(response.status).send(response.body);
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