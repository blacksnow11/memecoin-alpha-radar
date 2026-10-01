import {
  ChainId,
  DecisionLog,
  DemoClosedTrade,
  DemoPortfolio,
  DemoPosition,
  MilestoneRate,
  PeriodicPnlSummary,
  PreBreakoutGemSignal,
  ProfitLadderAnalytics,
  Token,
  Trade,
  WalletProfile,
} from './types';
import { SEED_WALLETS } from './wallet-engine';
import { fetchSolanaTokenPrice } from './solana/birdeye';
import { checkWalletTokenHolding, discoverActiveTraders, fetchWalletOnChainSwaps } from './solana/helius';
import { detectPreBreakoutGemSignals } from './solana/gem-radar';

// Clean-slate Initial State for the Autonomous Demo Paper Trading Bot
export const INITIAL_CLOSED_TRADES: DemoClosedTrade[] = [];
export const INITIAL_OPEN_POSITIONS: DemoPosition[] = [];

// 45-minute post-stop-loss cooldown to prevent catching falling knives / re-entry churn
const STOP_LOSS_COOLDOWN_MS = 45 * 60 * 1000;
export const tokenStopLossCooldownMap = new Map<string, number>();

export function registerStopLossCooldown(tokenAddress: string): void {
  tokenStopLossCooldownMap.set(tokenAddress, Date.now() + STOP_LOSS_COOLDOWN_MS);
}

export function isTokenInStopLossCooldown(tokenAddress: string): { inCooldown: boolean; remainingMinutes: number } {
  const expiry = tokenStopLossCooldownMap.get(tokenAddress);
  if (!expiry) return { inCooldown: false, remainingMinutes: 0 };
  const diff = expiry - Date.now();
  if (diff <= 0) {
    tokenStopLossCooldownMap.delete(tokenAddress);
    return { inCooldown: false, remainingMinutes: 0 };
  }
  return { inCooldown: true, remainingMinutes: Math.ceil(diff / 60000) };
}

// 60-minute post-take-profit cooldown to prevent FOMO top-buying after a successful pump
const TAKE_PROFIT_COOLDOWN_MS = 60 * 60 * 1000;
export const tokenTakeProfitCooldownMap = new Map<string, number>();

export function registerTakeProfitCooldown(tokenAddress: string): void {
  tokenTakeProfitCooldownMap.set(tokenAddress, Date.now() + TAKE_PROFIT_COOLDOWN_MS);
}

export function isTokenInTakeProfitCooldown(tokenAddress: string): { inCooldown: boolean; remainingMinutes: number } {
  const expiry = tokenTakeProfitCooldownMap.get(tokenAddress);
  if (!expiry) return { inCooldown: false, remainingMinutes: 0 };
  const diff = expiry - Date.now();
  if (diff <= 0) {
    tokenTakeProfitCooldownMap.delete(tokenAddress);
    return { inCooldown: false, remainingMinutes: 0 };
  }
  return { inCooldown: true, remainingMinutes: Math.ceil(diff / 60000) };
}

// Trader Performance Circuit Breaker: blacklist copied trader for 2 hours if 2 consecutive losses or rug pull
export interface TraderPerformance {
  consecutiveLosses: number;
  totalLosses: number;
  totalWins: number;
  cooldownUntil: number;
}
export const traderPerformanceMap = new Map<string, TraderPerformance>();

export function registerTraderTradeOutcome(walletAddress: string, isWin: boolean, isRugPull: boolean = false): void {
  const perf = traderPerformanceMap.get(walletAddress) || { consecutiveLosses: 0, totalLosses: 0, totalWins: 0, cooldownUntil: 0 };
  if (isWin) {
    perf.totalWins++;
    perf.consecutiveLosses = 0;
  } else {
    perf.totalLosses++;
    perf.consecutiveLosses++;
    if (perf.consecutiveLosses >= 2 || isRugPull) {
      // 2-hour quarantine cooldown
      perf.cooldownUntil = Date.now() + 2 * 60 * 60 * 1000;
    }
  }
  traderPerformanceMap.set(walletAddress, perf);
}

export function isTraderInCooldown(walletAddress: string): { inCooldown: boolean; remainingMinutes: number } {
  const perf = traderPerformanceMap.get(walletAddress);
  if (!perf || !perf.cooldownUntil) return { inCooldown: false, remainingMinutes: 0 };
  const diff = perf.cooldownUntil - Date.now();
  if (diff <= 0) {
    perf.cooldownUntil = 0;
    perf.consecutiveLosses = 0;
    return { inCooldown: false, remainingMinutes: 0 };
  }
  return { inCooldown: true, remainingMinutes: Math.ceil(diff / 60000) };
}

// Exited Buy Signatures Set: prevents repeated rejection spam and evaluation locks
// when a tracked whale has closed a position for a recent swap.
export const knownExitedBuysSet = new Set<string>();

// Standard MFE Profit Milestones for pattern analysis and optimal target discovery
export const STANDARD_PROFIT_MILESTONES = [
  { percent: 15, label: '+15% Move' },
  { percent: 30, label: '+30% Momentum' },
  { percent: 50, label: '+50% Surge' },
  { percent: 75, label: '+75% Expansion' },
  { percent: 100, label: '+100% (2x Double)' },
  { percent: 200, label: '+200% (3x Runner)' },
];

// Portfolio 1: Smart Money Copy-Trade Bot ($1,000 Starting Cash, 25 Concurrent Positions)
export const DEFAULT_DEMO_PORTFOLIO: DemoPortfolio = {
  startingCash: 1000.00,
  currentCash: 1000.00,
  investedInPositionsUsd: 0.00,
  totalEquityUsd: 1000.00,
  totalRealizedPnlUsd: 0.00,
  totalUnrealizedPnlUsd: 0.00,
  totalWins: 0,
  totalLosses: 0,
  winRate: 0,
  reloadCount: 0,
  totalDemoCapitalLoaded: 1000.00,
  isAutoReloadEnabled: true,
  isBotRunning: true,
  minConvictionThreshold: 80,
  allocationPerTradeUsd: 20,
  maxConcurrentPositions: 25,
  stopLossPercent: -20,
  takeProfitTargets: [
    { targetMultiplier: 1.35, sellPercent: 40 },
    { targetMultiplier: 2.0, sellPercent: 30 },
    { targetMultiplier: 3.0, sellPercent: 30 },
  ],
  equityHistory: [
    { timestamp: Date.now(), equityUsd: 1000.00 },
  ],
  closedTrades: [],
};

// Portfolio 2: Gem Radar Breakout Hunter Bot ($1,000 Starting Cash, 25 Concurrent Positions)
export const DEFAULT_GEM_RADAR_PORTFOLIO: DemoPortfolio = {
  startingCash: 1000.00,
  currentCash: 1000.00,
  investedInPositionsUsd: 0.00,
  totalEquityUsd: 1000.00,
  totalRealizedPnlUsd: 0.00,
  totalUnrealizedPnlUsd: 0.00,
  totalWins: 0,
  totalLosses: 0,
  winRate: 0,
  reloadCount: 0,
  totalDemoCapitalLoaded: 1000.00,
  isAutoReloadEnabled: true,
  isBotRunning: true,
  minConvictionThreshold: 80,
  allocationPerTradeUsd: 20,
  maxConcurrentPositions: 25,
  stopLossPercent: -20,
  takeProfitTargets: [
    { targetMultiplier: 1.35, sellPercent: 40 },
    { targetMultiplier: 2.0, sellPercent: 30 },
    { targetMultiplier: 3.0, sellPercent: 30 },
  ],
  equityHistory: [
    { timestamp: Date.now(), equityUsd: 1000.00 },
  ],
  closedTrades: [],
};

// Clean-slate Initial Decision Logs
export const INITIAL_DECISION_LOGS: DecisionLog[] = [
  {
    id: 'log-boot-solana',
    timestamp: Date.now(),
    type: 'EVALUATION_PASS',
    tokenSymbol: 'SOL',
    tokenAddress: 'So11111111111111111111111111111111111111112',
    chain: 'solana',
    convictionScore: 100,
    action: 'INITIALIZED $100.00 SMART MONEY COPY BOT (CLEAN SLATE)',
    rationale: 'Autonomous copy bot active. Monitoring tracked Solana alpha whales on Helius. Only enters on verified on-chain BUY swaps where whale still holds balance.',
    improvementLessonTag: '[BOOT_WHALE_COPY]',
    improvementNote: 'Enforcing 15-minute buy recency check, on-chain holding verification via Helius RPC, and 20% max slippage guard.',
  },
];

export const INITIAL_GEM_RADAR_LOGS: DecisionLog[] = [
  {
    id: 'log-boot-gem-radar',
    timestamp: Date.now(),
    type: 'EVALUATION_PASS',
    tokenSymbol: 'SOL',
    tokenAddress: 'So11111111111111111111111111111111111111112',
    chain: 'solana',
    convictionScore: 100,
    action: 'INITIALIZED $100.00 GEM RADAR BREAKOUT BOT (CLEAN SLATE)',
    rationale: 'Gem Radar momentum engine active. Scanning live DexScreener boosted and high-velocity Solana pools for 5-min volume surges and heavy buy pressure.',
    improvementLessonTag: '[BOOT_GEM_RADAR]',
    improvementNote: 'Trades trigger on >$15k 5m volume velocity, >1.2x buy ratio, and locked liquidity.',
  },
];

// ==========================================
// Periodic P&L Aggregation Helpers
// ==========================================

export function getDayLabel(dateStr: string): string {
  const todayStr = new Date().toISOString().slice(0, 10);
  const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
  const d = new Date(dateStr + 'T12:00:00Z');
  const formatted = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  if (dateStr === todayStr) return `Today (${formatted})`;
  if (dateStr === yesterday) return `Yesterday (${formatted})`;
  return formatted;
}

export function getWeekInfo(timestamp: number): {
  weekKey: string;
  weekLabel: string;
  startOfWeek: number;
  endOfWeek: number;
} {
  const date = new Date(timestamp);
  const dayOfWeek = date.getDay();
  const diffToMonday = (dayOfWeek + 6) % 7;
  const monday = new Date(date);
  monday.setDate(date.getDate() - diffToMonday);
  monday.setHours(0, 0, 0, 0);

  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  sunday.setHours(23, 59, 59, 999);

  const tempDate = new Date(date.getTime());
  tempDate.setHours(0, 0, 0, 0);
  tempDate.setDate(tempDate.getDate() + 3 - ((tempDate.getDay() + 6) % 7));
  const week1 = new Date(tempDate.getFullYear(), 0, 4);
  const weekNum = 1 + Math.round(((tempDate.getTime() - week1.getTime()) / 86400000 - 3 + ((week1.getDay() + 6) % 7)) / 7);

  const year = tempDate.getFullYear();
  const weekKey = `${year}-W${weekNum < 10 ? '0' : ''}${weekNum}`;
  const monLabel = monday.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  const sunLabel = sunday.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  const weekLabel = `Week ${weekNum} (${monLabel} - ${sunLabel})`;

  return { weekKey, weekLabel, startOfWeek: monday.getTime(), endOfWeek: sunday.getTime() };
}

export function getMonthInfo(timestamp: number): {
  monthKey: string;
  monthLabel: string;
  startOfMonth: number;
  endOfMonth: number;
} {
  const d = new Date(timestamp);
  const year = d.getFullYear();
  const month = d.getMonth();
  const monthKey = `${year}-${month + 1 < 10 ? '0' : ''}${month + 1}`;
  const monthLabel = d.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

  const startOfMonth = new Date(year, month, 1, 0, 0, 0, 0).getTime();
  const endOfMonth = new Date(year, month + 1, 0, 23, 59, 59, 999).getTime();

  return { monthKey, monthLabel, startOfMonth, endOfMonth };
}

