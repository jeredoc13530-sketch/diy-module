// ============================================================================
//  /api/diy/challenges — Défis hebdo « Casse-toi pauv' » (WeeklyChallenge)
// ============================================================================
import { Hono } from 'hono';
import { z } from 'zod';
import { zValidator } from '@hono/zod-validator';
import { prisma } from '../../lib/prisma';
import { requireAuth, requireAdmin } from '../middleware/auth';

const challenges = new Hono();

// ---------- Schemas ----------
const createChallengeSchema = z.object({
  title: z.string().min(3),
  description: z.string().min(10),
  category: z.enum(['HOUSEHOLD', 'FOOD', 'HYGIENE', 'TOBACCO', 'ALCOHOL', 'COSMETICS', 'OTHER']),
  targetPercent: z.number().min(1).max(100),
  activeStartDate: z.coerce.date(),
  activeEndDate: z.coerce.date(),
});

const updateProgressSchema = z.object({
  progress: z.number().min(0).max(100),
});

// ---------- Helpers ----------
function getWeekNumber(d: Date): { week: number; year: number } {
  const date = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  date.setUTCDate(date.getUTCDate() + 4 - (date.getUTCDay() || 7));
  const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
  const week = Math.ceil(((date.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
  return { week, year: date.getUTCFullYear() };
}

// ---------- Routes ----------

// GET /api/diy/challenges — défis actifs (publiés + en cours)
challenges.get('/', async (c) => {
  const now = new Date();

  const items = await prisma.weeklyChallenge.findMany({
    where: {
      isPublished: true,
      activeEndDate: { gte: now },
    },
    orderBy: { activeStartDate: 'desc' },
    include: {
      _count: { select: { challenges: true } },
    },
  });

  return c.json({
    items: items.map((ch) => ({
      ...ch,
      participantCount: ch._count.challenges,
    })),
  });
});

// GET /api/diy/challenges/:id — détail d'un défi
challenges.get('/:id', async (c) => {
  const id = c.req.param('id');

  const challenge = await prisma.weeklyChallenge.findUnique({
    where: { id },
    include: {
      _count: { select: { challenges: true } },
      challenges: {
        orderBy: { progress: 'desc' },
        take: 10,
        include: {
          user: { select: { id: true, name: true } },
        },
      },
    },
  });

  if (!challenge || !challenge.isPublished) {
    return c.json({ error: 'Défi non trouvé' }, 404);
  }

  return c.json({
    ...challenge,
    participantCount: challenge._count.challenges,
    leaderboard: challenge.challenges.map((uc) => ({
      userId: uc.user.id,
      name: uc.user.name ?? 'Anonyme',
      progress: uc.progress,
      status: uc.status,
    })),
  });
});

// POST /api/diy/challenges — créer un défi (admin only)
challenges.post('/', requireAdmin, zValidator('json', createChallengeSchema), async (c) => {
  const data = c.req.valid('json');

  if (data.activeEndDate <= data.activeStartDate) {
    return c.json({ error: 'La date de fin doit être après la date de début' }, 400);
  }

  const challenge = await prisma.weeklyChallenge.create({ data });
  return c.json(challenge, 201);
});

// PATCH /api/diy/challenges/:id/publish — publier/dépublier (admin)
challenges.patch('/:id/publish', requireAdmin, async (c) => {
  const id = c.req.param('id');
  const { publish } = await c.req.json<{ publish: boolean }>();

  const existing = await prisma.weeklyChallenge.findUnique({ where: { id } });
  if (!existing) return c.json({ error: 'Non trouvé' }, 404);

  const updated = await prisma.weeklyChallenge.update({
    where: { id },
    data: { isPublished: publish },
  });

  return c.json(updated);
});

// POST /api/diy/challenges/:id/join — rejoindre un défi
challenges.post('/:id/join', requireAuth, async (c) => {
  const user = c.get('user')!;
  const challengeId = c.req.param('id');

  const challenge = await prisma.weeklyChallenge.findUnique({ where: { id: challengeId } });
  if (!challenge || !challenge.isPublished) {
    return c.json({ error: 'Défi non trouvé' }, 404);
  }

  if (new Date() > challenge.activeEndDate) {
    return c.json({ error: 'Ce défi est terminé' }, 410);
  }

  // Vérifier qu'on n'a pas déjà rejoint
  const existing = await prisma.userChallenge.findUnique({
    where: { userId_challengeId: { userId: user.id, challengeId } },
  });
  if (existing) {
    return c.json({ error: 'Tu participes déjà à ce défi' }, 409);
  }

  const { week, year } = getWeekNumber(new Date());

  const uc = await prisma.userChallenge.create({
    data: {
      userId: user.id,
      challengeId,
      weekNumber: week,
      year,
      status: 'ACTIVE',
    },
  });

  return c.json(uc, 201);
});

// PATCH /api/diy/challenges/:id/progress — mettre à jour sa progression
challenges.patch('/:id/progress', requireAuth, zValidator('json', updateProgressSchema), async (c) => {
  const user = c.get('user')!;
  const challengeId = c.req.param('id');
  const { progress } = c.req.valid('json');

  const existing = await prisma.userChallenge.findUnique({
    where: { userId_challengeId: { userId: user.id, challengeId } },
  });
  if (!existing) {
    return c.json({ error: 'Tu ne participes pas à ce défi' }, 404);
  }
  if (existing.status !== 'ACTIVE') {
    return c.json({ error: 'Ce défi n\'est plus actif pour toi' }, 410);
  }

  const uc = await prisma.userChallenge.update({
    where: { userId_challengeId: { userId: user.id, challengeId } },
    data: {
      progress,
      status: progress >= 100 ? 'COMPLETED' : 'ACTIVE',
    },
  });

  return c.json(uc);
});

// DELETE /api/diy/challenges/:id/leave — abandonner un défi
challenges.delete('/:id/leave', requireAuth, async (c) => {
  const user = c.get('user')!;
  const challengeId = c.req.param('id');

  const existing = await prisma.userChallenge.findUnique({
    where: { userId_challengeId: { userId: user.id, challengeId } },
  });
  if (!existing) {
    return c.json({ error: 'Tu ne participes pas à ce défi' }, 404);
  }

  await prisma.userChallenge.update({
    where: { userId_challengeId: { userId: user.id, challengeId } },
    data: { status: 'ABANDONED' },
  });

  return c.json({ success: true });
});

export default challenges;
