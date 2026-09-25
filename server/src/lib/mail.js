import nodemailer from 'nodemailer';
import { AppError } from './http.js';

function configuredTransport() {
  if (!process.env.SMTP_HOST || !process.env.SMTP_USER || !process.env.SMTP_PASSWORD) return null;
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT || 587),
    secure: process.env.SMTP_SECURE === 'true',
    auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASSWORD }
  });
}

export async function sendPasswordResetEmail({ email, token }) {
  const transporter = configuredTransport();
  if (!transporter) throw new AppError(503, 'خدمة البريد غير مهيأة حالياً. تواصل مع الدعم لإعادة تعيين كلمة المرور.', 'EMAIL_NOT_CONFIGURED');
  const appUrl = (process.env.APP_URL || 'http://localhost:3001').replace(/\/$/, '');
  const resetUrl = `${appUrl}/auth/reset-password?token=${encodeURIComponent(token)}`;
  await transporter.sendMail({
    from: process.env.SMTP_FROM || process.env.SMTP_USER,
    to: email,
    subject: 'إعادة تعيين كلمة المرور | TopDent',
    text: `استخدم الرابط التالي لإعادة تعيين كلمة المرور خلال ساعة واحدة: ${resetUrl}`,
    html: `<div dir="rtl"><h2>إعادة تعيين كلمة المرور</h2><p>استخدم الرابط التالي خلال ساعة واحدة:</p><p><a href="${resetUrl}">${resetUrl}</a></p></div>`
  });
}
