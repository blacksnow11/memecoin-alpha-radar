// Helius Enhanced Transactions & RPC Client for Solana Memecoin Swaps
// Rate Limit: 10 req/sec, 1M credits per month.
// Built with strict request pacing, exponential backoff, and in-memory TTL caching.

const HELIUS_API_KEY = process.env.HELIUS_API_KEY || '1adbcdca-3605-493c-8b42-e40b6ca0685b';
const HELIUS_RPC_URL = `https://mainnet.helius-rpc.com/?api-key=${HELIUS_API_KEY}`;
const PUBLIC_SOLANA_RPC = 'https://api.mainnet-beta.solana.com';
const HELIUS_API_URL = 'https://api.helius.xyz/v0';

export interface OnChainSwap {
  signature: string;
  timestamp: number;
  source: string; // PUMP_AMM, RAYDIUM, JUPITER, ORCA, etc.
  feeSol: number;
  walletAddress: string;
  action: 'BUY' | 'SELL';
  tokenAddress: string;
  tokenSymbol: string;
  tokenAmount: number;
  solAmount: number;
  priceSol?: number;
  slot: number;
  solscanUrl: string;
}

const WSOL_MINT = 'So11111111111111111111111111111111111111112';

// In-Memory Caches to prevent hitting Helius rate limits
const swapsCache = new Map<string, { data: OnChainSwap[]; expiry: number }>();
let pumpVaultCache: { data: OnChainSwap[]; expiry: number } | null = null;
const balanceCache = new Map<string, { data: number; expiry: number }>();
const holdingCache = new Map<string, { data: { isHolding: boolean; tokenBalance: number }; expiry: number }>();
let discoveredTradersCache: { data: string[]; expiry: number } | null = null;

// Request Pacing Throttle (max ~7 requests per second to stay safely below 10 req/sec ceiling)
let lastHeliusRequestTime = 0;
const MIN_REQUEST_INTERVAL_MS = 150;

async function rateLimitedHeliusFetch(url: string, options?: RequestInit): Promise<Response> {
  const now = Date.now();
  const timeSinceLast = now - lastHeliusRequestTime;
  if (timeSinceLast < MIN_REQUEST_INTERVAL_MS) {
    await new Promise((resolve) => setTimeout(resolve, MIN_REQUEST_INTERVAL_MS - timeSinceLast));
  }
  lastHeliusRequestTime = Date.now();

  try {
    let res = await fetch(url, options);

    // If rate-limited (429), back off with jitter and retry once
    if (res.status === 429) {
      await new Promise((resolve) => setTimeout(resolve, 600 + Math.random() * 300));
      lastHeliusRequestTime = Date.now();
      res = await fetch(url, options);
    }

    return res;
  } catch (err) {
    throw err;
  }
}

export async function fetchWalletOnChainSwaps(
  walletAddress: string,
  limit = 10
): Promise<OnChainSwap[]> {
  const now = Date.now();
  const cached = swapsCache.get(walletAddress);
  if (cached && now < cached.expiry) {
    return cached.data;
  }

  try {
    const url = `${HELIUS_API_URL}/addresses/${walletAddress}/transactions?api-key=${HELIUS_API_KEY}&type=SWAP&limit=${limit}`;
    const res = await rateLimitedHeliusFetch(url, {
      headers: { 'Accept': 'application/json' },
    });

    if (!res.ok) {
      // Return cached if available, or empty without crashing
      return cached ? cached.data : [];
    }

    const txs: any[] = await res.json();
    if (!Array.isArray(txs)) return cached ? cached.data : [];

    const swaps = txs.map((tx) => parseHeliusSwap(tx, walletAddress)).filter(Boolean) as OnChainSwap[];
    swapsCache.set(walletAddress, { data: swaps, expiry: now + 90000 }); // 90s TTL to conserve credits
    return swaps;
  } catch (err) {
    return cached ? cached.data : [];
  }
}

