import { NextResponse } from 'next/server';
import { detectPreBreakoutGemSignals } from '@/lib/solana/gem-radar';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const signals = await detectPreBreakoutGemSignals();
    return NextResponse.json({
      success: true,
      meta: {
        totalSignals: signals.length,
        chain: 'solana',
        generatedAt: Date.now(),
      },
      signals,
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to detect pre-breakout gem signals' },
      { status: 500 }
    );
  }
}
