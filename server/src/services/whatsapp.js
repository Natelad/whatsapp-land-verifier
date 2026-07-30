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
async function buildTemplatePayload({ toWaId, languageCode, headerType, headerImageUrl, headerText, bodyText, footerText }) {
  const components = [];
  const normalizedHeaderType = String(headerType || '').trim().toUpperCase();

  if (normalizedHeaderType === 'IMAGE' && headerImageUrl) {
    components.push({
      type: 'header',
      parameters: [
        {
          type: 'image',
          image: {
            link: headerImageUrl,
          },
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

  const languageCode = config.WHATSAPP_TEMPLATE_LANGUAGE_CODE;
  const envHeaderType = String(config.WHATSAPP_TEMPLATE_HEADER_TYPE || '').trim().toUpperCase();
  const envHeaderImageUrl = String(config.WHATSAPP_TEMPLATE_HEADER_IMAGE_URL || '').trim();
  const envHeaderText = String(config.WHATSAPP_TEMPLATE_HEADER_TEXT || '').trim();
  const envBodyText = String(config.WHATSAPP_TEMPLATE_BODY_TEXT || '').trim();
  const envFooterText = String(config.WHATSAPP_TEMPLATE_FOOTER_TEXT || '').trim();

  const fallbackImageUrl = 'https://via.placeholder.com/512.png?text=Land+Verification';
  const defaultBodyText = 'Applicant';

  const candidates = [];

  if (envHeaderType || envHeaderImageUrl || envHeaderText || envBodyText || envFooterText) {
    candidates.push({
      headerType: envHeaderType,
      headerImageUrl: envHeaderImageUrl,
      headerText: envHeaderText,
      bodyText: envBodyText,
      footerText: envFooterText,
    });
  }

  candidates.push({});
  candidates.push({ bodyText: defaultBodyText });
  candidates.push({ headerType: 'TEXT', headerText: 'Land Verification', bodyText: defaultBodyText });
  candidates.push({ headerType: 'IMAGE', headerImageUrl: fallbackImageUrl, bodyText: defaultBodyText });
  candidates.push({ headerType: 'TEXT', headerText: 'Land Verification' });
  candidates.push({ headerType: 'IMAGE', headerImageUrl: fallbackImageUrl });
  candidates.push({ bodyText: defaultBodyText, footerText: 'Thank you' });

  const tried = new Set();
  let lastError;

  for (const candidate of candidates) {
    const key = JSON.stringify(candidate);
    if (tried.has(key)) continue;
    tried.add(key);

    const payload = await buildTemplatePayload({
      toWaId,
      languageCode,
      ...candidate,
    });

    const { res, body } = await postWhatsAppPayload(payload);
    if (res.ok) {
      console.log('[WhatsApp Flow] Template message sent successfully to', toWaId, 'language:', languageCode, 'payload:', JSON.stringify(payload));
      return body;
    }

    lastError = body?.error;
    const details = body?.error?.error_data?.details || body?.error?.message || '';
    console.error('[WhatsApp Flow] Attempt failed:', JSON.stringify(payload, null, 2));
    console.error('[WhatsApp Flow] Error response:', JSON.stringify(body, null, 2));

    if (details.includes('expected IMAGE') && !candidate.headerImageUrl) {
      candidates.push({ headerType: 'IMAGE', headerImageUrl: fallbackImageUrl, bodyText: defaultBodyText });
      continue;
    }
    if (details.includes('expected TEXT') && !candidate.headerText) {
      candidates.push({ headerType: 'TEXT', headerText: 'Land Verification', bodyText: defaultBodyText });
      continue;
    }
    if (details.includes('number of localizable_params') && details.includes('expected number of params (1)') && !candidate.bodyText) {
      candidates.push({ bodyText: defaultBodyText });
      continue;
    }
    if (details.includes('number of localizable_params') && details.includes('expected number of params (0)') && candidate.bodyText) {
      continue;
    }
    if (details.includes('Format mismatch') && details.includes('header') && !candidate.headerType) {
      candidates.push({ headerType: 'IMAGE', headerImageUrl: fallbackImageUrl, bodyText: defaultBodyText });
      candidates.push({ headerType: 'TEXT', headerText: 'Land Verification', bodyText: defaultBodyText });
      continue;
    }
  }

  const msg = lastError?.message || 'WhatsApp flow send failed after trying template payload variants';
  throw new Error(msg);
}


module.exports = {
  sendWhatsAppMessage,
  sendWhatsAppFlowMessage,
};
