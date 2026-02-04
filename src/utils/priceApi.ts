// ISIN to ticker symbol mapping (common European stocks and ETFs)
const ISIN_TO_TICKER: Record<string, string> = {
  // US Stocks
  'US0378331005': 'AAPL',  // Apple
  'US5949181045': 'MSFT',  // Microsoft
  'US0231351067': 'AMZN',  // Amazon
  'US02079K3059': 'GOOGL', // Alphabet
  'US30303M1027': 'META',  // Meta
  'US88160R1014': 'TSLA',  // Tesla
  'US67066G1040': 'NVDA',  // Nvidia
  'US0846707026': 'BRK-B', // Berkshire Hathaway
  'US4781601046': 'JNJ',   // Johnson & Johnson
  'US7427181091': 'PG',    // Procter & Gamble

  // European ETFs
  'IE00B4L5Y983': 'IWDA.AS', // iShares Core MSCI World
  'IE00B5BMR087': 'CSPX.AS', // iShares Core S&P 500
  'IE00B3RBWM25': 'VWRL.AS', // Vanguard FTSE All-World
  'IE00BK5BQT80': 'VWCE.DE', // Vanguard FTSE All-World Acc
  'LU0392494562': 'DBXD.DE', // Xtrackers MSCI World
  'IE00BKM4GZ66': 'EMIM.AS', // iShares Core EM IMI
  'IE00B4L5YC18': 'IEMA.AS', // iShares MSCI EM

  // European Stocks
  'NL0010273215': 'ASML.AS', // ASML
  'DE0007164600': 'SAP.DE',  // SAP
  'FR0000121014': 'MC.PA',   // LVMH
  'DE0007236101': 'SIE.DE',  // Siemens
  'CH0012032048': 'ROG.SW',  // Roche
  'CH0038863350': 'NESN.SW', // Nestle
  'GB0005405286': 'HSBA.L',  // HSBC
  'GB00B03MLX29': 'RDSA.AS', // Shell
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

// Convert ISIN to ticker symbol
export function isinToTicker(isin: string): string | null {
  return ISIN_TO_TICKER[isin.toUpperCase()] || null;
}

// Register a custom ISIN to ticker mapping
export function registerIsinMapping(isin: string, ticker: string): void {
  ISIN_TO_TICKER[isin.toUpperCase()] = ticker;

  // Also save to localStorage for persistence
  const customMappings = JSON.parse(localStorage.getItem('custom_isin_mappings') || '{}');
  customMappings[isin.toUpperCase()] = ticker;
  localStorage.setItem('custom_isin_mappings', JSON.stringify(customMappings));
}

// Load custom mappings from localStorage
export function loadCustomMappings(): void {
  const customMappings = JSON.parse(localStorage.getItem('custom_isin_mappings') || '{}');
  Object.assign(ISIN_TO_TICKER, customMappings);
}

// Fetch price from Yahoo Finance via public API
async function fetchYahooPrice(ticker: string): Promise<{
  price: number;
  currency: string;
  change: number;
  changePercent: number;
} | null> {
  try {
    // Use Yahoo Finance's chart API which doesn't require authentication
    const response = await fetch(
      `https://query1.finance.yahoo.com/v8/finance/chart/${ticker}?interval=1d&range=1d`,
      {
        headers: {
          'User-Agent': 'Mozilla/5.0',
        },
      }
    );

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const data = await response.json();
    const result = data.chart?.result?.[0];

    if (!result) {
      return null;
    }

    const meta = result.meta;
    const quote = result.indicators?.quote?.[0];

    const currentPrice = meta.regularMarketPrice || quote?.close?.[quote.close.length - 1];
    const previousClose = meta.previousClose || meta.chartPreviousClose;
    const change = currentPrice - previousClose;
    const changePercent = (change / previousClose) * 100;

    return {
      price: currentPrice,
      currency: meta.currency || 'USD',
      change,
      changePercent,
    };
  } catch (error) {
    console.error(`Failed to fetch price for ${ticker}:`, error);
    return null;
  }
}

// Alternative: Use a CORS proxy for client-side fetching
async function fetchWithProxy(ticker: string): Promise<{
  price: number;
  currency: string;
  change: number;
  changePercent: number;
} | null> {
  try {
    // Using allorigins.win as a CORS proxy
    const targetUrl = `https://query1.finance.yahoo.com/v8/finance/chart/${ticker}?interval=1d&range=1d`;
    const proxyUrl = `https://api.allorigins.win/raw?url=${encodeURIComponent(targetUrl)}`;

    const response = await fetch(proxyUrl);

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const data = await response.json();
    const result = data.chart?.result?.[0];

    if (!result) {
      return null;
    }

    const meta = result.meta;
    const currentPrice = meta.regularMarketPrice;
    const previousClose = meta.previousClose || meta.chartPreviousClose;
    const change = currentPrice - previousClose;
    const changePercent = previousClose > 0 ? (change / previousClose) * 100 : 0;

    return {
      price: currentPrice,
      currency: meta.currency || 'USD',
      change,
      changePercent,
    };
  } catch (error) {
    console.error(`Failed to fetch price for ${ticker} via proxy:`, error);
    return null;
  }
}

// Main function to fetch price for an ISIN
export async function fetchPrice(isin: string): Promise<PriceResult> {
  const ticker = isinToTicker(isin);

  if (!ticker) {
    return {
      isin,
      ticker: '',
      price: 0,
      currency: 'EUR',
      change: 0,
      changePercent: 0,
      lastUpdated: new Date(),
      error: 'Unknown ISIN - please add ticker mapping',
    };
  }

  // Try direct fetch first, then proxy
  let result = await fetchYahooPrice(ticker);

  if (!result) {
    result = await fetchWithProxy(ticker);
  }

  if (!result) {
    return {
      isin,
      ticker,
      price: 0,
      currency: 'EUR',
      change: 0,
      changePercent: 0,
      lastUpdated: new Date(),
      error: 'Failed to fetch price',
    };
  }

  return {
    isin,
    ticker,
    price: result.price,
    currency: result.currency,
    change: result.change,
    changePercent: result.changePercent,
    lastUpdated: new Date(),
  };
}

// Fetch prices for multiple ISINs
export async function fetchPrices(isins: string[]): Promise<Map<string, PriceResult>> {
  loadCustomMappings();

  const results = new Map<string, PriceResult>();

  // Fetch in parallel with a small delay between requests to avoid rate limiting
  const batchSize = 5;
  for (let i = 0; i < isins.length; i += batchSize) {
    const batch = isins.slice(i, i + batchSize);
    const promises = batch.map(fetchPrice);
    const batchResults = await Promise.all(promises);

    batchResults.forEach((result, index) => {
      results.set(batch[index], result);
    });

    // Small delay between batches
    if (i + batchSize < isins.length) {
      await new Promise(resolve => setTimeout(resolve, 500));
    }
  }

  return results;
}

// Get known tickers for display
export function getKnownTickers(): Record<string, string> {
  loadCustomMappings();
  return { ...ISIN_TO_TICKER };
}
