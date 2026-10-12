/**
 * DIY Ingestion Service
 * Collecte automatisée d'astuces "fais-toi-même" depuis diverses sources francophones
 * (blogs, flux RSS, sitemaps HTML)
 */
import { parse } from 'node-html-parser';
import { parse as parseRSS } from 'rss-parser';
import { resolve } from 'node:path';

/* ============================================================
 * CONFIGURATION GÉNÉRALE
 * ============================================ */
const CONFIG = {
  maxPages: 5,
  delayBetweenRequests: 1000,
  userAgent:
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36',
  cacheDir: resolve(process.cwd(), '.ingestion-cache'),
};

/* ============================================================
 * TYPES
 * ============================================ */
export interface SourceConfig {
  type: 'rss' | 'sitemap' | 'list-page';
  baseUrl: string;
  slugSelector?: string;
  titleSelector?: string;
  contentSelector?: string;
  dateSelector?: string;
  excludeKeywords?: string[];
  includeKeywords?: string[];
}

export interface RawTip {
  title: string;
  url: string;
  sourceUrl: string;
  excerpt: string;
  date?: string;
  tags: string[];
}

/* ============================================================
 * MOTEUR D'INGESTION PRINCIPAL (100% Fetch & HTML Parser — sans Playwright lourd)
 * ============================================ */
export class DiyIngestionEngine {
  private cache = new Map<string, { data: string; ts: number }>();

  async init() {
    // Plus besoin de lancer un navigateur lourd
  }

  async run(sources: SourceConfig[]): Promise<RawTip[]> {
    const allTips: RawTip[] = [];

    for (const source of sources) {
      try {
        const tips = await this.ingestFromSource(source);
        allTips.push(...tips);
      } catch (e) {
        console.warn(`Erreur ingestion source ${source.baseUrl}:`, e);
      }
    }

    return this.deduplicate(allTips);
  }

  private async ingestFromSource(source: SourceConfig): Promise<RawTip[]> {
    switch (source.type) {
      case 'rss':
        return this.processRSS(source);
      case 'sitemap':
      case 'list-page':
        return this.processListPageAsHTML(source);
      default:
        throw new Error(`Type de source non supporté: ${source.type}`);
    }
  }

  private async processRSS(source: SourceConfig): Promise<RawTip[]> {
    const res = await fetch(source.baseUrl, {
      headers: { 'User-Agent': CONFIG.userAgent },
    });
    const xml = await res.text();
    const feed = await parseRSS(xml);
    return feed.items
      .map((item) => ({
        title: item.title || 'Sans titre',
        url: item.link || '',
        sourceUrl: source.baseUrl,
        excerpt: item.summary || item.contentSnippet || '',
        date: item.pubDate,
        tags: ['rss-import'],
      }))
      .filter((t) => t.url && this.validateContent(t, source));
  }

  private async processListPageAsHTML(source: SourceConfig): Promise<RawTip[]> {
    const html = await this.fetchWithCache(source.baseUrl);
    const root = parse(html);

    // Extraire les liens d'articles
    const links = root.querySelectorAll(source.slugSelector || 'a')
      .map((el) => el.getAttribute('href'))
      .filter((href): href is string => !!href && (href.startsWith('http') || href.startsWith('/')));

    const tips: RawTip[] = [];
    const baseObj = new URL(source.baseUrl);

    for (const rawLink of links.slice(0, CONFIG.maxPages)) {
      const link = rawLink.startsWith('/') ? `${baseObj.origin}${rawLink}` : rawLink;
      await new Promise((r) => setTimeout(r, CONFIG.delayBetweenRequests));
      try {
        const pageHtml = await this.fetchWithCache(link);
        const parsed = parse(pageHtml);
        const title = parsed.querySelector(source.titleSelector || 'h1')?.textContent?.trim() || 'Sans titre';
        const excerpt = parsed.querySelector(source.contentSelector || 'p')?.textContent?.trim().slice(0, 200) || '';

        tips.push({
          title,
          url: link,
          sourceUrl: source.baseUrl,
          excerpt,
          tags: ['scraped-html'],
        });
      } catch {
        console.warn(`Échec scraping page: ${link}`);
      }
    }

    return tips.filter((t) => this.validateContent(t, source));
  }

  private validateContent(tip: RawTip, source: SourceConfig): boolean {
    const txt = `${tip.title} ${tip.excerpt}`.toLowerCase();
    if (source.excludeKeywords && source.excludeKeywords.some((kw) => txt.includes(kw.toLowerCase()))) {
      return false;
    }
    if (source.includeKeywords && source.includeKeywords.length > 0) {
      return source.includeKeywords.some((kw) => txt.includes(kw.toLowerCase()));
    }
    return true;
  }

  private async fetchWithCache(url: string): Promise<string> {
    const cacheKey = url;
    const now = Date.now();

    const cached = this.cache.get(cacheKey);
    if (cached && now - cached.ts < 60_000) {
      return cached.data;
    }

    const res = await fetch(url, { headers: { 'User-Agent': CONFIG.userAgent } });
    const html = await res.text();
    this.cache.set(cacheKey, { data: html, ts: now });
    return html;
  }

  public deduplicate(tips: RawTip[]): RawTip[] {
    const seen = new Set<string>();
    return tips.filter((t) => {
      const key = t.url.toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }

  async close() {
    // Rien à fermer sans navigateur
  }
}
