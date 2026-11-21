import fs from 'node:fs';
import path from 'node:path';

export interface LottieCatalogItem {
  id: string;
  title: string;
  category: string;
  keywords: string[];
  lottie: string;
}

export interface LottieSearchResult {
  id: string;
  title: string;
  publicPath: string; // e.g. "lottie/cache/truck.json"
  lottieUrl: string;
  score: number;
}

const CATALOG_URL = 'https://useanimations.com/icons.json';
const CACHE_DIR = path.resolve(process.cwd(), 'remotion/public/lottie/cache');
const CATALOG_CACHE_PATH = path.resolve(process.cwd(), 'remotion/public/lottie/catalog.json');

let inMemoryCatalog: LottieCatalogItem[] | null = null;

/**
 * Loads the Lottie icon catalog from local cache or fetches it from useanimations.com
 */
export async function getLottieCatalog(): Promise<LottieCatalogItem[]> {
  if (inMemoryCatalog && inMemoryCatalog.length > 0) {
    return inMemoryCatalog;
  }

  // Check local disk cache
  if (fs.existsSync(CATALOG_CACHE_PATH)) {
    try {
      const raw = fs.readFileSync(CATALOG_CACHE_PATH, 'utf-8');
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) {
        inMemoryCatalog = parsed;
        return parsed;
      }
    } catch {
      // Ignore disk parse error and fetch fresh
    }
  }

  try {
    const res = await fetch(CATALOG_URL, { signal: AbortSignal.timeout(5000) });
    if (res.ok) {
      const data = (await res.json()) as any;
      if (data && Array.isArray(data.icons)) {
        const items: LottieCatalogItem[] = data.icons.map((item: any) => ({
          id: item.id,
          title: item.title,
          category: item.category,
          keywords: Array.isArray(item.keywords) ? item.keywords : [],
          lottie: item.lottie,
        }));
        // Cache to disk
        fs.mkdirSync(path.dirname(CATALOG_CACHE_PATH), { recursive: true });
        fs.writeFileSync(CATALOG_CACHE_PATH, JSON.stringify(items, null, 2), 'utf-8');
        inMemoryCatalog = items;
        return items;
      }
    }
  } catch (err) {
    console.warn('[LottieService] Failed to fetch online catalog, falling back to empty catalog:', err);
  }

  return inMemoryCatalog || [];
}

/**
 * Searches online catalog for the most relevant Lottie animation based on a query or keywords,
 * downloads the JSON file into remotion/public/lottie/cache/, and returns its public path.
 */
