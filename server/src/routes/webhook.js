const express = require('express');
const crypto = require('crypto');
const { upsertLandSubmission } = require('../services/supabase');
const { sendWhatsAppFlowMessage } = require('../services/whatsapp');
const { config } = require('../config/env');
const { normalizeTenureType } = require('../utils/tenureType');

const webhookRouter = express.Router();

/**
 * WhatsApp Cloud API Webhook payload shapes vary depending on product:
 * - message received / interactive flow submission events
 *
 * This scaffold accepts JSON and tries to extract:
 * - wa_id (sender id)
 * - plot_number, owner_name, national_id (from flow submission fields)
 * - message id / flow token (if present)
 *
 * You will likely adjust the mapping once you see a real webhook payload from Meta.
 */
function extractSubmissionFromMeta(payload) {
  // Common structure for WhatsApp Cloud:
  // payload.entry[0].changes[0].value.messages[0]...
  const entry = payload?.entry?.[0];
  const change = entry?.changes?.[0];
  const value = change?.value;

  // Try message-based extraction
  const message = value?.messages?.[0];
  const from = message?.from; // wa_id in many cases
  const wa_message_id = message?.id;

  // Interactive / flows submission might be under message.interactive
  // or under message?.button / list etc.
  const flow = message?.interactive?.flow;
  const flow_token = flow?.token;

  function normalizeFlowData(rawData) {
    if (!rawData) return {};

    if (Array.isArray(rawData)) {
      return rawData.reduce((acc, item) => {
        if (!item || typeof item !== 'object') return acc;

        const key =
          item.name ||
          item.id ||
          item.field ||
          item.field_name ||
          item.field_id ||
          item?.metadata?.name ||
          item?.payload?.name ||
          item.type;

        let value = item.value ?? item.text ?? item?.payload?.text ?? item?.payload?.value;
        if (value && typeof value === 'object') {
          value =
            value.text ??
            value.value ??
            value.display_text ??
            value.number ??
            JSON.stringify(value);
        }

        if (key && value !== undefined) {
          acc[key] = value;
        }
        return acc;
      }, {});
    }

    if (typeof rawData === 'object') {
      if (rawData.fields) {
        return normalizeFlowData(rawData.fields);
      }
      if (rawData.field_data) {
        return normalizeFlowData(rawData.field_data);
      }
      return rawData;
    }

    return {};
  }

  let data = normalizeFlowData(flow?.submission?.data || flow?.submission || flow?.submission?.fields || flow?.submission?.field_data || {});
  if (Array.isArray(data)) {
    data = normalizeFlowData(data);
  }

  const textPlot =
    data?.plot_number ||
    data?.plotNumber ||
    data?.plot ||
    data?.title_deed ||
    data?.deed ||
    data?.titleDeed ||
    data?.fields?.plot_number;

  const textFirstName =
    data?.first_name ||
    data?.firstName ||
    data?.given_name ||
    data?.givenName ||
    data?.name_first ||
    data?.fields?.first_name ||
    data?.fields?.firstName ||
    data?.fields?.given_name ||
    data?.fields?.givenName;

  const textLastName =
    data?.last_name ||
    data?.lastName ||
    data?.family_name ||
    data?.familyName ||
    data?.name_last ||
    data?.fields?.last_name ||
    data?.fields?.lastName ||
    data?.fields?.family_name ||
    data?.fields?.familyName;

  const textFarmName =
    data?.farm_name ||
    data?.farmName ||
    data?.fields?.farm_name ||
    data?.fields?.farmName;

  const textGender =
    data?.gender ||
    data?.sex ||
    data?.fields?.gender ||
    data?.fields?.sex;

  const textNationalId =
    data?.national_id ||
    data?.nationalId ||
    data?.id_number ||
    data?.fields?.national_id;

  const textProvince =
    data?.province ||
    data?.province_name ||
    data?.provinceName ||
    data?.fields?.province ||
    data?.fields?.province_name ||
    data?.fields?.provinceName;

  const textDistrict =
    data?.district ||
    data?.district_name ||
    data?.districtName ||
    data?.fields?.district ||
    data?.fields?.district_name ||
    data?.fields?.districtName;

  const textTenureType = normalizeTenureType(
    data?.tenure_type ||
      data?.tenureType ||
      data?.farm_particulars_tenure_type ||
      data?.farmParticularsTenureType ||
      data?.fields?.tenure_type ||
      data?.fields?.tenureType ||
      data?.fields?.farm_particulars_tenure_type ||
      data?.fields?.farmParticularsTenureType
  );

  const textTenureTypeOther = normalizeTenureType(
    data?.tenure_type_other ||
      data?.tenureTypeOther ||
      data?.other_tenure_type ||
      data?.otherTenureType ||
      data?.fields?.tenure_type_other ||
      data?.fields?.tenureTypeOther ||
      data?.fields?.other_tenure_type ||
      data?.fields?.otherTenureType
  );

  // Meta may include contact/phone
  // Depending on webhook type, identifier may be in `message.from` (wa_id) or in contacts.
  const from_phone =
    message?.from ||
    message?.contacts?.[0]?.wa_id ||
    message?.contacts?.[0]?.phone?.number ||
    value?.contacts?.[0]?.wa_id ||
    value?.contacts?.[0]?.phone?.number ||
    null;

  // wa_id may also appear in contacts or in flow submission payload fields
  const inferredWaId =
    from ||
    message?.contacts?.[0]?.wa_id ||
    message?.contacts?.[0]?.phone?.number ||
    value?.contacts?.[0]?.wa_id ||
    value?.contacts?.[0]?.phone?.number ||
    data?.wa_id ||
    data?.phone ||
    data?.phone_number ||
    data?.tel ||
    null;

  // wa_id is required for replying; we also store raw payload for later debugging
  return {
    wa_id: inferredWaId || null,
    from_phone,
    first_name: textFirstName || null,
    last_name: textLastName || null,
    farm_name: textFarmName || null,
    gender: textGender || null,
    national_id: textNationalId || null,
    plot_number: textPlot || null,
    wa_message_id: wa_message_id || null,
    wa_flow_token: flow_token || null,
    raw_payload: payload || {},
  };
}