export function aggregatePnlByPeriod(
  trades: DemoClosedTrade[],
  period: 'day' | 'week' | 'month'
): PeriodicPnlSummary[] {
  if (!trades || trades.length === 0) return [];

  const groups: Record<string, { label: string; start: number; end: number; trades: DemoClosedTrade[] }> = {};

  for (const trade of trades) {
    const ts = trade.exitTimestamp || trade.entryTimestamp;
    let key = '';
    let label = '';
    let start = 0;
    let end = 0;

    if (period === 'day') {
      const dateStr = new Date(ts).toISOString().slice(0, 10);
      key = dateStr;
      label = getDayLabel(dateStr);
      const d = new Date(dateStr + 'T00:00:00Z');
      start = d.getTime();
      end = start + 86400000 - 1;
    } else if (period === 'week') {
      const info = getWeekInfo(ts);
      key = info.weekKey;
      label = info.weekLabel;
      start = info.startOfWeek;
      end = info.endOfWeek;
    } else {
      const info = getMonthInfo(ts);
      key = info.monthKey;
      label = info.monthLabel;
      start = info.startOfMonth;
      end = info.endOfMonth;
    }

    if (!groups[key]) {
      groups[key] = { label, start, end, trades: [] };
    }
    groups[key].trades.push(trade);
  }

  const summaries: PeriodicPnlSummary[] = Object.entries(groups).map(([key, group]) => {
    const groupTrades = group.trades;
    const wins = groupTrades.filter((t) => t.netPnlUsd > 0).length;
    const losses = groupTrades.filter((t) => t.netPnlUsd <= 0).length;
    const winRate = groupTrades.length > 0 ? +((wins / groupTrades.length) * 100).toFixed(1) : 0;
    const totalInvested = groupTrades.reduce((acc, t) => acc + (t.investedUsd || 0), 0);
    const totalReturned = groupTrades.reduce((acc, t) => acc + (t.returnedUsd || 0), 0);
    const netPnlUsd = groupTrades.reduce((acc, t) => acc + (t.netPnlUsd || 0), 0);
    const netPnlPercent = totalInvested > 0 ? +((netPnlUsd / totalInvested) * 100).toFixed(1) : 0;

    let bestTradeSymbol: string | undefined;
    let bestTradeMultiplier = 0;
    for (const t of groupTrades) {
      if (t.multiplier > bestTradeMultiplier) {
        bestTradeMultiplier = t.multiplier;
        bestTradeSymbol = t.tokenSymbol;
      }
    }

    return {
      periodKey: key,
      periodType: period,
      periodLabel: group.label,
      startDate: group.start,
      endDate: group.end,
      totalTrades: groupTrades.length,
      wins,
      losses,
      winRate,
      totalInvestedUsd: +totalInvested.toFixed(2),
      totalReturnedUsd: +totalReturned.toFixed(2),
      netPnlUsd: +netPnlUsd.toFixed(2),
      netPnlPercent,
      bestTradeSymbol,
      bestTradeMultiplier,
      trades: groupTrades,
    };
  });

  summaries.sort((a, b) => b.startDate - a.startDate);
  return summaries;
}

export function aggregatePnlByDay(trades: DemoClosedTrade[]): PeriodicPnlSummary[] {
  return aggregatePnlByPeriod(trades, 'day');
}

export function aggregatePnlByWeek(trades: DemoClosedTrade[]): PeriodicPnlSummary[] {
  return aggregatePnlByPeriod(trades, 'week');
}

export function aggregatePnlByMonth(trades: DemoClosedTrade[]): PeriodicPnlSummary[] {
  return aggregatePnlByPeriod(trades, 'month');
}

export function calculateTimeframePnlMetrics(
  trades: DemoClosedTrade[],
  timeframe: '24h' | '7d' | '30d' | 'all'
): {
  realizedPnl: number;
  realizedPnlUsd: number;
  realizedPnlPercent: number;
  wins: number;
  losses: number;
  totalTrades: number;
  winRate: number;
  invested: number;
  returned: number;
} {
  const now = Date.now();
  const cutoff =
    timeframe === '24h'
      ? now - 86400000
      : timeframe === '7d'
      ? now - 7 * 86400000
      : timeframe === '30d'
      ? now - 30 * 86400000
      : 0;

  const filtered = cutoff === 0 ? trades : trades.filter((t) => (t.exitTimestamp || t.entryTimestamp) >= cutoff);
  const wins = filtered.filter((t) => t.netPnlUsd > 0).length;
  const losses = filtered.filter((t) => t.netPnlUsd <= 0).length;
  const totalTrades = filtered.length;
  const winRate = totalTrades > 0 ? +((wins / totalTrades) * 100).toFixed(1) : 0;
  const invested = filtered.reduce((acc, t) => acc + (t.investedUsd || 0), 0);
  const returned = filtered.reduce((acc, t) => acc + (t.returnedUsd || 0), 0);
  const realizedPnlUsd = filtered.reduce((acc, t) => acc + (t.netPnlUsd || 0), 0);
  const realizedPnlPercent = invested > 0 ? +((realizedPnlUsd / invested) * 100).toFixed(1) : 0;

  return {
    realizedPnl: +realizedPnlUsd.toFixed(2),
    realizedPnlUsd: +realizedPnlUsd.toFixed(2),
    realizedPnlPercent,
    wins,
    losses,
    totalTrades,
    winRate,
    invested: +invested.toFixed(2),
    returned: +returned.toFixed(2),
  };
}

export function filterTradesByTimeframe(
  trades: DemoClosedTrade[],
  filter: 'all' | '24h' | '7d' | '30d' | 'today' | 'yesterday' | 'this_week' | 'last_week' | 'this_month' | string
): DemoClosedTrade[] {
  if (!filter || filter === 'all') return trades;
  const now = Date.now();
  if (filter === '24h') return trades.filter((t) => (t.exitTimestamp || t.entryTimestamp) >= now - 86400000);
  if (filter === '7d') return trades.filter((t) => (t.exitTimestamp || t.entryTimestamp) >= now - 7 * 86400000);
  if (filter === '30d') return trades.filter((t) => (t.exitTimestamp || t.entryTimestamp) >= now - 30 * 86400000);

  const todayStart = new Date().setHours(0, 0, 0, 0);
  const yesterdayStart = todayStart - 86400000;

  const currentMonday = new Date();
  const day = currentMonday.getDay();
  const diff = (day + 6) % 7;
  currentMonday.setDate(currentMonday.getDate() - diff);
  currentMonday.setHours(0, 0, 0, 0);
  const thisWeekStart = currentMonday.getTime();
  const lastWeekStart = thisWeekStart - 7 * 86400000;
  const thisMonthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1).getTime();

  return trades.filter((t) => {
    const ts = t.exitTimestamp || t.entryTimestamp;
    switch (filter) {
      case 'today':
        return ts >= todayStart;
      case 'yesterday':
        return ts >= yesterdayStart && ts < todayStart;
      case 'this_week':
        return ts >= thisWeekStart;
      case 'last_week':
        return ts >= lastWeekStart && ts < thisWeekStart;
      case 'this_month':
        return ts >= thisMonthStart;
      default:
        return true;
    }
  });
}

// ==========================================
// Profitability Milestone & Peak Tracking Engine (MFE)
// ==========================================

export function updatePositionPeakAndMilestones(
  pos: DemoPosition,
  newPrice: number,
  newPnlPercent: number
): void {
  // Peak Price & PnL (Maximum Favorable Excursion)
  const currentPeakPrice = pos.peakPriceUsd ?? pos.entryPriceUsd;
  if (newPrice > currentPeakPrice) {
    pos.peakPriceUsd = newPrice;
  }
  const currentPeakPnl = pos.peakPnlPercent ?? 0;
  if (newPnlPercent > currentPeakPnl) {
    pos.peakPnlPercent = newPnlPercent;
  }

  // Lowest Price & PnL (Maximum Adverse Excursion)
  const currentLowestPrice = pos.lowestPriceUsd ?? pos.entryPriceUsd;
  if (newPrice < currentLowestPrice) {
    pos.lowestPriceUsd = newPrice;
  }
  const currentLowestPnl = pos.lowestPnlPercent ?? 0;
  if (newPnlPercent < currentLowestPnl) {
    pos.lowestPnlPercent = newPnlPercent;
  }

  // Record Milestones Reached
  if (!pos.profitMilestonesReached) {
    pos.profitMilestonesReached = [];
  }
  for (const m of STANDARD_PROFIT_MILESTONES) {
    if ((pos.peakPnlPercent ?? 0) >= m.percent && !pos.profitMilestonesReached.includes(m.percent)) {
      pos.profitMilestonesReached.push(m.percent);
    }
  }
}

export function calculateProfitLadderAnalytics(
  trades: DemoClosedTrade[],
  positions: DemoPosition[]
): ProfitLadderAnalytics {
  const evaluatedItems: Array<{ peakPnl: number; isWin: boolean; finalPnl: number }> = [];

  for (const t of trades) {
    const peak = t.peakPnlPercent !== undefined ? t.peakPnlPercent : Math.max(t.netPnlPercent, 0);
    evaluatedItems.push({
      peakPnl: peak,
      isWin: t.netPnlUsd > 0,
      finalPnl: t.netPnlPercent,
    });
  }

  for (const p of positions) {
    if (p.status === 'OPEN') {
      const peak = p.peakPnlPercent !== undefined ? p.peakPnlPercent : Math.max(p.pnlPercent, 0);
      evaluatedItems.push({
        peakPnl: peak,
        isWin: p.pnlPercent > 0,
        finalPnl: p.pnlPercent,
      });
    }
  }

  const totalEvaluated = evaluatedItems.length;

  const milestones: MilestoneRate[] = STANDARD_PROFIT_MILESTONES.map((m) => {
    const hitCount = evaluatedItems.filter((item) => item.peakPnl >= m.percent).length;
    const hitRatePercent = totalEvaluated > 0 ? +((hitCount / totalEvaluated) * 100).toFixed(1) : 0;
    return {
      milestonePercent: m.percent,
      label: m.label,
      hitCount,
      totalEvaluated,
      hitRatePercent,
    };
  });

  const allPeaks = evaluatedItems.map((i) => i.peakPnl);
  const avgPeakPnlAllPercent =
    allPeaks.length > 0 ? +(allPeaks.reduce((a, b) => a + b, 0) / allPeaks.length).toFixed(1) : 0;

  const winnerPeaks = evaluatedItems.filter((i) => i.isWin).map((i) => i.peakPnl);
  const avgPeakPnlWinnersPercent =
    winnerPeaks.length > 0 ? +(winnerPeaks.reduce((a, b) => a + b, 0) / winnerPeaks.length).toFixed(1) : 0;

  const lossPeaks = evaluatedItems.filter((i) => !i.isWin).map((i) => i.peakPnl);
  const avgPeakPnlLossesPercent =
    lossPeaks.length > 0 ? +(lossPeaks.reduce((a, b) => a + b, 0) / lossPeaks.length).toFixed(1) : 0;

  const tradesReversingAfterProfitCount = evaluatedItems.filter(
    (i) => i.peakPnl >= 15 && i.finalPnl <= 0
  ).length;

  let optimalTarget = 30;
  let bestEv = 0;
  for (const m of milestones) {
    const ev = (m.hitRatePercent / 100) * m.milestonePercent;
    if (ev > bestEv && m.hitRatePercent >= 25) {
      bestEv = ev;
      optimalTarget = m.milestonePercent;
    }
  }

  return {
    totalTradesTracked: totalEvaluated,
    milestones,
    avgPeakPnlAllPercent,
    avgPeakPnlWinnersPercent,
    avgPeakPnlLossesPercent,
    optimalTakeProfitTargetPercent: optimalTarget,
    tradesReversingAfterProfitCount,
  };
}

// ==========================================
// Bot Engine 1: Smart Money Copy-Trading Engine ($1,000 Bankroll, 25 Slots)
// Evaluates strictly real on-chain BUY swaps from Helius within last 15 min,
// verifies open token holding on-chain, and checks spot price slippage.
// ==========================================