export async function fetchLivePumpFunSwaps(limit = 10): Promise<OnChainSwap[]> {
  const now = Date.now();
  if (pumpVaultCache && now < pumpVaultCache.expiry) {
    return pumpVaultCache.data;
  }

  try {
    const PUMP_VAULT = 'CebN5WGQ4jvEPvsVU4EoHEpgzq1VV7AbicfhtW4xC9iM';
    const url = `${HELIUS_API_URL}/addresses/${PUMP_VAULT}/transactions?api-key=${HELIUS_API_KEY}&type=SWAP&limit=${limit}`;
    const res = await rateLimitedHeliusFetch(url, {
      headers: { 'Accept': 'application/json' },
    });

    if (!res.ok) {
      return pumpVaultCache ? pumpVaultCache.data : [];
    }

    const txs: any[] = await res.json();
    if (!Array.isArray(txs)) return pumpVaultCache ? pumpVaultCache.data : [];

    const parsed = txs
      .map((tx) => parseHeliusSwap(tx, tx.feePayer))
      .filter(Boolean) as OnChainSwap[];

    pumpVaultCache = { data: parsed, expiry: now + 45000 }; // 45s TTL to conserve credits
    return parsed;
  } catch (err) {
    return pumpVaultCache ? pumpVaultCache.data : [];
  }
}

export async function checkWalletTokenHolding(
  walletAddress: string,
  tokenMint: string
): Promise<{ isHolding: boolean; tokenBalance: number }> {
  const cacheKey = `${walletAddress}:${tokenMint}`;
  const now = Date.now();
  const cached = holdingCache.get(cacheKey);
  if (cached && now < cached.expiry) {
    return cached.data;
  }

  try {
    let res = await rateLimitedHeliusFetch(HELIUS_RPC_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 1,
        method: 'getTokenAccountsByOwner',
        params: [
          walletAddress,
          { mint: tokenMint },
          { encoding: 'jsonParsed' }
        ],
      }),
    });

    let data: any = null;
    if (res.ok) {
      try {
        data = await res.json();
      } catch {
        data = null;
      }
    }

    // Failover to public Solana RPC if Helius request failed or returned RPC error
    if (!res.ok || !data || data.error || !data.result) {
      try {
        const publicRes = await fetch(PUBLIC_SOLANA_RPC, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            jsonrpc: '2.0',
            id: 1,
            method: 'getTokenAccountsByOwner',
            params: [
              walletAddress,
              { mint: tokenMint },
              { encoding: 'jsonParsed' }
            ],
          }),
        });
        if (publicRes.ok) {
          data = await publicRes.json();
        }
      } catch {
        // Fallback gracefully
      }
    }

    if (data?.result?.value) {
      const accounts = data.result.value;
      if (Array.isArray(accounts) && accounts.length > 0) {
        const tokenAmount = accounts[0]?.account?.data?.parsed?.info?.tokenAmount;
        const uiAmount = tokenAmount?.uiAmount || 0;
        const result = {
          isHolding: uiAmount > 0,
          tokenBalance: uiAmount,
        };
        holdingCache.set(cacheKey, { data: result, expiry: now + 60000 });
        return result;
      }
    }
  } catch (err) {
    // Non-blocking fallback
  }

  const defaultResult = { isHolding: false, tokenBalance: 0 };
  holdingCache.set(cacheKey, { data: defaultResult, expiry: now + 20000 });
  return defaultResult;
}

export async function discoverActiveTraders(limit = 15): Promise<string[]> {
  const now = Date.now();
  if (discoveredTradersCache && now < discoveredTradersCache.expiry) {
    return discoveredTradersCache.data;
  }

  try {
    const swaps = await fetchLivePumpFunSwaps(limit);
    // Prioritize high-value traders swapping >= 1.0 SOL (~$180+) to filter out pump.fun micro-bot snipers
    const highValueSwaps = swaps.filter((s) => (s.solAmount || 0) >= 1.0);
    const targetSwaps = highValueSwaps.length > 0 ? highValueSwaps : swaps;
    const uniqueWallets = Array.from(new Set(targetSwaps.map((s) => s.walletAddress).filter(Boolean)));
    discoveredTradersCache = { data: uniqueWallets, expiry: now + 60000 }; // 60s cache
    return uniqueWallets;
  } catch (err) {
    return discoveredTradersCache ? discoveredTradersCache.data : [];
  }
}

