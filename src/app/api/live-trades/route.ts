import { NextResponse } from 'next/server';
import { SEED_WALLETS } from '@/lib/wallet-engine';
import { FEATURED_MEMECOINS } from '@/lib/dexscreener';

export const dynamic = 'force-dynamic';

export async function GET() {
  // Aggregate recent trades from our tracked seed wallets and featured tokens
  const trades: any[] = [];

  SEED_WALLETS.forEach((wallet) => {
    wallet.trades.forEach((trade) => {
      trades.push({
        ...trade,
        walletLabel: wallet.label,
        walletWinRate: wallet.winRate,
        walletRank: wallet.rank,
      });
    });
  });

  // Sort by timestamp descending
  trades.sort((a, b) => b.timestamp - a.timestamp);

  return NextResponse.json({
    success: true,
    count: trades.length,
    trades: trades.slice(0, 20),
    timestamp: Date.now(),
  });
}
