import express from 'express';
import { supabaseAdmin } from '../config/supabase.js';
import { verifyToken, requireRole } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { asyncHandler, AppError, audit, notify } from '../lib/http.js';
import { dentalCardQuoteSchema, dentalCardRequestSchema, idParamsSchema } from '../validation/schemas.js';

const router = express.Router();

router.post('/requests', verifyToken, validate({ body: dentalCardRequestSchema }), asyncHandler(async (req, res) => {
  const body = req.body;
  const { data, error } = await supabaseAdmin.from('dental_card_requests').insert({
    user_id: req.user.id, doctor_name: body.doctorName, specialty: body.specialty || null, phone: body.phone, address: body.address || null,
    email: body.email || null, logo_url: body.logoUrl || null, colors: body.colors || null, requested_text: body.requestedText || null,
    requested_template: body.requestedTemplate || null, attachments: body.attachments, status: 'new'
  }).select().single();
  if (error) throw error;
  await audit(req.user.id, 'dental_card_requested', 'dental_card_request', data.id);
  res.status(201).json({ message: 'تم إرسال طلب تصميم الكرت للمراجعة', request: data });
}));

router.get('/requests/mine', verifyToken, asyncHandler(async (req, res) => {
  const { data, error } = await supabaseAdmin.from('dental_card_requests').select('*').eq('user_id', req.user.id).order('created_at', { ascending: false });
  if (error) throw error;
  res.json({ requests: data || [] });
}));

router.get('/requests', verifyToken, requireRole(['admin', 'manager']), asyncHandler(async (req, res) => {
  const { data, error } = await supabaseAdmin.from('dental_card_requests').select('*, user:users(full_name, email, phone)').order('created_at', { ascending: false });
  if (error) throw error;
  res.json({ requests: data || [] });
}));

router.patch('/requests/:id', verifyToken, requireRole(['admin', 'manager']), validate({ params: idParamsSchema, body: dentalCardQuoteSchema }), asyncHandler(async (req, res) => {
  const { data: request, error } = await supabaseAdmin.from('dental_card_requests').select('id, user_id').eq('id', req.params.id).maybeSingle();
  if (error) throw error;
  if (!request) throw new AppError(404, 'طلب التصميم غير موجود', 'DESIGN_REQUEST_NOT_FOUND');
  const { error: updateError } = await supabaseAdmin.from('dental_card_requests').update({
    quoted_price: req.body.quotedPrice, execution_days: req.body.executionDays, included_revisions: req.body.includedRevisions,
    status: req.body.status, admin_note: req.body.adminNote || null, updated_at: new Date().toISOString()
  }).eq('id', request.id);
  if (updateError) throw updateError;
  await notify(request.user_id, 'dental_card_status', 'تحديث طلب تصميم الكرت', req.body.adminNote || `تم تحديث الطلب إلى ${req.body.status}`);
  await audit(req.user.id, 'dental_card_request_updated', 'dental_card_request', request.id, { status: req.body.status });
  res.json({ message: 'تم تحديث طلب التصميم' });
}));

export default router;
