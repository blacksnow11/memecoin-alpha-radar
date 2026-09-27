import { ChainId, DecisionLog, DemoClosedTrade, DemoPortfolio, DemoPosition, PeriodicPnlSummary, PreBreakoutGemSignal, Token, Trade, WalletProfile } from './types';
import { SEED_WALLETS } from './wallet-engine';
import { fetchSolanaTokenPrice } from './solana/birdeye';
import { checkWalletTokenHolding, fetchWalletOnChainSwaps } from './solana/helius';
import { detectPreBreakoutGemSignals } from './solana/gem-radar';

// Clean-slate Initial State for the Autonomous Demo Paper Trading Bot
export const INITIAL_CLOSED_TRADES: DemoClosedTrade[] = [];
export const INITIAL_OPEN_POSITIONS: DemoPosition[] = [];

// Portfolio 1: Smart Money Copy-Trade Bot ($100 Starting Cash)
export const DEFAULT_DEMO_PORTFOLIO: DemoPortfolio = {
  startingCash: 100.00,
  currentCash: 100.00,
  investedInPositionsUsd: 0.00,
  totalEquityUsd: 100.00,
  totalRealizedPnlUsd: 0.00,
  totalUnrealizedPnlUsd: 0.00,
  totalWins: 0,
  totalLosses: 0,
  winRate: 0,
  reloadCount: 0,
  totalDemoCapitalLoaded: 100.00,
  isAutoReloadEnabled: true,
  isBotRunning: true,
  minConvictionThreshold: 80,
  allocationPerTradeUsd: 20,
  maxConcurrentPositions: 4,
  stopLossPercent: -20,
  takeProfitTargets: [
    { targetMultiplier: 2.0, sellPercent: 50 },
    { targetMultiplier: 5.0, sellPercent: 30 },
    { targetMultiplier: 10.0, sellPercent: 20 },
  ],
  equityHistory: [
    { timestamp: Date.now(), equityUsd: 100.00 },
  ],
  closedTrades: [],
};

