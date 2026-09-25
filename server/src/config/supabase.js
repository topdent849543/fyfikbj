import { createClient } from '@supabase/supabase-js';
import WebSocket from 'ws';
import './env.js';

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY;

if (!supabaseUrl || !supabaseAnonKey || !supabaseServiceKey) {
  throw new Error('Missing Supabase configuration');
}

// Explicit transport keeps the API compatible with Railway images that still run Node 20.
const clientOptions = { realtime: { transport: WebSocket } };

// Client for public operations
export const supabase = createClient(supabaseUrl, supabaseAnonKey, clientOptions);

// Client for admin operations
export const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, clientOptions);

export default supabase;
