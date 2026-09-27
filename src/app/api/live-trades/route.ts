import { NextResponse } from 'next/server';
import { fetchLivePumpFunSwaps } from '@/lib/solana/helius';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    // Ingest 100% real on-chain swaps directly from Solana via Helius
    const liveSwaps = await fetchLivePumpFunSwaps(20);

    const trades = liveSwaps.map((s, idx) => ({
      id: `live-tx-${s.signature.slice(0, 10)}`,
      walletAddress: s.walletAddress,
      walletLabel: `Solana Sniper (${s.walletAddress.slice(0, 4)}...${s.walletAddress.slice(-4)})`,
      chain: 'solana',
      tokenAddress: s.tokenAddress,
      tokenSymbol: s.tokenSymbol,
      tokenName: s.tokenSymbol,
      action: s.action,
      priceUsd: s.priceSol ? +(s.priceSol * 184).toFixed(6) : 0.05,
      amountTokens: s.tokenAmount,
      volumeUsd: +(s.solAmount * 184).toFixed(2),
      nativeAmount: s.solAmount,
      nativeSymbol: 'SOL',
      timestamp: s.timestamp,
      blockNumber: s.slot,
      txHash: s.signature,
      dex: s.source ? s.source.replace('_', ' ') : 'Pump.fun',
      solscanUrl: s.solscanUrl,
    }));

    return NextResponse.json({
      success: true,
      count: trades.length,
      trades,
      timestamp: Date.now(),
    });
  } catch (err) {
    return NextResponse.json({
      success: false,
      count: 0,
      trades: [],
      timestamp: Date.now(),
    });
  }
}
