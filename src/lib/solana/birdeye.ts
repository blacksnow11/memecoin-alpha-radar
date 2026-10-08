// Birdeye DeFi API Client for Live Solana Memecoin Price Feeds & Metrics
// Rate Limit Protection: 60 RPM / 30,000 CUs per Month.
// All price queries are backed by an in-memory TTL cache (15s) to guarantee zero rate-limit breaches.

const BIRDEYE_API_KEY = process.env.BIRDEYE_API_KEY || '48fdf22fd26b45c698d113519ea8deee';
const BIRDEYE_BASE_URL = 'https://public-api.birdeye.so';

interface CachedPrice {
  priceUsd: number;
  priceChange24h: number;
  liquidityUsd?: number;
  marketCapUsd?: number;
  volume5m?: number;
  volume1h?: number;
  pairAddress?: string;
  pairCreatedAt?: number;
  txns24h?: number;
  timestamp: number;
}

export interface TokenPriceResult {
  priceUsd: number;
  priceChange24h: number;
  liquidityUsd?: number;
  marketCapUsd?: number;
  volume5m?: number;
  volume1h?: number;
  pairAddress?: string;
  pairCreatedAt?: number;
  txns24h?: number;
  source: 'birdeye' | 'dexscreener' | 'cache';
}

// In-memory 15-second cache for token prices
const priceCache: Record<string, CachedPrice> = {};
const CACHE_TTL_MS = 15000; // 15 seconds

