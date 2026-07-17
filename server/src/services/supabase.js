const { createClient } = require('@supabase/supabase-js');
const { config } = require('../config/env');

const supabase = createClient(config.SUPABASE_URL, config.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

async function upsertLandSubmission({
  plot_number,
  first_name,
  last_name,
  farm_name,
  gender,
  national_id,
  wa_id,
  from_phone,
  wa_message_id,
  wa_flow_token,
  raw_payload,
}) {
  // We key by (wa_id, plot_number). To keep this scaffold simple, we implement "upsert"
  // by first checking existence, then update or insert.
  const { data: existing, error: lookupError } = await supabase
    .from('land_submissions')
    .select('*')
    .eq('wa_id', wa_id)
    .eq('plot_number', plot_number)
    .maybeSingle();

  if (lookupError) throw lookupError;

  if (existing) {
    const { data, error } = await supabase
      .from('land_submissions')
      .update({
        first_name: first_name || existing.first_name,
        last_name: last_name || existing.last_name,
        farm_name: farm_name || existing.farm_name,
        gender: gender || existing.gender,
        national_id: national_id || existing.national_id,
        from_phone: from_phone || existing.from_phone,
        wa_message_id: wa_message_id || existing.wa_message_id,
        wa_flow_token: wa_flow_token || existing.wa_flow_token,
        raw_payload: raw_payload || existing.raw_payload,
        status: 'Pending',
      })
      .eq('id', existing.id)
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  const { data, error } = await supabase
    .from('land_submissions')
    .insert({
      plot_number,
      first_name: first_name || null,
      last_name: last_name || null,
      farm_name: farm_name || null,
      gender: gender || null,
      national_id: national_id || null,
      wa_id,
      from_phone: from_phone || null,
      status: 'Pending',
      wa_message_id: wa_message_id || null,
      wa_flow_token: wa_flow_token || null,
      raw_payload: raw_payload || {},
    })
    .select()
    .single();

  if (error) throw error;
  return data;
}

async function getSubmissionById(id) {
  const { data, error } = await supabase
    .from('land_submissions')
    .select('*')
    .eq('id', id)
    .single();

  if (error) throw error;
  return data;
}

async function listPendingSubmissions(limit = 50) {
  const { data, error } = await supabase
    .from('land_submissions')
    .select('*')
    .eq('status', 'Pending')
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) throw error;
  return data || [];
}

async function setSubmissionStatus({ id, status, admin_name, rejection_reason }) {
  const patch = {
    status,
    updated_at: new Date().toISOString(),
  };

  if (status === 'Verified') {
    patch.verified_by = admin_name || null;
    patch.verified_at = new Date().toISOString();
    patch.rejection_reason = null;
    patch.rejected_by = null;
    patch.rejected_at = null;
  }

  if (status === 'Rejected') {
    patch.rejected_by = admin_name || null;
    patch.rejected_at = new Date().toISOString();
    patch.rejection_reason = rejection_reason || null;
    patch.verified_by = null;
    patch.verified_at = null;
  }

  const { data, error } = await supabase
    .from('land_submissions')
    .update(patch)
    .eq('id', id)
    .select()
    .single();

  if (error) throw error;
  return data;
}

module.exports = {
  supabase,
  upsertLandSubmission,
  getSubmissionById,
  listPendingSubmissions,
  setSubmissionStatus,
};
