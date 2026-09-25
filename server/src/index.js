import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { rateLimit } from 'express-rate-limit';
import { getCorsOptions, validateRuntimeConfig } from './config/env.js';
import { supabaseAdmin } from './config/supabase.js';
import { errorMiddleware, notFound, asyncHandler } from './lib/http.js';

import authRoutes from './routes/auth.js';
import productRoutes from './routes/products.js';
import orderRoutes from './routes/orders.js';
import userRoutes from './routes/users.js';
import merchantRoutes from './routes/merchants.js';
import adminRoutes from './routes/admin.js';
import cartRoutes from './routes/cart.js';
import uploadRoutes from './routes/upload.js';
import favoriteRoutes from './routes/favorites.js';
import deliveryRateRoutes from './routes/deliveryRates.js';
import catalogRoutes from './routes/catalog.js';
import rentalRoutes from './routes/rentals.js';
import dentalCardRoutes from './routes/dentalCards.js';

const PORT = process.env.PORT || 3000;
const apiLimiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: 500, standardHeaders: 'draft-8', legacyHeaders: false, message: { error: 'تم تجاوز عدد الطلبات المسموح. حاول لاحقاً.', code: 'RATE_LIMITED' } });
const authLimiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: 20, standardHeaders: 'draft-8', legacyHeaders: false, message: { error: 'محاولات كثيرة. انتظر قليلاً قبل المحاولة مجدداً.', code: 'AUTH_RATE_LIMITED' } });

export function createApp() {
  validateRuntimeConfig();
  const app = express();
  app.disable('x-powered-by');
  if (process.env.TRUST_PROXY === 'true') app.set('trust proxy', 1);

  app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));
  app.use(cors(getCorsOptions()));
  app.use(express.json({ limit: '2mb' }));
  app.use(express.urlencoded({ limit: '2mb', extended: true }));
  app.use((req, res, next) => {
    const startedAt = Date.now();
    res.on('finish', () => console.info(JSON.stringify({ event: 'http_request', method: req.method, path: req.path, status: res.statusCode, durationMs: Date.now() - startedAt })));
    next();
  });

  app.get('/health', asyncHandler(async (req, res) => {
    if (process.env.HEALTHCHECK_SKIP_DB === 'true') return res.json({ status: 'ok', database: 'skipped', timestamp: new Date().toISOString() });
    const { error } = await supabaseAdmin.from('users').select('id', { head: true, count: 'exact' }).limit(1);
    if (error) return res.status(503).json({ status: 'degraded', database: 'unavailable', timestamp: new Date().toISOString() });
    return res.json({ status: 'ok', database: 'connected', timestamp: new Date().toISOString() });
  }));

  app.use('/api', apiLimiter);
  app.use('/api/auth', authLimiter, authRoutes);
  app.use('/api/catalog', catalogRoutes);
  app.use('/api/products', productRoutes);
  app.use('/api/orders', orderRoutes);
  app.use('/api/users', userRoutes);
  app.use('/api/merchants', merchantRoutes);
  app.use('/api/admin', adminRoutes);
  app.use('/api/cart', cartRoutes);
  app.use('/api/favorites', favoriteRoutes);
  app.use('/api/delivery-rates', deliveryRateRoutes);
  app.use('/api/upload', uploadRoutes);
  app.use('/api/rentals', rentalRoutes);
  app.use('/api/dental-cards', dentalCardRoutes);
  app.use('/api', notFound);
  app.use(errorMiddleware);
  return app;
}

if (process.argv[1] && new URL(import.meta.url).pathname === process.argv[1]) {
  createApp().listen(PORT, '0.0.0.0', () => console.info(`TopDent API running on port ${PORT}`));
}
