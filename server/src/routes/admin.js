const express = require('express');
const { listPendingSubmissions, getSubmissionById, setSubmissionStatus } = require('../services/supabase');
const { sendWhatsAppMessage } = require('../services/whatsapp');

const { config } = require('../config/env');

const adminRouter = express.Router();

// Simple shared secret protection (recommended to replace with real auth later)
function requireAdminToken(req, res, next) {
  const token = req.headers['x-admin-token'];
  if (!config.ADMIN_TOKEN) {
    // If not set, allow (dev convenience). In production, set ADMIN_TOKEN.
    return next();
  }
  if (token !== config.ADMIN_TOKEN) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  return next();
}

adminRouter.use(requireAdminToken);

adminRouter.get('/submissions', async (req, res) => {
  try {
    const status = req.query.status || 'Pending';
    const limit = Number(req.query.limit || 50);

    if (status !== 'Pending') {
      return res.status(400).json({ error: 'Only status=Pending supported by this scaffold' });
    }

    const rows = await listPendingSubmissions(limit);
    return res.status(200).json({ ok: true, items: rows });
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error(err);
    return res.status(500).json({ error: err.message || 'Server error' });
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
    const toWaId = submission.wa_id; // stored as wa_id in DB
    const name = [submission.first_name, submission.last_name].filter(Boolean).join(' ').trim() || 'there';
    const plot = submission.plot_number;

    const text = `Hi ${name}, your land verification for Plot ${plot} is currently *Verified*. Our team will reach out if we need anything else.`;

    // Best-effort: don't fail the whole request if WhatsApp send fails
    try {
      await sendWhatsAppMessage({ toWaId, text });
    } catch (e) {
      // eslint-disable-next-line no-console
      console.error('WhatsApp notify failed:', e.message || e);
    }

    return res.status(200).json({ ok: true, submission: updated });
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error(err);
    return res.status(500).json({ error: err.message || 'Server error' });
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
    const name = [submission.first_name, submission.last_name].filter(Boolean).join(' ').trim() || 'there';
    const plot = submission.plot_number;

    const text = `Hi ${name}, thank you for submitting details for Plot ${plot}. Your verification request is currently *Rejected*. Reason: ${rejection_reason}.`;

    try {
      await sendWhatsAppMessage({ toWaId, text });
    } catch (e) {
      // eslint-disable-next-line no-console
      console.error('WhatsApp notify failed:', e.message || e);
    }

    return res.status(200).json({ ok: true, submission: updated });
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error(err);
    return res.status(500).json({ error: err.message || 'Server error' });
  }
});

module.exports = { adminRouter };
