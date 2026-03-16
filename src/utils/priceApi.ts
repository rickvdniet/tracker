const PROXY_STORAGE_KEY = 'degiro_custom_proxy_url';

export function getCustomProxyUrl(): string {
  return localStorage.getItem(PROXY_STORAGE_KEY) ?? '';
}

export function setCustomProxyUrl(url: string): void {
  const trimmed = url.trim().replace(/\/?$/, '/'); // ensure trailing slash
  if (trimmed === '/') {
    localStorage.removeItem(PROXY_STORAGE_KEY);
  } else {
    localStorage.setItem(PROXY_STORAGE_KEY, trimmed);
  }
}

// Build ordered list of CORS proxies to try.
// Custom proxy (if set) goes first; public fallbacks follow.
function getProxies(): string[] {
  const custom = getCustomProxyUrl();
  const publics = [
    'https://corsproxy.io/?url=',
    'https://api.allorigins.win/raw?url=',
    'https://api.codetabs.com/v1/proxy?quest=',
  ];
  // Custom Cloudflare Worker expects: <workerUrl>?url=<encoded-target>
  return custom ? [`${custom}?url=`, ...publics] : publics;
}

// ISIN to ticker symbol mapping (common European stocks and ETFs)
const ISIN_TO_TICKER: Record<string, string> = {
  // US Stocks
  'US0378331005': 'AAPL',   // Apple
  'US5949181045': 'MSFT',   // Microsoft
  'US0231351067': 'AMZN',   // Amazon
  'US02079K3059': 'GOOGL',  // Alphabet
  'US30303M1027': 'META',   // Meta
  'US88160R1014': 'TSLA',   // Tesla
  'US67066G1040': 'NVDA',   // Nvidia
  'US0846707026': 'BRK-B',  // Berkshire Hathaway
  'US4781601046': 'JNJ',    // Johnson & Johnson
  'US7427181091': 'PG',     // Procter & Gamble

  // Swedish Stocks
  'SE0015811955': 'INVE-B.ST', // Investor AB Class B
  'SE0000107401': 'INVE-A.ST', // Investor AB Class A
  'SE0007525332': 'SWED-A.ST', // Swedbank
  'SE0000115446': 'VOLV-B.ST', // Volvo B
  'SE0000667925': 'ATCO-A.ST', // Atlas Copco A
  'SE0011166610': 'ATCO-B.ST', // Atlas Copco B
  'SE0000655199': 'HEXA-B.ST', // Hexagon B
  'SE0000108656': 'ERIC-B.ST', // Ericsson B
  'SE0000112724': 'ABB.ST',    // ABB
  'SE0000667891': 'ALFA.ST',   // Alfa Laval

  // European ETFs
  'IE00B4L5Y983': 'IWDA.AS',  // iShares Core MSCI World
  'IE00B5BMR087': 'CSPX.AS',  // iShares Core S&P 500
  'IE00B3RBWM25': 'VWRL.AS',  // Vanguard FTSE All-World
  'IE00BK5BQT80': 'VWCE.DE',  // Vanguard FTSE All-World Acc
  'LU0392494562': 'DBXD.DE',  // Xtrackers MSCI World
  'IE00BKM4GZ66': 'EMIM.AS',  // iShares Core EM IMI
  'IE00B4L5YC18': 'IEMA.AS',  // iShares MSCI EM

  // European Stocks
  'NL0010273215': 'ASML.AS',  // ASML
  'DE0007164600': 'SAP.DE',   // SAP
  'FR0000121014': 'MC.PA',    // LVMH
  'DE0007236101': 'SIE.DE',   // Siemens
  'CH0012032048': 'ROG.SW',   // Roche
  'CH0038863350': 'NESN.SW',  // Nestle
  'GB0005405286': 'HSBA.L',   // HSBC
  'GB00B03MLX29': 'RDSA.AS',  // Shell
};

export interface PriceResult {
  isin: string;
  ticker: string;
  price: number;
  currency: string;
  change: number;
  changePercent: number;
  lastUpdated: Date;
  error?: string;
}

export function isinToTicker(isin: string): string | null {
  return ISIN_TO_TICKER[isin.toUpperCase()] || null;
}

export function registerIsinMapping(isin: string, ticker: string): void {
  ISIN_TO_TICKER[isin.toUpperCase()] = ticker;
  const customMappings = JSON.parse(localStorage.getItem('custom_isin_mappings') || '{}');
  customMappings[isin.toUpperCase()] = ticker;
  localStorage.setItem('custom_isin_mappings', JSON.stringify(customMappings));
}

export function loadCustomMappings(): void {
  const customMappings = JSON.parse(localStorage.getItem('custom_isin_mappings') || '{}');
  Object.assign(ISIN_TO_TICKER, customMappings);
}