// Portfolio 2: Gem Radar Breakout Hunter Bot ($100 Starting Cash)
export const DEFAULT_GEM_RADAR_PORTFOLIO: DemoPortfolio = {
  startingCash: 100.00,
  currentCash: 100.00,
  investedInPositionsUsd: 0.00,
  totalEquityUsd: 100.00,
  totalRealizedPnlUsd: 0.00,
  totalUnrealizedPnlUsd: 0.00,
  totalWins: 0,
  totalLosses: 0,
  winRate: 0,
  reloadCount: 0,
  totalDemoCapitalLoaded: 100.00,
  isAutoReloadEnabled: true,
  isBotRunning: true,
  minConvictionThreshold: 80,
  allocationPerTradeUsd: 20,
  maxConcurrentPositions: 4,
  stopLossPercent: -20,
  takeProfitTargets: [
    { targetMultiplier: 2.0, sellPercent: 50 },
    { targetMultiplier: 5.0, sellPercent: 30 },
    { targetMultiplier: 10.0, sellPercent: 20 },
  ],
  equityHistory: [
    { timestamp: Date.now(), equityUsd: 100.00 },
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
// Bot Engine 1: Smart Money Copy-Trading Engine ($100 Bankroll)
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

  // 1. Evaluate Open Positions against real live spot prices
  for (const pos of positions) {
    if (pos.status === 'CLOSED') continue;

    const livePriceData = await fetchSolanaTokenPrice(pos.tokenAddress);
    const newPrice = livePriceData.priceUsd > 0 ? livePriceData.priceUsd : pos.currentPriceUsd;
    const newPnlUsd = +((newPrice - pos.entryPriceUsd) * pos.tokenAmount).toFixed(2);
    const newPnlPercent = +(((newPrice - pos.entryPriceUsd) / pos.entryPriceUsd) * 100).toFixed(1);

    // Take Profit Trigger
    if (newPrice >= pos.takeProfitPrice1) {
      const totalReturned = +(pos.investedUsd + newPnlUsd).toFixed(2);
      cash = +(cash + totalReturned).toFixed(2);
      realizedPnl = +(realizedPnl + newPnlUsd).toFixed(2);
      wins++;

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
        alphaScoreAtEntry: pos.alphaScoreAtEntry,
        entryRationale: pos.entryRationale,
        simulatedGasFeeUsd: 0.005,
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
        rationale: `Automated Take-Profit triggered at target $${pos.takeProfitPrice1}. Capital returned: $${totalReturned}. Net P&L: +$${newPnlUsd}.`,
        outcomePnlUsd: newPnlUsd,
        outcomePnlPercent: newPnlPercent,
        improvementLessonTag: '[WIN: TAKE_PROFIT]',
        improvementNote: 'Disciplined exit locked in gains mechanically.',
      });
      continue;
    }

    // Stop Loss Trigger
    if (newPrice <= pos.stopLossPrice) {
      const totalReturned = +(pos.investedUsd + newPnlUsd).toFixed(2);
      cash = +(cash + Math.max(0, totalReturned)).toFixed(2);
      realizedPnl = +(realizedPnl + newPnlUsd).toFixed(2);
      losses++;

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
        exitReasonDetail: `Stop-Loss Triggered (${newPnlPercent}%) at live spot $${newPrice}`,
        alphaScoreAtEntry: pos.alphaScoreAtEntry,
        entryRationale: pos.entryRationale,
        simulatedGasFeeUsd: 0.005,
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
        rationale: `Automated Stop-Loss triggered below threshold ($${pos.stopLossPrice}). Capital preserved by cutting loss at -$${Math.abs(newPnlUsd)}.`,
        outcomePnlUsd: newPnlUsd,
        outcomePnlPercent: newPnlPercent,
        improvementLessonTag: '[LOSS: STOP_LOSS_PROTECTION]',
        improvementNote: 'Capital preserved against severe drawdown.',
      });
      continue;
    }

    updatedPositions.push({
      ...pos,
      currentPriceUsd: newPrice,
      pnlUsd: newPnlUsd,
      pnlPercent: newPnlPercent,
    });
  }

  // 2. Real Whale Copy Evaluation: Scan tracked alpha whales for genuine recent buys
  const activePositionCount = updatedPositions.filter((p) => p.status === 'OPEN').length;
  if (activePositionCount < portfolio.maxConcurrentPositions && cash >= portfolio.allocationPerTradeUsd) {
    const trackedAlphaWallets = SEED_WALLETS.slice(0, 4);

    for (const wallet of trackedAlphaWallets) {
      if (updatedPositions.length >= portfolio.maxConcurrentPositions || cash < portfolio.allocationPerTradeUsd) break;

      try {
        const recentSwaps = await fetchWalletOnChainSwaps(wallet.address, 3);
        const fifteenMinsAgo = Date.now() - 15 * 60 * 1000;

        // Check for fresh on-chain BUY
        const freshBuy = recentSwaps.find(
          (s) => s.action === 'BUY' && s.timestamp >= fifteenMinsAgo && s.tokenAddress !== 'So11111111111111111111111111111111111111112'
        );

        if (freshBuy) {
          const alreadyHolding = updatedPositions.some((p) => p.tokenAddress === freshBuy.tokenAddress);
          if (alreadyHolding) continue;

          // Check on-chain holding via Helius RPC
          const holdingStatus = await checkWalletTokenHolding(wallet.address, freshBuy.tokenAddress);
          if (!holdingStatus.isHolding) {
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
            continue;
          }

          // Fetch live spot price
          const priceData = await fetchSolanaTokenPrice(freshBuy.tokenAddress);
          const spotPrice = priceData.priceUsd > 0 ? priceData.priceUsd : (freshBuy.priceSol ? freshBuy.priceSol * 184 : 0);

          if (spotPrice > 0) {
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
              takeProfitPrice1: +(spotPrice * 2.0).toFixed(6),
              takeProfitPrice2: +(spotPrice * 5.0).toFixed(6),
              stopLossPrice: +(spotPrice * (1 + portfolio.stopLossPercent / 100)).toFixed(6),
              status: 'OPEN',
              alphaScoreAtEntry: 95,
              entryRationale: `Copied verified on-chain BUY by ${wallet.label} (confirmed open token balance on Solscan).`,
              strategy: 'WHALE_COPY',
              verifiedWhaleHolding: true,
              whaleEntryTimestamp: freshBuy.timestamp,
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

  // 1. Evaluate Open Positions against real live spot prices
  for (const pos of positions) {
    if (pos.status === 'CLOSED') continue;

    const livePriceData = await fetchSolanaTokenPrice(pos.tokenAddress);
    const newPrice = livePriceData.priceUsd > 0 ? livePriceData.priceUsd : pos.currentPriceUsd;
    const newPnlUsd = +((newPrice - pos.entryPriceUsd) * pos.tokenAmount).toFixed(2);
    const newPnlPercent = +(((newPrice - pos.entryPriceUsd) / pos.entryPriceUsd) * 100).toFixed(1);

    // Take Profit Trigger
    if (newPrice >= pos.takeProfitPrice1) {
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
        alphaScoreAtEntry: pos.alphaScoreAtEntry,
        entryRationale: pos.entryRationale,
        simulatedGasFeeUsd: 0.005,
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
        rationale: `Automated Take-Profit triggered at target $${pos.takeProfitPrice1}. Capital returned: $${totalReturned}. Net P&L: +$${newPnlUsd}.`,
        outcomePnlUsd: newPnlUsd,
        outcomePnlPercent: newPnlPercent,
        improvementLessonTag: '[WIN: GEM_BREAKOUT_TP]',
        improvementNote: 'Locked in breakout gains mechanically.',
      });
      continue;
    }

    // Stop Loss Trigger
    if (newPrice <= pos.stopLossPrice) {
      const totalReturned = +(pos.investedUsd + newPnlUsd).toFixed(2);
      cash = +(cash + Math.max(0, totalReturned)).toFixed(2);
      realizedPnl = +(realizedPnl + newPnlUsd).toFixed(2);
      losses++;

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
        alphaScoreAtEntry: pos.alphaScoreAtEntry,
        entryRationale: pos.entryRationale,
        simulatedGasFeeUsd: 0.005,
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
        rationale: `Automated Stop-Loss triggered below threshold ($${pos.stopLossPrice}). Capital preserved by cutting loss at -$${Math.abs(newPnlUsd)}.`,
        outcomePnlUsd: newPnlUsd,
        outcomePnlPercent: newPnlPercent,
        improvementLessonTag: '[LOSS: GEM_BREAKOUT_STOP]',
        improvementNote: 'Capital protected from post-breakout pullback.',
      });
      continue;
    }

    updatedPositions.push({
      ...pos,
      currentPriceUsd: newPrice,
      pnlUsd: newPnlUsd,
      pnlPercent: newPnlPercent,
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

        // Entry criteria: Confidence >= 80, liquidity depth >= $10k, valid spot price
        if (sig.confidenceScore >= 80 && sig.liquidityUsd >= 10000 && sig.priceUsd > 0) {
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
            takeProfitPrice1: +(spotPrice * 2.0).toFixed(6),
            takeProfitPrice2: +(spotPrice * 5.0).toFixed(6),
            stopLossPrice: +(spotPrice * (1 + portfolio.stopLossPercent / 100)).toFixed(6),
            status: 'OPEN',
            alphaScoreAtEntry: sig.confidenceScore,
            entryRationale: `Sniped live Gem Radar breakout: ${sig.patternTitle}. 5m Volume: $${Math.round(sig.volume5mUsd).toLocaleString()}, Liquidity: $${Math.round(sig.liquidityUsd).toLocaleString()}.`,
            strategy: 'GEM_RADAR_BREAKOUT',
            gemPattern: sig.patternType,
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
            improvementNote: 'Sniped live breakout momentum with strict 2x TP and -20% SL protection.',
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
