// ============================================================================
//  /api/diy/tips — API REST pour le module DIY (Fais Tes Économies Toi-Même)
//  Framework: Hono (compatible Next.js / TanStack Start / Express via adapter)
// ============================================================================
import { Hono } from 'hono';
import { z } from 'zod';
import { zValidator } from '@hono/zod-validator';
import { prisma } from '../../lib/prisma';

const tips = new Hono();

// ---------- Schemas ----------
const createTipSchema = z.object({
  externalRef: z.string().min(1),
  sourceUrl: z.string().url(),
  sourceCredit: z.string(),
  sourceLicense: z.string().optional(),
  slug: z.string().regex(/^[\w-]+$/),
  title: z.string().min(3),
  description: z.string().min(20),
  category: z.enum([
    'HOUSEHOLD',
    'FOOD',
    'HYGIENE',
    'TOBACCO',
    'ALCOHOL',
    'COSMETICS',
    'OTHER',
  ]),
  difficulty: z.enum(['EASY', 'MEDIUM', 'EXPERT']),
  estimatedMonthlySaving: z.number().min(0),
  learningTimeHours: z.number().min(0),
  equipmentCost: z.number().min(0),
  tags: z.array(z.string()).default([]),
  safetyWarnings: z
    .array(
      z.object({
        category: z.enum(['HEALTH', 'CHEMICAL', 'FOOD', 'LEGAL', 'MATERIAL']),
        text: z.string().min(10),
        severity: z.enum(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']),
      }),
    )
    .default([]),
});

const updateTipSchema = createTipSchema.partial().omit({ slug: true }).extend({
  id: z.string().uuid(),
});

const listQuerySchema = z.object({
  category: z.enum([
    'HOUSEHOLD',
    'FOOD',
    'HYGIENE',
    'TOBACCO',
    'ALCOHOL',
    'COSMETICS',
    'OTHER',
  ]).optional(),
  difficulty: z.enum(['EASY', 'MEDIUM', 'EXPERT']).optional(),
  minSaving: z.coerce.number().optional(),
  maxSaving: z.coerce.number().optional(),
  search: z.string().optional(),
  verified: z.coerce.boolean().optional(),
  page: z.coerce.number().min(1).default(1),
  limit: z.coerce.number().min(1).max(50).default(12),
  sort: z.enum(['newest', 'saving', 'roi', 'popular']).default('newest'),
});

// ---------- Helpers ----------
function calcROI(equipmentCost: number, monthlySaving: number): number {
  return monthlySaving > 0 ? Math.ceil(equipmentCost / monthlySaving) : 0;
}

function buildWhere(query: z.infer<typeof listQuerySchema>) {
  const where: Record<string, unknown> = {
    moderationStatus: query.verified === false ? 'PENDING' : 'APPROVED',
  };

  if (query.category) where.category = query.category;
  if (query.difficulty) where.difficulty = query.difficulty;

  if (query.minSaving !== undefined || query.maxSaving !== undefined) {
    where.estimatedMonthlySaving = {};
    if (query.minSaving !== undefined) where.estimatedMonthlySaving.gte = query.minSaving;
    if (query.maxSaving !== undefined) where.estimatedMonthlySaving.lte = query.maxSaving;
  }

  if (query.search) {
    where.OR = [
      { title: { contains: query.search } },
      { description: { contains: query.search } },
      { tags: { contains: query.search } },
    ];
  }

  return where;
}

function buildOrderBy(sort: string) {
  switch (sort) {
    case 'saving':
      return { estimatedMonthlySaving: 'desc' };
    case 'roi':
      return { roiMonths: 'asc' };
    case 'popular':
      return { views: 'desc' };
    default:
      return { createdAt: 'desc' };
  }
}

// ---------- Routes ----------
// GET /api/diy/tips — liste paginée + filtres
tips.get('/', zValidator('query', listQuerySchema), async (c) => {
  const query = c.req.valid('query');
  const where = buildWhere(query);
  const orderBy = buildOrderBy(query.sort);
  const skip = (query.page - 1) * query.limit;

  const [items, total] = await Promise.all([
    prisma.diyTip.findMany({
      where,
      orderBy,
      skip,
      take: query.limit,
      include: {
        safetyWarnings: true,
      },
    }),
    prisma.diyTip.count({ where }),
  ]);

  return c.json({
    items: items.map((t) => ({
      ...t,
      roiMonths: calcROI(t.equipmentCost, t.estimatedMonthlySaving),
    })),
    pagination: {
      page: query.page,
      limit: query.limit,
      total,
      pages: Math.ceil(total / query.limit),
    },
  });
});

// GET /api/diy/tips/categories — catégories + compteurs
tips.get('/categories', async (c) => {
  const categories = await prisma.diyTip.groupBy({
    by: ['category'],
    where: { moderationStatus: 'APPROVED' },
    _count: { category: true },
    _avg: { estimatedMonthlySaving: true },
  });

  return c.json(
    categories.map((c) => ({
      category: c.category,
      count: c._count.category,
      avgSaving: Math.round(c._avg.estimatedMonthlySaving || 0),
    })),
  );
});

// GET /api/diy/tips/filters — options pour filtres intelligents
tips.get('/filters', async (c) => {
  const [difficulties, savingsRange] = await Promise.all([
    prisma.diyTip.groupBy({
      by: ['difficulty'],
      where: { moderationStatus: 'APPROVED' },
      _count: { difficulty: true },
    }),
    prisma.diyTip.aggregate({
      where: { moderationStatus: 'APPROVED' },
      _min: { estimatedMonthlySaving: true },
      _max: { estimatedMonthlySaving: true },
    }),
  ]);

  return c.json({
    difficulties: difficulties.map((d) => ({
      value: d.difficulty,
      label: d.difficulty === 'EASY' ? 'Facile' : d.difficulty === 'MEDIUM' ? 'Moyen' : 'Expert',
      count: d._count.difficulty,
    })),
    savingRange: {
      min: Math.floor(savingsRange._min.estimatedMonthlySaving || 0),
      max: Math.ceil(savingsRange._max.estimatedMonthlySaving || 0),
    },
  });
});

// GET /api/diy/tips/:slug — détail d'une astuce
tips.get('/:slug', async (c) => {
  const slug = c.req.param('slug');

  const tip = await prisma.diyTip.findUnique({
    where: { slug },
    include: { safetyWarnings: true },
  });

  if (!tip || tip.moderationStatus !== 'APPROVED') {
    return c.json({ error: 'Astuce non trouvée' }, 404);
  }

  // Incrémenter les vues
  await prisma.diyTip.update({
    where: { id: tip.id },
    data: { views: { increment: 1 } },
  });

  return c.json({
    ...tip,
    roiMonths: calcROI(tip.equipmentCost, tip.estimatedMonthlySaving),
  });
});

// POST /api/diy/tips — créer (admin/editor)
tips.post('/', zValidator('json', createTipSchema), async (c) => {
  const data = c.req.valid('json');
  const user = c.get('user'); // injecté par middleware auth

  const { safetyWarnings, ...tipData } = data;
  const roiMonths = calcROI(tipData.equipmentCost, tipData.estimatedMonthlySaving);

  const tip = await prisma.diyTip.create({
    data: {
      ...tipData,
      roiMonths,
      moderationStatus: user?.role === 'ADMIN' ? 'APPROVED' : 'PENDING',
      reviewedBy: user?.role === 'ADMIN' ? user.id : null,
      reviewedAt: user?.role === 'ADMIN' ? new Date() : null,
      safetyWarnings: safetyWarnings.length > 0 ? { create: safetyWarnings } : undefined,
    },
    include: { safetyWarnings: true },
  });

  return c.json(tip, 201);
});

// PATCH /api/diy/tips — modifier (admin/editor)
tips.patch('/', zValidator('json', updateTipSchema), async (c) => {
  const { id, ...data } = c.req.valid('json');
  const user = c.get('user');

  // Vérifier que l'utilisateur a le droit (admin ou créateur/reviewer)
  const existing = await prisma.diyTip.findUnique({ where: { id } });
  if (!existing) return c.json({ error: 'Non trouvé' }, 404);

  if (user?.role !== 'ADMIN' && existing.reviewedBy !== user?.id) {
    return c.json({ error: 'Non autorisé' }, 403);
  }

  const roiMonths = calcROI(
    data.equipmentCost ?? existing.equipmentCost,
    data.estimatedMonthlySaving ?? existing.estimatedMonthlySaving,
  );

  const { safetyWarnings: newWarnings, ...updateData } = data;

  const tip = await prisma.$transaction(async (tx) => {
    if (newWarnings) {
      await tx.diyTipSafetyWarning.deleteMany({ where: { tipId: id } });
    }

    return tx.diyTip.update({
      where: { id },
      data: {
        ...updateData,
        roiMonths,
        moderationStatus: user?.role === 'ADMIN' ? updateData.moderationStatus ?? 'APPROVED' : existing.moderationStatus,
        reviewedBy: user?.role === 'ADMIN' ? user.id : existing.reviewedBy,
        reviewedAt: user?.role === 'ADMIN' ? new Date() : existing.reviewedAt,
        safetyWarnings: newWarnings ? { create: newWarnings } : undefined,
      },
      include: { safetyWarnings: true },
    });
  });

  return c.json(tip);
});

// DELETE /api/diy/tips/:id — supprimer (admin only)
tips.delete('/:id', async (c) => {
  const id = c.req.param('id');
  const user = c.get('user');

  if (user?.role !== 'ADMIN') {
    return c.json({ error: 'Non autorisé' }, 403);
  }

  const existing = await prisma.diyTip.findUnique({ where: { id } });
  if (!existing) return c.json({ error: 'Non trouvé' }, 404);

  await prisma.diyTip.delete({ where: { id } });
  return c.json({ success: true });
});

// PATCH /api/diy/tips/:id/moderate — modérer (admin/editor)
tips.patch('/:id/moderate', async (c) => {
  const id = c.req.param('id');
  const user = c.get('user');
  const { status } = await c.req.json<{ status: 'APPROVED' | 'REJECTED' }>();

  if (!user || (user.role !== 'ADMIN' && user.role !== 'EDITOR')) {
    return c.json({ error: 'Non autorisé' }, 403);
  }

  if (!['APPROVED', 'REJECTED'].includes(status)) {
    return c.json({ error: 'Statut invalide (APPROVED ou REJECTED)' }, 400);
  }

  const existing = await prisma.diyTip.findUnique({ where: { id } });
  if (!existing) return c.json({ error: 'Non trouvé' }, 404);

  const tip = await prisma.diyTip.update({
    where: { id },
    data: {
      moderationStatus: status,
      isVerified: status === 'APPROVED',
      reviewedBy: user.id,
      reviewedAt: new Date(),
    },
    include: { safetyWarnings: true },
  });

  return c.json(tip);
});

export default tips;