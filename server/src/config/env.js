const required = (name) => {
  const v = process.env[name];
  if (!v) throw new Error(`Missing required env var: ${name}`);
  return v;
};

const config = {
  PORT: process.env.PORT ? Number(process.env.PORT) : 8080,

  SUPABASE_URL: required('SUPABASE_URL'),
  SUPABASE_SERVICE_ROLE_KEY: required('SUPABASE_SERVICE_ROLE_KEY'),

  // Admin access secret. If not set, /admin is open (dev convenience).
  // For production, set ADMIN_TOKEN in Render env vars.
  ADMIN_TOKEN: process.env.ADMIN_TOKEN,

  // Meta WhatsApp Cloud API
  // Example: https://graph.facebook.com/v20.0/{WABA_PHONE_NUMBER_ID}/messages
  WHATSAPP_GRAPH_API_VERSION: process.env.WHATSAPP_GRAPH_API_VERSION || '20.0',
  WHATSAPP_TOKEN: required('WHATSAPP_TOKEN'),
  WHATSAPP_PHONE_NUMBER_ID: required('WHATSAPP_PHONE_NUMBER_ID'),

  // WhatsApp Flows - the Flow ID from WhatsApp Manager
  WHATSAPP_FLOW_ID: process.env.WHATSAPP_FLOW_ID || '1030716066135048',
};

module.exports = { config };