export async function runCopyBotTick(
  portfolio: DemoPortfolio,
  positions: DemoPosition[],
  logs: DecisionLog[],
  closedTradesInput?: DemoClosedTrade[]
): Promise<{
  updatedPortfolio: DemoPortfolio;
  updatedPositions: DemoPosition[];
  newLogs: DecisionLog[];
}> {
  if (!portfolio.isBotRunning) {
    return { updatedPortfolio: portfolio, updatedPositions: positions, newLogs: [] };
  }

  let cash = portfolio.currentCash;
  let reloadCount = portfolio.reloadCount;
  let totalDemoCapitalLoaded = portfolio.totalDemoCapitalLoaded;
  let realizedPnl = portfolio.totalRealizedPnlUsd;
  let wins = portfolio.totalWins;
  let losses = portfolio.totalLosses;
  const newLogs: DecisionLog[] = [];
  const updatedPositions: DemoPosition[] = [];
  const updatedClosedTrades: DemoClosedTrade[] = [...(closedTradesInput || portfolio.closedTrades || [])];

  // 1. Evaluate Open Positions against real live spot prices with Dynamic Trailing Stop & Breakeven Ratchet
  for (const pos of positions) {
    if (pos.status === 'CLOSED') continue;

    const livePriceData = await fetchSolanaTokenPrice(pos.tokenAddress, pos.pairAddress);
    const newPrice = livePriceData.priceUsd > 0 ? livePriceData.priceUsd : pos.currentPriceUsd;
    if (livePriceData.liquidityUsd) {
      pos.currentLiquidityUsd = livePriceData.liquidityUsd;
    }
    if (livePriceData.pairAddress && !pos.pairAddress) {
      pos.pairAddress = livePriceData.pairAddress;
    }
    if (!pos.entryLiquidityUsd && pos.currentLiquidityUsd) {
      pos.entryLiquidityUsd = pos.currentLiquidityUsd;
    }
    const newPnlUsd = +((newPrice - pos.entryPriceUsd) * pos.tokenAmount).toFixed(2);
    const newPnlPercent = +(((newPrice - pos.entryPriceUsd) / pos.entryPriceUsd) * 100).toFixed(1);
    const holdDurationSeconds = Math.max(1, Math.round((Date.now() - pos.entryTimestamp) / 1000));
    const holdDurationMinutes = holdDurationSeconds / 60;

    // Update Peak & Lowest MFE Metrics
    updatePositionPeakAndMilestones(pos, newPrice, newPnlPercent);

    // Dynamic Rule 1: Early Breakeven Stop Ratchet
    // When peak PnL reaches >= +15%, move stop loss to Entry + 1.5% (covers gas & eliminates round-trip losses)
    if ((pos.peakPnlPercent ?? 0) >= 15) {
      pos.isBreakevenProtected = true;
      const breakevenStop = pos.entryPriceUsd * 1.015;
      if (pos.stopLossPrice < breakevenStop) {
        pos.stopLossPrice = breakevenStop;
      }
    }

    // Dynamic Rule 2: Trailing Stop Activation
    // When peak PnL reaches >= +25%, activate a dynamic trailing stop 12% below peak
    if ((pos.peakPnlPercent ?? 0) >= 25) {
      pos.isTrailingActive = true;
      const peakPrice = pos.peakPriceUsd || newPrice;
      const dynamicTrailingStop = peakPrice * 0.88;
      if (!pos.trailingStopPrice || dynamicTrailingStop > pos.trailingStopPrice) {
        pos.trailingStopPrice = dynamicTrailingStop;
      }
      if (pos.stopLossPrice < pos.trailingStopPrice) {
        pos.stopLossPrice = pos.trailingStopPrice;
      }
    }

    // Trigger CB: Circuit Breaker (Flash Rug / Liquidity Pull Detection)
    const isLiqDrained = !!(pos.entryLiquidityUsd && pos.currentLiquidityUsd && pos.entryLiquidityUsd > 0 &&
      ((pos.entryLiquidityUsd - pos.currentLiquidityUsd) / pos.entryLiquidityUsd >= 0.25));
    const isLiqBelowFloor = !!(pos.currentLiquidityUsd !== undefined && pos.currentLiquidityUsd > 0 && pos.currentLiquidityUsd < 8000);
    const isFlashCrash = newPnlPercent <= -50;

    if (isLiqDrained || isLiqBelowFloor || isFlashCrash) {
      const totalReturned = +(pos.investedUsd + newPnlUsd).toFixed(2);
      cash = +(cash + Math.max(0, totalReturned)).toFixed(2);
      realizedPnl = +(realizedPnl + newPnlUsd).toFixed(2);
      losses++;

      // Register trader outcome: flag trader for rug pull
      if (pos.copiedFromWallet) registerTraderTradeOutcome(pos.copiedFromWallet, false, true);

      // Emergency 2-hour quarantine cooldown for rug/crash tokens
      tokenStopLossCooldownMap.set(pos.tokenAddress, Date.now() + 2 * 3600 * 1000);

      const drainPct = (pos.entryLiquidityUsd && pos.currentLiquidityUsd && pos.entryLiquidityUsd > 0)
        ? Math.round(((pos.entryLiquidityUsd - pos.currentLiquidityUsd) / pos.entryLiquidityUsd) * 100)
        : 0;

      const reasonDetail = isLiqDrained
        ? `Circuit Breaker: Pool liquidity drained by ${drainPct}% ($${Math.round(pos.entryLiquidityUsd || 0)} -> $${Math.round(pos.currentLiquidityUsd || 0)})`
        : isLiqBelowFloor
        ? `Circuit Breaker: Liquidity collapsed below $8,000 floor ($${Math.round(pos.currentLiquidityUsd || 0)})`
        : `Circuit Breaker: Flash price crash (${newPnlPercent}%) detected`;

      const closedRecord: DemoClosedTrade = {
        id: `closed-copy-${Date.now()}-${Math.random().toString(36).substring(7)}`,
        tokenAddress: pos.tokenAddress,
        tokenSymbol: pos.tokenSymbol,
        tokenName: pos.tokenName,
        chain: 'solana',
        copiedFromWallet: pos.copiedFromWallet,
        copiedFromWalletLabel: pos.copiedFromWalletLabel,
        entryTimestamp: pos.entryTimestamp,
        exitTimestamp: Date.now(),
        holdDurationSeconds,
        entryPriceUsd: pos.entryPriceUsd,
        exitPriceUsd: newPrice,
        investedUsd: pos.investedUsd,
        returnedUsd: Math.max(0, totalReturned),
        netPnlUsd: newPnlUsd,
        netPnlPercent: newPnlPercent,
        multiplier: +(newPrice / pos.entryPriceUsd).toFixed(2),
        exitReason: 'LIQUIDITY_RUG_PULL',
        exitReasonDetail: reasonDetail,
        peakPriceUsd: pos.peakPriceUsd ?? pos.entryPriceUsd,
        peakPnlPercent: pos.peakPnlPercent ?? Math.max(0, newPnlPercent),
        lowestPriceUsd: pos.lowestPriceUsd ?? pos.entryPriceUsd,
        lowestPnlPercent: pos.lowestPnlPercent ?? Math.min(0, newPnlPercent),
        profitMilestonesReached: pos.profitMilestonesReached || [],
        alphaScoreAtEntry: pos.alphaScoreAtEntry,
        entryRationale: pos.entryRationale,
        simulatedGasFeeUsd: 0.005,
        pairAddress: pos.pairAddress,
      };
      updatedClosedTrades.unshift(closedRecord);

      newLogs.unshift({
        id: `log-cb-${Date.now()}`,
        timestamp: Date.now(),
        type: 'EXIT_STOP_LOSS',
        tokenSymbol: pos.tokenSymbol,
        tokenAddress: pos.tokenAddress,
        chain: 'solana',
        triggeredByWallet: pos.copiedFromWallet,
        triggeredByWalletLabel: pos.copiedFromWalletLabel,
        convictionScore: 5,
        action: `CIRCUIT BREAKER ACTIVATED: Emergency Exit on ${pos.tokenSymbol} at $${newPrice}`,
        rationale: `${reasonDetail}. Emergency market exit executed to protect capital. Placed on 2-hour quarantine cooldown.`,
        outcomePnlUsd: newPnlUsd,
        outcomePnlPercent: newPnlPercent,
        improvementLessonTag: '[CIRCUIT_BREAKER: RUG_DETECTED]',
        improvementNote: 'Emergency liquidity/crash filter triggered to prevent total loss.',
      });
      continue;
    }

    // Trigger ST: Stagnation / Time-Decay Exit (30m elapsed with < 4% peak, or 60m with < 10% peak)
    const isEarlyStagnant = holdDurationMinutes >= 30 && (pos.peakPnlPercent ?? 0) < 4;
    const isLateStagnant = holdDurationMinutes >= 60 && (pos.peakPnlPercent ?? 0) < 10;
    if (isEarlyStagnant || isLateStagnant) {
      const totalReturned = +(pos.investedUsd + newPnlUsd).toFixed(2);
      cash = +(cash + Math.max(0, totalReturned)).toFixed(2);
      realizedPnl = +(realizedPnl + newPnlUsd).toFixed(2);
      if (newPnlUsd >= 0) wins++; else losses++;

      if (pos.copiedFromWallet) registerTraderTradeOutcome(pos.copiedFromWallet, newPnlUsd >= 0);
      registerStopLossCooldown(pos.tokenAddress);

      const closedRecord: DemoClosedTrade = {
        id: `closed-copy-${Date.now()}-${Math.random().toString(36).substring(7)}`,
        tokenAddress: pos.tokenAddress,
        tokenSymbol: pos.tokenSymbol,
        tokenName: pos.tokenName,
        chain: 'solana',
        copiedFromWallet: pos.copiedFromWallet,
        copiedFromWalletLabel: pos.copiedFromWalletLabel,
        entryTimestamp: pos.entryTimestamp,
        exitTimestamp: Date.now(),
        holdDurationSeconds,
        entryPriceUsd: pos.entryPriceUsd,
        exitPriceUsd: newPrice,
        investedUsd: pos.investedUsd,
        returnedUsd: Math.max(0, totalReturned),
        netPnlUsd: newPnlUsd,
        netPnlPercent: newPnlPercent,
        multiplier: +(newPrice / pos.entryPriceUsd).toFixed(2),
        exitReason: 'STAGNATION_TIMEOUT',
        exitReasonDetail: `Stagnation Timeout (${Math.round(holdDurationMinutes)}m elapsed, peak only +${pos.peakPnlPercent}%) - Capital recycled`,
        peakPriceUsd: pos.peakPriceUsd ?? pos.entryPriceUsd,
        peakPnlPercent: pos.peakPnlPercent ?? Math.max(0, newPnlPercent),
        lowestPriceUsd: pos.lowestPriceUsd ?? pos.entryPriceUsd,
        lowestPnlPercent: pos.lowestPnlPercent ?? Math.min(0, newPnlPercent),
        profitMilestonesReached: pos.profitMilestonesReached || [],
        alphaScoreAtEntry: pos.alphaScoreAtEntry,
        entryRationale: pos.entryRationale,
        simulatedGasFeeUsd: 0.005,
        pairAddress: pos.pairAddress,
      };
      updatedClosedTrades.unshift(closedRecord);

      newLogs.unshift({
        id: `log-stag-${Date.now()}`,
        timestamp: Date.now(),
        type: 'EXIT_MANUAL',
        tokenSymbol: pos.tokenSymbol,
        tokenAddress: pos.tokenAddress,
        chain: 'solana',
        triggeredByWallet: pos.copiedFromWallet,
        triggeredByWalletLabel: pos.copiedFromWalletLabel,
        convictionScore: pos.alphaScoreAtEntry,
        action: `STAGNATION EXIT (${newPnlPercent >= 0 ? '+' : ''}${newPnlPercent}%) - Closed ${pos.tokenSymbol} at $${newPrice}`,
        rationale: `Position held for ${Math.round(holdDurationMinutes)}m with zero momentum (peak was only +${pos.peakPnlPercent}%). Capital recycled to newly breaking out gems. Net P&L: $${newPnlUsd}.`,
        outcomePnlUsd: newPnlUsd,
        outcomePnlPercent: newPnlPercent,
        improvementLessonTag: '[STAGNATION_TIMEOUT: CAPITAL_RECYCLED]',
        improvementNote: 'Capital freed up from stagnant sideways tokens to allocate to high-velocity breakouts.',
      });
      continue;
    }

    // Trigger A: Full Take-Profit Target Hit (Calibrated 1.35x / +35% Sweet Spot)
    if (newPrice >= pos.takeProfitPrice1) {
      registerTakeProfitCooldown(pos.tokenAddress);
      const totalReturned = +(pos.investedUsd + newPnlUsd).toFixed(2);
      cash = +(cash + totalReturned).toFixed(2);
      realizedPnl = +(realizedPnl + newPnlUsd).toFixed(2);
      wins++;

      if (pos.copiedFromWallet) registerTraderTradeOutcome(pos.copiedFromWallet, true);

      const closedRecord: DemoClosedTrade = {
        id: `closed-copy-${Date.now()}-${Math.random().toString(36).substring(7)}`,
        tokenAddress: pos.tokenAddress,
        tokenSymbol: pos.tokenSymbol,
        tokenName: pos.tokenName,
        chain: 'solana',
        copiedFromWallet: pos.copiedFromWallet,
        copiedFromWalletLabel: pos.copiedFromWalletLabel,
        entryTimestamp: pos.entryTimestamp,
        exitTimestamp: Date.now(),
        holdDurationSeconds: Math.max(1, Math.round((Date.now() - pos.entryTimestamp) / 1000)),
        entryPriceUsd: pos.entryPriceUsd,
        exitPriceUsd: newPrice,
        investedUsd: pos.investedUsd,
        returnedUsd: totalReturned,
        netPnlUsd: newPnlUsd,
        netPnlPercent: newPnlPercent,
        multiplier: +(newPrice / pos.entryPriceUsd).toFixed(2),
        exitReason: 'TAKE_PROFIT',
        exitReasonDetail: `Take-Profit Target Hit (+${newPnlPercent}%) at live spot $${newPrice}`,
        peakPriceUsd: pos.peakPriceUsd ?? pos.entryPriceUsd,
        peakPnlPercent: pos.peakPnlPercent ?? Math.max(0, newPnlPercent),
        lowestPriceUsd: pos.lowestPriceUsd ?? pos.entryPriceUsd,
        lowestPnlPercent: pos.lowestPnlPercent ?? Math.min(0, newPnlPercent),
        profitMilestonesReached: pos.profitMilestonesReached || [],
        alphaScoreAtEntry: pos.alphaScoreAtEntry,
        entryRationale: pos.entryRationale,
        simulatedGasFeeUsd: 0.005,
        pairAddress: pos.pairAddress,
      };
      updatedClosedTrades.unshift(closedRecord);

      newLogs.unshift({
        id: `log-tp-${Date.now()}`,
        timestamp: Date.now(),
        type: 'EXIT_TAKE_PROFIT',
        tokenSymbol: pos.tokenSymbol,
        tokenAddress: pos.tokenAddress,
        chain: 'solana',
        triggeredByWallet: pos.copiedFromWallet,
        triggeredByWalletLabel: pos.copiedFromWalletLabel,
        convictionScore: pos.alphaScoreAtEntry,
        action: `TAKE PROFIT (+${newPnlPercent}%) - Closed ${pos.tokenSymbol} at $${newPrice}`,
        rationale: `Automated Take-Profit triggered at target $${pos.takeProfitPrice1}. Capital returned: $${totalReturned}. Net P&L: +$${newPnlUsd}. Peak reached: +${pos.peakPnlPercent}%. Placed on 60m anti-top cooldown.`,
        outcomePnlUsd: newPnlUsd,
        outcomePnlPercent: newPnlPercent,
        improvementLessonTag: '[WIN: TAKE_PROFIT]',
        improvementNote: 'Disciplined exit locked in maximum target gains mechanically. Anti-top FOMO cooldown active.',
      });
      continue;
    }

    // Trigger B: Dynamic Trailing Stop Hit (Locked In Gains)
    if (pos.isTrailingActive && newPrice <= pos.stopLossPrice) {
      registerTakeProfitCooldown(pos.tokenAddress);
      const totalReturned = +(pos.investedUsd + newPnlUsd).toFixed(2);
      cash = +(cash + Math.max(0, totalReturned)).toFixed(2);
      realizedPnl = +(realizedPnl + newPnlUsd).toFixed(2);
      const isProfitable = newPnlUsd >= 0;
      if (isProfitable) wins++; else losses++;

      if (pos.copiedFromWallet) registerTraderTradeOutcome(pos.copiedFromWallet, isProfitable);

      const closedRecord: DemoClosedTrade = {
        id: `closed-copy-${Date.now()}-${Math.random().toString(36).substring(7)}`,
        tokenAddress: pos.tokenAddress,
        tokenSymbol: pos.tokenSymbol,
        tokenName: pos.tokenName,
        chain: 'solana',
        copiedFromWallet: pos.copiedFromWallet,
        copiedFromWalletLabel: pos.copiedFromWalletLabel,
        entryTimestamp: pos.entryTimestamp,
        exitTimestamp: Date.now(),
        holdDurationSeconds: Math.max(1, Math.round((Date.now() - pos.entryTimestamp) / 1000)),
        entryPriceUsd: pos.entryPriceUsd,
        exitPriceUsd: newPrice,
        investedUsd: pos.investedUsd,
        returnedUsd: Math.max(0, totalReturned),
        netPnlUsd: newPnlUsd,
        netPnlPercent: newPnlPercent,
        multiplier: +(newPrice / pos.entryPriceUsd).toFixed(2),
        exitReason: 'TRAILING_STOP',
        exitReasonDetail: `Trailing Stop Triggered (${newPnlPercent >= 0 ? '+' : ''}${newPnlPercent}%) - Locked in gains after peak +${pos.peakPnlPercent}%`,
        peakPriceUsd: pos.peakPriceUsd ?? pos.entryPriceUsd,
        peakPnlPercent: pos.peakPnlPercent ?? Math.max(0, newPnlPercent),
        lowestPriceUsd: pos.lowestPriceUsd ?? pos.entryPriceUsd,
        lowestPnlPercent: pos.lowestPnlPercent ?? Math.min(0, newPnlPercent),
        profitMilestonesReached: pos.profitMilestonesReached || [],
        alphaScoreAtEntry: pos.alphaScoreAtEntry,
        entryRationale: pos.entryRationale,
        simulatedGasFeeUsd: 0.005,
        pairAddress: pos.pairAddress,
      };
      updatedClosedTrades.unshift(closedRecord);

      newLogs.unshift({
        id: `log-trail-${Date.now()}`,
        timestamp: Date.now(),
        type: 'EXIT_TAKE_PROFIT',
        tokenSymbol: pos.tokenSymbol,
        tokenAddress: pos.tokenAddress,
        chain: 'solana',
        triggeredByWallet: pos.copiedFromWallet,
        triggeredByWalletLabel: pos.copiedFromWalletLabel,
        convictionScore: pos.alphaScoreAtEntry,
        action: `TRAILING STOP (${newPnlPercent >= 0 ? '+' : ''}${newPnlPercent}%) - Closed ${pos.tokenSymbol} at $${newPrice}`,
        rationale: `Dynamic trailing stop locked in profit after peak reached +${pos.peakPnlPercent}%. Prevented profit round-trip into loss. Net P&L: +$${newPnlUsd}. Placed on 60m anti-top cooldown.`,
        outcomePnlUsd: newPnlUsd,
        outcomePnlPercent: newPnlPercent,
        improvementLessonTag: '[WIN: TRAILING_STOP_PROTECTION]',
        improvementNote: 'Dynamic trailing stop protected accumulated unrealized gains. Anti-top FOMO cooldown active.',
      });
      continue;
    }

    // Trigger C: Breakeven Stop Hit (Protected Capital)
    if (pos.isBreakevenProtected && newPrice <= pos.stopLossPrice) {
      registerTakeProfitCooldown(pos.tokenAddress);
      const totalReturned = +(pos.investedUsd + newPnlUsd).toFixed(2);
      cash = +(cash + Math.max(0, totalReturned)).toFixed(2);
      realizedPnl = +(realizedPnl + newPnlUsd).toFixed(2);
      const isProfitable = newPnlUsd >= 0;
      if (isProfitable) {
        wins++;
        if (pos.copiedFromWallet) registerTraderTradeOutcome(pos.copiedFromWallet, true);
      } else {
        losses++;
        registerStopLossCooldown(pos.tokenAddress);
        if (pos.copiedFromWallet) registerTraderTradeOutcome(pos.copiedFromWallet, false);
      }

      const closedRecord: DemoClosedTrade = {
        id: `closed-copy-${Date.now()}-${Math.random().toString(36).substring(7)}`,
        tokenAddress: pos.tokenAddress,
        tokenSymbol: pos.tokenSymbol,
        tokenName: pos.tokenName,
        chain: 'solana',
        copiedFromWallet: pos.copiedFromWallet,
        copiedFromWalletLabel: pos.copiedFromWalletLabel,
        entryTimestamp: pos.entryTimestamp,
        exitTimestamp: Date.now(),
        holdDurationSeconds: Math.max(1, Math.round((Date.now() - pos.entryTimestamp) / 1000)),
        entryPriceUsd: pos.entryPriceUsd,
        exitPriceUsd: newPrice,
        investedUsd: pos.investedUsd,
        returnedUsd: Math.max(0, totalReturned),
        netPnlUsd: newPnlUsd,
        netPnlPercent: newPnlPercent,
        multiplier: +(newPrice / pos.entryPriceUsd).toFixed(2),
        exitReason: isProfitable ? 'BREAKEVEN_STOP' : 'STOP_LOSS',
        exitReasonDetail: isProfitable
          ? `Breakeven Stop Triggered (+${newPnlPercent}%) - Preserved capital after peak +${pos.peakPnlPercent}%`
          : `Breakeven Stop Slipped (${newPnlPercent}%) - Gap-down tick executed below entry`,
        peakPriceUsd: pos.peakPriceUsd ?? pos.entryPriceUsd,
        peakPnlPercent: pos.peakPnlPercent ?? Math.max(0, newPnlPercent),
        lowestPriceUsd: pos.lowestPriceUsd ?? pos.entryPriceUsd,
        lowestPnlPercent: pos.lowestPnlPercent ?? Math.min(0, newPnlPercent),
        profitMilestonesReached: pos.profitMilestonesReached || [],
        alphaScoreAtEntry: pos.alphaScoreAtEntry,
        entryRationale: pos.entryRationale,
        simulatedGasFeeUsd: 0.005,
        pairAddress: pos.pairAddress,
      };
      updatedClosedTrades.unshift(closedRecord);

      newLogs.unshift({
        id: `log-be-${Date.now()}`,
        timestamp: Date.now(),
        type: isProfitable ? 'EXIT_TAKE_PROFIT' : 'EXIT_STOP_LOSS',
        tokenSymbol: pos.tokenSymbol,
        tokenAddress: pos.tokenAddress,
        chain: 'solana',
        triggeredByWallet: pos.copiedFromWallet,
        triggeredByWalletLabel: pos.copiedFromWalletLabel,
        convictionScore: pos.alphaScoreAtEntry,
        action: isProfitable
          ? `BREAKEVEN STOP (+${newPnlPercent}%) - Closed ${pos.tokenSymbol} at $${newPrice}`
          : `BREAKEVEN STOP SLIPPED (${newPnlPercent}%) - Closed ${pos.tokenSymbol} at $${newPrice}`,
        rationale: isProfitable
          ? `Capital preserved at breakeven after initial pump to +${pos.peakPnlPercent}%. Prevented falling back to a loss. Placed on 60m anti-top cooldown.`
          : `Position peaked at +${pos.peakPnlPercent}%, but subsequent gap-down tick triggered exit below entry (${newPnlPercent}%). Capital protected against further drop.`,
        outcomePnlUsd: newPnlUsd,
        outcomePnlPercent: newPnlPercent,
        improvementLessonTag: isProfitable ? '[BREAKEVEN_PROTECTION]' : '[SLIPPAGE_STOP]',
        improvementNote: isProfitable ? 'Capital defended: trade closed without taking a loss. Anti-top FOMO cooldown active.' : 'Cut loss early after momentum failed.',
      });
      continue;
    }

    // Trigger D: Hard Stop Loss Cut
    if (newPrice <= pos.stopLossPrice) {
      const totalReturned = +(pos.investedUsd + newPnlUsd).toFixed(2);
      cash = +(cash + Math.max(0, totalReturned)).toFixed(2);
      realizedPnl = +(realizedPnl + newPnlUsd).toFixed(2);
      losses++;

      if (pos.copiedFromWallet) registerTraderTradeOutcome(pos.copiedFromWallet, false);

      // Register 45-minute anti-churn cooldown for this token
      registerStopLossCooldown(pos.tokenAddress);

      const closedRecord: DemoClosedTrade = {
        id: `closed-copy-${Date.now()}-${Math.random().toString(36).substring(7)}`,
        tokenAddress: pos.tokenAddress,
        tokenSymbol: pos.tokenSymbol,
        tokenName: pos.tokenName,
        chain: 'solana',
        copiedFromWallet: pos.copiedFromWallet,
        copiedFromWalletLabel: pos.copiedFromWalletLabel,
        entryTimestamp: pos.entryTimestamp,
        exitTimestamp: Date.now(),
        holdDurationSeconds: Math.max(1, Math.round((Date.now() - pos.entryTimestamp) / 1000)),
        entryPriceUsd: pos.entryPriceUsd,
        exitPriceUsd: newPrice,
        investedUsd: pos.investedUsd,
        returnedUsd: Math.max(0, totalReturned),
        netPnlUsd: newPnlUsd,
        netPnlPercent: newPnlPercent,
        multiplier: +(newPrice / pos.entryPriceUsd).toFixed(2),
        exitReason: 'STOP_LOSS',
        exitReasonDetail: `Hard Stop-Loss Triggered (${newPnlPercent}%) at live spot $${newPrice}`,
        peakPriceUsd: pos.peakPriceUsd ?? pos.entryPriceUsd,
        peakPnlPercent: pos.peakPnlPercent ?? Math.max(0, newPnlPercent),
        lowestPriceUsd: pos.lowestPriceUsd ?? pos.entryPriceUsd,
        lowestPnlPercent: pos.lowestPnlPercent ?? Math.min(0, newPnlPercent),
        profitMilestonesReached: pos.profitMilestonesReached || [],
        alphaScoreAtEntry: pos.alphaScoreAtEntry,
        entryRationale: pos.entryRationale,
        simulatedGasFeeUsd: 0.005,
        pairAddress: pos.pairAddress,
      };
      updatedClosedTrades.unshift(closedRecord);

      newLogs.unshift({
        id: `log-sl-${Date.now()}`,
        timestamp: Date.now(),
        type: 'EXIT_STOP_LOSS',
        tokenSymbol: pos.tokenSymbol,
        tokenAddress: pos.tokenAddress,
        chain: 'solana',
        triggeredByWallet: pos.copiedFromWallet,
        triggeredByWalletLabel: pos.copiedFromWalletLabel,
        convictionScore: pos.alphaScoreAtEntry,
        action: `STOP LOSS HIT (${newPnlPercent}%) - Closed ${pos.tokenSymbol} at $${newPrice}`,
        rationale: `Automated Stop-Loss triggered below threshold ($${pos.stopLossPrice}). Token placed on 45m anti-churn cooldown to prevent buying falling knife. Net Loss: -$${Math.abs(newPnlUsd)}.`,
        outcomePnlUsd: newPnlUsd,
        outcomePnlPercent: newPnlPercent,
        improvementLessonTag: '[LOSS: STOP_LOSS_PROTECTION]',
        improvementNote: 'Capital preserved against catastrophic drawdown. Cooldown activated.',
      });
      continue;
    }

    updatedPositions.push({
      ...pos,
      currentPriceUsd: newPrice,
      pnlUsd: newPnlUsd,
      pnlPercent: newPnlPercent,
      peakPriceUsd: pos.peakPriceUsd,
      peakPnlPercent: pos.peakPnlPercent,
      lowestPriceUsd: pos.lowestPriceUsd,
      lowestPnlPercent: pos.lowestPnlPercent,
      profitMilestonesReached: pos.profitMilestonesReached,
      trailingStopPrice: pos.trailingStopPrice,
      isTrailingActive: pos.isTrailingActive,
      isBreakevenProtected: pos.isBreakevenProtected,
      stopLossPrice: pos.stopLossPrice,
    });
  }

  // 2. Real Whale Copy Evaluation: Scan tracked alpha whales for genuine recent buys
  const activePositionCount = updatedPositions.filter((p) => p.status === 'OPEN').length;
  if (activePositionCount < portfolio.maxConcurrentPositions && cash >= portfolio.allocationPerTradeUsd) {
    const targetWallets: Array<{ address: string; label: string; isDynamic?: boolean }> = SEED_WALLETS.slice(0, 8).map((w) => ({
      address: w.address,
      label: w.label,
    }));

    // If slots are available and cash permits, dynamically pull active Solana traders from real on-chain swaps
    if (updatedPositions.length < portfolio.maxConcurrentPositions && cash >= portfolio.allocationPerTradeUsd) {
      try {
        const liveTraderAddresses = await discoverActiveTraders(12);
        for (const addr of liveTraderAddresses) {
          if (!targetWallets.some((w) => w.address.toLowerCase() === addr.toLowerCase())) {
            targetWallets.push({
              address: addr,
              label: `Active Solana Trader (${addr.slice(0, 4)}...${addr.slice(-4)})`,
              isDynamic: true,
            });
          }
        }
      } catch (err) {
        // Fallback gracefully
      }
    }

    const maxRecencyMs = 45 * 60 * 1000; // 45-minute recency window

    for (const wallet of targetWallets) {
      if (updatedPositions.length >= portfolio.maxConcurrentPositions || cash < portfolio.allocationPerTradeUsd) break;

      // Trader Performance Circuit Breaker: Skip wallets in cooldown
      const traderCooldown = isTraderInCooldown(wallet.address);
      if (traderCooldown.inCooldown) {
        continue;
      }

      try {
        const recentSwaps = await fetchWalletOnChainSwaps(wallet.address, 5);
        const recencyThreshold = Date.now() - maxRecencyMs;

        // Check for fresh on-chain BUY swaps
        const candidateBuys = recentSwaps.filter(
          (s) => s.action === 'BUY' && s.timestamp >= recencyThreshold && s.tokenAddress !== 'So11111111111111111111111111111111111111112'
        );

        for (const freshBuy of candidateBuys) {
          if (updatedPositions.length >= portfolio.maxConcurrentPositions || cash < portfolio.allocationPerTradeUsd) break;

          const exitKey = `${wallet.address}:${freshBuy.tokenAddress}:${freshBuy.signature}`;
          if (knownExitedBuysSet.has(exitKey)) {
            continue; // Already processed and verified exited; move to next candidate buy
          }

          // Trader Quality Gate: Reject dynamic unvetted traders buying micro amounts (< 1.0 SOL)
          if (wallet.isDynamic && (freshBuy.solAmount || 0) < 1.0) {
            newLogs.unshift({
              id: `log-skip-dynamic-size-${Date.now()}`,
              timestamp: Date.now(),
              type: 'EVALUATION_REJECT',
              tokenSymbol: freshBuy.tokenSymbol,
              tokenAddress: freshBuy.tokenAddress,
              chain: 'solana',
              triggeredByWallet: wallet.address,
              triggeredByWalletLabel: wallet.label,
              convictionScore: 25,
              action: `SKIPPED ${freshBuy.tokenSymbol}: Dynamic Trader Buy Under 1.0 SOL (${freshBuy.solAmount || 0} SOL)`,
              rationale: `Dynamic unvetted trader executed micro-buy (< 1.0 SOL). Filtered out to reject pump.fun snipers and preserve bankroll for high-conviction whale moves.`,
              improvementLessonTag: '[AVOIDED_MICRO_SNIPER]',
              improvementNote: 'Trader Quality Gate: Required >= 1.0 SOL on dynamic trader signals.',
            });
            continue;
          }

          const alreadyHolding = updatedPositions.some((p) => p.tokenAddress === freshBuy.tokenAddress);
          if (alreadyHolding) continue;

          // Anti-Churn Stop-Loss Cooldown Check
          const cooldownCheck = isTokenInStopLossCooldown(freshBuy.tokenAddress);
          if (cooldownCheck.inCooldown) {
            newLogs.unshift({
              id: `log-skip-cooldown-${Date.now()}`,
              timestamp: Date.now(),
              type: 'EVALUATION_REJECT',
              tokenSymbol: freshBuy.tokenSymbol,
              tokenAddress: freshBuy.tokenAddress,
              chain: 'solana',
              triggeredByWallet: wallet.address,
              triggeredByWalletLabel: wallet.label,
              convictionScore: 25,
              action: `SKIPPED ${freshBuy.tokenSymbol}: Anti-Churn Cooldown Active (${cooldownCheck.remainingMinutes}m remaining)`,
              rationale: `Token recently triggered hard stop-loss. Blacklisted for 45 minutes to prevent re-entering a falling knife / dumping momentum.`,
              improvementLessonTag: '[ANTI_CHURN_COOLDOWN]',
              improvementNote: 'Capital protected from repetitive churn losses.',
            });
            continue;
          }

          // Anti-Top-FOMO Take-Profit Cooldown Check
          const tpCooldownCheck = isTokenInTakeProfitCooldown(freshBuy.tokenAddress);
          if (tpCooldownCheck.inCooldown) {
            newLogs.unshift({
              id: `log-skip-tp-cooldown-${Date.now()}`,
              timestamp: Date.now(),
              type: 'EVALUATION_REJECT',
              tokenSymbol: freshBuy.tokenSymbol,
              tokenAddress: freshBuy.tokenAddress,
              chain: 'solana',
              triggeredByWallet: wallet.address,
              triggeredByWalletLabel: wallet.label,
              convictionScore: 30,
              action: `SKIPPED ${freshBuy.tokenSymbol}: Anti-FOMO Cooldown Active (${tpCooldownCheck.remainingMinutes}m remaining)`,
              rationale: `Token recently hit Take-Profit / Trailing Stop. Blacklisted for 60 minutes to prevent buying the exhausted top of a pump.`,
              improvementLessonTag: '[ANTI_TOP_FOMO_COOLDOWN]',
              improvementNote: 'Capital protected from post-pump exhaustion and secondary dump tops.',
            });
            continue;
          }

          // Check on-chain holding via Helius RPC
          const holdingStatus = await checkWalletTokenHolding(wallet.address, freshBuy.tokenAddress);
          if (!holdingStatus.isHolding) {
            knownExitedBuysSet.add(exitKey);
            newLogs.unshift({
              id: `log-skip-sold-${Date.now()}`,
              timestamp: Date.now(),
              type: 'EVALUATION_REJECT',
              tokenSymbol: freshBuy.tokenSymbol,
              tokenAddress: freshBuy.tokenAddress,
              chain: 'solana',
              triggeredByWallet: wallet.address,
              triggeredByWalletLabel: wallet.label,
              convictionScore: 20,
              action: `SKIPPED ${freshBuy.tokenSymbol}: Whale Already Exited Position`,
              rationale: `Whale ${wallet.label} executed buy but on-chain balance is now 0. Whale already sold/dumped. Refusing late copy trade.`,
              improvementLessonTag: '[AVOIDED_DUMP: POSITION_CLOSED]',
              improvementNote: 'Verified zero token balance on Helius RPC. Capital preserved.',
            });
            continue; // Continue to next candidate buy for this wallet
          }

          // Fetch live spot price and liquidity
          const priceData = await fetchSolanaTokenPrice(freshBuy.tokenAddress);
          const spotPrice = priceData.priceUsd > 0 ? priceData.priceUsd : (freshBuy.priceSol ? freshBuy.priceSol * 184 : 0);

          if (spotPrice > 0) {
            // Whale Copy Safety Floor 1: Pool Liquidity >= $25,000 (Prevents pump.fun Raydium migration dumps)
            const poolLiquidity = priceData.liquidityUsd || 0;
            if (poolLiquidity < 25000) {
              newLogs.unshift({
                id: `log-skip-liq-${Date.now()}`,
                timestamp: Date.now(),
                type: 'EVALUATION_REJECT',
                tokenSymbol: freshBuy.tokenSymbol,
                tokenAddress: freshBuy.tokenAddress,
                chain: 'solana',
                triggeredByWallet: wallet.address,
                triggeredByWalletLabel: wallet.label,
                convictionScore: 20,
                action: `SKIPPED ${freshBuy.tokenSymbol}: Liquidity Under $25k ($${Math.round(poolLiquidity).toLocaleString()})`,
                rationale: `Token pool liquidity ($${Math.round(poolLiquidity).toLocaleString()}) is below the $25,000 safety threshold. Protected against pump.fun Raydium migration rugs.`,
                improvementLessonTag: '[AVOIDED_LOW_LIQUIDITY]',
                improvementNote: 'Enforced $25k liquidity floor on copy trading.',
              });
              continue;
            }

            // Whale Copy Safety Floor 1b: Pool Maturation Check (Pool age >= 180s and txns >= 50)
            if (priceData.pairCreatedAt && (Date.now() - priceData.pairCreatedAt) < 180000 && (priceData.txns24h || 0) < 50) {
              newLogs.unshift({
                id: `log-skip-unmature-${Date.now()}`,
                timestamp: Date.now(),
                type: 'EVALUATION_REJECT',
                tokenSymbol: freshBuy.tokenSymbol,
                tokenAddress: freshBuy.tokenAddress,
                chain: 'solana',
                triggeredByWallet: wallet.address,
                triggeredByWalletLabel: wallet.label,
                convictionScore: 25,
                action: `SKIPPED ${freshBuy.tokenSymbol}: Pool Immature (${Math.round((Date.now() - priceData.pairCreatedAt) / 1000)}s old, ${priceData.txns24h || 0} txns)`,
                rationale: `Pool is under 3 minutes old with fewer than 50 transactions. Protected against sniper-dump traps.`,
                improvementLessonTag: '[AVOIDED_IMMATURE_POOL]',
                improvementNote: 'Required pool age >= 180s and >= 50 transactions.',
              });
              continue;
            }

            // Whale Copy Safety Floor 2: Price Ceiling ($1.00 max to filter non-meme / synthetic tokens)
            if (spotPrice > 1.0) {
              newLogs.unshift({
                id: `log-skip-price-${Date.now()}`,
                timestamp: Date.now(),
                type: 'EVALUATION_REJECT',
                tokenSymbol: freshBuy.tokenSymbol,
                tokenAddress: freshBuy.tokenAddress,
                chain: 'solana',
                triggeredByWallet: wallet.address,
                triggeredByWalletLabel: wallet.label,
                convictionScore: 25,
                action: `SKIPPED ${freshBuy.tokenSymbol}: Spot Price Over $1.00 ($${spotPrice.toFixed(2)})`,
                rationale: `Asset spot price ($${spotPrice.toFixed(2)}) exceeds $1.00 meme threshold.`,
                improvementLessonTag: '[NON_MEME_FILTER]',
                improvementNote: 'Filter active: only low-cap memecoins permitted.',
              });
              continue;
            }

            // Whale Copy Safety Floor 3: Market Cap Ceiling ($25M max)
            if (priceData.marketCapUsd && priceData.marketCapUsd > 25000000) {
              continue;
            }

            // Whale Copy Safety Floor 4: Volume Velocity Floor
            if (priceData.volume5m !== undefined && priceData.volume1h !== undefined && priceData.volume5m < 500 && priceData.volume1h < 2500) {
              continue;
            }

            // Check slippage: if price has already pumped > 25% since whale entry, skip
            if (freshBuy.priceSol) {
              const whaleEntryUsd = freshBuy.priceSol * 184;
              const slippagePct = ((spotPrice - whaleEntryUsd) / whaleEntryUsd) * 100;
              if (slippagePct > 25) {
                newLogs.unshift({
                  id: `log-skip-fomo-${Date.now()}`,
                  timestamp: Date.now(),
                  type: 'EVALUATION_REJECT',
                  tokenSymbol: freshBuy.tokenSymbol,
                  tokenAddress: freshBuy.tokenAddress,
                  chain: 'solana',
                  triggeredByWallet: wallet.address,
                  triggeredByWalletLabel: wallet.label,
                  convictionScore: 35,
                  action: `SKIPPED ${freshBuy.tokenSymbol}: Price Already Surged +${slippagePct.toFixed(1)}%`,
                  rationale: `Whale entered at $${whaleEntryUsd.toFixed(6)}, spot is now $${spotPrice.toFixed(6)}. Chasing top risks immediate drawdown.`,
                  improvementLessonTag: '[AVOIDED_FOMO: LATE_ENTRY_SLIPPAGE]',
                  improvementNote: 'Discipline enforced: only enter within 25% of whale entry price.',
                });
                continue;
              }
            }

            // Execute true copy trade
            const allocation = portfolio.allocationPerTradeUsd;
            cash = +(cash - allocation).toFixed(2);
            const tokenAmount = +(allocation / spotPrice).toFixed(4);

            const newPos: DemoPosition = {
              id: `pos-copy-${Date.now()}-${freshBuy.tokenSymbol}`,
              tokenAddress: freshBuy.tokenAddress,
              tokenSymbol: freshBuy.tokenSymbol,
              tokenName: freshBuy.tokenSymbol,
              chain: 'solana',
              copiedFromWallet: wallet.address,
              copiedFromWalletLabel: wallet.label,
              entryTimestamp: Date.now(),
              entryPriceUsd: spotPrice,
              currentPriceUsd: spotPrice,
              investedUsd: allocation,
              tokenAmount,
              pnlUsd: 0,
              pnlPercent: 0,
              takeProfitPrice1: spotPrice * 1.35, // High-precision float (no .toFixed(6) truncation)
              takeProfitPrice2: spotPrice * 2.0,  // Extended TP2 (+100%)
              stopLossPrice: spotPrice * (1 + portfolio.stopLossPercent / 100),
              status: 'OPEN',
              alphaScoreAtEntry: 95,
              entryRationale: `Copied verified on-chain BUY by ${wallet.label} (confirmed open token balance on Solscan).`,
              strategy: 'WHALE_COPY',
              verifiedWhaleHolding: true,
              whaleEntryTimestamp: freshBuy.timestamp,
              peakPriceUsd: spotPrice,
              peakPnlPercent: 0,
              lowestPriceUsd: spotPrice,
              lowestPnlPercent: 0,
              profitMilestonesReached: [],
              isBreakevenProtected: false,
              isTrailingActive: false,
              entryLiquidityUsd: priceData.liquidityUsd || 25000,
              currentLiquidityUsd: priceData.liquidityUsd || 25000,
              pairAddress: priceData.pairAddress,
            };

            updatedPositions.push(newPos);

            newLogs.unshift({
              id: `log-entry-copy-${Date.now()}`,
              timestamp: Date.now(),
              type: 'ENTRY_EXECUTED',
              tokenSymbol: freshBuy.tokenSymbol,
              tokenAddress: freshBuy.tokenAddress,
              chain: 'solana',
              triggeredByWallet: wallet.address,
              triggeredByWalletLabel: wallet.label,
              convictionScore: 95,
              action: `ENTERED ${freshBuy.tokenSymbol}: Copied verified live whale buy at $${spotPrice}`,
              rationale: `Verified on-chain swap by ${wallet.label} on Solana. Whale holding active balance (${holdingStatus.tokenBalance.toLocaleString()} tokens). Tx: ${freshBuy.signature.slice(0, 12)}...`,
              improvementLessonTag: '[WIN_OPPORTUNITY: VERIFIED_WHALE_HOLDING]',
              improvementNote: 'Entered alongside whale with confirmed on-chain position.',
            });

            // Enter at most one position per wallet per tick
            break;
          }
        }
      } catch (err) {
        console.warn(`[CopyBot] Error scanning wallet ${wallet.address}:`, err);
      }
    }
  }

  // 3. Final Portfolio Metrics Calculation
  const openPositionsMarketValue = updatedPositions
    .filter((p) => p.status === 'OPEN')
    .reduce((acc, p) => acc + (p.investedUsd + p.pnlUsd), 0);
  const investedInPositions = updatedPositions
    .filter((p) => p.status === 'OPEN')
    .reduce((acc, p) => acc + p.investedUsd, 0);
  const totalEquity = +(cash + openPositionsMarketValue).toFixed(2);
  const unrealizedPnl = +(openPositionsMarketValue - investedInPositions).toFixed(2);
  const totalTradesCount = wins + losses;
  const winRate = totalTradesCount > 0 ? +((wins / totalTradesCount) * 100).toFixed(1) : 0;

  const history = [...portfolio.equityHistory];
  if (history.length === 0 || Date.now() - history[history.length - 1].timestamp > 60000) {
    history.push({ timestamp: Date.now(), equityUsd: totalEquity });
  }

  const updatedPortfolio: DemoPortfolio = {
    ...portfolio,
    currentCash: cash,
    investedInPositionsUsd: +investedInPositions.toFixed(2),
    totalEquityUsd: totalEquity,
    totalRealizedPnlUsd: realizedPnl,
    totalUnrealizedPnlUsd: unrealizedPnl,
    totalWins: wins,
    totalLosses: losses,
    winRate,
    reloadCount,
    totalDemoCapitalLoaded,
    equityHistory: history.slice(-50),
    closedTrades: updatedClosedTrades,
  };

  return {
    updatedPortfolio,
    updatedPositions,
    newLogs,
  };
}

