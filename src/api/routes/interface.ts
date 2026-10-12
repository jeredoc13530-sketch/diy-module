// ============================================================================
//  /api/diy/interface — Interface utilisateur pour le module DIY
//  Retourne les données nécessaires pour construire une UI complète
// ============================================================================
import { Hono } from 'hono';
import { prisma } from '../../lib/prisma';

const ui = new Hono();

// GET /api/diy/interface — données pour l'UI complète
ui.get('/', async (c) => {
  const now = new Date();

  // 1. Astuces populaires (top 3)
  const popularTips = await prisma.diyTip.findMany({
    where: { moderationStatus: 'APPROVED' },
    orderBy: { views: 'desc' },
    take: 3,
    select: {
      slug: true,
      title: true,
      category: true,
      difficulty: true,
      estimatedMonthlySaving: true,
      roiMonths: true,
    },
  });

  // 2. Catégories avec compteurs
  const categories = await prisma.diyTip.groupBy({
    by: ['category'],
    where: { moderationStatus: 'APPROVED' },
    _count: { category: true },
  });

  // 3. Défis actifs
  const activeChallenges = await prisma.weeklyChallenge.findMany({
    where: {
      isPublished: true,
      activeEndDate: { gte: now },
    },
    orderBy: { activeStartDate: 'desc' },
    take: 1,
    include: {
      _count: { select: { challenges: true } },
    },
  });

  // 4. Trouvailles récentes
  const recentFindings = await prisma.communityFinding.findMany({
    where: { status: 'APPROVED' },
    orderBy: { createdAt: 'desc' },
    take: 3,
    select: {
      id: true,
      title: true,
      category: true,
      location: true,
      upvotes: true,
    },
  });

  // 5. Stats globales
  const [totalTips, totalSavings] = await Promise.all([
    prisma.diyTip.count({ where: { moderationStatus: 'APPROVED' } }),
    prisma.diyTip.aggregate({
      where: { moderationStatus: 'APPROVED' },
      _sum: { estimatedMonthlySaving: true },
    }),
  ]);

  return c.json({
    popularTips,
    categories: categories.map((c) => ({
      category: c.category,
      count: c._count.category,
    })),
    activeChallenge: activeChallenges[0] ? {
      ...activeChallenges[0],
      participantCount: activeChallenges[0]._count.challenges,
    } : null,
    recentFindings,
    stats: {
      totalTips,
      totalMonthlySavings: totalSavings._sum.estimatedMonthlySaving ?? 0,
    },
  });
});

export default ui;
