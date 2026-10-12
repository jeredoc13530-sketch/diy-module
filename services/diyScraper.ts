/**
 * diyScraper - Scraping intelligent de blog DIY/frugal (modèle reusable)
 *
 * Exemple de scraper configuré pour un blog francophone de type
 * "Zéro Déchet / Frugal Living". Modifie les `selectors` pour l'adapter
 * à une autre source.
 *
 * Utilisation:
 *   npx ts-node services/diyScraper.ts --url <surliste-de-langs> --mode list
 */
import { DiyIngestionEngine, SourceConfig, RawTip, ScrapedTipResult } from './diyIngestion';
import { chromium, Browser, Page } from 'playwright';

/* ============================================================
 * CONFIGURATION PAR SOURCE
 * ============================================ */

// Source 1 : flux RSS (le plus robuste → prioritaire)
const RSS_SOURCES: SourceConfig[] = [
  {
    type: 'rss',
    baseUrl: 'https://www.famillezodeschet.fr/blog/feed',
    titleSelector: 'title',
    contentSelector: 'summary',
    includeKeywords: ['diy', 'recette', 'maison', 'zéro déchet', 'économe', 'astuce'],
    excludeKeywords: ['pub', 'sponsorisé', 'partenariat', 'commander'],
  },
  {
    type: 'rss',
    baseUrl: 'https://www.zerodechetonry.fr/feed',
    includeKeywords: ['diy', 'recette', 'maison', 'astuce', 'réutilisé'],
    excludeKeywords: ['pub', 'sponsorisé', 'partenariat'],
  },
];

// Source 2 : pages de listes d'articles (fallback HTML)
const LIST_PAGES: SourceConfig[] = [
  {
    type: 'list-page',
    baseUrl: 'https://www.famillezodeschet.fr/blog',
    slugSelector: 'article a.entry-title, a.post-title',
    titleSelector: 'h1',
    contentSelector: '.entry-content',
    includeKeywords: ['diy', 'recette', 'maison', 'zéro déchet', 'économe', 'astuce', 'bricolage', 'tuto'],
    excludeKeywords: ['pub', 'sponsorisé', 'partenariat', 'vente'],
  },
  {
    type: 'list-page',
    baseUrl: 'https://www.zerodechetonry.fr/articles',
    slugSelector: 'a.archive-link',
    titleSelector: 'h1',
    contentSelector: 'article',
    includeKeywords: ['diy', 'recette', 'astuce', 'faux', 'tuto'],
    excludeKeywords: ['pub', 'sponsorisé', 'partenariat'],
  },
];

/* ============================================================
 * SCRAPING DIRECT (fallback quand Playwright est dispo)
 * ============================================ */
const DIRECT_SCRAPER = {
  // Blog "Famille Zéro Déchet"
  familleZodeschet: {
    baseUrl: 'https://www.famillezodeschet.fr',
    // Sélecteurs à ajuster selon la structure DOM réelle du blog
    listSelector: 'article',
    titleSelector: 'h1, .post-title, .entry-title',
    linkSelector: 'a',
    excerptSelector: '.excerpt, p',
    includeKeywords: ['diy', 'recette', 'maison', 'zéro déchet', 'économe', 'astuce', 'bricolage', 'tuto'],
    excludeKeywords: ['pub', 'sponsorisé', 'partenariat', 'vente'],
  },

  // Blog "Zéro Déchet à Ry"
  zerodechetonry: {
    baseUrl: 'https://www.zerodechetonry.fr',
    listSelector: 'article',
    titleSelector: 'h1, .post-title, .entry-title',
    linkSelector: 'a',
    excerptSelector: '.excerpt, p',
    includeKeywords: ['diy', 'recette', 'astuce', 'faux', 'tuto'],
    excludeKeywords: ['pub', 'sponsorisé', 'partenariat'],
  },
};

/* ============================================================
 * FONCTIONS D'UTILITÉ
 * ============================================ */
function normalizeTags(raw: string): string[] {
  if (!raw) return [];
  const tags = raw
    .split(/[,;|#]/)
    .map((t) => t.trim())
    .filter((t) => t.length > 2)
    .slice(0, 8);
  return tags.length ? tags : ['diy'];
}

async function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/* ============================================================
 * INGESTION PRINCIPALE
 * ============================================ */
async function ingestAll(tips: RawTip[]): Promise<RawTip[]> {
  // Déduplication par URL (même logique que DiyIngestionEngine.deduplicate)
  const seen = new Set<string>();
  const unique = tips.filter((t) => {
    const key = t.url.toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
  console.log(`✅ ${unique.length} astuces uniques prêtes à être validées.`);
  return unique;
}

/* ============================================================
 * POINT D'ENTRÉE (CLI)
 * ============================================ */
async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const mode = args.find((a) => a === '--rss' || a === '--html' || a === '--all') || '--all';
  const out = args.find((a) => a.startsWith('--out='))?.split('=')[1] || 'output/ingestion.json';
  const debug = args.includes('--debug');

  console.log(`Mode: ${mode}`);

  let allTips: RawTip[] = [];

  if (mode === '--rss' || mode === '--all') {
    console.log('→ Ingestion RSS...');
    const engine = new DiyIngestionEngine();
    await engine.init();
    allTips.push(...(await engine.run(RSS_SOURCES)));
    await engine.close();
  }

  if (mode === '--html' || mode === '--all') {
    console.log('→ Scraping pages de listes...');
    const engine = new DiyIngestionEngine();
    await engine.init();
    allTips.push(...(await engine.run(LIST_PAGES)));
    await engine.close();
  }

  const final = await ingestAll(allTips);
  console.log(`Total astuces: ${final.length}`);

  // Sauvegarde JSON (feed vers l'API de modération)
  const json = JSON.stringify(final.map((t) => ({
    ...t,
    tags: normalizeTags(t.tags.join(',')),
  })), null, 2);
  require('fs').writeFileSync(out, json);
  console.log(`Sauvegardé vers ${out}`);
}

// main().catch((e) => {
//   console.error('❌ Erreur:', e);
//   process.exit(1);
// });

export { ingestAll, DIRECT_SCRAPER, RSS_SOURCES, LIST_PAGES };
