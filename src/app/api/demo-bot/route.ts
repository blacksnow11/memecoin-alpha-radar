import { NextRequest, NextResponse } from 'next/server';
import {
  DEFAULT_DEMO_PORTFOLIO,
  DEFAULT_GEM_RADAR_PORTFOLIO,
  INITIAL_DECISION_LOGS,
  INITIAL_GEM_RADAR_LOGS,
} from '@/lib/demo-trading-engine';
import { DecisionLog, DemoClosedTrade, DemoPosition } from '@/lib/types';
import { fetchSolanaTokenPrice } from '@/lib/solana/birdeye';
import { getBotState, updateBotState, StoredBotState } from '@/lib/bot-storage';
import { executeBotTick, getServerWorkerStatus, start247BotWorker } from '@/lib/bot-worker';

export const dynamic = 'force-dynamic';

// Fail-safe: ensure 24/7 worker is initiated on standalone/long-running Node servers
if (typeof process !== 'undefined' && process.env.NEXT_RUNTIME === 'nodejs' && !process.env.VERCEL && !process.env.AWS_LAMBDA_FUNCTION_NAME) {
  start247BotWorker();
}

export async function GET(request: NextRequest) {
  if (!process.env.VERCEL && !process.env.AWS_LAMBDA_FUNCTION_NAME) {
    start247BotWorker();
  }

  // Check if triggered by Vercel Cron or if state is stale in serverless
  const isCron = request.nextUrl.searchParams.get('cron') === 'true';
  const currentState = getBotState();
  const timeSinceLastTick = Date.now() - (currentState.lastServerTickTimestamp || 0);

  // If cron invoked or state is older than 20s on Vercel, run an evaluation tick
  if (isCron || (process.env.VERCEL && timeSinceLastTick > 20000)) {
    await executeBotTick();
  }

  const state = getBotState();
  const serverWorker = getServerWorkerStatus();

  return NextResponse.json({
    success: true,
    // Default / Copy Bot payload (maintains backward compatibility)
    portfolio: state.copyBot.portfolio,
    positions: state.copyBot.positions,
    logs: state.copyBot.logs,
    // Full Dual-Bot Engine payload
    copyBot: state.copyBot,
    gemRadarBot: state.gemRadarBot,
    serverWorker,
    timestamp: Date.now(),
  });
}

