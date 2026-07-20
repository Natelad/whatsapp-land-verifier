const { config } = require('../config/env');

function requireEnv(name) {
  const v = process.env[name];
  if (!v) throw new Error(`Missing required env var: ${name}`);
  return v;
}

async function sendWhatsAppMessage({ toWaId, text }) {
  if (!toWaId) throw new Error('sendWhatsAppMessage: toWaId is required');
  if (!text) throw new Error('sendWhatsAppMessage: text is required');

  // Meta Cloud API call
  // POST https://graph.facebook.com/{version}/{WABA_PHONE_NUMBER_ID}/messages
  // with Bearer token.
  const url = `https://graph.facebook.com/v20.0/${config.WHATSAPP_PHONE_NUMBER_ID}/messages`;

  const payload = {
    messaging_product: 'whatsapp',
    to: toWaId,
    type: 'text',
    text: { body: text },
  };

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${config.WHATSAPP_TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg = body?.error?.message || `WhatsApp send failed with status ${res.status}`;
    throw new Error(msg);
  }
  return body;
}

/**
 * Send a WhatsApp Flows interactive message to trigger a flow.
 * The flow will call the /whatsapp-flow endpoint for data exchange.
 *
 * @param {Object} params
 * @param {string} params.toWaId - The recipient's WhatsApp ID
 * @param {string} params.flowId - The Flow ID from WhatsApp Manager
 * @param {string} params.flowToken - A unique flow token (session identifier)
 * @param {Object} params.flowData - Optional data to pass to the flow's first screen
 */
async function sendWhatsAppFlowMessage({ toWaId, flowId, flowToken, flowData = {} }) {
  if (!toWaId) throw new Error('sendWhatsAppFlowMessage: toWaId is required');
  if (!flowId) throw new Error('sendWhatsAppFlowMessage: flowId is required');
  if (!flowToken) throw new Error('sendWhatsAppFlowMessage: flowToken is required');

  const url = `https://graph.facebook.com/v20.0/${config.WHATSAPP_PHONE_NUMBER_ID}/messages`;

  const payload = {
    messaging_product: 'whatsapp',
    recipient_type: 'individual',
    to: toWaId,
    type: 'interactive',
    interactive: {
      type: 'flow',
      header: {
        type: 'text',
        text: 'Land Verification Form',
      },
      body: {
        text: 'Please fill out the land verification form to proceed.',
      },
      footer: {
        text: 'Powered by Landbot',
      },
      action: {
        name: 'flow',
        parameters: {
          flow_message_version: '3',
          flow_token: flowToken,
          flow_id: flowId,
          flow_cta: 'Open Form',
          flow_action: 'data_exchange',
          flow_action_payload: {
            screen: 'INIT',
            data: flowData,
          },
        },
      },
    },
  };

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${config.WHATSAPP_TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg = body?.error?.message || `WhatsApp flow send failed with status ${res.status}`;
    throw new Error(msg);
  }
  return body;
}

module.exports = {
  sendWhatsAppMessage,
  sendWhatsAppFlowMessage,
};
