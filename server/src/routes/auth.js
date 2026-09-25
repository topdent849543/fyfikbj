import crypto from 'crypto';
import express from 'express';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { supabaseAdmin } from '../config/supabase.js';
import { getJwtSecret } from '../config/env.js';
import { verifyToken } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { asyncHandler, AppError, audit } from '../lib/http.js';
import { sendPasswordResetEmail } from '../lib/mail.js';
import { changePasswordSchema, forgotPasswordSchema, loginSchema, merchantRegisterSchema, registerSchema, resetPasswordSchema } from '../validation/schemas.js';

const router = express.Router();
const tokenExpiry = process.env.JWT_EXPIRES_IN || '7d';

function publicUser(user) {
  return { id: user.id, email: user.email, fullName: user.full_name, role: user.role, isActive: user.is_active };
}

function generateToken(user) {
  return jwt.sign({ id: user.id }, getJwtSecret(), { expiresIn: tokenExpiry });
}

async function findExistingAccount(email, phone) {
  const { data: emailUser, error: emailError } = await supabaseAdmin.from('users').select('id').eq('email', email).maybeSingle();
  if (emailError) throw emailError;
  if (emailUser) throw new AppError(409, 'البريد الإلكتروني مستخدم بالفعل', 'EMAIL_IN_USE');
  const { data: phoneUser, error: phoneError } = await supabaseAdmin.from('users').select('id').eq('phone', phone).maybeSingle();
  if (phoneError) throw phoneError;
  if (phoneUser) throw new AppError(409, 'رقم الهاتف مستخدم بالفعل', 'PHONE_IN_USE');
}

function userInsert(account, passwordHash, role = 'customer') {
  return {
    email: account.email,
    password: passwordHash,
    full_name: account.fullName,
    phone: account.phone,
    whatsapp: account.whatsapp || null,
    province: account.province,
    area: account.area,
    address: account.address || null,
    university_clinic: account.universityClinic || null,
    role,
    is_active: true,
    terms_accepted_at: new Date().toISOString(),
    privacy_accepted_at: new Date().toISOString(),
    password_changed_at: new Date().toISOString()
  };
}

router.post('/register', validate({ body: registerSchema }), asyncHandler(async (req, res) => {
  const account = req.body;
  await findExistingAccount(account.email, account.phone);
  const passwordHash = await bcrypt.hash(account.password, 12);
  const { data: user, error } = await supabaseAdmin.from('users').insert(userInsert(account, passwordHash)).select().single();
  if (error) throw error;
  await audit(user.id, 'customer_registered', 'user', user.id);
  res.status(201).json({ message: 'تم إنشاء الحساب بنجاح', user: publicUser(user), token: generateToken(user) });
}));

router.post('/register-merchant', validate({ body: merchantRegisterSchema }), asyncHandler(async (req, res) => {
  const { account, companyName, companyDescription, logoUrl, contactEmail, websiteUrl, contactDetails } = req.body;
  await findExistingAccount(account.email, account.phone);
  const passwordHash = await bcrypt.hash(account.password, 12);
  const { data: user, error: userError } = await supabaseAdmin.from('users').insert(userInsert(account, passwordHash, 'merchant')).select().single();
  if (userError) throw userError;

  const { data: merchant, error: merchantError } = await supabaseAdmin.from('merchants').insert({
    user_id: user.id,
    company_name: companyName,
    description: companyDescription || null,
    logo_url: logoUrl || null,
    phone: account.phone,
    whatsapp: account.whatsapp || null,
    province: account.province,
    area: account.area,
    contact_email: contactEmail || account.email,
    website_url: websiteUrl || null,
    contact_details: contactDetails,
    is_active: true,
    is_approved: false,
    approval_status: 'pending'
  }).select().single();

  if (merchantError) {
    await supabaseAdmin.from('users').delete().eq('id', user.id);
    throw merchantError;
  }
  await audit(user.id, 'merchant_registration_submitted', 'merchant', merchant.id);
  res.status(201).json({
    message: 'تم تسجيل الشركة وهي بانتظار موافقة الإدارة',
    user: publicUser(user),
    merchant: { id: merchant.id, companyName: merchant.company_name, approvalStatus: merchant.approval_status },
    token: generateToken(user)
  });
}));

