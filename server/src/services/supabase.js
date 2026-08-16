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
  province,
  district,
  tenure_type,
  tenure_type_other,
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
        province: province || existing.province,
        district: district || existing.district,
        tenure_type: tenure_type || existing.tenure_type,
        tenure_type_other: tenure_type_other || existing.tenure_type_other,
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
      province: province || null,
      district: district || null,
      tenure_type: tenure_type || null,
      tenure_type_other: tenure_type_other || null,
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

// Strip characters that have special meaning in PostgREST filter strings
// (commas, parentheses, dots, quotes) and in LIKE patterns, so user input
// cannot inject additional filter clauses.
function sanitizeSearchTerm(search) {
  return String(search || '')
    .trim()
    .replace(/[,()."'\\%_*]/g, '')
    .slice(0, 100);
}

const SORTABLE_COLUMNS = new Set([
  'created_at',
  'updated_at',
  'plot_number',
  'first_name',
  'last_name',
  'national_id',
  'status',
  'province',
  'district',
  'verified_at',
  'rejected_at',
]);

async function listAllSubmissions({ status, search, date_from, date_to, sort_by, sort_order, page, limit } = {}) {
  let query = supabase.from('land_submissions').select('*', { count: 'exact' });

  // Status filter
  if (status && status !== 'all') {
    query = query.eq('status', status);
  }

  // Search across multiple fields
  const sanitizedSearch = sanitizeSearchTerm(search);
  if (sanitizedSearch) {
    const term = `%${sanitizedSearch}%`;
    query = query.or(
      `plot_number.ilike.${term},first_name.ilike.${term},last_name.ilike.${term},national_id.ilike.${term},wa_id.ilike.${term},farm_name.ilike.${term},province.ilike.${term},district.ilike.${term},tenure_type.ilike.${term},tenure_type_other.ilike.${term},from_phone.ilike.${term}`
    );
  }

  // Date range
  if (date_from) {
    query = query.gte('created_at', date_from);
  }
  if (date_to) {
    query = query.lte('created_at', date_to);
  }

  // Sorting (whitelisted columns only)
  const sortField = SORTABLE_COLUMNS.has(sort_by) ? sort_by : 'created_at';
  const sortDir = sort_order === 'asc' ? { ascending: true } : { ascending: false };
  query = query.order(sortField, sortDir);

  // Pagination
  const pageNum = Math.max(1, parseInt(page || '1', 10) || 1);
  const limitNum = Math.min(100, Math.max(1, parseInt(limit || '20', 10) || 20));
  const offset = (pageNum - 1) * limitNum;
  query = query.range(offset, offset + limitNum - 1);

  const { data, error, count } = await query;
  if (error) throw error;
  return { items: data || [], total: count || 0, page: pageNum, limit: limitNum };
}

async function getDashboardStats() {
  // Get total counts by status
  const { data: statusCounts, error: statusError } = await supabase
    .from('land_submissions')
    .select('status');

  if (statusError) throw statusError;

  const total = statusCounts.length;
  const pending = statusCounts.filter(s => s.status === 'Pending').length;
  const verified = statusCounts.filter(s => s.status === 'Verified').length;
  const rejected = statusCounts.filter(s => s.status === 'Rejected').length;

  // Average turnaround time for verified submissions
  const { data: verifiedSubs, error: verifiedError } = await supabase
    .from('land_submissions')
    .select('created_at, verified_at')
    .eq('status', 'Verified')
    .not('verified_at', 'is', null);

  if (verifiedError) throw verifiedError;

  let avgTurnaroundHours = null;
  if (verifiedSubs && verifiedSubs.length > 0) {
    const totalHours = verifiedSubs.reduce((sum, sub) => {
      const created = new Date(sub.created_at).getTime();
      const verified = new Date(sub.verified_at).getTime();
      return sum + (verified - created) / (1000 * 60 * 60);
    }, 0);
    avgTurnaroundHours = Math.round((totalHours / verifiedSubs.length) * 10) / 10;
  }

  return {
    total,
    pending,
    verified,
    rejected,
    approvalRate: total > 0 ? Math.round((verified / total) * 100) : 0,
    rejectionRate: total > 0 ? Math.round((rejected / total) * 100) : 0,
    avgTurnaroundHours,
  };
}

async function getSubmissionsExport({ status, search, date_from, date_to } = {}) {
  let query = supabase.from('land_submissions').select('*');

  if (status && status !== 'all') {
    query = query.eq('status', status);
  }

  const sanitizedSearch = sanitizeSearchTerm(search);
  if (sanitizedSearch) {
    const term = `%${sanitizedSearch}%`;
    query = query.or(
      `plot_number.ilike.${term},first_name.ilike.${term},last_name.ilike.${term},national_id.ilike.${term},wa_id.ilike.${term}`
    );
  }

  if (date_from) {
    query = query.gte('created_at', date_from);
  }
  if (date_to) {
    query = query.lte('created_at', date_to);
  }

  query = query.order('created_at', { ascending: false });

  const { data, error } = await query;
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
  listAllSubmissions,
  getDashboardStats,
  getSubmissionsExport,
  setSubmissionStatus,
};
