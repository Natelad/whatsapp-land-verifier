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
async function buildTemplatePayload({ toWaId, languageCode, headerType, headerImageUrl, headerImageId, headerText, bodyText, footerText, buttonFlowToken }) {
  const components = [];
  const normalizedHeaderType = String(headerType || '').trim().toUpperCase();
  const normalizedHeaderImageId = String(headerImageId || '').trim();
  const normalizedHeaderImageUrl = String(headerImageUrl || '').trim();

  if (normalizedHeaderType === 'IMAGE' && (normalizedHeaderImageId || normalizedHeaderImageUrl)) {
    const imagePayload = {};
    if (normalizedHeaderImageId) {
      imagePayload.id = normalizedHeaderImageId;
    } else {
      imagePayload.link = normalizedHeaderImageUrl;
    }

    components.push({
      type: 'header',
      parameters: [
        {
          type: 'image',
          image: imagePayload,
        },
      ],
    });
  } else if (normalizedHeaderType === 'TEXT' && headerText) {
    components.push({
      type: 'header',
      parameters: [
        {
          type: 'text',
          text: headerText,
        },
      ],
    });
  }

  if (bodyText) {
    components.push({
      type: 'body',
      parameters: [
        {
          type: 'text',
          text: bodyText,
        },
      ],
    });
  }

  if (footerText) {
    components.push({
      type: 'footer',
      parameters: [
        {
          type: 'text',
          text: footerText,
        },
      ],
    });
  }

  if (buttonFlowToken) {
    components.push({
      type: 'button',
      sub_type: 'flow',
      index: '0',
      parameters: [
        {
          type: 'action',
          action: {
            flow_token: buttonFlowToken,
            flow_action_data: {},
          },
        },
      ],
    });
  }

  const payload = {
    messaging_product: 'whatsapp',
    to: toWaId,
    type: 'template',
    template: {
      name: config.WHATSAPP_TEMPLATE_NAME,
      language: {
        code: languageCode,
      },
    },
  };

  if (components.length > 0) {
    payload.template.components = components;
  }

  return payload;
}

async function sendWhatsAppFlowMessage({ toWaId, flowId, flowToken }) {
  if (!toWaId) throw new Error('sendWhatsAppFlowMessage: toWaId is required');
  if (!flowId) throw new Error('sendWhatsAppFlowMessage: flowId is required');
  if (!flowToken) throw new Error('sendWhatsAppFlowMessage: flowToken is required');

  const headerImageUrl = String(config.WHATSAPP_FLOW_HEADER_IMAGE_URL || '').trim();
  const bodyText = String(config.WHATSAPP_FLOW_BODY_TEXT || 'Hello! 👋\n\nPlease tap the "View Flow" button below to begin your land verification process. Ensure you have your property details ready.').trim();
  const footerText = String(config.WHATSAPP_FLOW_FOOTER_TEXT || 'Thank you! Powered by NA').trim() || 'Thank you! Powered by NA';
  const flowCta = String(config.WHATSAPP_FLOW_ACTION_CTA || 'View Flow').trim() || 'View Flow';
  const flowStartScreen = String(config.WHATSAPP_FLOW_START_SCREEN || '').trim();

  const interactive = {
    type: 'flow',
    body: {
      text: bodyText,
    },
    footer: {
      text: footerText,
    },
    action: {
      name: 'flow',
      parameters: {
        flow_message_version: '3',
        flow_token: flowToken,
        flow_id: flowId,
        flow_cta: flowCta,
        flow_action: 'navigate',
        flow_action_payload: flowStartScreen ? { screen: flowStartScreen } : {},
      },
    },
  };

  if (headerImageUrl) {
    interactive.header = {
      type: 'image',
      image: {
        link: headerImageUrl,
      },
    };
  }

  const payload = {
    messaging_product: 'whatsapp',
    recipient_type: 'individual',
    to: toWaId,
    type: 'interactive',
    interactive,
  };

  const { res, body } = await postWhatsAppPayload(payload);
  if (!res.ok) {
    console.error('[WhatsApp Flow] Full error response:', JSON.stringify(body, null, 2));
    console.error('[WhatsApp Flow] Request payload sent:', JSON.stringify(payload, null, 2));
    const msg = body?.error?.message || `WhatsApp flow send failed with status ${res.status}`;
    throw new Error(msg);
  }

  console.log('[WhatsApp Flow] Interactive flow message sent successfully to', toWaId);
  console.log('[WhatsApp Flow] WhatsApp API response:', JSON.stringify(body, null, 2));
  console.log('[WhatsApp Flow] Request payload sent:', JSON.stringify(payload, null, 2));
  return body;
}


module.exports = {
  sendWhatsAppMessage,
  sendWhatsAppFlowMessage,
};
