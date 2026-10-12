// ============================================================================
//  /api/diy/auth — Authentification (Google OAuth + Email/Pass + Session)
// ============================================================================
import { Hono } from 'hono';
import { sign } from 'hono/jwt';
import { setCookie, deleteCookie } from 'hono/cookie';
import { prisma } from '../../lib/prisma';
import { requireAuth } from '../middleware/auth';

const auth = new Hono();

const JWT_SECRET = process.env.JWT_SECRET || 'diy-module-dev-secret-change-in-prod';

// =====================================================
//  Google OAuth
// =====================================================

auth.post('/google', async (c) => {
  try {
    const { idToken } = await c.req.json<{ idToken: string }>();
    if (!idToken) return c.json({ error: 'idToken requis' }, 400);

    let email = 'utilisateur.google@example.com';
    let name = 'Utilisateur Google';

    if (idToken.includes('.')) {
      try {
        const parts = idToken.split('.');
        const payload = JSON.parse(Buffer.from(parts[1], 'base64').toString());
        if (payload.email) email = payload.email;
        if (payload.name) name = payload.name;
      } catch (e) {}
    }

    const user = await prisma.user.upsert({
      where: { email },
      update: { name },
      create: {
        email,
        name,
        role: 'USER',
      },
    });

    const jwt = await sign({ userId: user.id, email: user.email, role: user.role }, JWT_SECRET);

    setCookie(c, 'token', jwt, {
      path: '/',
      httpOnly: true,
      sameSite: 'Lax',
      maxAge: 7 * 24 * 3600,
    });

    return c.json({
      user: { id: user.id, email: user.email, name: user.name, role: user.role },
      token: jwt,
    });
  } catch (e: any) {
    return c.json({ error: e.message || 'Erreur Google Auth' }, 400);
  }
});

// =====================================================
//  Inscription / Connexion Email
// =====================================================

auth.post('/register', async (c) => {
  try {
    const { email, password, name } = await c.req.json<{ email: string; password: string; name?: string }>();

    if (!email || !password) return c.json({ error: 'Email et mot de passe requis' }, 400);
    if (password.length < 6) return c.json({ error: 'Le mot de passe doit contenir au moins 6 caractères' }, 400);

    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) return c.json({ error: 'Cet email est déjà utilisé' }, 409);

    const user = await prisma.user.create({
      data: { email, name: name || email.split('@')[0], role: 'USER' },
    });

    const jwt = await sign({ userId: user.id, email: user.email, role: user.role }, JWT_SECRET);

    setCookie(c, 'token', jwt, {
      path: '/',
      httpOnly: true,
      sameSite: 'Lax',
      maxAge: 7 * 24 * 3600,
    });

    return c.json({ user: { id: user.id, email: user.email, name: user.name, role: user.role }, token: jwt });
  } catch (e: any) {
    return c.json({ error: e.message }, 400);
  }
});

auth.post('/login', async (c) => {
  try {
    const { email, password } = await c.req.json<{ email: string; password: string }>();
    if (!email || !password) return c.json({ error: 'Email et mot de passe requis' }, 400);

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) return c.json({ error: 'Email ou mot de passe incorrect' }, 401);

    const jwt = await sign({ userId: user.id, email: user.email, role: user.role }, JWT_SECRET);

    setCookie(c, 'token', jwt, {
      path: '/',
      httpOnly: true,
      sameSite: 'Lax',
      maxAge: 7 * 24 * 3600,
    });

    return c.json({ user: { id: user.id, email: user.email, name: user.name, role: user.role }, token: jwt });
  } catch (e: any) {
    return c.json({ error: e.message }, 400);
  }
});

// =====================================================
//  Profil & Déconnexion
// =====================================================

auth.get('/me', requireAuth, async (c) => {
  const user = c.get('user');
  if (!user) return c.json({ error: 'Non authentifié' }, 401);

  const u = await prisma.user.findUnique({ where: { id: user.id }, select: { id: true, email: true, name: true, role: true, createdAt: true } });
  return c.json(u);
});

auth.post('/logout', async (c) => {
  deleteCookie(c, 'token', { path: '/' });
  return c.json({ success: true });
});

export default auth;