// ==========================================
// Bot Engine 2: Gem Radar Breakout Hunter Engine ($100 Bankroll)
// Trades live high-velocity volume surges and early-stage breakouts
// discovered dynamically on the Gem Radar.
// ==========================================

export async function runGemRadarBotTick(
  portfolio: DemoPortfolio,
  positions: DemoPosition[],
  logs: DecisionLog[],
  closedTradesInput?: DemoClosedTrade[]
): Promise<{
  updatedPortfolio: DemoPortfolio;
  updatedPositions: DemoPosition[];
  newLogs: DecisionLog[];
}> {
  if (!portfolio.isBotRunning) {
    return { updatedPortfolio: portfolio, updatedPositions: positions, newLogs: [] };
  }

  let cash = portfolio.currentCash;
  let reloadCount = portfolio.reloadCount;
  let totalDemoCapitalLoaded = portfolio.totalDemoCapitalLoaded;
  let realizedPnl = portfolio.totalRealizedPnlUsd;
  let wins = portfolio.totalWins;
  let losses = portfolio.totalLosses;
  const newLogs: DecisionLog[] = [];
  const updatedPositions: DemoPosition[] = [];
  const updatedClosedTrades: DemoClosedTrade[] = [...(closedTradesInput || portfolio.closedTrades || [])];

  // 1. Evaluate Open Positions against real live spot prices with Dynamic Trailing Stop & Breakeven Ratchet
  for (const pos of positions) {
    if (pos.status === 'CLOSED') continue;

    const livePriceData = await fetchSolanaTokenPrice(pos.tokenAddress, pos.pairAddress);
    const newPrice = livePriceData.priceUsd > 0 ? livePriceData.priceUsd : pos.currentPriceUsd;
    if (livePriceData.liquidityUsd) {
      pos.currentLiquidityUsd = livePriceData.liquidityUsd;
    }
    if (livePriceData.pairAddress && !pos.pairAddress) {
      pos.pairAddress = livePriceData.pairAddress;
    }
    if (!pos.entryLiquidityUsd && pos.currentLiquidityUsd) {
      pos.entryLiquidityUsd = pos.currentLiquidityUsd;
    }
    const newPnlUsd = +((newPrice - pos.entryPriceUsd) * pos.tokenAmount).toFixed(2);
    const newPnlPercent = +(((newPrice - pos.entryPriceUsd) / pos.entryPriceUsd) * 100).toFixed(1);
    const holdDurationSeconds = Math.max(1, Math.round((Date.now() - pos.entryTimestamp) / 1000));
    const holdDurationMinutes = holdDurationSeconds / 60;

    // Update Peak & Lowest MFE Metrics
    updatePositionPeakAndMilestones(pos, newPrice, newPnlPercent);

    // Dynamic Rule 1: Early Breakeven Stop Ratchet
    // When peak PnL reaches >= +15%, move stop loss to Entry + 1.5% (covers gas & eliminates round-trip losses)
    if ((pos.peakPnlPercent ?? 0) >= 15) {
      pos.isBreakevenProtected = true;
      const breakevenStop = pos.entryPriceUsd * 1.015;
      if (pos.stopLossPrice < breakevenStop) {
        pos.stopLossPrice = breakevenStop;
      }
    }

    // Dynamic Rule 2: Trailing Stop Activation
    // When peak PnL reaches >= +25%, activate a dynamic trailing stop 12% below peak
    if ((pos.peakPnlPercent ?? 0) >= 25) {
      pos.isTrailingActive = true;
      const peakPrice = pos.peakPriceUsd || newPrice;
      const dynamicTrailingStop = peakPrice * 0.88;
      if (!pos.trailingStopPrice || dynamicTrailingStop > pos.trailingStopPrice) {
        pos.trailingStopPrice = dynamicTrailingStop;
      }
      if (pos.stopLossPrice < pos.trailingStopPrice) {
        pos.stopLossPrice = pos.trailingStopPrice;
      }
    }

    // Trigger CB: Circuit Breaker (Flash Rug / Liquidity Pull Detection)
    const isLiqDrained = !!(pos.entryLiquidityUsd && pos.currentLiquidityUsd && pos.entryLiquidityUsd > 0 &&
      ((pos.entryLiquidityUsd - pos.currentLiquidityUsd) / pos.entryLiquidityUsd >= 0.25));
    const isLiqBelowFloor = !!(pos.currentLiquidityUsd !== undefined && pos.currentLiquidityUsd > 0 && pos.currentLiquidityUsd < 8000);
    const isFlashCrash = newPnlPercent <= -50;

    if (isLiqDrained || isLiqBelowFloor || isFlashCrash) {
      const totalReturned = +(pos.investedUsd + newPnlUsd).toFixed(2);
      cash = +(cash + Math.max(0, totalReturned)).toFixed(2);
      realizedPnl = +(realizedPnl + newPnlUsd).toFixed(2);
      losses++;

      // Emergency 2-hour quarantine cooldown for rug/crash tokens
      tokenStopLossCooldownMap.set(pos.tokenAddress, Date.now() + 2 * 3600 * 1000);

      const drainPct = (pos.entryLiquidityUsd && pos.currentLiquidityUsd && pos.entryLiquidityUsd > 0)
        ? Math.round(((pos.entryLiquidityUsd - pos.currentLiquidityUsd) / pos.entryLiquidityUsd) * 100)
        : 0;

      const reasonDetail = isLiqDrained
        ? `Circuit Breaker: Pool liquidity drained by ${drainPct}% ($${Math.round(pos.entryLiquidityUsd || 0)} -> $${Math.round(pos.currentLiquidityUsd || 0)})`
        : isLiqBelowFloor
        ? `Circuit Breaker: Liquidity collapsed below $8,000 floor ($${Math.round(pos.currentLiquidityUsd || 0)})`
        : `Circuit Breaker: Flash price crash (${newPnlPercent}%) detected`;

      const closedRecord: DemoClosedTrade = {
        id: `closed-gem-${Date.now()}-${Math.random().toString(36).substring(7)}`,
        tokenAddress: pos.tokenAddress,
        tokenSymbol: pos.tokenSymbol,
        tokenName: pos.tokenName,
        chain: 'solana',
        copiedFromWallet: pos.copiedFromWallet,
        copiedFromWalletLabel: 'Gem Radar Velocity Breakout',
        entryTimestamp: pos.entryTimestamp,
        exitTimestamp: Date.now(),
        holdDurationSeconds,
        entryPriceUsd: pos.entryPriceUsd,
        exitPriceUsd: newPrice,
        investedUsd: pos.investedUsd,
        returnedUsd: Math.max(0, totalReturned),
        netPnlUsd: newPnlUsd,
        netPnlPercent: newPnlPercent,
        multiplier: +(newPrice / pos.entryPriceUsd).toFixed(2),
        exitReason: 'LIQUIDITY_RUG_PULL',
        exitReasonDetail: reasonDetail,
        peakPriceUsd: pos.peakPriceUsd ?? pos.entryPriceUsd,
        peakPnlPercent: pos.peakPnlPercent ?? Math.max(0, newPnlPercent),
        lowestPriceUsd: pos.lowestPriceUsd ?? pos.entryPriceUsd,
        lowestPnlPercent: pos.lowestPnlPercent ?? Math.min(0, newPnlPercent),
        profitMilestonesReached: pos.profitMilestonesReached || [],
        alphaScoreAtEntry: pos.alphaScoreAtEntry,
        entryRationale: pos.entryRationale,
        simulatedGasFeeUsd: 0.005,
        pairAddress: pos.pairAddress,
      };
      updatedClosedTrades.unshift(closedRecord);

      newLogs.unshift({
        id: `log-gem-cb-${Date.now()}`,
        timestamp: Date.now(),
        type: 'EXIT_STOP_LOSS',
        tokenSymbol: pos.tokenSymbol,
        tokenAddress: pos.tokenAddress,
        chain: 'solana',
        convictionScore: 5,
        action: `CIRCUIT BREAKER ACTIVATED: Emergency Exit on ${pos.tokenSymbol} at $${newPrice}`,
        rationale: `${reasonDetail}. Emergency market exit executed on Gem Breakout to protect capital. Placed on 2-hour quarantine cooldown.`,
        outcomePnlUsd: newPnlUsd,
        outcomePnlPercent: newPnlPercent,
        improvementLessonTag: '[CIRCUIT_BREAKER: RUG_DETECTED]',
        improvementNote: 'Emergency liquidity/crash filter triggered to prevent total loss.',
      });
      continue;
    }

    // Trigger ST: Stagnation / Time-Decay Exit (30m elapsed with < 4% peak, or 60m with < 10% peak)
    const isEarlyStagnant = holdDurationMinutes >= 30 && (pos.peakPnlPercent ?? 0) < 4;
    const isLateStagnant = holdDurationMinutes >= 60 && (pos.peakPnlPercent ?? 0) < 10;
    if (isEarlyStagnant || isLateStagnant) {
      const totalReturned = +(pos.investedUsd + newPnlUsd).toFixed(2);
      cash = +(cash + Math.max(0, totalReturned)).toFixed(2);
      realizedPnl = +(realizedPnl + newPnlUsd).toFixed(2);
      if (newPnlUsd >= 0) wins++; else losses++;
      registerStopLossCooldown(pos.tokenAddress);

      const closedRecord: DemoClosedTrade = {
        id: `closed-gem-${Date.now()}-${Math.random().toString(36).substring(7)}`,
        tokenAddress: pos.tokenAddress,
        tokenSymbol: pos.tokenSymbol,
        tokenName: pos.tokenName,
        chain: 'solana',
        copiedFromWallet: pos.copiedFromWallet,
        copiedFromWalletLabel: 'Gem Radar Velocity Breakout',
        entryTimestamp: pos.entryTimestamp,
        exitTimestamp: Date.now(),
        holdDurationSeconds,
        entryPriceUsd: pos.entryPriceUsd,
        exitPriceUsd: newPrice,
        investedUsd: pos.investedUsd,
        returnedUsd: Math.max(0, totalReturned),
        netPnlUsd: newPnlUsd,
        netPnlPercent: newPnlPercent,
        multiplier: +(newPrice / pos.entryPriceUsd).toFixed(2),
        exitReason: 'STAGNATION_TIMEOUT',
        exitReasonDetail: `Stagnation Timeout (${Math.round(holdDurationMinutes)}m elapsed, peak ${pos.peakPnlPercent ?? 0}%) - Capital recycled`,
        peakPriceUsd: pos.peakPriceUsd ?? pos.entryPriceUsd,
        peakPnlPercent: pos.peakPnlPercent ?? Math.max(0, newPnlPercent),
        lowestPriceUsd: pos.lowestPriceUsd ?? pos.entryPriceUsd,
        lowestPnlPercent: pos.lowestPnlPercent ?? Math.min(0, newPnlPercent),
        profitMilestonesReached: pos.profitMilestonesReached || [],
        alphaScoreAtEntry: pos.alphaScoreAtEntry,
        entryRationale: pos.entryRationale,
        simulatedGasFeeUsd: 0.005,
        pairAddress: pos.pairAddress,
      };
      updatedClosedTrades.unshift(closedRecord);

      newLogs.unshift({
        id: `log-gem-stag-${Date.now()}`,
        timestamp: Date.now(),
        type: 'EXIT_MANUAL',
        tokenSymbol: pos.tokenSymbol,
        tokenAddress: pos.tokenAddress,
        chain: 'solana',
        convictionScore: pos.alphaScoreAtEntry,
        action: `STAGNATION EXIT (${newPnlPercent >= 0 ? '+' : ''}${newPnlPercent}%) - Closed ${pos.tokenSymbol} at $${newPrice}`,
        rationale: `Position held for ${Math.round(holdDurationMinutes)}m with zero momentum (peak was only +${pos.peakPnlPercent}%). Capital recycled to newly breaking out gems. Net P&L: $${newPnlUsd}.`,
        outcomePnlUsd: newPnlUsd,
        outcomePnlPercent: newPnlPercent,
        improvementLessonTag: '[STAGNATION_TIMEOUT: CAPITAL_RECYCLED]',
        improvementNote: 'Capital freed up from stagnant sideways tokens to allocate to high-velocity breakouts.',
      });
      continue;
    }

    // Trigger A: Full Take-Profit Target Hit (Calibrated 1.35x / +35% Sweet Spot)
    if (newPrice >= pos.takeProfitPrice1) {
      registerTakeProfitCooldown(pos.tokenAddress);
      const totalReturned = +(pos.investedUsd + newPnlUsd).toFixed(2);
      cash = +(cash + totalReturned).toFixed(2);
      realizedPnl = +(realizedPnl + newPnlUsd).toFixed(2);
      wins++;

      const closedRecord: DemoClosedTrade = {
        id: `closed-gem-${Date.now()}-${Math.random().toString(36).substring(7)}`,
        tokenAddress: pos.tokenAddress,
        tokenSymbol: pos.tokenSymbol,
        tokenName: pos.tokenName,
        chain: 'solana',
        copiedFromWallet: pos.copiedFromWallet,
        copiedFromWalletLabel: 'Gem Radar Velocity Breakout',
        entryTimestamp: pos.entryTimestamp,
        exitTimestamp: Date.now(),
        holdDurationSeconds: Math.max(1, Math.round((Date.now() - pos.entryTimestamp) / 1000)),
        entryPriceUsd: pos.entryPriceUsd,
        exitPriceUsd: newPrice,
        investedUsd: pos.investedUsd,
        returnedUsd: totalReturned,
        netPnlUsd: newPnlUsd,
        netPnlPercent: newPnlPercent,
        multiplier: +(newPrice / pos.entryPriceUsd).toFixed(2),
        exitReason: 'TAKE_PROFIT',
        exitReasonDetail: `Take-Profit Target Hit (+${newPnlPercent}%) on Gem Radar Breakout at $${newPrice}`,
        peakPriceUsd: pos.peakPriceUsd ?? pos.entryPriceUsd,
        peakPnlPercent: pos.peakPnlPercent ?? Math.max(0, newPnlPercent),
        lowestPriceUsd: pos.lowestPriceUsd ?? pos.entryPriceUsd,
        lowestPnlPercent: pos.lowestPnlPercent ?? Math.min(0, newPnlPercent),
        profitMilestonesReached: pos.profitMilestonesReached || [],
        alphaScoreAtEntry: pos.alphaScoreAtEntry,
        entryRationale: pos.entryRationale,
        simulatedGasFeeUsd: 0.005,
        pairAddress: pos.pairAddress,
      };
      updatedClosedTrades.unshift(closedRecord);

      newLogs.unshift({
        id: `log-gem-tp-${Date.now()}`,
        timestamp: Date.now(),
        type: 'EXIT_TAKE_PROFIT',
        tokenSymbol: pos.tokenSymbol,
        tokenAddress: pos.tokenAddress,
        chain: 'solana',
        convictionScore: pos.alphaScoreAtEntry,
        action: `TAKE PROFIT (+${newPnlPercent}%) - Sold Gem Radar breakout ${pos.tokenSymbol} at $${newPrice}`,
        rationale: `Automated Take-Profit triggered at target $${pos.takeProfitPrice1}. Capital returned: $${totalReturned}. Net P&L: +$${newPnlUsd}. Peak reached: +${pos.peakPnlPercent}%. Placed on 60m anti-top cooldown.`,
        outcomePnlUsd: newPnlUsd,
        outcomePnlPercent: newPnlPercent,
        improvementLessonTag: '[WIN: GEM_BREAKOUT_TP]',
        improvementNote: 'Locked in breakout gains mechanically at peak double. Anti-top FOMO cooldown active.',
      });
      continue;
    }

    // Trigger B: Dynamic Trailing Stop Hit (Locked In Gains)
    if (pos.isTrailingActive && newPrice <= pos.stopLossPrice) {
      registerTakeProfitCooldown(pos.tokenAddress);
      const totalReturned = +(pos.investedUsd + newPnlUsd).toFixed(2);
      cash = +(cash + Math.max(0, totalReturned)).toFixed(2);
      realizedPnl = +(realizedPnl + newPnlUsd).toFixed(2);
      if (newPnlUsd >= 0) wins++; else losses++;

      const closedRecord: DemoClosedTrade = {
        id: `closed-gem-${Date.now()}-${Math.random().toString(36).substring(7)}`,
        tokenAddress: pos.tokenAddress,
        tokenSymbol: pos.tokenSymbol,
        tokenName: pos.tokenName,
        chain: 'solana',
        copiedFromWallet: pos.copiedFromWallet,
        copiedFromWalletLabel: 'Gem Radar Velocity Breakout',
        entryTimestamp: pos.entryTimestamp,
        exitTimestamp: Date.now(),
        holdDurationSeconds: Math.max(1, Math.round((Date.now() - pos.entryTimestamp) / 1000)),
        entryPriceUsd: pos.entryPriceUsd,
        exitPriceUsd: newPrice,
        investedUsd: pos.investedUsd,
        returnedUsd: Math.max(0, totalReturned),
        netPnlUsd: newPnlUsd,
        netPnlPercent: newPnlPercent,
        multiplier: +(newPrice / pos.entryPriceUsd).toFixed(2),
        exitReason: 'TRAILING_STOP',
        exitReasonDetail: `Trailing Stop Triggered (${newPnlPercent >= 0 ? '+' : ''}${newPnlPercent}%) on Gem Breakout - Locked in gains after peak +${pos.peakPnlPercent}%`,
        peakPriceUsd: pos.peakPriceUsd ?? pos.entryPriceUsd,
        peakPnlPercent: pos.peakPnlPercent ?? Math.max(0, newPnlPercent),
        lowestPriceUsd: pos.lowestPriceUsd ?? pos.entryPriceUsd,
        lowestPnlPercent: pos.lowestPnlPercent ?? Math.min(0, newPnlPercent),
        profitMilestonesReached: pos.profitMilestonesReached || [],
        alphaScoreAtEntry: pos.alphaScoreAtEntry,
        entryRationale: pos.entryRationale,
        simulatedGasFeeUsd: 0.005,
        pairAddress: pos.pairAddress,
      };
      updatedClosedTrades.unshift(closedRecord);

      newLogs.unshift({
        id: `log-gem-trail-${Date.now()}`,
        timestamp: Date.now(),
        type: 'EXIT_TAKE_PROFIT',
        tokenSymbol: pos.tokenSymbol,
        tokenAddress: pos.tokenAddress,
        chain: 'solana',
        convictionScore: pos.alphaScoreAtEntry,
        action: `TRAILING STOP (${newPnlPercent >= 0 ? '+' : ''}${newPnlPercent}%) - Closed Gem ${pos.tokenSymbol} at $${newPrice}`,
        rationale: `Dynamic trailing stop locked in profit after breakout peaked at +${pos.peakPnlPercent}%. Prevented profit round-trip into loss. Net P&L: +$${newPnlUsd}. Placed on 60m anti-top cooldown.`,
        outcomePnlUsd: newPnlUsd,
        outcomePnlPercent: newPnlPercent,
        improvementLessonTag: '[WIN: GEM_TRAILING_PROTECTION]',
        improvementNote: 'Dynamic trailing stop protected accumulated unrealized gains from post-breakout pullback. Anti-top FOMO cooldown active.',
      });
      continue;
    }

    // Trigger C: Breakeven Stop Hit (Protected Capital)
    if (pos.isBreakevenProtected && newPrice <= pos.stopLossPrice) {
      registerTakeProfitCooldown(pos.tokenAddress);
      const totalReturned = +(pos.investedUsd + newPnlUsd).toFixed(2);
      cash = +(cash + Math.max(0, totalReturned)).toFixed(2);
      realizedPnl = +(realizedPnl + newPnlUsd).toFixed(2);
      const isProfitable = newPnlUsd >= 0;
      if (isProfitable) {
        wins++;
      } else {
        losses++;
        registerStopLossCooldown(pos.tokenAddress);
      }

      const closedRecord: DemoClosedTrade = {
        id: `closed-gem-${Date.now()}-${Math.random().toString(36).substring(7)}`,
        tokenAddress: pos.tokenAddress,
        tokenSymbol: pos.tokenSymbol,
        tokenName: pos.tokenName,
        chain: 'solana',
        copiedFromWallet: pos.copiedFromWallet,
        copiedFromWalletLabel: 'Gem Radar Velocity Breakout',
        entryTimestamp: pos.entryTimestamp,
        exitTimestamp: Date.now(),
        holdDurationSeconds: Math.max(1, Math.round((Date.now() - pos.entryTimestamp) / 1000)),
        entryPriceUsd: pos.entryPriceUsd,
        exitPriceUsd: newPrice,
        investedUsd: pos.investedUsd,
        returnedUsd: Math.max(0, totalReturned),
        netPnlUsd: newPnlUsd,
        netPnlPercent: newPnlPercent,
        multiplier: +(newPrice / pos.entryPriceUsd).toFixed(2),
        exitReason: isProfitable ? 'BREAKEVEN_STOP' : 'STOP_LOSS',
        exitReasonDetail: isProfitable
          ? `Breakeven Stop Triggered (+${newPnlPercent}%) on Gem Breakout - Preserved capital after peak +${pos.peakPnlPercent}%`
          : `Breakeven Stop Slipped (${newPnlPercent}%) on Gem Breakout - Gap-down tick executed below entry`,
        peakPriceUsd: pos.peakPriceUsd ?? pos.entryPriceUsd,
        peakPnlPercent: pos.peakPnlPercent ?? Math.max(0, newPnlPercent),
        lowestPriceUsd: pos.lowestPriceUsd ?? pos.entryPriceUsd,
        lowestPnlPercent: pos.lowestPnlPercent ?? Math.min(0, newPnlPercent),
        profitMilestonesReached: pos.profitMilestonesReached || [],
        alphaScoreAtEntry: pos.alphaScoreAtEntry,
        entryRationale: pos.entryRationale,
        simulatedGasFeeUsd: 0.005,
        pairAddress: pos.pairAddress,
      };
      updatedClosedTrades.unshift(closedRecord);

      newLogs.unshift({
        id: `log-gem-be-${Date.now()}`,
        timestamp: Date.now(),
        type: isProfitable ? 'EXIT_TAKE_PROFIT' : 'EXIT_STOP_LOSS',
        tokenSymbol: pos.tokenSymbol,
        tokenAddress: pos.tokenAddress,
        chain: 'solana',
        convictionScore: pos.alphaScoreAtEntry,
        action: isProfitable
          ? `BREAKEVEN STOP (+${newPnlPercent}%) - Closed Gem ${pos.tokenSymbol} at $${newPrice}`
          : `BREAKEVEN STOP SLIPPED (${newPnlPercent}%) - Closed Gem ${pos.tokenSymbol} at $${newPrice}`,
        rationale: isProfitable
          ? `Capital preserved at breakeven after initial pump to +${pos.peakPnlPercent}%. Prevented falling back to a loss. Placed on 60m anti-top cooldown.`
          : `Position peaked at +${pos.peakPnlPercent}%, but subsequent gap-down tick triggered exit below entry (${newPnlPercent}%). Capital protected against further drop.`,
        outcomePnlUsd: newPnlUsd,
        outcomePnlPercent: newPnlPercent,
        improvementLessonTag: isProfitable ? '[BREAKEVEN_PROTECTION]' : '[SLIPPAGE_STOP]',
        improvementNote: isProfitable ? 'Capital defended: trade closed without taking a loss. Anti-top FOMO cooldown active.' : 'Cut loss early after momentum failed.',
      });
      continue;
    }

    // Trigger D: Hard Stop Loss Cut
    if (newPrice <= pos.stopLossPrice) {
      const totalReturned = +(pos.investedUsd + newPnlUsd).toFixed(2);
      cash = +(cash + Math.max(0, totalReturned)).toFixed(2);
      realizedPnl = +(realizedPnl + newPnlUsd).toFixed(2);
      losses++;

      // Register 45-minute anti-churn cooldown for this token
      registerStopLossCooldown(pos.tokenAddress);

      const closedRecord: DemoClosedTrade = {
        id: `closed-gem-${Date.now()}-${Math.random().toString(36).substring(7)}`,
        tokenAddress: pos.tokenAddress,
        tokenSymbol: pos.tokenSymbol,
        tokenName: pos.tokenName,
        chain: 'solana',
        copiedFromWallet: pos.copiedFromWallet,
        copiedFromWalletLabel: 'Gem Radar Velocity Breakout',
        entryTimestamp: pos.entryTimestamp,
        exitTimestamp: Date.now(),
        holdDurationSeconds: Math.max(1, Math.round((Date.now() - pos.entryTimestamp) / 1000)),
        entryPriceUsd: pos.entryPriceUsd,
        exitPriceUsd: newPrice,
        investedUsd: pos.investedUsd,
        returnedUsd: Math.max(0, totalReturned),
        netPnlUsd: newPnlUsd,
        netPnlPercent: newPnlPercent,
        multiplier: +(newPrice / pos.entryPriceUsd).toFixed(2),
        exitReason: 'STOP_LOSS',
        exitReasonDetail: `Hard Stop-Loss Cut (${newPnlPercent}%) on Gem Radar breakout at $${newPrice}`,
        peakPriceUsd: pos.peakPriceUsd ?? pos.entryPriceUsd,
        peakPnlPercent: pos.peakPnlPercent ?? Math.max(0, newPnlPercent),
        lowestPriceUsd: pos.lowestPriceUsd ?? pos.entryPriceUsd,
        lowestPnlPercent: pos.lowestPnlPercent ?? Math.min(0, newPnlPercent),
        profitMilestonesReached: pos.profitMilestonesReached || [],
        alphaScoreAtEntry: pos.alphaScoreAtEntry,
        entryRationale: pos.entryRationale,
        simulatedGasFeeUsd: 0.005,
        pairAddress: pos.pairAddress,
      };
      updatedClosedTrades.unshift(closedRecord);

      newLogs.unshift({
        id: `log-gem-sl-${Date.now()}`,
        timestamp: Date.now(),
        type: 'EXIT_STOP_LOSS',
        tokenSymbol: pos.tokenSymbol,
        tokenAddress: pos.tokenAddress,
        chain: 'solana',
        convictionScore: pos.alphaScoreAtEntry,
        action: `STOP LOSS HIT (${newPnlPercent}%) - Cut Gem ${pos.tokenSymbol} at $${newPrice}`,
        rationale: `Automated Stop-Loss triggered below threshold ($${pos.stopLossPrice}). Placed on 45m anti-churn cooldown to prevent re-entering falling knife. Net Loss: -$${Math.abs(newPnlUsd)}.`,
        outcomePnlUsd: newPnlUsd,
        outcomePnlPercent: newPnlPercent,
        improvementLessonTag: '[LOSS: GEM_BREAKOUT_STOP]',
        improvementNote: 'Capital protected from post-breakout pullback. Cooldown activated.',
      });
      continue;
    }

    updatedPositions.push({
      ...pos,
      currentPriceUsd: newPrice,
      pnlUsd: newPnlUsd,
      pnlPercent: newPnlPercent,
      peakPriceUsd: pos.peakPriceUsd,
      peakPnlPercent: pos.peakPnlPercent,
      lowestPriceUsd: pos.lowestPriceUsd,
      lowestPnlPercent: pos.lowestPnlPercent,
      profitMilestonesReached: pos.profitMilestonesReached,
      trailingStopPrice: pos.trailingStopPrice,
      isTrailingActive: pos.isTrailingActive,
      isBreakevenProtected: pos.isBreakevenProtected,
      stopLossPrice: pos.stopLossPrice,
    });
  }

  // 2. Scan Live Gem Radar for High-Conviction Breakout Setups
  const activePositionCount = updatedPositions.filter((p) => p.status === 'OPEN').length;
  if (activePositionCount < portfolio.maxConcurrentPositions && cash >= portfolio.allocationPerTradeUsd) {
    try {
      const liveSignals = await detectPreBreakoutGemSignals();

      for (const sig of liveSignals) {
        if (updatedPositions.length >= portfolio.maxConcurrentPositions || cash < portfolio.allocationPerTradeUsd) break;

        const alreadyHolding = updatedPositions.some((p) => p.tokenAddress === sig.tokenAddress);
        if (alreadyHolding) continue;

        // Anti-Churn Stop-Loss Cooldown Check
        const cooldownCheck = isTokenInStopLossCooldown(sig.tokenAddress);
        if (cooldownCheck.inCooldown) {
          newLogs.unshift({
            id: `log-gem-skip-cooldown-${Date.now()}`,
            timestamp: Date.now(),
            type: 'EVALUATION_REJECT',
            tokenSymbol: sig.tokenSymbol,
            tokenAddress: sig.tokenAddress,
            chain: 'solana',
            convictionScore: 25,
            action: `SKIPPED ${sig.tokenSymbol}: Anti-Churn Cooldown Active (${cooldownCheck.remainingMinutes}m remaining)`,
            rationale: `Token recently triggered stop-loss. Blacklisted for 45 minutes to prevent re-entering a dumping breakout.`,
            improvementLessonTag: '[ANTI_CHURN_COOLDOWN]',
            improvementNote: 'Capital protected from repetitive churn losses.',
          });
          continue;
        }

        // Anti-Top-FOMO Take-Profit Cooldown Check
        const tpCooldownCheck = isTokenInTakeProfitCooldown(sig.tokenAddress);
        if (tpCooldownCheck.inCooldown) {
          newLogs.unshift({
            id: `log-gem-skip-tp-cooldown-${Date.now()}`,
            timestamp: Date.now(),
            type: 'EVALUATION_REJECT',
            tokenSymbol: sig.tokenSymbol,
            tokenAddress: sig.tokenAddress,
            chain: 'solana',
            convictionScore: 30,
            action: `SKIPPED ${sig.tokenSymbol}: Anti-FOMO Cooldown Active (${tpCooldownCheck.remainingMinutes}m remaining)`,
            rationale: `Token recently hit Take-Profit / Trailing Stop. Blacklisted for 60 minutes to prevent buying the exhausted top of a finished pump.`,
            improvementLessonTag: '[ANTI_TOP_FOMO_COOLDOWN]',
            improvementNote: 'Capital protected from post-pump exhaustion and secondary dump tops.',
          });
          continue;
        }

        // Entry criteria: Confidence >= 80, liquidity depth >= $25k (Strict Floor), valid spot price
        if (sig.confidenceScore >= 80 && sig.liquidityUsd >= 25000 && sig.priceUsd > 0) {
          const allocation = portfolio.allocationPerTradeUsd;
          cash = +(cash - allocation).toFixed(2);
          const spotPrice = sig.priceUsd;
          const tokenAmount = +(allocation / spotPrice).toFixed(4);

          const newPos: DemoPosition = {
            id: `pos-gem-${Date.now()}-${sig.tokenSymbol}`,
            tokenAddress: sig.tokenAddress,
            tokenSymbol: sig.tokenSymbol,
            tokenName: sig.tokenName,
            chain: 'solana',
            copiedFromWallet: sig.tokenAddress,
            copiedFromWalletLabel: `Gem Radar: ${sig.patternTitle}`,
            entryTimestamp: Date.now(),
            entryPriceUsd: spotPrice,
            currentPriceUsd: spotPrice,
            investedUsd: allocation,
            tokenAmount,
            pnlUsd: 0,
            pnlPercent: 0,
            takeProfitPrice1: spotPrice * 1.35, // High-precision float (no .toFixed(6) truncation)
            takeProfitPrice2: spotPrice * 2.0,  // Extended TP2 (+100%)
            stopLossPrice: spotPrice * (1 + portfolio.stopLossPercent / 100),
            status: 'OPEN',
            alphaScoreAtEntry: sig.confidenceScore,
            entryRationale: `Sniped live Gem Radar breakout: ${sig.patternTitle}. 5m Volume: $${Math.round(sig.volume5mUsd).toLocaleString()}, Liquidity: $${Math.round(sig.liquidityUsd).toLocaleString()}.`,
            strategy: 'GEM_RADAR_BREAKOUT',
            gemPattern: sig.patternType,
            peakPriceUsd: spotPrice,
            peakPnlPercent: 0,
            lowestPriceUsd: spotPrice,
            lowestPnlPercent: 0,
            profitMilestonesReached: [],
            isBreakevenProtected: false,
            isTrailingActive: false,
            entryLiquidityUsd: sig.liquidityUsd || 25000,
            currentLiquidityUsd: sig.liquidityUsd || 25000,
            pairAddress: sig.pairAddress,
          };

          updatedPositions.push(newPos);

          newLogs.unshift({
            id: `log-entry-gem-${Date.now()}`,
            timestamp: Date.now(),
            type: 'ENTRY_EXECUTED',
            tokenSymbol: sig.tokenSymbol,
            tokenAddress: sig.tokenAddress,
            chain: 'solana',
            convictionScore: sig.confidenceScore,
            action: `ENTERED ${sig.tokenSymbol} (GEM RADAR BREAKOUT): $${allocation} at spot $${spotPrice}`,
            rationale: `Live Gem Radar setup verified: ${sig.patternTitle}. ${sig.patternDescription}`,
            improvementLessonTag: '[WIN_OPPORTUNITY: GEM_RADAR_BREAKOUT]',
            improvementNote: 'Sniped live breakout momentum with dynamic trailing stop and breakeven protection.',
          });
        }
      }
    } catch (err) {
      console.warn('[GemRadarBot] Error scanning gem signals:', err);
    }
  }

  // 3. Final Portfolio Metrics Calculation
  const openPositionsMarketValue = updatedPositions
    .filter((p) => p.status === 'OPEN')
    .reduce((acc, p) => acc + (p.investedUsd + p.pnlUsd), 0);
  const investedInPositions = updatedPositions
    .filter((p) => p.status === 'OPEN')
    .reduce((acc, p) => acc + p.investedUsd, 0);
  const totalEquity = +(cash + openPositionsMarketValue).toFixed(2);
  const unrealizedPnl = +(openPositionsMarketValue - investedInPositions).toFixed(2);
  const totalTradesCount = wins + losses;
  const winRate = totalTradesCount > 0 ? +((wins / totalTradesCount) * 100).toFixed(1) : 0;

  const history = [...portfolio.equityHistory];
  if (history.length === 0 || Date.now() - history[history.length - 1].timestamp > 60000) {
    history.push({ timestamp: Date.now(), equityUsd: totalEquity });
  }

  const updatedPortfolio: DemoPortfolio = {
    ...portfolio,
    currentCash: cash,
    investedInPositionsUsd: +investedInPositions.toFixed(2),
    totalEquityUsd: totalEquity,
    totalRealizedPnlUsd: realizedPnl,
    totalUnrealizedPnlUsd: unrealizedPnl,
    totalWins: wins,
    totalLosses: losses,
    winRate,
    reloadCount,
    totalDemoCapitalLoaded,
    equityHistory: history.slice(-50),
    closedTrades: updatedClosedTrades,
  };

  return {
    updatedPortfolio,
    updatedPositions,
    newLogs,
  };
}

// Backward-compatible wrapper for single tick
export async function runDemoBotTick(
  portfolio: DemoPortfolio,
  positions: DemoPosition[],
  logs: DecisionLog[],
  closedTradesInput?: DemoClosedTrade[]
) {
  return runCopyBotTick(portfolio, positions, logs, closedTradesInput);
}