export async function POST(request: NextRequest) {
  try {
    if (!process.env.VERCEL && !process.env.AWS_LAMBDA_FUNCTION_NAME) {
      start247BotWorker();
    }

    const body = await request.json();
    const { action, botType } = body; // botType can be 'copy' | 'gem_radar'

    // 1. Autonomous Tick on both engines
    if (action === 'tick') {
      const updatedState = await executeBotTick();
      const serverWorker = getServerWorkerStatus();

      return NextResponse.json({
        success: true,
        portfolio: botType === 'gem_radar' ? updatedState.gemRadarBot.portfolio : updatedState.copyBot.portfolio,
        positions: botType === 'gem_radar' ? updatedState.gemRadarBot.positions : updatedState.copyBot.positions,
        logs: botType === 'gem_radar' ? updatedState.gemRadarBot.logs : updatedState.copyBot.logs,
        copyBot: updatedState.copyBot,
        gemRadarBot: updatedState.gemRadarBot,
        serverWorker,
      });
    }

    // 2. Manual reload $100 cash
    if (action === 'reload') {
      const nextState = updateBotState((prevState) => {
        const isGem = botType === 'gem_radar';
        const targetBot = isGem ? prevState.gemRadarBot : prevState.copyBot;

        targetBot.portfolio.currentCash = +(targetBot.portfolio.currentCash + 100).toFixed(2);
        targetBot.portfolio.reloadCount += 1;
        targetBot.portfolio.totalDemoCapitalLoaded += 100;

        const openMarketValue = targetBot.positions
          .filter((p) => p.status === 'OPEN')
          .reduce((acc, p) => acc + (p.investedUsd + p.pnlUsd), 0);
        targetBot.portfolio.totalEquityUsd = +(targetBot.portfolio.currentCash + openMarketValue).toFixed(2);

        const reloadLog: DecisionLog = {
          id: `log-reload-${Date.now()}`,
          timestamp: Date.now(),
          type: 'AUTO_RELOAD',
          tokenSymbol: 'USD_DEMO',
          tokenAddress: '0x0',
          chain: 'solana',
          convictionScore: 100,
          action: `MANUAL RELOAD: Added $100.00 to ${isGem ? 'Gem Radar' : 'Copy'} Bot`,
          rationale: `Manual bankroll replenishment triggered. Current cash: $${targetBot.portfolio.currentCash}.`,
          improvementLessonTag: '[MANUAL_RELOAD]',
          improvementNote: `Total capital loaded for this engine: $${targetBot.portfolio.totalDemoCapitalLoaded}.`,
        };

        targetBot.logs.unshift(reloadLog);
        return { ...prevState };
      });

      const serverWorker = getServerWorkerStatus();
      return NextResponse.json({
        success: true,
        copyBot: nextState.copyBot,
        gemRadarBot: nextState.gemRadarBot,
        serverWorker,
      });
    }

    // 3. Toggle bot running state
    if (action === 'toggle_bot') {
      const nextState = updateBotState((prevState) => {
        if (botType === 'gem_radar') {
          prevState.gemRadarBot.portfolio.isBotRunning = !prevState.gemRadarBot.portfolio.isBotRunning;
        } else {
          prevState.copyBot.portfolio.isBotRunning = !prevState.copyBot.portfolio.isBotRunning;
        }
        return { ...prevState };
      });

      return NextResponse.json({
        success: true,
        isBotRunning: botType === 'gem_radar' ? nextState.gemRadarBot.portfolio.isBotRunning : nextState.copyBot.portfolio.isBotRunning,
        copyBot: nextState.copyBot,
        gemRadarBot: nextState.gemRadarBot,
      });
    }

    // 4. Close an open position
    if (action === 'close_position') {
      const { positionId } = body;
      let closedSuccessfully = false;

      const nextState = updateBotState((prevState) => {
        let isGem = false;
        let posIndex = prevState.copyBot.positions.findIndex((p) => p.id === positionId && p.status === 'OPEN');
        if (posIndex < 0) {
          posIndex = prevState.gemRadarBot.positions.findIndex((p) => p.id === positionId && p.status === 'OPEN');
          isGem = true;
        }

        if (posIndex >= 0) {
          const targetBot = isGem ? prevState.gemRadarBot : prevState.copyBot;
          const pos = targetBot.positions[posIndex];
          const returnAmount = +(pos.investedUsd + pos.pnlUsd).toFixed(2);
          targetBot.portfolio.currentCash = +(targetBot.portfolio.currentCash + Math.max(0, returnAmount)).toFixed(2);
          targetBot.portfolio.totalRealizedPnlUsd = +(targetBot.portfolio.totalRealizedPnlUsd + pos.pnlUsd).toFixed(2);

          if (pos.pnlUsd >= 0) {
            targetBot.portfolio.totalWins += 1;
          } else {
            targetBot.portfolio.totalLosses += 1;
          }

          const totalTrades = targetBot.portfolio.totalWins + targetBot.portfolio.totalLosses;
          targetBot.portfolio.winRate = totalTrades > 0 ? +((targetBot.portfolio.totalWins / totalTrades) * 100).toFixed(1) : 0;

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

          targetBot.portfolio.closedTrades = [closedTrade, ...(targetBot.portfolio.closedTrades || [])];
          targetBot.positions.splice(posIndex, 1);

          const openPositions = targetBot.positions.filter((p) => p.status === 'OPEN');
          const finalInvested = openPositions.reduce((acc, p) => acc + p.investedUsd, 0);
          const finalMarketVal = openPositions.reduce((acc, p) => acc + (p.investedUsd + p.pnlUsd), 0);
          targetBot.portfolio.investedInPositionsUsd = +finalInvested.toFixed(2);
          targetBot.portfolio.totalUnrealizedPnlUsd = +(finalMarketVal - finalInvested).toFixed(2);
          targetBot.portfolio.totalEquityUsd = +(targetBot.portfolio.currentCash + finalMarketVal).toFixed(2);

          targetBot.logs.unshift({
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

          closedSuccessfully = true;
        }

        return { ...prevState };
      });

      return NextResponse.json({
        success: closedSuccessfully,
        copyBot: nextState.copyBot,
        gemRadarBot: nextState.gemRadarBot,
      });
    }

    // 5. Open Gem Trade explicitly from Radar button
    if (action === 'open_gem_trade') {
      const { signal } = body;
      if (signal) {
        const livePriceData = await fetchSolanaTokenPrice(signal.tokenAddress);
        const spotPrice = livePriceData.priceUsd > 0 ? livePriceData.priceUsd : signal.priceUsd;

        const nextState = updateBotState((prevState) => {
          if (prevState.gemRadarBot.portfolio.currentCash >= prevState.gemRadarBot.portfolio.allocationPerTradeUsd) {
            const allocation = prevState.gemRadarBot.portfolio.allocationPerTradeUsd;
            prevState.gemRadarBot.portfolio.currentCash = +(prevState.gemRadarBot.portfolio.currentCash - allocation).toFixed(2);
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
              stopLossPrice: +(spotPrice * (1 + prevState.gemRadarBot.portfolio.stopLossPercent / 100)).toFixed(6),
              status: 'OPEN',
              alphaScoreAtEntry: signal.confidenceScore,
              entryRationale: `User triggered breakout snipe on ${signal.tokenSymbol}. Pattern: ${signal.patternTitle}.`,
              strategy: 'GEM_RADAR_BREAKOUT',
              gemPattern: signal.patternType,
            };

            prevState.gemRadarBot.positions.push(newPos);

            prevState.gemRadarBot.logs.unshift({
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
          }
          return { ...prevState };
        });

        return NextResponse.json({
          success: true,
          copyBot: nextState.copyBot,
          gemRadarBot: nextState.gemRadarBot,
        });
      }
    }

    // 6. Reset both to pristine clean slates
    if (action === 'reset') {
      const resetState: StoredBotState = {
        copyBot: {
          portfolio: { ...DEFAULT_DEMO_PORTFOLIO, equityHistory: [{ timestamp: Date.now(), equityUsd: 100 }] },
          positions: [],
          logs: [...INITIAL_DECISION_LOGS],
        },
        gemRadarBot: {
          portfolio: { ...DEFAULT_GEM_RADAR_PORTFOLIO, equityHistory: [{ timestamp: Date.now(), equityUsd: 100 }] },
          positions: [],
          logs: [...INITIAL_GEM_RADAR_LOGS],
        },
        lastServerTickTimestamp: Date.now(),
        totalTicksExecuted: 0,
        workerStartedAt: Date.now(),
      };

      const nextState = updateBotState(() => resetState);

      return NextResponse.json({
        success: true,
        copyBot: nextState.copyBot,
        gemRadarBot: nextState.gemRadarBot,
      });
    }

    return NextResponse.json({ success: false, error: 'Unknown action' }, { status: 400 });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