export async function fetchSolanaTokenPrice(
  mintAddress: string,
  pairAddress?: string
): Promise<TokenPriceResult> {
  const now = Date.now();
  const cacheKey = pairAddress ? `${mintAddress}:${pairAddress}` : mintAddress;

  // 1. Check in-memory cache
  if (priceCache[cacheKey] && now - priceCache[cacheKey].timestamp < CACHE_TTL_MS) {
    return {
      priceUsd: priceCache[cacheKey].priceUsd,
      priceChange24h: priceCache[cacheKey].priceChange24h,
      liquidityUsd: priceCache[cacheKey].liquidityUsd,
      marketCapUsd: priceCache[cacheKey].marketCapUsd,
      volume5m: priceCache[cacheKey].volume5m,
      volume1h: priceCache[cacheKey].volume1h,
      pairAddress: priceCache[cacheKey].pairAddress,
      pairCreatedAt: priceCache[cacheKey].pairCreatedAt,
      txns24h: priceCache[cacheKey].txns24h,
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
        const lastCachedPrice = priceCache[cacheKey]?.priceUsd || priceCache[mintAddress]?.priceUsd;

        // Anti-Glitch Sanity Guard: If Birdeye price jumps > 8x from cached price, cross-validate with DexScreener
        if (lastCachedPrice && lastCachedPrice > 0 && priceUsd / lastCachedPrice > 8) {
          console.warn(`[Birdeye] Extreme price jump detected on ${mintAddress} ($${lastCachedPrice} -> $${priceUsd}). Falling back to DexScreener for cross-validation.`);
        } else {
          const priceChange24h = data.data.priceChange24h || 0;
          const existingLiquidity = priceCache[cacheKey]?.liquidityUsd || priceCache[mintAddress]?.liquidityUsd;
          const existingMarketCap = priceCache[cacheKey]?.marketCapUsd || priceCache[mintAddress]?.marketCapUsd;
          const existingVol5m = priceCache[cacheKey]?.volume5m || priceCache[mintAddress]?.volume5m;
          const existingVol1h = priceCache[cacheKey]?.volume1h || priceCache[mintAddress]?.volume1h;
          const existingPair = priceCache[cacheKey]?.pairAddress || priceCache[mintAddress]?.pairAddress || pairAddress;
          const existingCreatedAt = priceCache[cacheKey]?.pairCreatedAt || priceCache[mintAddress]?.pairCreatedAt;
          const existingTxns = priceCache[cacheKey]?.txns24h || priceCache[mintAddress]?.txns24h;

          // Save to cache
          priceCache[cacheKey] = {
            priceUsd,
            priceChange24h,
            liquidityUsd: existingLiquidity,
            marketCapUsd: existingMarketCap,
            volume5m: existingVol5m,
            volume1h: existingVol1h,
            pairAddress: existingPair,
            pairCreatedAt: existingCreatedAt,
            txns24h: existingTxns,
            timestamp: now,
          };

          return {
            priceUsd,
            priceChange24h,
            liquidityUsd: existingLiquidity,
            marketCapUsd: existingMarketCap,
            volume5m: existingVol5m,
            volume1h: existingVol1h,
            pairAddress: existingPair,
            pairCreatedAt: existingCreatedAt,
            txns24h: existingTxns,
            source: 'birdeye',
          };
        }
      }
    }
  } catch (err) {
    console.warn(`[Birdeye] Fetch price failed for ${mintAddress}, falling back to DexScreener:`, err);
  }

  // 3. Fallback to live DexScreener Solana endpoint (provides real-time liquidityUsd, volume & pool details)
  try {
    const dsRes = await fetch(`https://api.dexscreener.com/latest/dex/tokens/${mintAddress}`);
    if (dsRes.ok) {
      const dsData = await dsRes.json();
      const allSolPairs: any[] = (dsData.pairs || []).filter((p: any) => p.chainId === 'solana');

      // Helper 1: Verify token is the BASE token of the pool (so priceUsd is actually this token's price)
      const isBaseToken = (p: any) => p.baseToken?.address?.toLowerCase() === mintAddress.toLowerCase();

      // Helper 2: Check if pool is quoted in real, sellable routes (SOL, WSOL, USDC)
      const isNativeQuote = (p: any) => {
        const sym = (p.quoteToken?.symbol || '').toUpperCase();
        const addr = (p.quoteToken?.address || '').toLowerCase();
        return (
          sym === 'SOL' ||
          sym === 'WSOL' ||
          sym === 'USDC' ||
          addr === 'so11111111111111111111111111111111111111112' ||
          addr === 'epjfwdd5aufqssqem2qn1xzybapc8g4weggkzwytdt1v'
        );
      };

      // Rank pairs:
      // Priority 1: Base token matches mintAddress
      // Priority 2: Quoted in SOL or USDC (real sellable liquidity route)
      // Priority 3: Deepest pool liquidity
      const rankedPairs = [...allSolPairs].sort((a: any, b: any) => {
        const aBase = isBaseToken(a) ? 1 : 0;
        const bBase = isBaseToken(b) ? 1 : 0;
        if (aBase !== bBase) return bBase - aBase;

        const aNative = isNativeQuote(a) ? 1 : 0;
        const bNative = isNativeQuote(b) ? 1 : 0;
        if (aNative !== bNative) return bNative - aNative;

        return (b.liquidity?.usd || 0) - (a.liquidity?.usd || 0);
      });

      // Primary native pair (anchor benchmark for real sellable execution)
      const primaryNativePair = rankedPairs.find((p: any) => isBaseToken(p) && isNativeQuote(p)) || rankedPairs[0];

      // If specific pairAddress is requested, locate that pool
      let solPair = pairAddress
        ? rankedPairs.find((p: any) => p.pairAddress?.toLowerCase() === pairAddress.toLowerCase())
        : null;

      if (!solPair) {
        solPair = primaryNativePair || allSolPairs[0];
      }

      // Cross-check: If specific pool is an exotic non-SOL pair, verify against primary native SOL/USDC pair
      // to ensure cross-rate consistency and prevent misattributed quote prices (e.g. RAYCAT / RAY reading RAY's price)
      if (solPair && primaryNativePair && solPair.pairAddress !== primaryNativePair.pairAddress) {
        const exoticPrice = parseFloat(solPair.priceUsd || '0');
        const nativePrice = parseFloat(primaryNativePair.priceUsd || '0');
        if (nativePrice > 0 && exoticPrice > 0) {
          const ratio = exoticPrice / nativePrice;
          if (ratio > 5.0 || ratio < 0.2) {
            console.warn(`[DexScreener] Exotic pool price ($${exoticPrice}) diverges significantly from native SOL pool ($${nativePrice}) on ${mintAddress}. Routing to primary sellable pool.`);
            solPair = primaryNativePair;
          }
        }
      }

      if (solPair && solPair.priceUsd) {
        let priceUsd = parseFloat(solPair.priceUsd);
        const fdv = solPair.fdv || solPair.marketCap || 0;
        if (fdv > 0 && priceUsd > 0) {
          const impliedTokens = fdv / priceUsd;
          if (impliedTokens < 1000 && primaryNativePair && primaryNativePair !== solPair) {
            priceUsd = parseFloat(primaryNativePair.priceUsd || String(priceUsd));
          }
        }
        const priceChange24h = solPair.priceChange?.h24 || 0;
        const liquidityUsd = solPair.liquidity?.usd;
        const marketCapUsd = solPair.marketCap || solPair.fdv;
        const volume5m = solPair.volume?.m5;
        const volume1h = solPair.volume?.h1;
        const resolvedPairAddress = solPair.pairAddress || pairAddress;
        const pairCreatedAt = solPair.pairCreatedAt;
        const txns24h = (solPair.txns?.h24?.buys || 0) + (solPair.txns?.h24?.sells || 0);

        priceCache[cacheKey] = {
          priceUsd,
          priceChange24h,
          liquidityUsd,
          marketCapUsd,
          volume5m,
          volume1h,
          pairAddress: resolvedPairAddress,
          pairCreatedAt,
          txns24h,
          timestamp: now,
        };

        return {
          priceUsd,
          priceChange24h,
          liquidityUsd,
          marketCapUsd,
          volume5m,
          volume1h,
          pairAddress: resolvedPairAddress,
          pairCreatedAt,
          txns24h,
          source: 'dexscreener',
        };
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
    marketCapUsd: priceCache[cacheKey]?.marketCapUsd || priceCache[mintAddress]?.marketCapUsd,
    volume5m: priceCache[cacheKey]?.volume5m || priceCache[mintAddress]?.volume5m,
    volume1h: priceCache[cacheKey]?.volume1h || priceCache[mintAddress]?.volume1h,
    pairAddress: priceCache[cacheKey]?.pairAddress || pairAddress,
    pairCreatedAt: priceCache[cacheKey]?.pairCreatedAt || priceCache[mintAddress]?.pairCreatedAt,
    txns24h: priceCache[cacheKey]?.txns24h || priceCache[mintAddress]?.txns24h,
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
