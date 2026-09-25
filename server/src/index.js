import express from 'express';
import cors from 'cors';
import { fileURLToPath } from 'url';
import path from 'path';
import { getCorsOptions, validateRuntimeConfig } from './config/env.js';

// Routes
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

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = process.env.PORT || 3000;

export function createApp() {
  validateRuntimeConfig();
  const app = express();

  // Middleware
  app.use(cors(getCorsOptions()));
  app.use(express.json({ limit: '2mb' }));
  app.use(express.urlencoded({ limit: '2mb', extended: true }));

  // Static files
  app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

  // Health check
  app.get('/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
  });

  // API Routes
  app.use('/api/auth', authRoutes);
  app.use('/api/products', productRoutes);
  app.use('/api/orders', orderRoutes);
  app.use('/api/users', userRoutes);
  app.use('/api/merchants', merchantRoutes);
  app.use('/api/admin', adminRoutes);
  app.use('/api/cart', cartRoutes);
  app.use('/api/favorites', favoriteRoutes);
  app.use('/api/delivery-rates', deliveryRateRoutes);
  app.use('/api/upload', uploadRoutes);

  app.use('/api', (req, res) => res.status(404).json({ error: 'API route not found' }));

  // Error handling
  app.use((err, req, res, next) => {
    console.error(err);
    res.status(500).json({
      error: 'Internal Server Error',
      message: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
  });

  return app;
}

const isMainModule = process.argv[1] && path.resolve(process.argv[1]) === __filename;

if (isMainModule) {
  createApp().listen(PORT, '0.0.0.0', () => {
    console.log(`TopDent API running on port ${PORT}`);
  });
}