router.post('/login', validate({ body: loginSchema }), asyncHandler(async (req, res) => {
  const { email, password } = req.body;
  const { data: user, error } = await supabaseAdmin.from('users').select('*').eq('email', email).maybeSingle();
  if (error) throw error;
  if (!user || !(await bcrypt.compare(password, user.password))) throw new AppError(401, 'بيانات تسجيل الدخول غير صحيحة', 'INVALID_CREDENTIALS');
  if (!user.is_active) throw new AppError(403, 'الحساب معطل. تواصل مع الدعم للمساعدة.', 'ACCOUNT_DISABLED');

  await supabaseAdmin.from('users').update({ last_login_at: new Date().toISOString() }).eq('id', user.id);
  await audit(user.id, 'login_succeeded', 'user', user.id);
  res.json({ message: 'تم تسجيل الدخول بنجاح', user: publicUser(user), token: generateToken(user) });
}));

router.post('/forgot-password', validate({ body: forgotPasswordSchema }), asyncHandler(async (req, res) => {
  const { data: user, error } = await supabaseAdmin.from('users').select('id, email, is_active').eq('email', req.body.email).maybeSingle();
  if (error) throw error;
  if (!user || !user.is_active) return res.status(202).json({ message: 'إذا كان البريد مسجلاً فسيتم إرسال رابط إعادة التعيين.' });

  const rawToken = crypto.randomBytes(32).toString('hex');
  const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
  await supabaseAdmin.from('password_reset_tokens').delete().eq('user_id', user.id).is('used_at', null);
  const { error: insertError } = await supabaseAdmin.from('password_reset_tokens').insert({ user_id: user.id, token_hash: tokenHash, expires_at: new Date(Date.now() + 60 * 60 * 1000).toISOString() });
  if (insertError) throw insertError;
  await sendPasswordResetEmail({ email: user.email, token: rawToken });
  await audit(user.id, 'password_reset_requested', 'user', user.id);
  return res.status(202).json({ message: 'إذا كان البريد مسجلاً فسيتم إرسال رابط إعادة التعيين.' });
}));

router.post('/reset-password', validate({ body: resetPasswordSchema }), asyncHandler(async (req, res) => {
  const tokenHash = crypto.createHash('sha256').update(req.body.token).digest('hex');
  const { data: resetToken, error } = await supabaseAdmin.from('password_reset_tokens')
    .select('*').eq('token_hash', tokenHash).is('used_at', null).gt('expires_at', new Date().toISOString()).maybeSingle();
  if (error) throw error;
  if (!resetToken) throw new AppError(400, 'رابط إعادة التعيين غير صالح أو انتهت صلاحيته', 'INVALID_RESET_TOKEN');
  const passwordHash = await bcrypt.hash(req.body.password, 12);
  const now = new Date().toISOString();
  const { error: updateError } = await supabaseAdmin.from('users').update({ password: passwordHash, password_changed_at: now }).eq('id', resetToken.user_id);
  if (updateError) throw updateError;
  await supabaseAdmin.from('password_reset_tokens').update({ used_at: now }).eq('id', resetToken.id);
  await audit(resetToken.user_id, 'password_reset_completed', 'user', resetToken.user_id);
  res.json({ message: 'تم تغيير كلمة المرور بنجاح. سجّل الدخول باستخدام كلمة المرور الجديدة.' });
}));

router.post('/change-password', verifyToken, validate({ body: changePasswordSchema }), asyncHandler(async (req, res) => {
  const { data: user, error } = await supabaseAdmin.from('users').select('id, password').eq('id', req.user.id).single();
  if (error) throw error;
  if (!(await bcrypt.compare(req.body.currentPassword, user.password))) throw new AppError(400, 'كلمة المرور الحالية غير صحيحة', 'WRONG_CURRENT_PASSWORD');
  const passwordHash = await bcrypt.hash(req.body.password, 12);
  const { error: updateError } = await supabaseAdmin.from('users').update({ password: passwordHash, password_changed_at: new Date().toISOString() }).eq('id', user.id);
  if (updateError) throw updateError;
  await audit(user.id, 'password_changed', 'user', user.id);
  res.json({ message: 'تم تغيير كلمة المرور بنجاح' });
}));

router.post('/disable-account', verifyToken, asyncHandler(async (req, res) => {
  const { error } = await supabaseAdmin.from('users').update({ is_active: false, disabled_at: new Date().toISOString() }).eq('id', req.user.id);
  if (error) throw error;
  await audit(req.user.id, 'account_disabled', 'user', req.user.id);
  res.json({ message: 'تم تعطيل الحساب. تواصل مع الدعم لإعادة تفعيله.' });
}));

router.get('/verify', verifyToken, (req, res) => res.json({ valid: true, user: req.user }));

export default router;
