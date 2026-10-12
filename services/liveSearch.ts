// ============================================================================
//  Live Web Search & Ingestion Service (DuckDuckGo HTML)
//  Permet de scraper le web en temps réel lors d'une recherche utilisateur
// ============================================================================
import { parse } from 'node-html-parser';
import { prisma } from '../src/lib/prisma';

export async function searchAndIngestWeb(searchQuery: string) {
  if (!searchQuery || searchQuery.trim().length < 2) return;

  try {
    const query = `${searchQuery} astuce diy maison economie`;
    const url = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`;

    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      },
    });

    if (!res.ok) return;

    const html = await res.text();
    const root = parse(html);
    const results = root.querySelectorAll('.result');

    for (const r of results.slice(0, 5)) {
      const titleEl = r.querySelector('.result__title a');
      const snippetEl = r.querySelector('.result__snippet');
      const title = titleEl?.textContent?.trim();
      const rawLink = titleEl?.getAttribute('href');
      const excerpt = snippetEl?.textContent?.trim() || '';

      if (title && rawLink) {
        let targetUrl = rawLink;
        if (rawLink.includes('uddg=')) {
          const match = rawLink.match(/uddg=([^&]+)/);
          if (match) {
            try {
              targetUrl = decodeURIComponent(match[1]);
            } catch {}
          }
        }

        if (!targetUrl.startsWith('http')) continue;

        const slug = title
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, '-')
          .replace(/(^-|-$)/g, '')
          .slice(0, 90) + '-' + Math.random().toString(36).slice(2, 7);

        const externalRef = `live:${targetUrl}`;

        // Enregistrer automatiquement en base pour enrichir la knowledge base
        await prisma.diyTip.upsert({
          where: { externalRef },
          create: {
            externalRef,
            sourceUrl: targetUrl,
            sourceCredit: new URL(targetUrl).hostname,
            slug,
            title,
            description: excerpt || 'Trouvé via recherche web automatisée.',
            category: 'OTHER',
            difficulty: 'EASY',
            estimatedMonthlySaving: 15,
            equipmentCost: 5,
            roiMonths: 1,
            tags: JSON.stringify([searchQuery.toLowerCase(), 'web-live']),
            moderationStatus: 'APPROVED',
            isVerified: true,
          },
          update: {},
        });
      }
    }
  } catch (e) {
    console.warn('Erreur live web search:', e);
  }
}
