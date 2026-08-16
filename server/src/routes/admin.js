const express = require('express');
const { listPendingSubmissions, listAllSubmissions, getSubmissionById, getDashboardStats, getSubmissionsExport, setSubmissionStatus } = require('../services/supabase');
const { sendWhatsAppMessage } = require('../services/whatsapp');

const { config } = require('../config/env');
const { safeEqual } = require('../utils/security');

const adminRouter = express.Router();

// Simple shared secret protection (recommended to replace with real auth later)
function requireAdminToken(req, res, next) {
  if (!config.ADMIN_TOKEN) {
    // Fail closed: never expose admin endpoints without a configured token.
    return res.status(503).json({ error: 'Admin API unavailable: ADMIN_TOKEN is not configured' });
  }
  const token = req.headers['x-admin-token'] || '';
  if (!safeEqual(token, config.ADMIN_TOKEN)) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  return next();
}

adminRouter.use((req, res, next) => {
  // Allow CORS preflight requests without admin auth
  if (req.method === 'OPTIONS') return res.sendStatus(204)
  return requireAdminToken(req, res, next)
})

// Dashboard stats
adminRouter.get('/stats', async (req, res) => {
  try {
    const stats = await getDashboardStats();
    return res.status(200).json({ ok: true, stats });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Server error' });
  }
});

// List all submissions with filters, search, pagination
adminRouter.get('/submissions', async (req, res) => {
  try {
    const { status, search, date_from, date_to, sort_by, sort_order, page, limit } = req.query;

    // If no specific filters and no all-status requested, default to pending for backward compat
    const filters = {
      status: status || 'all',
      search: search || '',
      date_from: date_from || '',
      date_to: date_to || '',
      sort_by: sort_by || 'created_at',
      sort_order: sort_order || 'desc',
      page: page || '1',
      limit: limit || '50',
    };

    const result = await listAllSubmissions(filters);
    return res.status(200).json({ ok: true, ...result });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Server error' });
  }
});

// Quote a CSV field and neutralize spreadsheet formula injection
// (values starting with =, +, -, @, tab, or CR are prefixed with a quote).
function csvField(value) {
  const str = String(value ?? '');
  const escaped = /^[=+\-@\t\r]/.test(str) ? `'${str}` : str;
  return `"${escaped.replace(/"/g, '""')}"`;
}

// Export submissions as CSV
adminRouter.get('/export', async (req, res) => {
  try {
    const { status, search, date_from, date_to } = req.query;
    const items = await getSubmissionsExport({ status, search, date_from, date_to });

    // Build CSV
    const headers = [
      'ID', 'Plot Number', 'First Name', 'Last Name', 'National ID',
      'Farm Name', 'Gender', 'Province', 'District', 'Tenure Type', 'Tenure Type Other', 'WhatsApp ID', 'From Phone',
      'Status', 'Verified By', 'Verified At', 'Rejected By',
      'Rejected At', 'Rejection Reason', 'Created At', 'Updated At'
    ];

    const csvRows = [headers.join(',')];

    for (const item of items) {
      const row = [
        item.id,
        csvField(item.plot_number || ''),
        csvField(item.first_name || ''),
        csvField(item.last_name || ''),
        csvField(item.national_id || ''),
        csvField(item.farm_name || ''),
        csvField(item.gender || ''),
        csvField(item.province || ''),
        csvField(item.district || ''),
        csvField(item.tenure_type || ''),
        csvField(item.tenure_type_other || ''),
        csvField(item.wa_id || ''),
        csvField(item.from_phone || ''),
        item.status,
        csvField(item.verified_by || ''),
        item.verified_at || '',
        csvField(item.rejected_by || ''),
        item.rejected_at || '',
        csvField(item.rejection_reason || ''),
        item.created_at,
        item.updated_at,
      ];
      csvRows.push(row.join(','));
    }

    const csv = csvRows.join('\n');
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="land-submissions-export-${Date.now()}.csv"`);
    return res.status(200).send(csv);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Server error' });
  }
});

// Send custom WhatsApp message to submission owner
adminRouter.post('/submissions/:id/message', async (req, res) => {
  try {
    const { id } = req.params;
    const { message } = req.body;

    if (!message || !message.trim()) {
      return res.status(400).json({ error: 'Message text is required' });
    }

    const submission = await getSubmissionById(id);
    if (!submission) return res.status(404).json({ error: 'Submission not found' });

    const toWaId = submission.wa_id;
    const name = [submission.first_name, submission.last_name].filter(Boolean).join(' ').trim() || 'there';
    const plot = submission.plot_number;

    const text = `Hi ${name}, regarding your submission for Plot ${plot}:\n\n${message.trim()}`;

    try {
      await sendWhatsAppMessage({ toWaId, text });
    } catch (e) {
      console.error('WhatsApp send failed:', e.message || e);
      return res.status(502).json({ error: `WhatsApp send failed: ${e.message}` });
    }

    return res.status(200).json({ ok: true, message: 'Message sent successfully' });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Server error' });
  }
});

// Pending submissions (backward compatible)
adminRouter.get('/submissions/pending', async (req, res) => {
  try {
    const limit = Number(req.query.limit || 50);
    const rows = await listPendingSubmissions(limit);
    return res.status(200).json({ ok: true, items: rows });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Server error' });
  }
});

adminRouter.post('/submissions/:id/verify', async (req, res) => {
  try {
    const { id } = req.params;
    const admin_name = req.body?.admin_name || 'Bank Admin';

    const submission = await getSubmissionById(id);
    if (!submission) return res.status(404).json({ error: 'Submission not found' });

    if (submission.status !== 'Pending') {
      return res.status(409).json({ error: `Cannot verify submission in status ${submission.status}` });
    }

    const updated = await setSubmissionStatus({
      id,
      status: 'Verified',
      admin_name,
    });

    // Notify user
    const toWaId = submission.wa_id;
    const text = 'Thank you! Your details have been verified.';

    // Best-effort: don't fail the whole request if WhatsApp send fails
    try {
      await sendWhatsAppMessage({ toWaId, text });
    } catch (e) {
      console.error('WhatsApp notify failed:', e.message || e);
    }

    return res.status(200).json({ ok: true, submission: updated });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Server error' });
  }
});

adminRouter.post('/submissions/:id/reject', async (req, res) => {
  try {
    const { id } = req.params;
    const admin_name = req.body?.admin_name || 'Bank Admin';
    const rejection_reason = req.body?.rejection_reason || 'Not verified';

    const submission = await getSubmissionById(id);
    if (!submission) return res.status(404).json({ error: 'Submission not found' });

    if (submission.status !== 'Pending') {
      return res.status(409).json({ error: `Cannot reject submission in status ${submission.status}` });
    }

    const updated = await setSubmissionStatus({
      id,
      status: 'Rejected',
      admin_name,
      rejection_reason,
    });

    // Notify user
    const toWaId = submission.wa_id;
    const text = 'Thank you for your submission. If the request is rejected, our team will contact you for verification.';

    try {
      await sendWhatsAppMessage({ toWaId, text });
    } catch (e) {
      console.error('WhatsApp notify failed:', e.message || e);
    }

    return res.status(200).json({ ok: true, submission: updated });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Server error' });
  }
});

module.exports = { adminRouter };
