const express = require('express');
const { upsertLandSubmission } = require('../services/supabase');

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

  // Fields can be in flow.submission.data
  const data = flow?.submission?.data || flow?.submission || {};
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

  // Meta may include contact/phone
  const from_phone = value?.contacts?.[0]?.wa_id || null;

  // wa_id is required for replying; we also store raw payload for later debugging
  return {
    wa_id: from,
    from_phone,
    first_name: textFirstName,
    last_name: textLastName,
    farm_name: textFarmName,
    gender: textGender,
    national_id: textNationalId,
    plot_number: textPlot,
    wa_message_id: wa_message_id || null,
    wa_flow_token: flow_token || null,
    raw_payload: payload || {},
  };
}

webhookRouter.post('/whatsapp', async (req, res) => {
  try {
    const {
      wa_id,
      plot_number,
      first_name,
      last_name,
      farm_name,
      gender,
      national_id,
      wa_message_id,
      wa_flow_token,
      from_phone,
      raw_payload,
    } = extractSubmissionFromMeta(req.body || {});

    if (!wa_id) {
      return res.status(400).json({ error: 'Missing wa_id in webhook payload' });
    }
    if (!plot_number) {
      return res.status(400).json({ error: 'Missing plot_number in flow submission payload' });
    }

    const row = await upsertLandSubmission({
      plot_number: String(plot_number).trim(),
      first_name: first_name ? String(first_name).trim() : null,
      last_name: last_name ? String(last_name).trim() : null,
      farm_name: farm_name ? String(farm_name).trim() : null,
      gender: gender ? String(gender).trim() : null,
      national_id: national_id ? String(national_id).trim() : null,
      wa_id: String(wa_id).trim(),
      from_phone: from_phone ? String(from_phone).trim() : null,
      wa_message_id,
      wa_flow_token,
      raw_payload,
    });

    return res.status(200).json({ ok: true, submission_id: row.id });
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('Webhook error:', err);
    return res.status(500).json({ error: err.message || 'Server error' });
  }
});

module.exports = { webhookRouter };