export async function searchAndDownloadLottie(
  query: string,
  extraKeywords: string[] = []
): Promise<LottieSearchResult | null> {
  const catalog = await getLottieCatalog();
  if (!catalog || catalog.length === 0) return null;

  const normalizedQuery = query.toLowerCase().replace(/[^a-z0-9\s-]/g, ' ').trim();
  const tokens = Array.from(
    new Set([
      ...normalizedQuery.split(/\s+/).filter((t) => t.length > 1),
      ...extraKeywords.map((k) => k.toLowerCase().trim()).filter((k) => k.length > 1),
    ])
  );

  if (tokens.length === 0) return null;

  // Synonyms map for common system design / business domains
  const SYNONYMS: Record<string, string[]> = {
    delivery: ['truck', 'package', 'box', 'shopping-bag'],
    courier: ['truck', 'package'],
    driver: ['truck', 'navigation', 'map-pin'],
    scooter: ['truck', 'navigation'],
    rider: ['truck', 'map-pin'],
    food: ['shopping-bag', 'shopping-cart', 'package'],
    restaurant: ['shopping-bag', 'shopping-cart'],
    order: ['shopping-cart', 'package', 'truck'],
    payment: ['credit-card', 'dollar-sign', 'tag'],
    price: ['dollar-sign', 'tag', 'percent'],
    surge: ['trending-up', 'bar-chart', 'dollar-sign'],
    h3: ['map', 'map-pin', 'navigation', 'crosshair'],
    map: ['map', 'map-pin', 'crosshair', 'navigation'],
    location: ['map-pin', 'map', 'navigation', 'crosshair'],
    redis: ['database', 'server', 'cpu', 'hard-drive'],
    cache: ['database', 'server', 'cpu'],
    kafka: ['activity', 'git-branch', 'server', 'command'],
    queue: ['git-branch', 'activity', 'server'],
    database: ['database', 'hard-drive', 'server'],
    cluster: ['server', 'cpu', 'hard-drive'],
    lock: ['lock', 'alert-circle', 'shield'],
    mutex: ['lock', 'alert-triangle'],
    error: ['alert-circle', 'alert-triangle', 'x-octagon'],
    crash: ['alert-triangle', 'alert-circle', 'trending-down'],
    shop: ['shopping-cart', 'shopping-bag', 'tag', 'box'],
    ecommerce: ['shopping-cart', 'shopping-bag', 'credit-card'],
    chart: ['bar-chart', 'pie-chart', 'trending-up'],
    metrics: ['bar-chart', 'trending-up', 'activity'],
    speed: ['activity', 'trending-up', 'cpu'],
    cloud: ['server', 'globe', 'wifi'],
    network: ['wifi', 'globe', 'activity'],
  };

  const directTokens = new Set(tokens);
  const synonymTokens = new Set<string>();

  for (const token of tokens) {
    if (SYNONYMS[token]) {
      for (const syn of SYNONYMS[token]) {
        if (!directTokens.has(syn)) {
          synonymTokens.add(syn);
        }
      }
    }
  }

  let bestMatch: LottieCatalogItem | null = null;
  let highestScore = 0;

  for (const item of catalog) {
    let score = 0;
    const itemId = item.id.toLowerCase();
    const itemTitle = item.title.toLowerCase();
    const itemKw = item.keywords.map((k) => k.toLowerCase());

    // Score direct query tokens (high priority)
    for (const t of directTokens) {
      if (itemId === t) score += 60;
      else if (itemId.includes(t)) score += 30;

      if (itemTitle === t) score += 40;
      else if (itemTitle.includes(t)) score += 20;

      if (itemKw.includes(t)) score += 25;
      else if (itemKw.some((k) => k.includes(t))) score += 10;
    }

    // Score synonym tokens (lower priority fallback)
    for (const t of synonymTokens) {
      if (itemId === t) score += 15;
      else if (itemId.includes(t)) score += 8;

      if (itemTitle.includes(t)) score += 6;

      if (itemKw.includes(t)) score += 5;
    }

    if (score > highestScore) {
      highestScore = score;
      bestMatch = item;
    }
  }

  if (!bestMatch || highestScore < 5) {
    return null;
  }

  // Ensure downloaded to remotion/public/lottie/cache/<id>.json
  fs.mkdirSync(CACHE_DIR, { recursive: true });
  const localFileName = `${bestMatch.id}.json`;
  const localFilePath = path.join(CACHE_DIR, localFileName);
  const publicPath = `lottie/cache/${localFileName}`;

  if (!fs.existsSync(localFilePath)) {
    try {
      const res = await fetch(bestMatch.lottie, { signal: AbortSignal.timeout(6000) });
      if (res.ok) {
        const json = await res.json();
        fs.writeFileSync(localFilePath, JSON.stringify(json), 'utf-8');
        console.log(`[LottieService] Successfully fetched and cached online Lottie: ${bestMatch.id} (${bestMatch.title})`);
      } else {
        console.warn(`[LottieService] Failed to download ${bestMatch.lottie}: HTTP ${res.status}`);
        return null;
      }
    } catch (err) {
      console.warn(`[LottieService] Network error downloading ${bestMatch.lottie}:`, err);
      return null;
    }
  }

  return {
    id: bestMatch.id,
    title: bestMatch.title,
    publicPath,
    lottieUrl: bestMatch.lottie,
    score: highestScore,
  };
}
