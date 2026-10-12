// ============================================================================
//  /api/diy/scraper — API pour déclencher le scraping et l'ingestion en base
// ============================================================================
import { Hono } from 'hono';
import { prisma } from '../../lib/prisma';
import { DiyIngestionEngine } from '../../../services/diyIngestion';
import { RSS_SOURCES, LIST_PAGES } from '../../../services/diyScraper';
import { requireEditor } from '../middleware/auth';

const scraperRoute = new Hono();

// POST /api/diy/scraper/run — Lancer le scraping et enregistrer en base (réservé éditeur/admin)
scraperRoute.post('/run', requireEditor, async (c) => {
  const engine = new DiyIngestionEngine();
  try {
    await engine.init();

    // 1. Récupérer depuis RSS et Listes
    console.log('🔄 Démarrage du scraping programatique...');
    const rssTips = await engine.run(RSS_SOURCES);
    const htmlTips = await engine.run(LIST_PAGES);

    const allRaw = [...rssTips, ...htmlTips];

    // 2. Déduplication par URL
    const seen = new Set<string>();
    const uniqueTips = allRaw.filter((t) => {
      const key = t.url.toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });

    let addedCount = 0;

    // 3. Inscription en base (Prisma)
    for (const t of uniqueTips) {
      const slug = t.title
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/(^-|-$)/g, '');

      const externalRef = `scrape:${slug}`;

      // Vérifier si existe déjà
      const existing = await prisma.diyTip.findUnique({ where: { externalRef } });
      if (!existing) {
        await prisma.diyTip.create({
          data: {
            externalRef,
            sourceUrl: t.url,
            sourceCredit: 'Web Scraper Automatique',
            slug,
            title: t.title,
            description: t.excerpt || 'Aucune description disponible.',
            category: 'OTHER', // Catégorisation par défaut, modifiable
            difficulty: 'EASY',
            estimatedMonthlySaving: 15, // Valeur estimée par défaut
            equipmentCost: 5,
            roiMonths: 1,
            tags: JSON.stringify(t.tags || ['scraped']),
            moderationStatus: 'PENDING', // En attente de validation humaine
            isVerified: false,
          },
        });
        addedCount++;
      }
    }

    return c.json({
      success: true,
      scraped: uniqueTips.length,
      newTipsAdded: addedCount,
      message: `${addedCount} nouvelles astuces ajoutées en attente de modération.`,
    });
  } catch (error: any) {
    console.error('Erreur scraping:', error);
    return c.json({ error: error.message || 'Erreur lors du scraping' }, 500);
  } finally {
    await engine.close();
  }
});

export default scraperRoute;
