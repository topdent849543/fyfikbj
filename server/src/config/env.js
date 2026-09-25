import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import path from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Prefer an explicit process environment, then server/.env, then the repository .env.
dotenv.config({ path: path.resolve(__dirname, '../../.env') });
dotenv.config({ path: path.resolve(__dirname, '../../../.env') });

const DEVELOPMENT_JWT_SECRET = 'topdent-development-only-secret-not-for-production';
const PLACEHOLDER_SECRETS = new Set([
  'your-secret-key',
  'your-super-secret-key-change-this-in-production',
  DEVELOPMENT_JWT_SECRET
]);

export function validateJwtSecret(environment = process.env.NODE_ENV, secret = process.env.JWT_SECRET) {
  const normalized = secret?.trim();

  if (environment === 'production') {
    if (!normalized || normalized.length < 32 || PLACEHOLDER_SECRETS.has(normalized)) {
      throw new Error('JWT_SECRET must be a non-placeholder secret of at least 32 characters in production');
    }
  }

  return normalized || DEVELOPMENT_JWT_SECRET;
}

export function getJwtSecret() {
  return validateJwtSecret();
}

export function getAllowedOrigins() {
  const configured = process.env.CORS_ORIGINS || '';
  const origins = configured
    .split(',')
    .map((origin) => origin.trim().replace(/\/$/, ''))
    .filter(Boolean);

  if (origins.length > 0) return origins;

  return process.env.NODE_ENV === 'production'
    ? []
    : ['http://localhost:3000', 'http://localhost:3001'];
}

export function getCorsOptions() {
  const allowedOrigins = getAllowedOrigins();

  return {
    origin(origin, callback) {
      // Non-browser clients do not send Origin. An explicit wildcard remains opt-in.
      const allowed = !origin || allowedOrigins.includes('*') || allowedOrigins.includes(origin.replace(/\/$/, ''));
      callback(null, allowed);
    },
    methods: ['GET', 'HEAD', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    maxAge: 86400
  };
}

export function validateRuntimeConfig() {
  getJwtSecret();

  if (process.env.NODE_ENV === 'production' && getAllowedOrigins().length === 0) {
    console.warn('CORS_ORIGINS is empty; browser cross-origin requests will be denied');
  }
}

export const isProduction = process.env.NODE_ENV === 'production';
