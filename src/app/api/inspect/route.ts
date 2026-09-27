import { NextRequest, NextResponse } from 'next/server';
import { getWalletByAddress } from '@/lib/wallet-engine';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { address } = body;

    if (!address || typeof address !== 'string' || address.trim().length < 10) {
      return NextResponse.json(
        { success: false, error: 'Please provide a valid Solana wallet address or Pump.fun creator address.' },
        { status: 400 }
      );
    }

    const cleanAddress = address.trim();
    const profile = await getWalletByAddress(cleanAddress);

    return NextResponse.json({
      success: true,
      profile,
      timestamp: Date.now(),
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || 'Inspection failed' },
      { status: 500 }
    );
  }
}
