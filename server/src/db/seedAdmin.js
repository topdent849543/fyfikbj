import bcrypt from 'bcrypt';
import '../config/env.js';
import { supabaseAdmin } from '../config/supabase.js';

const email = process.env.ADMIN_EMAIL?.trim().toLowerCase();
const password = process.env.ADMIN_PASSWORD;
const fullName = process.env.ADMIN_NAME?.trim() || 'مدير TopDent';

if (!email || !password || password.length < 12) {
  throw new Error('Set ADMIN_EMAIL and an ADMIN_PASSWORD of at least 12 characters before running this bootstrap command');
}

const { data: existing, error: lookupError } = await supabaseAdmin.from('users').select('id, role').eq('email', email).maybeSingle();
if (lookupError) throw lookupError;

if (existing) {
  const { error } = await supabaseAdmin.from('users').update({ role: 'admin', is_active: true, updated_at: new Date().toISOString() }).eq('id', existing.id);
  if (error) throw error;
  console.log(`Promoted existing user to admin: ${email}`);
} else {
  const passwordHash = await bcrypt.hash(password, 12);
  const { error } = await supabaseAdmin.from('users').insert({
    email,
    password: passwordHash,
    full_name: fullName,
    role: 'admin',
    is_active: true,
    terms_accepted_at: new Date().toISOString(),
    privacy_accepted_at: new Date().toISOString(),
    password_changed_at: new Date().toISOString()
  });
  if (error) throw error;
  console.log(`Created admin user: ${email}`);
}
