// ============================================================================
//  Middleware Auth — JWT + Cookie + Stub Dev
// ============================================================================
import { Context, Next } from 'hono';
import { verify } from 'hono/jwt';
import { getCookie } from 'hono/cookie';

export interface AuthUser {
  id: string;
  email: string;
  role: 'USER' | 'EDITOR' | 'ADMIN';
}

declare module 'hono' {
  interface ContextVariableMap {
    user: AuthUser | null;
  }
}

const JWT_SECRET = process.env.JWT_SECRET || 'diy-module-dev-secret-change-in-prod';

/**
 * Middleware qui extrait l'utilisateur depuis le cookie JWT ou le header Authorization.
 */
export async function authMiddleware(c: Context, next: Next) {
  // 1. Essayer le cookie
  const cookieToken = getCookie(c, 'token');

  // 2. Essayer le header Authorization
  const authHeader = c.req.header('Authorization') ?? '';
  const headerToken = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;

  const token = cookieToken || headerToken || null;

  if (token) {
    try {
      const decoded = await verify(token, JWT_SECRET);
      c.set('user', {
        id: decoded.userId as string,
        email: decoded.email as string,
        role: (decoded.role as 'USER' | 'EDITOR' | 'ADMIN') || 'USER',
      });
      return next();
    } catch {
      // Token invalide, continuer sans auth
    }
  }

  // Mode dev : si pas de token, autoriser en stub admin pour tester
  if (process.env.NODE_ENV === 'development') {
    c.set('user', { id: 'dev-user-001', email: 'dev@local.test', role: 'ADMIN' });
    return next();
  }

  c.set('user', null);
  return next();
}

export async function requireAuth(c: Context, next: Next) {
  const user = c.get('user');
  if (!user) return c.json({ error: 'Authentification requise' }, 401);
  return next();
}

export async function requireEditor(c: Context, next: Next) {
  const user = c.get('user');
  if (!user || (user.role !== 'ADMIN' && user.role !== 'EDITOR')) {
    return c.json({ error: 'Accès réservé aux éditeurs et administrateurs' }, 403);
  }
  return next();
}

export async function requireAdmin(c: Context, next: Next) {
  const user = c.get('user');
  if (!user || user.role !== 'ADMIN') {
    return c.json({ error: 'Accès réservé aux administrateurs' }, 403);
  }
  return next();
}
