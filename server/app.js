import express from 'express';
import path from 'path';
import { getRecentMessages, UPLOADS_DIR } from './storage/store.js';
import settingsRouter from './routes/settings.js';
import alertsRouter from './routes/alerts.js';
import ttsRouter from './routes/tts.js';
import authRouter from './routes/auth.js';
import fontsRouter from './routes/fonts.js';

const LOCAL_ORIGIN = /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/i;

export function isTrustedLocalOrigin(origin) {
  return !origin || LOCAL_ORIGIN.test(origin);
}

export function createApp({ rootDir }) {
  const app = express();
  app.disable('x-powered-by');
  app.use((req, res, next) => {
    const origin = req.get('origin');
    if (!isTrustedLocalOrigin(origin)) return res.status(403).json({ error: 'Only local origins are allowed' });
    if (origin) res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Vary', 'Origin');
    res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    if (req.method === 'OPTIONS') return res.sendStatus(204);
    next();
  });
  app.use(express.json({ limit: '256kb', strict: true }));

  app.use('/uploads', express.static(UPLOADS_DIR, { fallthrough: false, maxAge: '1h', index: false }));
  app.use('/overlay', express.static(path.join(rootDir, 'overlay'), { fallthrough: false, index: false }));
  app.use(express.static(path.join(rootDir, 'dist'), { index: false, maxAge: '1h' }));

  app.use('/api/settings', settingsRouter);
  app.use('/api/alerts', alertsRouter);
  app.use('/api/tts', ttsRouter);
  app.use('/api/auth', authRouter);
  app.use('/api/fonts', fontsRouter);

  app.get('/api/messages', async (req, res, next) => {
    try {
      const parsed = Number.parseInt(req.query.limit, 10);
      const limit = Number.isFinite(parsed) ? Math.min(Math.max(parsed, 1), 500) : 100;
      res.json(await getRecentMessages(limit));
    } catch (error) { next(error); }
  });

  app.use('/api', (req, res) => res.status(404).json({ error: 'Not found' }));
  app.use((req, res, next) => {
    if (req.path.startsWith('/overlay') || req.path.startsWith('/uploads')) return res.status(404).json({ error: 'Not found' });
    res.sendFile(path.join(rootDir, 'dist', 'index.html'), error => {
      if (error?.code === 'ENOENT') return res.status(200).send('StreamOverlay Pro backend is running. Start Vite for the development dashboard.');
      if (error) next(error);
    });
  });
  app.use((error, req, res, next) => {
    if (res.headersSent) return next(error);
    const status = error.type === 'entity.parse.failed' ? 400 : error.status || 500;
    console.error('[HTTP]', error.message);
    res.status(status).json({ error: status === 500 ? 'Internal server error' : error.message });
  });
  return app;
}
