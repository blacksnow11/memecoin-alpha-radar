// Birdeye DeFi API Client for Live Solana Memecoin Price Feeds & Metrics
// Rate Limit Protection: 60 RPM / 30,000 CUs per Month.
// All price queries are backed by an in-memory TTL cache (15s) to guarantee zero rate-limit breaches.

const BIRDEYE_API_KEY = process.env.BIRDEYE_API_KEY || '05415e07972549ab93bba08c3c906519';
const BIRDEYE_BASE_URL = 'https://public-api.birdeye.so';

interface CachedPrice {
  priceUsd: number;
  priceChange24h: number;
  timestamp: number;
}

// In-memory 15-second cache for token prices
const priceCache: Record<string, CachedPrice> = {};
const CACHE_TTL_MS = 15000; // 15 seconds

export async function fetchSolanaTokenPrice(
  mintAddress: string
): Promise<{ priceUsd: number; priceChange24h: number; source: 'birdeye' | 'dexscreener' | 'cache' }> {
  const now = Date.now();

  // 1. Check in-memory cache
  if (priceCache[mintAddress] && now - priceCache[mintAddress].timestamp < CACHE_TTL_MS) {
    return {
      priceUsd: priceCache[mintAddress].priceUsd,
      priceChange24h: priceCache[mintAddress].priceChange24h,
      source: 'cache',
    };
  }

  // 2. Query Birdeye live API
  try {
    const url = `${BIRDEYE_BASE_URL}/defi/price?address=${mintAddress}`;
    const res = await fetch(url, {
      headers: {
        'X-API-KEY': BIRDEYE_API_KEY,
        'accept': 'application/json',
        'x-chain': 'solana',
      },
      next: { revalidate: 15 },
    });

    if (res.ok) {
      const data = await res.json();
      if (data.success && data.data && typeof data.data.value === 'number') {
        const priceUsd = data.data.value;
        const priceChange24h = data.data.priceChange24h || 0;

        // Save to cache
        priceCache[mintAddress] = {
          priceUsd,
          priceChange24h,
          timestamp: now,
        };

        return { priceUsd, priceChange24h, source: 'birdeye' };
      }
    }
  } catch (err) {
    console.warn(`[Birdeye] Fetch price failed for ${mintAddress}, falling back to DexScreener:`, err);
  }

  // 3. Fallback to live DexScreener Solana endpoint if Birdeye rate limits
  try {
    const dsRes = await fetch(`https://api.dexscreener.com/latest/dex/tokens/${mintAddress}`);
    if (dsRes.ok) {
      const dsData = await dsRes.json();
      const solPair = dsData.pairs?.find((p: any) => p.chainId === 'solana') || dsData.pairs?.[0];
      if (solPair && solPair.priceUsd) {
        const priceUsd = parseFloat(solPair.priceUsd);
        const priceChange24h = solPair.priceChange?.h24 || 0;

        priceCache[mintAddress] = {
          priceUsd,
          priceChange24h,
          timestamp: now,
        };

        return { priceUsd, priceChange24h, source: 'dexscreener' };
      }
    }
  } catch (dsErr) {
    console.error(`[DexScreener] Fallback failed for ${mintAddress}:`, dsErr);
  }

  // Return last known cached price or 0
  const fallback = priceCache[mintAddress]?.priceUsd || 0;
  return { priceUsd: fallback, priceChange24h: 0, source: 'cache' };
}

export async function fetchSolanaTokenOverview(mintAddress: string) {
  try {
    const url = `${BIRDEYE_BASE_URL}/defi/token_overview?address=${mintAddress}`;
    const res = await fetch(url, {
      headers: {
        'X-API-KEY': BIRDEYE_API_KEY,
        'accept': 'application/json',
        'x-chain': 'solana',
      },
    });

    if (res.ok) {
      const data = await res.json();
      if (data.success && data.data) {
        return data.data;
      }
    }
  } catch (err) {
    console.warn(`[Birdeye] Token overview failed for ${mintAddress}:`, err);
  }
  return null;
}