interface YahooResult {
  price: number;
  currency: string;
  change: number;
  changePercent: number;
}

function parseYahooResponse(data: unknown): YahooResult | null {
  const result = (data as { chart?: { result?: { meta: { regularMarketPrice: number; previousClose?: number; chartPreviousClose?: number; currency?: string } }[] } })
    .chart?.result?.[0];
  if (!result) return null;

  const meta = result.meta;
  const currentPrice = meta.regularMarketPrice;
  const previousClose = meta.previousClose ?? meta.chartPreviousClose ?? currentPrice;
  const change = currentPrice - previousClose;
  const changePercent = previousClose > 0 ? (change / previousClose) * 100 : 0;

  return {
    price: currentPrice,
    currency: meta.currency || 'USD',
    change,
    changePercent,
  };
}

async function fetchViaProxy(ticker: string, proxyUrl: string): Promise<YahooResult | null> {
  try {
    const targetUrl = `https://query2.finance.yahoo.com/v8/finance/chart/${ticker}?interval=1d&range=1d`;
    const response = await fetch(proxyUrl + encodeURIComponent(targetUrl), {
      signal: AbortSignal.timeout(8000),
    });
    if (!response.ok) return null;
    const data = await response.json();
    return parseYahooResponse(data);
  } catch {
    return null;
  }
}

export async function fetchPrice(isin: string): Promise<PriceResult> {
  loadCustomMappings();
  const ticker = isinToTicker(isin);

  if (!ticker) {
    return {
      isin, ticker: '', price: 0, currency: 'EUR',
      change: 0, changePercent: 0, lastUpdated: new Date(),
      error: 'No ticker — click + to add one',
    };
  }

  for (const proxy of getProxies()) {
    const result = await fetchViaProxy(ticker, proxy);
    if (result && result.price > 0) {
      return {
        isin, ticker,
        price: result.price,
        currency: result.currency,
        change: result.change,
        changePercent: result.changePercent,
        lastUpdated: new Date(),
      };
    }
  }

  return {
    isin, ticker, price: 0, currency: 'EUR',
    change: 0, changePercent: 0, lastUpdated: new Date(),
    error: 'Could not fetch — update manually',
  };
}

// Fetch monthly historical closing prices for a ticker symbol
// Returns array of { date: 'yyyy-MM', price } sorted oldest → newest
export async function fetchHistoricalPrices(
  ticker: string,
  rangeYears: number = 5
): Promise<Array<{ date: string; price: number }>> {
  const targetUrl = `https://query2.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(ticker)}?interval=1wk&range=${rangeYears}y`;

  for (const proxy of getProxies()) {
    try {
      const response = await fetch(proxy + encodeURIComponent(targetUrl), {
        signal: AbortSignal.timeout(12000),
      });
      if (!response.ok) continue;
      const data = await response.json();
      const result = (data as { chart?: { result?: { timestamp: number[]; indicators: { adjclose?: { adjclose: (number | null)[] }[]; quote: { close: (number | null)[] }[] } }[] } }).chart?.result?.[0];
      if (!result) continue;

      const timestamps: number[] = result.timestamp || [];
      const closes: (number | null)[] =
        result.indicators?.adjclose?.[0]?.adjclose ||
        result.indicators?.quote?.[0]?.close || [];

      const points: Array<{ date: string; price: number }> = [];
      for (let i = 0; i < timestamps.length; i++) {
        const price = closes[i];
        if (price == null || price <= 0) continue;
        // Format as yyyy-MM-dd (week start date)
        const d = new Date(timestamps[i] * 1000);
        const dateStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
        points.push({ date: dateStr, price });
      }
      if (points.length > 0) return points;
    } catch {
      continue;
    }
  }
  return [];
}

// Fetch EUR per 1 unit of the given currency (e.g. 'SEK' → ~0.088)
export async function fetchExchangeRate(currency: string): Promise<number | null> {
  if (currency === 'EUR') return 1;
  const ticker = `${currency}EUR=X`;
  for (const proxy of getProxies()) {
    const result = await fetchViaProxy(ticker, proxy);
    if (result && result.price > 0) return result.price;
  }
  return null;
}

export async function fetchPrices(isins: string[]): Promise<Map<string, PriceResult>> {
  loadCustomMappings();
  const results = new Map<string, PriceResult>();

  // Fetch sequentially to avoid rate limiting
  for (const isin of isins) {
    results.set(isin, await fetchPrice(isin));
    await new Promise(resolve => setTimeout(resolve, 300));
  }

  return results;
}

export function getKnownTickers(): Record<string, string> {
  loadCustomMappings();
  return { ...ISIN_TO_TICKER };
}
