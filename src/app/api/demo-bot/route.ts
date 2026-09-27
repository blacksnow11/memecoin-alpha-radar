import { NextRequest, NextResponse } from 'next/server';
import {
  DEFAULT_DEMO_PORTFOLIO,
  DEFAULT_GEM_RADAR_PORTFOLIO,
  INITIAL_DECISION_LOGS,
  INITIAL_GEM_RADAR_LOGS,
  runCopyBotTick,
  runGemRadarBotTick,
} from '@/lib/demo-trading-engine';
import { DecisionLog, DemoClosedTrade, DemoPortfolio, DemoPosition } from '@/lib/types';
import { fetchSolanaTokenPrice } from '@/lib/solana/birdeye';

export const dynamic = 'force-dynamic';

// Dual-Engine in-memory runtime states:
// 1. Smart Money Copy Bot ($100 Bankroll)
let copyPortfolio: DemoPortfolio = { ...DEFAULT_DEMO_PORTFOLIO };
let copyPositions: DemoPosition[] = [];
let copyLogs: DecisionLog[] = [...INITIAL_DECISION_LOGS];

// 2. Gem Radar Breakout Bot ($100 Bankroll)
let gemPortfolio: DemoPortfolio = { ...DEFAULT_GEM_RADAR_PORTFOLIO };
let gemPositions: DemoPosition[] = [];
let gemLogs: DecisionLog[] = [...INITIAL_GEM_RADAR_LOGS];

