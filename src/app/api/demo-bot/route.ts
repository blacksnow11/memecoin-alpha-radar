import { NextRequest, NextResponse } from 'next/server';
import {
  DEFAULT_DEMO_PORTFOLIO,
  INITIAL_DECISION_LOGS,
  INITIAL_OPEN_POSITIONS,
  runDemoBotTick,
} from '@/lib/demo-trading-engine';
import { DecisionLog, DemoClosedTrade, DemoPortfolio, DemoPosition } from '@/lib/types';

export const dynamic = 'force-dynamic';

// In-memory runtime state for serverless execution
let runtimePortfolio: DemoPortfolio = { ...DEFAULT_DEMO_PORTFOLIO };
let runtimePositions: DemoPosition[] = [...INITIAL_OPEN_POSITIONS];
let runtimeLogs: DecisionLog[] = [...INITIAL_DECISION_LOGS];

export async function GET() {
  return NextResponse.json({
    success: true,
    portfolio: runtimePortfolio,
    positions: runtimePositions,
    logs: runtimeLogs,
    timestamp: Date.now(),
  });
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action } = body;

    if (action === 'tick') {
      const result = await runDemoBotTick(runtimePortfolio, runtimePositions, runtimeLogs);
      runtimePortfolio = result.updatedPortfolio;
      runtimePositions = result.updatedPositions;
      runtimeLogs = result.newLogs;

      return NextResponse.json({
        success: true,
        portfolio: runtimePortfolio,
        positions: runtimePositions,
        logs: runtimeLogs,
      });
    }

    if (action === 'reload') {
      runtimePortfolio.currentCash = +(runtimePortfolio.currentCash + 100).toFixed(2);
      runtimePortfolio.reloadCount += 1;
      runtimePortfolio.totalDemoCapitalLoaded += 100;
      const openMarketValue = runtimePositions
        .filter((p) => p.status === 'OPEN')
        .reduce((acc, p) => acc + (p.investedUsd + p.pnlUsd), 0);
      runtimePortfolio.totalEquityUsd = +(
        runtimePortfolio.currentCash + openMarketValue
      ).toFixed(2);

      const reloadLog: DecisionLog = {
        id: `log-manual-reload-${Date.now()}`,
        timestamp: Date.now(),
        type: 'AUTO_RELOAD',
        tokenSymbol: 'USD_DEMO',
        tokenAddress: '0x0',
        chain: 'solana',
        convictionScore: 100,
        action: `MANUAL RELOAD: Added $100.00 (Total Reloads: ${runtimePortfolio.reloadCount})`,
        rationale: `Manual reload triggered by user. Current cash replenished to $${runtimePortfolio.currentCash}.`,
        improvementLessonTag: '[MANUAL_RELOAD]',
        improvementNote: `Bankroll reinforced. Total demo capital loaded: $${runtimePortfolio.totalDemoCapitalLoaded}.`,
      };

      runtimeLogs.unshift(reloadLog);

      return NextResponse.json({
        success: true,
        portfolio: runtimePortfolio,
        positions: runtimePositions,
        logs: runtimeLogs,
      });
    }

    if (action === 'toggle_bot') {
      runtimePortfolio.isBotRunning = !runtimePortfolio.isBotRunning;
      return NextResponse.json({
        success: true,
        isBotRunning: runtimePortfolio.isBotRunning,
      });
    }

    if (action === 'close_position') {
      const { positionId } = body;
      const posIndex = runtimePositions.findIndex((p) => p.id === positionId && p.status === 'OPEN');

      if (posIndex >= 0) {
        const pos = runtimePositions[posIndex];
        const returnAmount = +(pos.investedUsd + pos.pnlUsd).toFixed(2);
        runtimePortfolio.currentCash = +(runtimePortfolio.currentCash + Math.max(0, returnAmount)).toFixed(2);
        runtimePortfolio.totalRealizedPnlUsd = +(runtimePortfolio.totalRealizedPnlUsd + pos.pnlUsd).toFixed(2);

        if (pos.pnlUsd >= 0) {
          runtimePortfolio.totalWins += 1;
        } else {
          runtimePortfolio.totalLosses += 1;
        }

        const totalTrades = runtimePortfolio.totalWins + runtimePortfolio.totalLosses;
        runtimePortfolio.winRate = totalTrades > 0 ? +( (runtimePortfolio.totalWins / totalTrades) * 100 ).toFixed(1) : 0;

        // Record into closed trades ledger
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
          exitReasonDetail: `Manual Discretionary Exit executed at $${pos.currentPriceUsd} (${pos.pnlPercent >= 0 ? '+' : ''}${pos.pnlPercent}%)`,
          alphaScoreAtEntry: pos.alphaScoreAtEntry,
          entryRationale: pos.entryRationale,
          simulatedGasFeeUsd: pos.chain === 'solana' ? 0.01 : pos.chain === 'base' ? 0.02 : pos.chain === 'bsc' ? 0.05 : 0.25,
        };

        if (!runtimePortfolio.closedTrades) {
          runtimePortfolio.closedTrades = [];
        }
        runtimePortfolio.closedTrades = [closedTrade, ...runtimePortfolio.closedTrades];

        runtimePositions.splice(posIndex, 1);

        // Strictly rebalance invested principal, unrealized pnl, and total portfolio equity
        const openPositions = runtimePositions.filter((p) => p.status === 'OPEN');
        const finalInvestedPrincipal = openPositions.reduce((acc, p) => acc + p.investedUsd, 0);
        const finalMarketValue = openPositions.reduce((acc, p) => acc + (p.investedUsd + p.pnlUsd), 0);
        runtimePortfolio.investedInPositionsUsd = +finalInvestedPrincipal.toFixed(2);
        runtimePortfolio.totalUnrealizedPnlUsd = +(finalMarketValue - finalInvestedPrincipal).toFixed(2);
        runtimePortfolio.totalEquityUsd = +(runtimePortfolio.currentCash + finalMarketValue).toFixed(2);

        const manualCloseLog: DecisionLog = {
          id: `log-close-${Date.now()}`,
          timestamp: Date.now(),
          type: 'EXIT_MANUAL',
          tokenSymbol: pos.tokenSymbol,
          tokenAddress: pos.tokenAddress,
          chain: pos.chain,
          triggeredByWallet: pos.copiedFromWallet,
          triggeredByWalletLabel: pos.copiedFromWalletLabel,
          convictionScore: pos.alphaScoreAtEntry,
          action: `MANUAL CLOSE: Sold ${pos.tokenSymbol} at $${pos.currentPriceUsd} (${pos.pnlPercent >= 0 ? '+' : ''}${pos.pnlPercent}%)`,
          rationale: `Manual discretionary exit executed. Returned $${returnAmount} to cash balance. P&L: $${pos.pnlUsd}.`,
          outcomePnlUsd: pos.pnlUsd,
          outcomePnlPercent: pos.pnlPercent,
          improvementLessonTag: '[MANUAL_INTERVENTION]',
          improvementNote: `Operator manually took control of position. Record rationale for why automated rules were overridden.`,
        };

        runtimeLogs.unshift(manualCloseLog);
      }

      return NextResponse.json({
        success: true,
        portfolio: runtimePortfolio,
        positions: runtimePositions,
        logs: runtimeLogs,
      });
    }

    if (action === 'update_config') {
      const { minConvictionThreshold, allocationPerTradeUsd, stopLossPercent, isAutoReloadEnabled } = body;
      if (typeof minConvictionThreshold === 'number') {
        runtimePortfolio.minConvictionThreshold = Math.max(50, Math.min(100, minConvictionThreshold));
      }
      if (typeof allocationPerTradeUsd === 'number') {
        runtimePortfolio.allocationPerTradeUsd = Math.max(5, Math.min(100, allocationPerTradeUsd));
      }
      if (typeof stopLossPercent === 'number') {
        runtimePortfolio.stopLossPercent = stopLossPercent;
      }
      if (typeof isAutoReloadEnabled === 'boolean') {
        runtimePortfolio.isAutoReloadEnabled = isAutoReloadEnabled;
      }

      return NextResponse.json({
        success: true,
        portfolio: runtimePortfolio,
      });
    }

    if (action === 'open_gem_trade') {
      const { signal } = body;
      const allocationUsd = signal.suggestedDemoAllocationUsd || runtimePortfolio.allocationPerTradeUsd || 20;

      // Auto-reload if cash is insufficient
      if (runtimePortfolio.currentCash < allocationUsd) {
        runtimePortfolio.currentCash = +(runtimePortfolio.currentCash + 100).toFixed(2);
        runtimePortfolio.reloadCount += 1;
        runtimePortfolio.totalDemoCapitalLoaded += 100;
      }

      runtimePortfolio.currentCash = +(runtimePortfolio.currentCash - allocationUsd).toFixed(2);

      const entryPrice = signal.priceUsd || 0.001;
      const tokenAmount = +(allocationUsd / entryPrice).toFixed(2);

      const newPosition: DemoPosition = {
        id: `pos-gem-${Date.now()}-${signal.tokenSymbol.toLowerCase()}`,
        tokenAddress: signal.tokenAddress,
        tokenSymbol: signal.tokenSymbol,
        tokenName: signal.tokenName,
        chain: 'solana',
        copiedFromWallet: signal.smartWalletsDetected[0]?.address || 'Solana-Smart-Cluster',
        copiedFromWalletLabel: signal.smartWalletsDetected[0]?.label || 'Gem Radar Cluster',
        entryTimestamp: Date.now(),
        entryPriceUsd: entryPrice,
        currentPriceUsd: entryPrice,
        investedUsd: allocationUsd,
        tokenAmount,
        pnlUsd: 0,
        pnlPercent: 0,
        takeProfitPrice1: +(entryPrice * 2.0).toFixed(6),
        takeProfitPrice2: +(entryPrice * 5.0).toFixed(6),
        stopLossPrice: +(entryPrice * 0.8).toFixed(6),
        status: 'OPEN',
        alphaScoreAtEntry: signal.breakoutProbability,
        entryRationale: `[PRE-BREAKOUT GEM RADAR] ${signal.patternTitle}. ${signal.patternDescription}`,
      };

      runtimePositions.unshift(newPosition);

      const openPositions = runtimePositions.filter((p) => p.status === 'OPEN');
      const finalInvested = openPositions.reduce((acc, p) => acc + p.investedUsd, 0);
      const finalMarketValue = openPositions.reduce((acc, p) => acc + (p.investedUsd + p.pnlUsd), 0);
      runtimePortfolio.investedInPositionsUsd = +finalInvested.toFixed(2);
      runtimePortfolio.totalUnrealizedPnlUsd = +(finalMarketValue - finalInvested).toFixed(2);
      runtimePortfolio.totalEquityUsd = +(runtimePortfolio.currentCash + finalMarketValue).toFixed(2);

      const entryLog: DecisionLog = {
        id: `log-gem-entry-${Date.now()}`,
        timestamp: Date.now(),
        type: 'ENTRY_EXECUTED',
        tokenSymbol: signal.tokenSymbol,
        tokenAddress: signal.tokenAddress,
        chain: 'solana',
        triggeredByWallet: signal.smartWalletsDetected[0]?.address,
        triggeredByWalletLabel: signal.smartWalletsDetected[0]?.label || 'Smart Money Cluster',
        convictionScore: signal.breakoutProbability,
        action: `BOUGHT $${allocationUsd} of ${signal.tokenSymbol} at $${entryPrice}`,
        rationale: `Pattern: ${signal.patternTitle}. Odds: ${signal.breakoutProbability}%. Early ground-floor entry.`,
        improvementLessonTag: '[PRE_BREAKOUT_GEM_ENTRY]',
        improvementNote: `Capital efficiency test: entering before DEX trending to achieve 5x-20x multipliers.`,
      };

      runtimeLogs.unshift(entryLog);

      return NextResponse.json({
        success: true,
        position: newPosition,
        portfolio: runtimePortfolio,
        positions: runtimePositions,
        logs: runtimeLogs,
      });
    }

    return NextResponse.json({ success: false, error: 'Unknown action' }, { status: 400 });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
