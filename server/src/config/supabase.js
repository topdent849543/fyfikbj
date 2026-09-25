import { createClient } from '@supabase/supabase-js';
import './env.js';

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY;

if (!supabaseUrl || !supabaseAnonKey || !supabaseServiceKey) {
  throw new Error('Missing Supabase configuration');
}

// Client for public operations
export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Client for admin operations
export const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

export default supabase;
