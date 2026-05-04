// backend/app.js

import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import { errorHandler } from './middleware/errorMiddleware.js';
import authRoutes from './routes/authRoutes.js';
import restaurantRoutes from './routes/restaurantRoutes.js';
import searchRoutes from './routes/searchRoutes.js';
import deliveryRoutes from './routes/deliveryRoutes.js';
import clusterRoutes from './routes/clusterRoutes.js';
import riderRoutes from './routes/riderRoutes.js';
import orderRoutes from './routes/orderRoutes.js';
import ratingRoutes from './routes/ratingRoutes.js';
import adminRoutes from './routes/adminRoutes.js';
import publicRestaurantRoutes from './routes/publicRestaurantRoutes.js';
import orderTrackingRoutes    from './routes/orderTrackingRoutes.js';
import * as demandService from './services/demandService.js'
import recommendationRoutes from './routes/recommendationRoutes.js';
import aiRoutes from './routes/aiRoutes.js';

const app = express();

const normalizeOrigin = (value) => {
  if (!value || typeof value !== 'string') return null;
  return value.trim().replace(/\/+$/, '').toLowerCase();
};

const configuredOrigins = (process.env.FRONTEND_URL || '')
  .split(',')
  .map((v) => normalizeOrigin(v))
  .filter(Boolean);

const isLocalhostOrigin = (origin) => /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/i.test(origin);

app.use(cors({
  origin: (origin, callback) => {
    const normalized = normalizeOrigin(origin);
    const isAllowedConfigured = normalized ? configuredOrigins.includes(normalized) : false;

    if (!origin || isAllowedConfigured || (normalized && isLocalhostOrigin(normalized))) {
      callback(null, true);
    } else {
      callback(new Error(`CORS: origin ${origin} not allowed. Add it to FRONTEND_URL in backend/.env`));
    }
  },
  credentials: true,
}));

app.use(helmet());
app.use(morgan('dev'));
app.use(express.json());
app.get('/api/health', (req, res) => res.json({ status: 'ok' }));
app.use('/api/auth',        authRoutes);
app.use('/api/restaurants', restaurantRoutes);
app.use('/api/search',      searchRoutes);
app.use('/api/delivery', deliveryRoutes);
app.use('/api/cluster',     clusterRoutes);
app.use('/api/rider',       riderRoutes);
app.use('/api/orders',      orderRoutes);
app.use('/api/ratings',     ratingRoutes);
app.use('/api/admin',       adminRoutes);
app.use('/api/public/restaurants', publicRestaurantRoutes);
app.use('/api/order-tracking',     orderTrackingRoutes);
app.use('/api/recommendations',    recommendationRoutes);
app.use('/api/ai',                 aiRoutes);
app.use(errorHandler);

// Background job: Analyze demand zones every 3 minutes
const DEMAND_ANALYSIS_INTERVAL = 3 * 60 * 1000 // 3 minutes
setInterval(() => {
  demandService.analyzeZones().catch(err => console.error('Demand analysis job failed:', err))
}, DEMAND_ANALYSIS_INTERVAL)
console.log('✅ Demand zone analysis background job scheduled (every 30 minutes)')

export default app;