export async function GET() {
  return NextResponse.json({
    success: true,
    // Default / Copy Bot payload (maintains backward compatibility)
    portfolio: copyPortfolio,
    positions: copyPositions,
    logs: copyLogs,
    // Full Dual-Bot Engine payload
    copyBot: {
      portfolio: copyPortfolio,
      positions: copyPositions,
      logs: copyLogs,
    },
    gemRadarBot: {
      portfolio: gemPortfolio,
      positions: gemPositions,
      logs: gemLogs,
    },
    timestamp: Date.now(),
  });
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action, botType } = body; // botType can be 'copy' | 'gem_radar'

    // 1. Autonomous Tick on both engines
    if (action === 'tick') {
      const [copyRes, gemRes] = await Promise.all([
        runCopyBotTick(copyPortfolio, copyPositions, copyLogs),
        runGemRadarBotTick(gemPortfolio, gemPositions, gemLogs),
      ]);

      copyPortfolio = copyRes.updatedPortfolio;
      copyPositions = copyRes.updatedPositions;
      if (copyRes.newLogs.length > 0) {
        copyLogs = [...copyRes.newLogs, ...copyLogs].slice(0, 50);
      }

      gemPortfolio = gemRes.updatedPortfolio;
      gemPositions = gemRes.updatedPositions;
      if (gemRes.newLogs.length > 0) {
        gemLogs = [...gemRes.newLogs, ...gemLogs].slice(0, 50);
      }

      return NextResponse.json({
        success: true,
        portfolio: botType === 'gem_radar' ? gemPortfolio : copyPortfolio,
        positions: botType === 'gem_radar' ? gemPositions : copyPositions,
        logs: botType === 'gem_radar' ? gemLogs : copyLogs,
        copyBot: {
          portfolio: copyPortfolio,
          positions: copyPositions,
          logs: copyLogs,
        },
        gemRadarBot: {
          portfolio: gemPortfolio,
          positions: gemPositions,
          logs: gemLogs,
        },
      });
    }

    // 2. Manual reload $100 cash
    if (action === 'reload') {
      const targetPortfolio = botType === 'gem_radar' ? gemPortfolio : copyPortfolio;
      const targetPositions = botType === 'gem_radar' ? gemPositions : copyPositions;
      const targetLogs = botType === 'gem_radar' ? gemLogs : copyLogs;

      targetPortfolio.currentCash = +(targetPortfolio.currentCash + 100).toFixed(2);
      targetPortfolio.reloadCount += 1;
      targetPortfolio.totalDemoCapitalLoaded += 100;

      const openMarketValue = targetPositions
        .filter((p) => p.status === 'OPEN')
        .reduce((acc, p) => acc + (p.investedUsd + p.pnlUsd), 0);
      targetPortfolio.totalEquityUsd = +(targetPortfolio.currentCash + openMarketValue).toFixed(2);

      const reloadLog: DecisionLog = {
        id: `log-reload-${Date.now()}`,
        timestamp: Date.now(),
        type: 'AUTO_RELOAD',
        tokenSymbol: 'USD_DEMO',
        tokenAddress: '0x0',
        chain: 'solana',
        convictionScore: 100,
        action: `MANUAL RELOAD: Added $100.00 to ${botType === 'gem_radar' ? 'Gem Radar' : 'Copy'} Bot`,
        rationale: `Manual bankroll replenishment triggered. Current cash: $${targetPortfolio.currentCash}.`,
        improvementLessonTag: '[MANUAL_RELOAD]',
        improvementNote: `Total capital loaded for this engine: $${targetPortfolio.totalDemoCapitalLoaded}.`,
      };

      targetLogs.unshift(reloadLog);

      return NextResponse.json({
        success: true,
        portfolio: targetPortfolio,
        positions: targetPositions,
        logs: targetLogs,
        copyBot: { portfolio: copyPortfolio, positions: copyPositions, logs: copyLogs },
        gemRadarBot: { portfolio: gemPortfolio, positions: gemPositions, logs: gemLogs },
      });
    }

    // 3. Toggle bot running state
    if (action === 'toggle_bot') {
      if (botType === 'gem_radar') {
        gemPortfolio.isBotRunning = !gemPortfolio.isBotRunning;
        return NextResponse.json({ success: true, isBotRunning: gemPortfolio.isBotRunning });
      } else {
        copyPortfolio.isBotRunning = !copyPortfolio.isBotRunning;
        return NextResponse.json({ success: true, isBotRunning: copyPortfolio.isBotRunning });
      }
    }

    // 4. Close an open position
    if (action === 'close_position') {
      const { positionId } = body;
      // Search in copy positions first, then gem positions
      let isGem = false;
      let posIndex = copyPositions.findIndex((p) => p.id === positionId && p.status === 'OPEN');
      if (posIndex < 0) {
        posIndex = gemPositions.findIndex((p) => p.id === positionId && p.status === 'OPEN');
        isGem = true;
      }

      if (posIndex >= 0) {
        const targetPortfolio = isGem ? gemPortfolio : copyPortfolio;
        const targetPositions = isGem ? gemPositions : copyPositions;
        const targetLogs = isGem ? gemLogs : copyLogs;

        const pos = targetPositions[posIndex];
        const returnAmount = +(pos.investedUsd + pos.pnlUsd).toFixed(2);
        targetPortfolio.currentCash = +(targetPortfolio.currentCash + Math.max(0, returnAmount)).toFixed(2);
        targetPortfolio.totalRealizedPnlUsd = +(targetPortfolio.totalRealizedPnlUsd + pos.pnlUsd).toFixed(2);

        if (pos.pnlUsd >= 0) {
          targetPortfolio.totalWins += 1;
        } else {
          targetPortfolio.totalLosses += 1;
        }

        const totalTrades = targetPortfolio.totalWins + targetPortfolio.totalLosses;
        targetPortfolio.winRate = totalTrades > 0 ? +((targetPortfolio.totalWins / totalTrades) * 100).toFixed(1) : 0;

        const closedTrade: DemoClosedTrade = {
          id: `closed-${Date.now()}-${Math.random().toString(36).substring(7)}`,
          tokenAddress: pos.tokenAddress,
          tokenSymbol: pos.tokenSymbol,
          tokenName: pos.tokenName,
          chain: pos.chain,
          copiedFromWallet: pos.copiedFromWallet,
          copiedFromWalletLabel: pos.copiedFromWalletLabel,
          entryTimestamp: pos.entryTimestamp,
          exitTimestamp: Date.now(),
          holdDurationSeconds: Math.max(1, Math.round((Date.now() - pos.entryTimestamp) / 1000)),
          entryPriceUsd: pos.entryPriceUsd,
          exitPriceUsd: pos.currentPriceUsd,
          investedUsd: pos.investedUsd,
          returnedUsd: Math.max(0, returnAmount),
          netPnlUsd: pos.pnlUsd,
          netPnlPercent: pos.pnlPercent,
          multiplier: +(pos.currentPriceUsd / pos.entryPriceUsd).toFixed(2),
          exitReason: 'MANUAL_CLOSE',
          exitReasonDetail: `Manual Discretionary Exit at $${pos.currentPriceUsd} (${pos.pnlPercent >= 0 ? '+' : ''}${pos.pnlPercent}%)`,
          alphaScoreAtEntry: pos.alphaScoreAtEntry,
          entryRationale: pos.entryRationale,
          simulatedGasFeeUsd: 0.005,
        };

        targetPortfolio.closedTrades = [closedTrade, ...(targetPortfolio.closedTrades || [])];
        targetPositions.splice(posIndex, 1);

        const openPositions = targetPositions.filter((p) => p.status === 'OPEN');
        const finalInvested = openPositions.reduce((acc, p) => acc + p.investedUsd, 0);
        const finalMarketVal = openPositions.reduce((acc, p) => acc + (p.investedUsd + p.pnlUsd), 0);
        targetPortfolio.investedInPositionsUsd = +finalInvested.toFixed(2);
        targetPortfolio.totalUnrealizedPnlUsd = +(finalMarketVal - finalInvested).toFixed(2);
        targetPortfolio.totalEquityUsd = +(targetPortfolio.currentCash + finalMarketVal).toFixed(2);

        targetLogs.unshift({
          id: `log-close-${Date.now()}`,
          timestamp: Date.now(),
          type: 'EXIT_MANUAL',
          tokenSymbol: pos.tokenSymbol,
          tokenAddress: pos.tokenAddress,
          chain: pos.chain,
          convictionScore: pos.alphaScoreAtEntry,
          action: `MANUAL CLOSE: Sold ${pos.tokenSymbol} at $${pos.currentPriceUsd} (${pos.pnlPercent >= 0 ? '+' : ''}${pos.pnlPercent}%)`,
          rationale: `Manual exit executed on ${isGem ? 'Gem Radar' : 'Copy'} bot. Capital returned: $${returnAmount}.`,
          outcomePnlUsd: pos.pnlUsd,
          outcomePnlPercent: pos.pnlPercent,
          improvementLessonTag: '[MANUAL_EXIT]',
          improvementNote: 'Manual intervention recorded.',
        });

        return NextResponse.json({
          success: true,
          copyBot: { portfolio: copyPortfolio, positions: copyPositions, logs: copyLogs },
          gemRadarBot: { portfolio: gemPortfolio, positions: gemPositions, logs: gemLogs },
        });
      }
    }

    // 5. Open Gem Trade explicitly from Radar button
    if (action === 'open_gem_trade') {
      const { signal } = body;
      if (signal && gemPortfolio.currentCash >= gemPortfolio.allocationPerTradeUsd) {
        const livePriceData = await fetchSolanaTokenPrice(signal.tokenAddress);
        const spotPrice = livePriceData.priceUsd > 0 ? livePriceData.priceUsd : signal.priceUsd;

        const allocation = gemPortfolio.allocationPerTradeUsd;
        gemPortfolio.currentCash = +(gemPortfolio.currentCash - allocation).toFixed(2);
        const tokenAmount = +(allocation / spotPrice).toFixed(4);

        const newPos: DemoPosition = {
          id: `pos-gem-${Date.now()}-${signal.tokenSymbol}`,
          tokenAddress: signal.tokenAddress,
          tokenSymbol: signal.tokenSymbol,
          tokenName: signal.tokenName,
          chain: 'solana',
          copiedFromWallet: signal.tokenAddress,
          copiedFromWalletLabel: `Gem Radar: ${signal.patternTitle}`,
          entryTimestamp: Date.now(),
          entryPriceUsd: spotPrice,
          currentPriceUsd: spotPrice,
          investedUsd: allocation,
          tokenAmount,
          pnlUsd: 0,
          pnlPercent: 0,
          takeProfitPrice1: +(spotPrice * 2.0).toFixed(6),
          takeProfitPrice2: +(spotPrice * 5.0).toFixed(6),
          stopLossPrice: +(spotPrice * (1 + gemPortfolio.stopLossPercent / 100)).toFixed(6),
          status: 'OPEN',
          alphaScoreAtEntry: signal.confidenceScore,
          entryRationale: `User triggered breakout snipe on ${signal.tokenSymbol}. Pattern: ${signal.patternTitle}.`,
          strategy: 'GEM_RADAR_BREAKOUT',
          gemPattern: signal.patternType,
        };

        gemPositions.push(newPos);

        gemLogs.unshift({
          id: `log-user-gem-${Date.now()}`,
          timestamp: Date.now(),
          type: 'ENTRY_EXECUTED',
          tokenSymbol: signal.tokenSymbol,
          tokenAddress: signal.tokenAddress,
          chain: 'solana',
          convictionScore: signal.confidenceScore,
          action: `USER TRIGGERED GEM SNIPE: Invested $${allocation} into ${signal.tokenSymbol}`,
          rationale: `Manual trigger on Gem Radar signal: ${signal.patternTitle}. Live spot price: $${spotPrice}.`,
          improvementLessonTag: '[USER_GEM_SNIPE]',
          improvementNote: 'Position added to Gem Radar Hunter portfolio with 2x TP / -20% SL triggers.',
        });

        return NextResponse.json({
          success: true,
          copyBot: { portfolio: copyPortfolio, positions: copyPositions, logs: copyLogs },
          gemRadarBot: { portfolio: gemPortfolio, positions: gemPositions, logs: gemLogs },
        });
      }
    }

    // 6. Reset both to pristine clean slates
    if (action === 'reset') {
      copyPortfolio = { ...DEFAULT_DEMO_PORTFOLIO, equityHistory: [{ timestamp: Date.now(), equityUsd: 100 }] };
      copyPositions = [];
      copyLogs = [...INITIAL_DECISION_LOGS];

      gemPortfolio = { ...DEFAULT_GEM_RADAR_PORTFOLIO, equityHistory: [{ timestamp: Date.now(), equityUsd: 100 }] };
      gemPositions = [];
      gemLogs = [...INITIAL_GEM_RADAR_LOGS];

      return NextResponse.json({
        success: true,
        copyBot: { portfolio: copyPortfolio, positions: copyPositions, logs: copyLogs },
        gemRadarBot: { portfolio: gemPortfolio, positions: gemPositions, logs: gemLogs },
      });
    }

    return NextResponse.json({ success: false, error: 'Unknown action' }, { status: 400 });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
