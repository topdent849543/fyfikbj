import bcrypt from 'bcrypt';
import '../config/env.js';
import { supabaseAdmin } from '../config/supabase.js';

const email = process.env.PLATFORM_OWNER_EMAIL?.trim().toLowerCase();
const password = process.env.PLATFORM_OWNER_PASSWORD;
const fullName = process.env.PLATFORM_OWNER_NAME?.trim() || 'مالك منصة TopDent';
const recoveryMode = process.env.ALLOW_PLATFORM_OWNER_RECOVERY === 'true';

if (!email || !password || password.length < 16) {
  throw new Error('Set PLATFORM_OWNER_EMAIL and a unique PLATFORM_OWNER_PASSWORD of at least 16 characters before running this bootstrap command');
}

const { data: ownerRole, error: roleError } = await supabaseAdmin.from('roles').select('id').eq('key', 'platform_owner').single();
if (roleError) throw new Error(`Unable to load platform_owner role. Run migrations first. (${roleError.message})`);

const { data: existingOwners, error: ownersError } = await supabaseAdmin
  .from('user_role_assignments')
  .select('id, user_id, user:users(email)')
  .eq('role_id', ownerRole.id)
  .eq('is_active', true);
if (ownersError) throw ownersError;
if (existingOwners?.length && !existingOwners.some((assignment) => assignment.user?.email?.toLowerCase() === email) && !recoveryMode) {
  throw new Error('A platform owner already exists. Refusing to create another owner. Use the documented recovery procedure only when explicitly required.');
}

const { data: existing, error: lookupError } = await supabaseAdmin.from('users').select('id').eq('email', email).maybeSingle();
if (lookupError) throw lookupError;

let userId = existing?.id;
if (existing) {
  const { error } = await supabaseAdmin.from('users').update({ role: 'admin', account_status: 'active', is_active: true, updated_at: new Date().toISOString() }).eq('id', existing.id);
  if (error) throw error;
} else {
  const passwordHash = await bcrypt.hash(password, 12);
  const { data, error } = await supabaseAdmin.from('users').insert({
    email,
    password: passwordHash,
    full_name: fullName,
    role: 'admin',
    account_status: 'active',
    is_active: true,
    terms_accepted_at: new Date().toISOString(),
    privacy_accepted_at: new Date().toISOString(),
    password_changed_at: new Date().toISOString()
  }).select('id').single();
  if (error) throw error;
  userId = data.id;
}

const { data: assignment, error: assignmentError } = await supabaseAdmin
  .from('user_role_assignments')
  .select('id')
  .eq('user_id', userId)
  .eq('role_id', ownerRole.id)
  .is('company_id', null)
  .maybeSingle();
if (assignmentError) throw assignmentError;
if (!assignment) {
  const { error } = await supabaseAdmin.from('user_role_assignments').insert({
    user_id: userId,
    role_id: ownerRole.id,
    company_id: null,
    scope_type: 'global',
    is_active: true
  });
  if (error) throw error;
}

console.log(`Platform owner bootstrap completed for ${email}. No password was stored in repository files.`);