webhookRouter.use((req, res, next) => {
  console.log('[Webhook] Incoming request:', req.method, req.originalUrl);
  next();
});

webhookRouter.get(['/', '/whatsapp'], (req, res) => {
  // Meta webhook verification handshake:
  // ?hub.mode=subscribe&hub.verify_token=...&hub.challenge=...
  const mode = req.query['hub.mode'];
  const verifyToken = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];

  try {
    // Require env at runtime; server won't mount routes if env is invalid.
    // eslint-disable-next-line global-require
    const { config } = require('../config/env');
    if (mode === 'subscribe' && verifyToken === config.WHATSAPP_TOKEN) {
      return res.status(200).send(String(challenge || ''));
    }
    return res.status(403).send('Verification failed');
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('Webhook verification config error:', err);
    return res.status(500).send('Server error');
  }
});

/**
 * Check if the incoming webhook payload is a text message (not a flow submission).
 */
function isTextMessage(payload) {
  const message = payload?.entry?.[0]?.changes?.[0]?.value?.messages?.[0];
  if (!message) return false;
  // Text messages have type === 'text'
  return message.type === 'text' && message.text?.body;
}

/**
 * Extract the text body and sender wa_id from a text message payload.
 */
function extractTextMessage(payload) {
  const entry = payload?.entry?.[0];
  const change = entry?.changes?.[0];
  const value = change?.value;
  const message = value?.messages?.[0];
  return {
    wa_id: message?.from || null,
    text: message?.text?.body || null,
    wa_message_id: message?.id || null,
  };
}

webhookRouter.post(['/', '/whatsapp'], async (req, res) => {
  try {
    // Always respond with 200 to Meta to acknowledge receipt
    // (Meta will retry if we don't respond quickly)
    res.status(200).json({ ok: true });

    // Handle asynchronously after responding to Meta
    setImmediate(async () => {
      try {
        // Check if this is a text message (like "hi")
        if (isTextMessage(req.body)) {
          const { wa_id, text, wa_message_id } = extractTextMessage(req.body);
          console.log(`[Webhook] Text message from ${wa_id}: "${text}"`);

          if (wa_id) {
            // Generate a unique flow token for this session
            const flowToken = `landbot_${wa_id}_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;

            console.log(`[Webhook] Sending Flow to ${wa_id} with token ${flowToken}`);
            await sendWhatsAppFlowMessage({
              toWaId: wa_id,
              flowId: config.WHATSAPP_FLOW_ID,
              flowToken,
            });
            console.log(`[Webhook] Flow sent successfully to ${wa_id}`);
          }
          return;
        }

        // Otherwise, process as a flow submission
        const extracted = extractSubmissionFromMeta(req.body || {});
        console.log('[Webhook] Flow submission received:', {
          wa_id: extracted.wa_id,
          plot_number: extracted.plot_number,
          first_name: extracted.first_name,
          last_name: extracted.last_name,
        });

        const {
          wa_id,
          plot_number,
          first_name,
          last_name,
          farm_name,
          gender,
          national_id,
          province,
          district,
          wa_message_id,
          wa_flow_token,
          from_phone,
          raw_payload,
        } = extracted;

        if (!wa_id) {
          console.warn('[Webhook] Missing wa_id in flow submission');
          return;
        }

        if (!plot_number && !first_name && !last_name && !national_id && !farm_name && !gender && !province && !district) {
          console.warn('[Webhook] No meaningful flow submission data found; skipping save');
          return;
        }

        if (!plot_number) {
          console.warn('[Webhook] Missing plot_number in flow submission; saving partial submission');
        }

        const row = await upsertLandSubmission({
          plot_number: plot_number ? String(plot_number).trim() : null,
          first_name: first_name ? String(first_name).trim() : null,
          last_name: last_name ? String(last_name).trim() : null,
          farm_name: farm_name ? String(farm_name).trim() : null,
          gender: gender ? String(gender).trim() : null,
          national_id: national_id ? String(national_id).trim() : null,
          province: province ? String(province).trim() : null,
          district: district ? String(district).trim() : null,
          wa_id: String(wa_id).trim(),
          from_phone: from_phone ? String(from_phone).trim() : null,
          wa_message_id,
          wa_flow_token,
          raw_payload,
        });

        console.log(`[Webhook] Submission saved: ${row.id}`);
      } catch (innerErr) {
        console.error('[Webhook] Async processing error:', innerErr);
      }
    });
  } catch (err) {
    console.error('[Webhook] Error:', err);
    // We already sent 200, so nothing more to do
  }
});

module.exports = { webhookRouter };
