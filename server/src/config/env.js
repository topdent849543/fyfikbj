import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import path from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.resolve(__dirname, '../../.env') });
dotenv.config({ path: path.resolve(__dirname, '../../../.env') });

const PLACEHOLDER_SECRETS = new Set([
  'your-secret-key',
  'your-super-secret-key-change-this-in-production',
  'replace-with-a-random-secret-at-least-32-characters'
]);

export function validateJwtSecret(environment = process.env.NODE_ENV, secret = process.env.JWT_SECRET) {
  const normalized = secret?.trim();
  if (!normalized || normalized.length < 32 || PLACEHOLDER_SECRETS.has(normalized)) {
    throw new Error('JWT_SECRET must be a non-placeholder secret of at least 32 characters');
  }
  return normalized;
}

export function getJwtSecret() {
  return validateJwtSecret();
}

export function getAllowedOrigins() {
  const origins = (process.env.CORS_ORIGINS || '')
    .split(',')
    .map((origin) => origin.trim().replace(/\/$/, ''))
    .filter(Boolean);
  if (origins.includes('*')) throw new Error('CORS_ORIGINS must not contain a wildcard');
  if (process.env.NODE_ENV === 'production' && origins.length === 0) {
    throw new Error('CORS_ORIGINS is required in production');
  }
  return origins.length ? origins : ['http://localhost:3000', 'http://localhost:3001'];
}

export function getCorsOptions() {
  const allowedOrigins = getAllowedOrigins();
  return {
    origin(origin, callback) {
      if (!origin || allowedOrigins.includes(origin.replace(/\/$/, ''))) return callback(null, true);
      return callback(null, false);
    },
    methods: ['GET', 'HEAD', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    credentials: false,
    maxAge: 86400
  };
}

export function validateRuntimeConfig() {
  getJwtSecret();
  getAllowedOrigins();
  for (const key of ['SUPABASE_URL', 'SUPABASE_ANON_KEY', 'SUPABASE_SERVICE_KEY']) {
    if (!process.env[key]) throw new Error(`${key} is required`);
  }
}

export const isProduction = process.env.NODE_ENV === 'production';
