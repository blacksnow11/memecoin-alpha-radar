// Helius Enhanced Transactions & RPC Client for Solana Memecoin Swaps
// Rate Limit: 10 req/sec, 1M credits per month.

const HELIUS_API_KEY = process.env.HELIUS_API_KEY || 'f7d85eb1-a07a-4d5f-bbcf-9bb6a859b28a';
const HELIUS_RPC_URL = `https://mainnet.helius-rpc.com/?api-key=${HELIUS_API_KEY}`;
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

export async function fetchWalletOnChainSwaps(
  walletAddress: string,
  limit = 10
): Promise<OnChainSwap[]> {
  try {
    const url = `${HELIUS_API_URL}/addresses/${walletAddress}/transactions?api-key=${HELIUS_API_KEY}&type=SWAP&limit=${limit}`;
    const res = await fetch(url, {
      headers: { 'Accept': 'application/json' },
      next: { revalidate: 10 },
    });

    if (!res.ok) {
      console.warn(`[Helius] Failed to fetch swaps for ${walletAddress}: ${res.statusText}`);
      return [];
    }

    const txs: any[] = await res.json();
    if (!Array.isArray(txs)) return [];

    return txs.map((tx) => parseHeliusSwap(tx, walletAddress)).filter(Boolean) as OnChainSwap[];
  } catch (err) {
    console.error(`[Helius] Error fetching swaps for ${walletAddress}:`, err);
    return [];
  }
}

export async function fetchLivePumpFunSwaps(limit = 10): Promise<OnChainSwap[]> {
  try {
    // Pump.fun fee vault has thousands of live swaps per hour
    const PUMP_VAULT = 'CebN5WGQ4jvEPvsVU4EoHEpgzq1VV7AbicfhtW4xC9iM';
    const url = `${HELIUS_API_URL}/addresses/${PUMP_VAULT}/transactions?api-key=${HELIUS_API_KEY}&type=SWAP&limit=${limit}`;
    const res = await fetch(url, {
      headers: { 'Accept': 'application/json' },
      next: { revalidate: 5 },
    });

    if (!res.ok) return [];
    const txs: any[] = await res.json();
    if (!Array.isArray(txs)) return [];

    return txs
      .map((tx) => parseHeliusSwap(tx, tx.feePayer))
      .filter(Boolean) as OnChainSwap[];
  } catch (err) {
    console.error('[Helius] Live Pump.fun swaps error:', err);
    return [];
  }
}

export async function checkWalletTokenHolding(
  walletAddress: string,
  tokenMint: string
): Promise<{ isHolding: boolean; tokenBalance: number }> {
  try {
    const res = await fetch(HELIUS_RPC_URL, {
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

    if (res.ok) {
      const data = await res.json();
      const accounts = data.result?.value;
      if (Array.isArray(accounts) && accounts.length > 0) {
        const tokenAmount = accounts[0]?.account?.data?.parsed?.info?.tokenAmount;
        const uiAmount = tokenAmount?.uiAmount || 0;
        return {
          isHolding: uiAmount > 0,
          tokenBalance: uiAmount,
        };
      }
    }
  } catch (err) {
    console.warn(`[Helius] checkWalletTokenHolding error for ${walletAddress}:`, err);
  }
  return { isHolding: false, tokenBalance: 0 };
}

export async function discoverActiveTraders(limit = 20): Promise<string[]> {
  try {
    const swaps = await fetchLivePumpFunSwaps(limit);
    const uniqueWallets = Array.from(new Set(swaps.map((s) => s.walletAddress).filter(Boolean)));
    return uniqueWallets;
  } catch (err) {
    console.error('[Helius] discoverActiveTraders error:', err);
    return [];
  }
}

export async function fetchSolanaAccountBalance(walletAddress: string): Promise<number> {
  try {
    const res = await fetch(HELIUS_RPC_URL, {
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
        return +(data.result.value / 1e9).toFixed(4);
      }
    }
  } catch (err) {
    console.warn(`[Helius] getBalance error for ${walletAddress}:`, err);
  }
  return 0;
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
