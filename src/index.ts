// ============================================================================
//  Point d'entrée — Serveur Hono / Node.js
//  Module DIY « Fais Tes Économies Toi-Même »
//
//  Démarrage:
//    npm run dev      (tsx watch)
//    npm run build && npm start
// ============================================================================
import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { logger } from 'hono/logger';
import { serve } from '@hono/node-server';

import { authMiddleware } from './api/middleware/auth';
import tips from './api/routes/tips';
import logs from './api/routes/logs';
import findings from './api/routes/findings';
import challenges from './api/routes/challenges';
import ui from './api/routes/ui';
import scraperRoute from './api/routes/scraper';
import auth from './api/routes/auth';

const app = new Hono();

// ---------- Global middleware ----------
app.use('*', logger());
app.use('*', cors());
app.use('*', authMiddleware);

// ---------- Health check ----------
app.get('/health', (c) => c.json({ status: 'ok', module: 'diy', timestamp: new Date().toISOString() }));

// ---------- Routes API ----------
app.route('/api/diy/tips', tips);
app.route('/api/diy/logs', logs);
app.route('/api/diy/findings', findings);
app.route('/api/diy/challenges', challenges);
app.route('/api/diy/ui', ui);
app.route('/api/diy/scraper', scraperRoute);
app.route('/api/diy/auth', auth);

// ---------- 404 fallback ----------
app.notFound((c) => c.json({ error: 'Route non trouvée' }, 404));

// ---------- Error handler ----------
app.onError((err, c) => {
  console.error('❌ Erreur serveur:', err);
  return c.json(
    {
      error: err.message || 'Erreur interne',
      stack: process.env.NODE_ENV === 'development' ? err.stack : undefined,
    },
    500,
  );
});

// ---------- Start ----------
const port = Number(process.env.PORT) || 3001;

serve({ fetch: app.fetch, port }, (info) => {
  console.log(`
  ┌─────────────────────────────────────────────┐
  │  🔧 Module DIY — Fais Tes Économies Toi-Même │
  │  Serveur démarré sur http://localhost:${info.port}    │
  │                                             │
  │  Routes:                                    │
  │    GET    /health                            │
  │    GET    /api/diy/tips                      │
  │    GET    /api/diy/tips/categories            │
  │    GET    /api/diy/tips/filters               │
  │    GET    /api/diy/tips/:slug                 │
  │    POST   /api/diy/tips                      │
  │    PATCH  /api/diy/tips                      │
  │    DELETE /api/diy/tips/:id                   │
  │    PATCH  /api/diy/tips/:id/moderate          │
  │    GET    /api/diy/logs                      │
  │    GET    /api/diy/logs/stats                 │
  │    POST   /api/diy/logs                      │
  │    PATCH  /api/diy/logs/:tipId                │
  │    DELETE /api/diy/logs/:tipId                │
  │    GET    /api/diy/findings                  │
  │    GET    /api/diy/findings/:id               │
  │    POST   /api/diy/findings                  │
  │    POST   /api/diy/findings/:id/upvote        │
  │    PATCH  /api/diy/findings/:id/moderate      │
  │    DELETE /api/diy/findings/:id               │
  │    GET    /api/diy/challenges                │
  │    GET    /api/diy/challenges/:id             │
  │    POST   /api/diy/challenges                │
  │    PATCH  /api/diy/challenges/:id/publish     │
  │    POST   /api/diy/challenges/:id/join        │
  │    PATCH  /api/diy/challenges/:id/progress    │
  │    DELETE /api/diy/challenges/:id/leave       │
  └─────────────────────────────────────────────┘
  `);
});

export default app;
