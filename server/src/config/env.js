const required = (name) => {
  const v = process.env[name];
  if (!v) throw new Error(`Missing required env var: ${name}`);
  return v;
};

const config = {
  PORT: process.env.PORT ? Number(process.env.PORT) : 8080,

  SUPABASE_URL: required('SUPABASE_URL'),
  SUPABASE_SERVICE_ROLE_KEY: required('SUPABASE_SERVICE_ROLE_KEY'),

  // Meta WhatsApp Cloud API
  // Example: https://graph.facebook.com/v20.0/{WABA_PHONE_NUMBER_ID}/messages
  WHATSAPP_GRAPH_API_VERSION: process.env.WHATSAPP_GRAPH_API_VERSION || '20.0',
  WHATSAPP_TOKEN: required('WHATSAPP_TOKEN'),
  WHATSAPP_PHONE_NUMBER_ID: required('WHATSAPP_PHONE_NUMBER_ID'),
};

module.exports = { config };
