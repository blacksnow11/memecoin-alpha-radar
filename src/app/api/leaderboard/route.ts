import { NextRequest, NextResponse } from 'next/server';
import { getRankedWallets } from '@/lib/wallet-engine';
import { ChainId } from '@/lib/types';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const chainParam = (searchParams.get('chain') || 'solana') as ChainId | 'all';
    const timeframeParam = (searchParams.get('timeframe') || 'all') as '24h' | '7d' | '30d' | 'all';
    const sortByParam = (searchParams.get('sortBy') || 'dynamic') as 'dynamic' | 'capitalEfficiency' | 'profit' | 'winrate' | 'activity';
    const excludeBots = searchParams.get('excludeBots') !== 'false';
    const activityParam = (searchParams.get('activity') || 'all') as 'all' | 'hot' | 'active';

    const wallets = getRankedWallets(chainParam, timeframeParam, sortByParam, excludeBots, activityParam);

    return NextResponse.json({
      success: true,
      meta: {
        totalWallets: wallets.length,
        chain: chainParam,
        timeframe: timeframeParam,
        sortBy: sortByParam,
        excludeBots,
        activity: activityParam,
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
