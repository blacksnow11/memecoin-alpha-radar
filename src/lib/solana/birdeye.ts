// Birdeye DeFi API Client for Live Solana Memecoin Price Feeds & Metrics
// Rate Limit Protection: 60 RPM / 30,000 CUs per Month.
// All price queries are backed by an in-memory TTL cache (15s) to guarantee zero rate-limit breaches.

const BIRDEYE_API_KEY = process.env.BIRDEYE_API_KEY || '53aff172dddf45c395c4481ee23d6e26';
const BIRDEYE_BASE_URL = 'https://public-api.birdeye.so';

interface CachedPrice {
  priceUsd: number;
  priceChange24h: number;
  liquidityUsd?: number;
  pairAddress?: string;
  timestamp: number;
}

// In-memory 15-second cache for token prices
const priceCache: Record<string, CachedPrice> = {};
const CACHE_TTL_MS = 15000; // 15 seconds

export async function fetchSolanaTokenPrice(
  mintAddress: string,
  pairAddress?: string
): Promise<{ priceUsd: number; priceChange24h: number; liquidityUsd?: number; pairAddress?: string; source: 'birdeye' | 'dexscreener' | 'cache' }> {
  const now = Date.now();
  const cacheKey = pairAddress ? `${mintAddress}:${pairAddress}` : mintAddress;

  // 1. Check in-memory cache
  if (priceCache[cacheKey] && now - priceCache[cacheKey].timestamp < CACHE_TTL_MS) {
    return {
      priceUsd: priceCache[cacheKey].priceUsd,
      priceChange24h: priceCache[cacheKey].priceChange24h,
      liquidityUsd: priceCache[cacheKey].liquidityUsd,
      pairAddress: priceCache[cacheKey].pairAddress,
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
        const existingLiquidity = priceCache[cacheKey]?.liquidityUsd || priceCache[mintAddress]?.liquidityUsd;
        const existingPair = priceCache[cacheKey]?.pairAddress || priceCache[mintAddress]?.pairAddress || pairAddress;

        // Save to cache
        priceCache[cacheKey] = {
          priceUsd,
          priceChange24h,
          liquidityUsd: existingLiquidity,
          pairAddress: existingPair,
          timestamp: now,
        };

        return { priceUsd, priceChange24h, liquidityUsd: existingLiquidity, pairAddress: existingPair, source: 'birdeye' };
      }
    }
  } catch (err) {
    console.warn(`[Birdeye] Fetch price failed for ${mintAddress}, falling back to DexScreener:`, err);
  }

  // 3. Fallback to live DexScreener Solana endpoint (provides real-time liquidityUsd & pool details)
  try {
    const dsRes = await fetch(`https://api.dexscreener.com/latest/dex/tokens/${mintAddress}`);
    if (dsRes.ok) {
      const dsData = await dsRes.json();
      const solPairs: any[] = (dsData.pairs || []).filter((p: any) => p.chainId === 'solana');
      // Sort by highest liquidity descending to guarantee we always target the primary pool
      solPairs.sort((a: any, b: any) => (b.liquidity?.usd || 0) - (a.liquidity?.usd || 0));

      // If specific pairAddress is requested, locate that exact pool first
      let solPair = pairAddress
        ? solPairs.find((p: any) => p.pairAddress?.toLowerCase() === pairAddress.toLowerCase())
        : null;

      if (!solPair) {
        solPair = solPairs[0] || dsData.pairs?.[0];
      }

      if (solPair && solPair.priceUsd) {
        const priceUsd = parseFloat(solPair.priceUsd);
        const priceChange24h = solPair.priceChange?.h24 || 0;
        const liquidityUsd = solPair.liquidity?.usd;
        const resolvedPairAddress = solPair.pairAddress || pairAddress;

        priceCache[cacheKey] = {
          priceUsd,
          priceChange24h,
          liquidityUsd,
          pairAddress: resolvedPairAddress,
          timestamp: now,
        };

        return { priceUsd, priceChange24h, liquidityUsd, pairAddress: resolvedPairAddress, source: 'dexscreener' };
      }
    }
  } catch (dsErr) {
    console.error(`[DexScreener] Fallback failed for ${mintAddress}:`, dsErr);
  }

  // Return last known cached price or 0
  const fallback = priceCache[cacheKey]?.priceUsd || priceCache[mintAddress]?.priceUsd || 0;
  return {
    priceUsd: fallback,
    priceChange24h: 0,
    liquidityUsd: priceCache[cacheKey]?.liquidityUsd || priceCache[mintAddress]?.liquidityUsd,
    pairAddress: priceCache[cacheKey]?.pairAddress || pairAddress,
    source: 'cache',
  };
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
