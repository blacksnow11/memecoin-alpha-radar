import { NextRequest, NextResponse } from 'next/server';
import { getRankedWallets } from '@/lib/wallet-engine';
import { ChainId } from '@/lib/types';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const chainParam = (searchParams.get('chain') || 'all') as ChainId | 'all';
    const timeframeParam = (searchParams.get('timeframe') || 'all') as '24h' | '7d' | '30d' | 'all';
    const sortByParam = (searchParams.get('sortBy') || 'profit') as 'profit' | 'winrate' | 'alpha';

    const wallets = getRankedWallets(chainParam, timeframeParam, sortByParam);

    return NextResponse.json({
      success: true,
      meta: {
        totalWallets: wallets.length,
        chain: chainParam,
        timeframe: timeframeParam,
        sortBy: sortByParam,
        timestamp: Date.now(),
      },
      wallets,
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to fetch leaderboard' },
      { status: 500 }
    );
  }
}
