// ============================================================================
//  /api/diy/logs — Journal des essais utilisateur (UserTipLog)
// ============================================================================
import { Hono } from 'hono';
import { z } from 'zod';
import { zValidator } from '@hono/zod-validator';
import { prisma } from '../../lib/prisma';
import { requireAuth } from '../middleware/auth';

const logs = new Hono();

// Toutes les routes nécessitent une auth
logs.use('*', requireAuth);

// ---------- Schemas ----------
const createLogSchema = z.object({
  tipId: z.string(),
  status: z.enum(['WANT_TO_TRY', 'IN_PROGRESS', 'COMPLETED', 'ABANDONED']),
  notes: z.string().optional(),
});

const updateLogSchema = z.object({
  status: z.enum(['WANT_TO_TRY', 'IN_PROGRESS', 'COMPLETED', 'ABANDONED']).optional(),
  actualMonthlySaving: z.number().min(0).optional(),
  equipmentBought: z.boolean().optional(),
  equipmentCost: z.number().min(0).optional(),
  rating: z.number().min(1).max(5).optional(),
  notes: z.string().optional(),
});

// ---------- Routes ----------

// GET /api/diy/logs — mes essais
logs.get('/', async (c) => {
  const user = c.get('user')!;
  const status = c.req.query('status');

  const where: Record<string, unknown> = { userId: user.id };
  if (status) where.status = status;

  const items = await prisma.userTipLog.findMany({
    where,
    include: {
      tip: {
        select: {
          slug: true,
          title: true,
          category: true,
          difficulty: true,
          estimatedMonthlySaving: true,
          equipmentCost: true,
        },
      },
    },
    orderBy: { startedAt: 'desc' },
  });

  return c.json({ items });
});

// GET /api/diy/logs/stats — résumé ROI personnel
logs.get('/stats', async (c) => {
  const user = c.get('user')!;

  const [completed, totalSaving, totalEquipment] = await Promise.all([
    prisma.userTipLog.count({
      where: { userId: user.id, status: 'COMPLETED' },
    }),
    prisma.userTipLog.aggregate({
      where: { userId: user.id, status: 'COMPLETED' },
      _sum: { actualMonthlySaving: true },
    }),
    prisma.userTipLog.aggregate({
      where: { userId: user.id, equipmentBought: true },
      _sum: { equipmentCost: true },
    }),
  ]);

  const monthlySaving = totalSaving._sum.actualMonthlySaving ?? 0;
  const equipmentSpent = totalEquipment._sum.equipmentCost ?? 0;

  return c.json({
    completedTips: completed,
    monthlySaving,
    yearlySaving: monthlySaving * 12,
    equipmentSpent,
    roiMonths: monthlySaving > 0 ? Math.ceil(equipmentSpent / monthlySaving) : null,
  });
});

// POST /api/diy/logs — ajouter un essai
logs.post('/', zValidator('json', createLogSchema), async (c) => {
  const user = c.get('user')!;
  const data = c.req.valid('json');

  // Vérifier que le tip existe et est approuvé
  const tip = await prisma.diyTip.findUnique({ where: { id: data.tipId } });
  if (!tip || tip.moderationStatus !== 'APPROVED') {
    return c.json({ error: 'Astuce non trouvée ou non approuvée' }, 404);
  }

  // Vérifier qu'on n'a pas déjà un log pour ce tip
  const existing = await prisma.userTipLog.findUnique({
    where: { userId_tipId: { userId: user.id, tipId: data.tipId } },
  });
  if (existing) {
    return c.json({ error: 'Tu suis déjà cette astuce. Utilise PATCH pour mettre à jour.' }, 409);
  }

  const log = await prisma.userTipLog.create({
    data: {
      userId: user.id,
      tipId: data.tipId,
      status: data.status,
      notes: data.notes,
      startedAt: data.status !== 'WANT_TO_TRY' ? new Date() : null,
    },
    include: { tip: { select: { slug: true, title: true } } },
  });

  return c.json(log, 201);
});

// PATCH /api/diy/logs/:tipId — mettre à jour un essai
logs.patch('/:tipId', zValidator('json', updateLogSchema), async (c) => {
  const user = c.get('user')!;
  const tipId = c.req.param('tipId');
  const data = c.req.valid('json');

  const existing = await prisma.userTipLog.findUnique({
    where: { userId_tipId: { userId: user.id, tipId } },
  });
  if (!existing) {
    return c.json({ error: 'Essai non trouvé' }, 404);
  }

  const log = await prisma.userTipLog.update({
    where: { userId_tipId: { userId: user.id, tipId } },
    data: {
      ...data,
      startedAt: data.status === 'IN_PROGRESS' && !existing.startedAt ? new Date() : existing.startedAt,
      completedAt: data.status === 'COMPLETED' ? new Date() : existing.completedAt,
    },
    include: { tip: { select: { slug: true, title: true } } },
  });

  return c.json(log);
});

// DELETE /api/diy/logs/:tipId — retirer de mes essais
logs.delete('/:tipId', async (c) => {
  const user = c.get('user')!;
  const tipId = c.req.param('tipId');

  const existing = await prisma.userTipLog.findUnique({
    where: { userId_tipId: { userId: user.id, tipId } },
  });
  if (!existing) {
    return c.json({ error: 'Essai non trouvé' }, 404);
  }

  await prisma.userTipLog.delete({
    where: { userId_tipId: { userId: user.id, tipId } },
  });

  return c.json({ success: true });
});

export default logs;
