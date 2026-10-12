// ============================================================================
//  /api/diy/findings — Trouvailles communautaires (CommunityFinding)
// ============================================================================
import { Hono } from 'hono';
import { z } from 'zod';
import { zValidator } from '@hono/zod-validator';
import { prisma } from '../../lib/prisma';
import { requireAuth, requireEditor } from '../middleware/auth';

const findings = new Hono();

// ---------- Schemas ----------
const createFindingSchema = z.object({
  title: z.string().min(3).max(255),
  content: z.string().min(10),
  category: z.enum(['UPCYCLING', 'TROC', 'LOCAL', 'BRICOLAGE', 'RECUPERATION', 'TIP']),
  location: z.string().max(128).optional(),
  authorName: z.string().max(128).optional(),
});

const listFindingsSchema = z.object({
  category: z.enum(['UPCYCLING', 'TROC', 'LOCAL', 'BRICOLAGE', 'RECUPERATION', 'TIP']).optional(),
  location: z.string().optional(),
  page: z.coerce.number().min(1).default(1),
  limit: z.coerce.number().min(1).max(50).default(12),
});

// ---------- Routes ----------

// GET /api/diy/findings — liste publique (only APPROVED)
findings.get('/', zValidator('query', listFindingsSchema), async (c) => {
  const query = c.req.valid('query');
  const skip = (query.page - 1) * query.limit;

  const where: Record<string, unknown> = { status: 'APPROVED' };
  if (query.category) where.category = query.category;
  if (query.location) {
    where.location = { contains: query.location };
  }

  const [items, total] = await Promise.all([
    prisma.communityFinding.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip,
      take: query.limit,
      select: {
        id: true,
        title: true,
        content: true,
        category: true,
        location: true,
        authorName: true,
        upvotes: true,
        createdAt: true,
      },
    }),
    prisma.communityFinding.count({ where }),
  ]);

  return c.json({
    items,
    pagination: {
      page: query.page,
      limit: query.limit,
      total,
      pages: Math.ceil(total / query.limit),
    },
  });
});

// GET /api/diy/findings/:id — détail
findings.get('/:id', async (c) => {
  const id = c.req.param('id');
  const finding = await prisma.communityFinding.findUnique({ where: { id } });
  if (!finding || finding.status !== 'APPROVED') {
    return c.json({ error: 'Trouvaille non trouvée' }, 404);
  }
  return c.json(finding);
});

// POST /api/diy/findings — soumettre (auth requise)
findings.post('/', requireAuth, zValidator('json', createFindingSchema), async (c) => {
  const user = c.get('user')!;
  const data = c.req.valid('json');

  const finding = await prisma.communityFinding.create({
    data: {
      ...data,
      userId: user.id,
      status: 'PENDING',
    },
  });

  return c.json(finding, 201);
});

// POST /api/diy/findings/:id/upvote — voter (auth requise)
findings.post('/:id/upvote', requireAuth, async (c) => {
  const id = c.req.param('id');

  const finding = await prisma.communityFinding.findUnique({ where: { id } });
  if (!finding || finding.status !== 'APPROVED') {
    return c.json({ error: 'Trouvaille non trouvée' }, 404);
  }

  const updated = await prisma.communityFinding.update({
    where: { id },
    data: { upvotes: { increment: 1 } },
  });

  return c.json({ upvotes: updated.upvotes });
});

// PATCH /api/diy/findings/:id/moderate — modérer (editor/admin)
findings.patch('/:id/moderate', requireEditor, async (c) => {
  const id = c.req.param('id');
  const user = c.get('user')!;
  const { status } = await c.req.json<{ status: 'APPROVED' | 'REJECTED' }>();

  if (!['APPROVED', 'REJECTED'].includes(status)) {
    return c.json({ error: 'Statut invalide (APPROVED ou REJECTED)' }, 400);
  }

  const existing = await prisma.communityFinding.findUnique({ where: { id } });
  if (!existing) return c.json({ error: 'Non trouvé' }, 404);

  const finding = await prisma.communityFinding.update({
    where: { id },
    data: {
      status,
      isVerified: status === 'APPROVED',
    },
  });

  return c.json(finding);
});

// DELETE /api/diy/findings/:id — supprimer (admin, ou auteur si PENDING)
findings.delete('/:id', requireAuth, async (c) => {
  const id = c.req.param('id');
  const user = c.get('user')!;

  const existing = await prisma.communityFinding.findUnique({ where: { id } });
  if (!existing) return c.json({ error: 'Non trouvé' }, 404);

  const isOwner = existing.userId === user.id && existing.status === 'PENDING';
  if (user.role !== 'ADMIN' && !isOwner) {
    return c.json({ error: 'Non autorisé' }, 403);
  }

  await prisma.communityFinding.delete({ where: { id } });
  return c.json({ success: true });
});

export default findings;