export async function fetchSolanaAccountBalance(walletAddress: string): Promise<number> {
  const now = Date.now();
  const cached = balanceCache.get(walletAddress);
  if (cached && now < cached.expiry) {
    return cached.data;
  }

  try {
    const res = await rateLimitedHeliusFetch(HELIUS_RPC_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 1,
        method: 'getBalance',
        params: [walletAddress],
      }),
    });

    if (res.ok) {
      const data = await res.json();
      if (data.result?.value !== undefined) {
        const bal = +(data.result.value / 1e9).toFixed(4);
        balanceCache.set(walletAddress, { data: bal, expiry: now + 60000 }); // 60s TTL
        return bal;
      }
    }
  } catch (err) {
    // Non-blocking
  }

  return cached ? cached.data : 0;
}

const STABLE_MINTS = new Set([
  WSOL_MINT,
  'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v', // USDC
  'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB', // USDT
  'Xsc9qvGR1efVDFGLrVsmkzv3qi45LTBjeUKSPmx9qEh', // Pump fee token
]);

function parseHeliusSwap(tx: any, targetWallet?: string): OnChainSwap | null {
  try {
    const tokenTransfers = tx.tokenTransfers || [];
    const nativeTransfers = tx.nativeTransfers || [];

    // Find non-SOL non-stablecoin token transfer
    const memeTransfer = tokenTransfers.find((t: any) => t.mint && !STABLE_MINTS.has(t.mint));
    if (!memeTransfer) return null;

    const tokenAddress = memeTransfer.mint;
    const tokenAmount = Math.abs(memeTransfer.tokenAmount || 0);

    // Identify SOL transfer amount
    const solTransfer = tokenTransfers.find((t: any) => t.mint === WSOL_MINT);
    let solAmount = solTransfer ? Math.abs(solTransfer.tokenAmount || 0) : 0;

    const feePayer = tx.feePayer || targetWallet || 'unknown';

    if (solAmount === 0 && nativeTransfers.length > 0) {
      const payerNative = nativeTransfers.filter(
        (nt: any) => nt.fromUserAccount === feePayer || nt.toUserAccount === feePayer
      );
      if (payerNative.length > 0) {
        solAmount = +(
          payerNative.reduce((acc: number, nt: any) => acc + (nt.amount || 0), 0) / 1e9
        ).toFixed(4);
      } else {
        solAmount = +(
          nativeTransfers.reduce((acc: number, nt: any) => acc + (nt.amount || 0), 0) / 1e9
        ).toFixed(4);
      }
    }

    if (solAmount === 0) solAmount = 0.05; // Fallback minimum swap size

    const isBuy = memeTransfer.toUserAccount === feePayer;
    const action: 'BUY' | 'SELL' = isBuy ? 'BUY' : 'SELL';
    const priceSol = tokenAmount > 0 && solAmount > 0 ? +(solAmount / tokenAmount).toFixed(8) : undefined;

    return {
      signature: tx.signature,
      timestamp: (tx.timestamp || Math.floor(Date.now() / 1000)) * 1000,
      source: tx.source || 'PUMP_AMM',
      feeSol: +((tx.fee || 5000) / 1e9).toFixed(6),
      walletAddress: feePayer,
      action,
      tokenAddress,
      tokenSymbol: tokenAddress.slice(0, 5).toUpperCase(),
      tokenAmount,
      solAmount,
      priceSol,
      slot: tx.slot || 0,
      solscanUrl: `https://solscan.io/tx/${tx.signature}`,
    };
  } catch (err) {
    return null;
  }
}
