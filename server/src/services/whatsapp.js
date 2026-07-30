const { config } = require('../config/env');

function requireEnv(name) {
  const v = process.env[name];
  if (!v) throw new Error(`Missing required env var: ${name}`);
  return v;
}

async function postWhatsAppPayload(payload) {
  const url = `https://graph.facebook.com/v${config.WHATSAPP_GRAPH_API_VERSION}/${config.WHATSAPP_PHONE_NUMBER_ID}/messages`;
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${config.WHATSAPP_TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  const body = await res.json().catch(() => ({}));
  return { res, body };
}

async function sendWhatsAppMessage({ toWaId, text }) {
  if (!toWaId) throw new Error('sendWhatsAppMessage: toWaId is required');
  if (!text) throw new Error('sendWhatsAppMessage: text is required');

  const payload = {
    messaging_product: 'whatsapp',
    to: toWaId,
    type: 'text',
    text: { body: text },
  };

  const { res, body } = await postWhatsAppPayload(payload);
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
async function sendWhatsAppFlowMessage({ toWaId, flowId, flowToken }) {
  if (!toWaId) throw new Error('sendWhatsAppFlowMessage: toWaId is required');
  if (!flowId) throw new Error('sendWhatsAppFlowMessage: flowId is required');
  if (!flowToken) throw new Error('sendWhatsAppFlowMessage: flowToken is required');

  const languageCode = config.WHATSAPP_TEMPLATE_LANGUAGE_CODE;

  const payload = {
    messaging_product: 'whatsapp',
    to: toWaId,
    type: 'template',
    template: {
      name: config.WHATSAPP_TEMPLATE_NAME,
      language: {
        code: languageCode,
      },
      components: [
        {
          type: 'body',
          parameters: [
            {
              type: 'text',
              text: config.WHATSAPP_TEMPLATE_BODY_TEXT || 'Applicant',
            },
          ],
        },
      ],
    },
  };

  const { res, body } = await postWhatsAppPayload(payload);
  if (!res.ok) {
    console.error('[WhatsApp Flow] Full error response:', JSON.stringify(body, null, 2));
    console.error('[WhatsApp Flow] Request payload sent:', JSON.stringify(payload, null, 2));
    const msg = body?.error?.message || `WhatsApp flow send failed with status ${res.status}`;
    throw new Error(msg);
  }

  console.log('[WhatsApp Flow] Template message sent successfully to', toWaId, 'language:', languageCode, 'response:', JSON.stringify(body));
  return body;
}

module.exports = {
  sendWhatsAppMessage,
  sendWhatsAppFlowMessage,
};
