import express from 'express';
import cookieParser from 'cookie-parser';
import path from 'node:path';
import fs from 'node:fs';
import { UPLOAD_DIR } from './db.js';
import { loadUser } from './auth.js';
import authRoutes from './routes/auth.js';
import publicRoutes from './routes/public.js';
import bookingRoutes from './routes/bookings.js';
import vendorRoutes from './routes/vendor.js';
import messageRoutes from './routes/messages.js';
import notificationRoutes from './routes/notifications.js';
import adminRoutes, { flags } from './routes/admin.js';

export function createApp() {
  const app = express();
  app.disable('x-powered-by');
  app.use(express.json({ limit: '1mb' }));
  app.use(cookieParser());
  app.use(loadUser);

  app.use('/api/auth', authRoutes);
  app.use('/api', publicRoutes);
  app.use('/api/bookings', bookingRoutes);
  app.use('/api/vendor', vendorRoutes);
  app.use('/api/messages', messageRoutes);
  app.use('/api/notifications', notificationRoutes);
  app.use('/api/flags', flags);
  app.use('/api/admin', adminRoutes);
  app.use('/api', (_req, res) => res.status(404).json({ error: 'Not found' }));

  // Portfolio media only; ID documents live under uploads/private and are served to admins via the API.
  app.use('/uploads/media', express.static(path.join(UPLOAD_DIR, 'media'), { maxAge: '7d' }));

  const dist = path.resolve('web/dist');
  if (fs.existsSync(dist)) {
    app.use(express.static(dist, { index: false }));
    app.get(/^\/(?!api|uploads).*/, (_req, res) => res.sendFile(path.join(dist, 'index.html')));
  }

  app.use((err, _req, res, _next) => {
    const status = err.status || (err.code === 'LIMIT_FILE_SIZE' ? 413 : 500);
    if (status >= 500) console.error(err);
    res.status(status).json({ error: status >= 500 ? 'Something went wrong' : err.message });
  });
  return app;
}
