"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.INITIAL_DECISION_LOGS = exports.DEFAULT_DEMO_PORTFOLIO = exports.INITIAL_OPEN_POSITIONS = exports.INITIAL_CLOSED_TRADES = void 0;
exports.getDayLabel = getDayLabel;
exports.getWeekInfo = getWeekInfo;
exports.getMonthInfo = getMonthInfo;
exports.aggregatePnlByDay = aggregatePnlByDay;
exports.aggregatePnlByWeek = aggregatePnlByWeek;
exports.aggregatePnlByMonth = aggregatePnlByMonth;
exports.filterTradesByTimeframe = filterTradesByTimeframe;
exports.calculateTimeframePnlMetrics = calculateTimeframePnlMetrics;
exports.evaluateAlphaConviction = evaluateAlphaConviction;
exports.runDemoBotTick = runDemoBotTick;
const dexscreener_1 = require("./dexscreener");
const wallet_engine_1 = require("./wallet-engine");
// Initial Closed Trades History for the Autonomous Demo Bot (spans Today, Yesterday, Earlier This Week, Earlier This Month)
exports.INITIAL_CLOSED_TRADES = [
    // --- Today's Trades (Sep 27, 2026) ---
    {
        id: 'closed-1',
        tokenAddress: '0x6982508145454ce325ddbe47a25d4ec3d2311933',
        tokenSymbol: 'PEPE',
        tokenName: 'Pepe',
        chain: 'ethereum',
        copiedFromWallet: '0x1111111254fb6c44bac0bed2854e76f90643097d',
        copiedFromWalletLabel: 'Ethereum Legendary PEPE OG',
        entryTimestamp: Date.now() - 3600000 * 5.5,
        exitTimestamp: Date.now() - 3600000 * 2.2, // Today
        holdDurationSeconds: 11880, // 3h 18m
        entryPriceUsd: 0.0000052,
        exitPriceUsd: 0.0000104,
        entryMarketCap: 2180000000,
        exitMarketCap: 4360000000,
        investedUsd: 20.00,
        returnedUsd: 40.00,
        netPnlUsd: 20.00,
        netPnlPercent: 100.0,
        multiplier: 2.0,
        exitReason: 'TAKE_PROFIT',
        exitReasonDetail: 'Take-Profit Level 1 Hit (+100% Target at $0.0000104 reached)',
        alphaScoreAtEntry: 94,
        entryRationale: 'Top #3 ETH Whale (77.8% Win Rate) entered breakout. Deep liquidity ($68M pool), 0/0 tax contract verified.',
        txHash: '0x9c1e3b5d7f9a2c4e6b8d0f1a3c5e7b9d1f3a5c7e',
        simulatedGasFeeUsd: 0.25,
    },
    {
        id: 'closed-2',
        tokenAddress: '3L6w5sD8B2qP9yR4mU7vN1xZ6kM3tC5jF8hK2nQ9aE4W',
        tokenSymbol: 'SOLCAT',
        tokenName: 'SolCat Meme',
        chain: 'solana',
        copiedFromWallet: 'H6ARHf6YXhGYeQfUzQNGk6rDNnLBQKrenN712K4AoUMP',
        copiedFromWalletLabel: 'Solana Moonshot Sniper Bot',
        entryTimestamp: Date.now() - 3600000 * 8.5,
        exitTimestamp: Date.now() - 3600000 * 7.7, // Today
        holdDurationSeconds: 2880, // 48 mins
        entryPriceUsd: 0.0125,
        exitPriceUsd: 0.0100,
        entryMarketCap: 1250000,
        exitMarketCap: 1000000,
        investedUsd: 20.00,
        returnedUsd: 16.00,
        netPnlUsd: -4.00,
        netPnlPercent: -20.0,
        multiplier: 0.8,
        exitReason: 'STOP_LOSS',
        exitReasonDetail: 'Hard Stop-Loss Cut (-20.0% threshold triggered at $0.0100)',
        alphaScoreAtEntry: 82,
        entryRationale: 'Momentum sniper bought pump curve breakout. Price failed to hold local VWAP support.',
        txHash: '5eN1vL3kXbQz7R2mWs8pY9cF1a4bT6hU8vJx2kM9qWeR',
        simulatedGasFeeUsd: 0.01,
    },
    // --- Yesterday's Trade (Sep 26, 2026) ---
    {
        id: 'closed-3',
        tokenAddress: '0x4ed4e862860bed51a9570b96d89af5e1b0efefed',
        tokenSymbol: 'DEGEN',
        tokenName: 'Degen',
        chain: 'base',
        copiedFromWallet: '0x47ac0Fb4F2D84898e4D9E7b4DaB3C24507a6D503',
        copiedFromWalletLabel: 'Base Aerodrome Early Whale',
        entryTimestamp: Date.now() - 3600000 * 32.0,
        exitTimestamp: Date.now() - 3600000 * 24.0, // Yesterday
        holdDurationSeconds: 28800, // 8 hours
        entryPriceUsd: 0.0072,
        exitPriceUsd: 0.0124,
        entryMarketCap: 108000000,
        exitMarketCap: 186000000,
        investedUsd: 20.00,
        returnedUsd: 34.44,
        netPnlUsd: 14.44,
        netPnlPercent: 72.2,
        multiplier: 1.72,
        exitReason: 'TAKE_PROFIT',
        exitReasonDetail: 'DCA Scale-Out execution: Locked in +72.2% gain at key resistance',
        alphaScoreAtEntry: 91,
        entryRationale: 'Base Whale (81.2% Win Rate) accumulated in Uniswap v3 pool. 0% tax, Base L2 momentum surging.',
        txHash: '0x1b3d5f7a9c1e3b5d7f9a2c4e6b8d0f1a3c5e7b9d',
        simulatedGasFeeUsd: 0.02,
    },
    // --- Earlier This Week (Sep 23, 2026 - 3.5 days ago) ---
    {
        id: 'closed-4',
        tokenAddress: '7GCihgDB8fe6KNjn2MYtkzZcRjQy3t9GHdC8uHYmW2hr',
        tokenSymbol: 'POPCAT',
        tokenName: 'Popcat',
        chain: 'solana',
        copiedFromWallet: '8bKmW5zLpxD3VnQq9J7bT7G4uL8Yf1x4bNq2Z8yPump',
        copiedFromWalletLabel: 'Pump.fun Curve Sniper Alpha',
        entryTimestamp: Date.now() - 3600000 * 90,
        exitTimestamp: Date.now() - 3600000 * 84, // 3.5 days ago
        holdDurationSeconds: 21600, // 6 hours
        entryPriceUsd: 0.80,
        exitPriceUsd: 1.40,
        entryMarketCap: 780000000,
        exitMarketCap: 1365000000,
        investedUsd: 20.00,
        returnedUsd: 35.00,
        netPnlUsd: 15.00,
        netPnlPercent: 75.0,
        multiplier: 1.75,
        exitReason: 'TAKE_PROFIT',
        exitReasonDetail: 'Scaled out 75% at local high breakout',
        alphaScoreAtEntry: 96,
        entryRationale: 'Top #1 Solana Sniper bought Raydium re-accumulation zone with $14M 24h volume surge.',
        txHash: '3wP9mK1bQv7N4rL8tX6eY2cF5aD9hU3vJx1kM8qWeR',
        simulatedGasFeeUsd: 0.01,
    },
    // --- Last Week (Sep 18, 2026 - 9 days ago) ---
    {
        id: 'closed-5',
        tokenAddress: '0xaaee1a9723aadb7afa2810263653a34ba2c21c7a',
        tokenSymbol: 'MOG',
        tokenName: 'Mog Coin',
        chain: 'base',
        copiedFromWallet: '0x47ac0Fb4F2D84898e4D9E7b4DaB3C24507a6D503',
        copiedFromWalletLabel: 'Base Aerodrome Early Whale',
        entryTimestamp: Date.now() - 3600000 * 224,
        exitTimestamp: Date.now() - 3600000 * 218, // 9 days ago
        holdDurationSeconds: 21600, // 6 hours
        entryPriceUsd: 0.0000018,
        exitPriceUsd: 0.00000144,
        entryMarketCap: 680000000,
        exitMarketCap: 544000000,
        investedUsd: 20.00,
        returnedUsd: 16.00,
        netPnlUsd: -4.00,
        netPnlPercent: -20.0,
        multiplier: 0.80,
        exitReason: 'STOP_LOSS',
        exitReasonDetail: 'Automated Stop-Loss Triggered (-20.0%) during market-wide flush',
        alphaScoreAtEntry: 84,
        entryRationale: 'Top Base Whale added liquidity, but overall market had high volatility spike.',
        txHash: '0x7e9a2c4e6b8d0f1a3c5e7b9d1f3a5c7e9c1e3b5d',
        simulatedGasFeeUsd: 0.02,
    },
    // --- Earlier This Month (Sep 05, 2026 - 22 days ago) ---
    {
        id: 'closed-6',
        tokenAddress: '0xfb5b838b6cff5dda83b6320a597a7605e71f5442',
        tokenSymbol: 'FLOKI',
        tokenName: 'Floki',
        chain: 'bsc',
        copiedFromWallet: '0x8888888820c74cf56f70a1e0b0e515d96a71391d',
        copiedFromWalletLabel: 'BNB Chain Memecoin Incubator Whale',
        entryTimestamp: Date.now() - 3600000 * 534,
        exitTimestamp: Date.now() - 3600000 * 524, // 22 days ago
        holdDurationSeconds: 36000, // 10 hours
        entryPriceUsd: 0.000135,
        exitPriceUsd: 0.000243,
        entryMarketCap: 1300000000,
        exitMarketCap: 2340000000,
        investedUsd: 20.00,
        returnedUsd: 36.00,
        netPnlUsd: 16.00,
        netPnlPercent: 80.0,
        multiplier: 1.80,
        exitReason: 'TAKE_PROFIT',
        exitReasonDetail: 'Target 1.8x reached on PancakeSwap liquidity pump',
        alphaScoreAtEntry: 89,
        entryRationale: 'Top #1 BSC Whale accumulated in PancakeSwap v3 pool. Zero tax verified.',
        txHash: '0x4e6b8d0f1a3c5e7b9d1f3a5c7e9c1e3b5d7f9a2c',
        simulatedGasFeeUsd: 0.05,
    },
];
// Seed Open Positions
exports.INITIAL_OPEN_POSITIONS = [
    {
        id: 'pos-1',
        tokenAddress: '9BB6NFEcjBCtnNLFko2FqVQBq8HHM13kCyYcdQbgpump',
        tokenSymbol: 'FARTCOIN',
        tokenName: 'Fartcoin',
        chain: 'solana',
        copiedFromWallet: '8bKmW5zLpxD3VnQq9J7bT7G4uL8Yf1x4bNq2Z8yPump',
        copiedFromWalletLabel: 'Pump.fun Curve Sniper Alpha',
        entryTimestamp: Date.now() - 3600000 * 3.0,
        entryPriceUsd: 0.384,
        currentPriceUsd: 0.442,
        investedUsd: 20.00,
        tokenAmount: 52.08,
        pnlUsd: 3.02,
        pnlPercent: 15.1,
        takeProfitPrice1: 0.768, // 2x
        takeProfitPrice2: 1.92, // 5x
        stopLossPrice: 0.3072, // -20%
        status: 'OPEN',
        alphaScoreAtEntry: 94,
        entryRationale: 'Top #1 Ranked Wallet (84.6% Win Rate) initiated 5,217 SOL snipe. Liquidity $12.4M.',
    },
    {
        id: 'pos-2',
        tokenAddress: '0x532f27101965dd16442e59d40670faf5ebb142e4',
        tokenSymbol: 'BRETT',
        tokenName: 'Brett',
        chain: 'base',
        copiedFromWallet: '0x47ac0Fb4F2D84898e4D9E7b4DaB3C24507a6D503',
        copiedFromWalletLabel: 'Base Aerodrome Early Whale',
        entryTimestamp: Date.now() - 3600000 * 1.5,
        entryPriceUsd: 0.117,
        currentPriceUsd: 0.124,
        investedUsd: 20.00,
        tokenAmount: 170.94,
        pnlUsd: 1.20,
        pnlPercent: 6.0,
        takeProfitPrice1: 0.234, // 2x
        takeProfitPrice2: 0.585, // 5x
        stopLossPrice: 0.0936, // -20%
        status: 'OPEN',
        alphaScoreAtEntry: 91,
        entryRationale: 'Top Base Whale added to Aerodrome pool. Deep pool ($22.4M liquidity).',
    },
];
// Initial default state for the Autonomous Demo Paper Trading Bot
// Formulated with strict mathematical balancing:
// Total Capital Deposited = $100.00
// Realized P&L from Closed Trades = +$20.00 - $4.00 + $14.44 + $15.00 - $4.00 + $16.00 = +$57.44
// Invested in 2 Open Positions = $20.00 + $20.00 = $40.00
// Available Free Cash = $100.00 (base) + $57.44 (realized gains) - $40.00 (invested) = $117.44
// Open Positions Market Value = $23.02 + $21.20 = $44.22 (Unrealized P&L: +$4.22)
// Total Portfolio Equity = $117.44 (cash) + $44.22 (positions) = $161.66
// Total Net Gain = $161.66 - $100.00 = +$61.66 (+61.7%)
exports.DEFAULT_DEMO_PORTFOLIO = {
    startingCash: 100,
    currentCash: 117.44, // Exactly $100 + $57.44 realized - $40 invested
    investedInPositionsUsd: 40.00,
    totalEquityUsd: 161.66,
    totalRealizedPnlUsd: 57.44,
    totalUnrealizedPnlUsd: 4.22,
    totalWins: 4,
    totalLosses: 2,
    winRate: 66.7,
    reloadCount: 0,
    totalDemoCapitalLoaded: 100,
    isAutoReloadEnabled: true,
    isBotRunning: true,
    minConvictionThreshold: 80, // High conviction bar: only trade high-probability setups!
    allocationPerTradeUsd: 20, // $20 per trade
    maxConcurrentPositions: 4,
    stopLossPercent: -20, // -20% stop loss
    takeProfitTargets: [
        { targetMultiplier: 2.0, sellPercent: 50 }, // Take 50% at 2x
        { targetMultiplier: 5.0, sellPercent: 30 }, // Take 30% at 5x
        { targetMultiplier: 10.0, sellPercent: 20 }, // Let 20% moonbag run
    ],
    equityHistory: [
        { timestamp: Date.now() - 3600000 * 24 * 22, equityUsd: 100.00 },
        { timestamp: Date.now() - 3600000 * 24 * 10, equityUsd: 116.00 },
        { timestamp: Date.now() - 3600000 * 24 * 4, equityUsd: 112.00 },
        { timestamp: Date.now() - 3600000 * 24 * 2, equityUsd: 127.00 },
        { timestamp: Date.now() - 3600000 * 12, equityUsd: 141.44 },
        { timestamp: Date.now() - 3600000 * 4, equityUsd: 137.44 },
        { timestamp: Date.now(), equityUsd: 161.66 },
    ],
    closedTrades: exports.INITIAL_CLOSED_TRADES,
};
// ==========================================
// Periodic P&L Aggregation Helpers
// ==========================================
function getDayLabel(dateStr) {
    const todayStr = new Date().toISOString().slice(0, 10);
    const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
    const d = new Date(dateStr + 'T12:00:00Z');
    const formatted = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    if (dateStr === todayStr)
        return `Today (${formatted})`;
    if (dateStr === yesterday)
        return `Yesterday (${formatted})`;
    return formatted;
}
function getWeekInfo(timestamp) {
    const date = new Date(timestamp);
    const dayOfWeek = date.getDay(); // 0 is Sunday, 1 is Monday...
    const diffToMonday = (dayOfWeek + 6) % 7;
    const monday = new Date(date);
    monday.setDate(date.getDate() - diffToMonday);
    monday.setHours(0, 0, 0, 0);
    const sunday = new Date(monday);
    sunday.setDate(monday.getDate() + 6);
    sunday.setHours(23, 59, 59, 999);
    const startOfWeek = monday.getTime();
    const endOfWeek = sunday.getTime();
    const now = Date.now();
    const isThisWeek = now >= startOfWeek && now <= endOfWeek;
    const mFmt = monday.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    const sFmt = sunday.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    const oneJan = new Date(monday.getFullYear(), 0, 1);
    const weekNum = Math.ceil(((monday.getTime() - oneJan.getTime()) / 86400000 + oneJan.getDay() + 1) / 7);
    const weekKey = `${monday.getFullYear()}-W${String(weekNum).padStart(2, '0')}`;
    const weekLabel = isThisWeek
        ? `This Week (Week ${weekNum}: ${mFmt} – ${sFmt})`
        : `Week ${weekNum} (${mFmt} – ${sFmt})`;
    return { weekKey, weekLabel, startOfWeek, endOfWeek };
}
function getMonthInfo(timestamp) {
    const d = new Date(timestamp);
    const year = d.getFullYear();
    const month = d.getMonth();
    const monthKey = `${year}-${String(month + 1).padStart(2, '0')}`;
    const monthLabel = d.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
    const startOfMonth = new Date(year, month, 1, 0, 0, 0, 0).getTime();
    const endOfMonth = new Date(year, month + 1, 0, 23, 59, 59, 999).getTime();
    return { monthKey, monthLabel, startOfMonth, endOfMonth };
}
function aggregatePnlByDay(trades) {
    const groups = {};
    for (const trade of trades) {
        const dayKey = new Date(trade.exitTimestamp).toISOString().slice(0, 10);
        if (!groups[dayKey])
            groups[dayKey] = [];
        groups[dayKey].push(trade);
    }
    const result = Object.keys(groups).map((dayKey) => {
        const groupTrades = groups[dayKey];
        const totalTrades = groupTrades.length;
        const wins = groupTrades.filter((t) => t.netPnlUsd >= 0).length;
        const losses = groupTrades.filter((t) => t.netPnlUsd < 0).length;
        const totalInvestedUsd = +groupTrades.reduce((acc, t) => acc + t.investedUsd, 0).toFixed(2);
        const totalReturnedUsd = +groupTrades.reduce((acc, t) => acc + t.returnedUsd, 0).toFixed(2);
        const netPnlUsd = +groupTrades.reduce((acc, t) => acc + t.netPnlUsd, 0).toFixed(2);
        const netPnlPercent = totalInvestedUsd > 0 ? +((netPnlUsd / totalInvestedUsd) * 100).toFixed(1) : 0;
        const winRate = totalTrades > 0 ? +((wins / totalTrades) * 100).toFixed(1) : 0;
        const sorted = [...groupTrades].sort((a, b) => b.multiplier - a.multiplier);
        const bestTrade = sorted[0];
        const d = new Date(dayKey + 'T00:00:00Z');
        const startDay = d.getTime();
        const endDay = startDay + 86400000 - 1;
        return {
            periodKey: dayKey,
            periodType: 'day',
            periodLabel: getDayLabel(dayKey),
            startDate: startDay,
            endDate: endDay,
            totalTrades,
            wins,
            losses,
            winRate,
            totalInvestedUsd,
            totalReturnedUsd,
            netPnlUsd,
            netPnlPercent,
            bestTradeSymbol: bestTrade?.tokenSymbol,
            bestTradeMultiplier: bestTrade?.multiplier,
            trades: groupTrades,
        };
    });
    return result.sort((a, b) => b.startDate - a.startDate);
}
function aggregatePnlByWeek(trades) {
    const groups = {};
    for (const trade of trades) {
        const info = getWeekInfo(trade.exitTimestamp);
        if (!groups[info.weekKey]) {
            groups[info.weekKey] = { weekInfo: info, trades: [] };
        }
        groups[info.weekKey].trades.push(trade);
    }
    const result = Object.keys(groups).map((weekKey) => {
        const { weekInfo, trades: groupTrades } = groups[weekKey];
        const totalTrades = groupTrades.length;
        const wins = groupTrades.filter((t) => t.netPnlUsd >= 0).length;
        const losses = groupTrades.filter((t) => t.netPnlUsd < 0).length;
        const totalInvestedUsd = +groupTrades.reduce((acc, t) => acc + t.investedUsd, 0).toFixed(2);
        const totalReturnedUsd = +groupTrades.reduce((acc, t) => acc + t.returnedUsd, 0).toFixed(2);
        const netPnlUsd = +groupTrades.reduce((acc, t) => acc + t.netPnlUsd, 0).toFixed(2);
        const netPnlPercent = totalInvestedUsd > 0 ? +((netPnlUsd / totalInvestedUsd) * 100).toFixed(1) : 0;
        const winRate = totalTrades > 0 ? +((wins / totalTrades) * 100).toFixed(1) : 0;
        const sorted = [...groupTrades].sort((a, b) => b.multiplier - a.multiplier);
        const bestTrade = sorted[0];
        return {
            periodKey: weekKey,
            periodType: 'week',
            periodLabel: weekInfo.weekLabel,
            startDate: weekInfo.startOfWeek,
            endDate: weekInfo.endOfWeek,
            totalTrades,
            wins,
            losses,
            winRate,
            totalInvestedUsd,
            totalReturnedUsd,
            netPnlUsd,
            netPnlPercent,
            bestTradeSymbol: bestTrade?.tokenSymbol,
            bestTradeMultiplier: bestTrade?.multiplier,
            trades: groupTrades,
        };
    });
    return result.sort((a, b) => b.startDate - a.startDate);
}
function aggregatePnlByMonth(trades) {
    const groups = {};
    for (const trade of trades) {
        const info = getMonthInfo(trade.exitTimestamp);
        if (!groups[info.monthKey]) {
            groups[info.monthKey] = { monthInfo: info, trades: [] };
        }
        groups[info.monthKey].trades.push(trade);
    }
    const result = Object.keys(groups).map((monthKey) => {
        const { monthInfo, trades: groupTrades } = groups[monthKey];
        const totalTrades = groupTrades.length;
        const wins = groupTrades.filter((t) => t.netPnlUsd >= 0).length;
        const losses = groupTrades.filter((t) => t.netPnlUsd < 0).length;
        const totalInvestedUsd = +groupTrades.reduce((acc, t) => acc + t.investedUsd, 0).toFixed(2);
        const totalReturnedUsd = +groupTrades.reduce((acc, t) => acc + t.returnedUsd, 0).toFixed(2);
        const netPnlUsd = +groupTrades.reduce((acc, t) => acc + t.netPnlUsd, 0).toFixed(2);
        const netPnlPercent = totalInvestedUsd > 0 ? +((netPnlUsd / totalInvestedUsd) * 100).toFixed(1) : 0;
        const winRate = totalTrades > 0 ? +((wins / totalTrades) * 100).toFixed(1) : 0;
        const sorted = [...groupTrades].sort((a, b) => b.multiplier - a.multiplier);
        const bestTrade = sorted[0];
        return {
            periodKey: monthKey,
            periodType: 'month',
            periodLabel: monthInfo.monthLabel,
            startDate: monthInfo.startOfMonth,
            endDate: monthInfo.endOfMonth,
            totalTrades,
            wins,
            losses,
            winRate,
            totalInvestedUsd,
            totalReturnedUsd,
            netPnlUsd,
            netPnlPercent,
            bestTradeSymbol: bestTrade?.tokenSymbol,
            bestTradeMultiplier: bestTrade?.multiplier,
            trades: groupTrades,
        };
    });
    return result.sort((a, b) => b.startDate - a.startDate);
}
function filterTradesByTimeframe(trades, timeframe) {
    if (timeframe === 'all')
        return trades;
    const now = Date.now();
    const cutoff = timeframe === '24h'
        ? now - 86400000
        : timeframe === '7d'
            ? now - 86400000 * 7
            : now - 86400000 * 30;
    return trades.filter((t) => t.exitTimestamp >= cutoff);
}
function calculateTimeframePnlMetrics(trades, timeframe) {
    const filtered = filterTradesByTimeframe(trades, timeframe);
    const totalTrades = filtered.length;
    const wins = filtered.filter((t) => t.netPnlUsd >= 0).length;
    const losses = filtered.filter((t) => t.netPnlUsd < 0).length;
    const realizedPnl = +filtered.reduce((acc, t) => acc + t.netPnlUsd, 0).toFixed(2);
    const invested = +filtered.reduce((acc, t) => acc + t.investedUsd, 0).toFixed(2);
    const roiPercent = invested > 0 ? +((realizedPnl / invested) * 100).toFixed(1) : 0;
    const winRate = totalTrades > 0 ? +((wins / totalTrades) * 100).toFixed(1) : 0;
    return {
        timeframe,
        totalTrades,
        wins,
        losses,
        winRate,
        realizedPnl,
        invested,
        roiPercent,
    };
}
// Seed Decision Logs to demonstrate rich post-mortem analysis on boot
exports.INITIAL_DECISION_LOGS = [
    {
        id: 'log-seed-1',
        timestamp: Date.now() - 3600000 * 3,
        type: 'ENTRY_EXECUTED',
        tokenSymbol: 'FARTCOIN',
        tokenAddress: '9BB6NFEcjBCtnNLFko2FqVQBq8HHM13kCyYcdQbgpump',
        chain: 'solana',
        triggeredByWallet: '8bKmW5zLpxD3VnQq9J7bT7G4uL8Yf1x4bNq2Z8yPump',
        triggeredByWalletLabel: 'Pump.fun Curve Sniper Alpha',
        convictionScore: 94,
        action: 'BUY 52.08 FARTCOIN for $20.00 at $0.384',
        rationale: 'Top #1 Ranked Wallet (84.6% Win Rate, $2.84M P&L) initiated a 5,217 SOL snipe. Liquidity: $12.4M (100% locked). Security check passed (0/0 tax, unblacklisted). Volume momentum +42.6% in 24h.',
        improvementLessonTag: '[WIN: SNIPER_CONSENSUS]',
        improvementNote: 'Entering within 30s of top sniper confirmation produced immediate positive price drift. Keep position sizing aligned with pool liquidity.',
    },
    {
        id: 'log-seed-2',
        timestamp: Date.now() - 3600000 * 2.2,
        type: 'EXIT_TAKE_PROFIT',
        tokenSymbol: 'PEPE',
        tokenAddress: '0x6982508145454ce325ddbe47a25d4ec3d2311933',
        chain: 'ethereum',
        triggeredByWallet: '0x1111111254fb6c44bac0bed2854e76f90643097d',
        triggeredByWalletLabel: 'Ethereum Legendary PEPE OG',
        convictionScore: 94,
        action: 'TAKE PROFIT (Target 1: +100%) - Sold PEPE at $0.0000104',
        rationale: 'Automated Take-Profit rule triggered at 2.0x target ($0.0000104). Initial $20 returned $40 (+100.0%).',
        outcomePnlUsd: 20.00,
        outcomePnlPercent: 100,
        improvementLessonTag: '[WIN: DISCIPLINED_SCALE_OUT]',
        improvementNote: 'De-risking at 2x protected capital while leaving upside exposure. Avoid holding 100% through local blow-off tops.',
    },
    {
        id: 'log-seed-3',
        timestamp: Date.now() - 3600000 * 1.5,
        type: 'ENTRY_EXECUTED',
        tokenSymbol: 'BRETT',
        tokenAddress: '0x532f27101965dd16442e59d40670faf5ebb142e4',
        chain: 'base',
        triggeredByWallet: '0x47ac0Fb4F2D84898e4D9E7b4DaB3C24507a6D503',
        triggeredByWalletLabel: 'Base Aerodrome Early Whale',
        convictionScore: 91,
        action: 'BUY 170.94 BRETT for $20.00 at $0.117',
        rationale: 'Top Base Whale (81.2% Win Rate, $2.18M P&L) added to Aerodrome pool. Deep pool ($22.4M liquidity). 0% tax, verified Base L2 contract.',
        improvementLessonTag: '[WIN: BASE_L2_MOMENTUM]',
        improvementNote: 'Base L2 gas is near $0.01, allowing tighter stop-losses without erosion from transaction fees.',
    },
    {
        id: 'log-seed-4',
        timestamp: Date.now() - 3600000 * 0.8,
        type: 'EVALUATION_REJECT',
        tokenSymbol: 'RUGPUPPY',
        tokenAddress: '3mK8s...fake',
        chain: 'solana',
        convictionScore: 42,
        action: 'REJECTED TRADE OPPORTUNITY',
        rationale: 'Rejected trade despite sudden 80% volume spike. Failure triggers: 1) Mint authority still active, 2) Only 1 unranked wallet bought, 3) LP was only $4,200. Security threshold failed (<80).',
        improvementLessonTag: '[AVOIDED: HONEYPOT_RISK]',
        improvementNote: 'Pre-flight security check successfully prevented entering an unverified mint authority liquidity pull.',
    },
];
// Evaluates an incoming trade or token to compute algorithmic conviction
function evaluateAlphaConviction(wallet, token, trade) {
    const reasons = [];
    let score = 0;
    // 1. Wallet Quality (Up to 40 pts)
    if (wallet.winRate >= 80) {
        score += 40;
        reasons.push(`Elite Wallet Win Rate: ${wallet.winRate}% (+40pts)`);
    }
    else if (wallet.winRate >= 70) {
        score += 30;
        reasons.push(`High Wallet Win Rate: ${wallet.winRate}% (+30pts)`);
    }
    else if (wallet.winRate >= 60) {
        score += 15;
        reasons.push(`Moderate Wallet Win Rate: ${wallet.winRate}% (+15pts)`);
    }
    else {
        reasons.push(`Sub-optimal Wallet Win Rate: ${wallet.winRate}% (+0pts)`);
    }
    // 2. Security Check (Up to 25 pts)
    if (token.buyTax === 0 && token.sellTax === 0 && token.lpLockedPercent >= 95) {
        score += 25;
        reasons.push(`Clean Contract: 0/0 Tax & ${token.lpLockedPercent}% LP Locked (+25pts)`);
    }
    else if (token.buyTax <= 3 && token.sellTax <= 3) {
        score += 10;
        reasons.push(`Acceptable Low Tax (${token.buyTax}/${token.sellTax}) (+10pts)`);
    }
    else {
        reasons.push(`High Tax or Unlocked LP: Security Warning! (-20pts)`);
        score -= 20;
    }
    // 3. Liquidity Depth & Market Cap Health (Up to 20 pts)
    if (token.liquidityUsd >= 500000) {
        score += 20;
        reasons.push(`Deep Liquidity: $${(token.liquidityUsd / 1000).toFixed(0)}k (+20pts)`);
    }
    else if (token.liquidityUsd >= 50000) {
        score += 15;
        reasons.push(`Healthy Liquidity: $${(token.liquidityUsd / 1000).toFixed(0)}k (+15pts)`);
    }
    else if (token.liquidityUsd >= 15000) {
        score += 8;
        reasons.push(`Moderate Liquidity: $${(token.liquidityUsd / 1000).toFixed(0)}k (+8pts)`);
    }
    else {
        reasons.push(`Dangerously Thin Liquidity (<$15k): High Slippage Hazard (-15pts)`);
        score -= 15;
    }
    // 4. Entry Timing & Volume Momentum (Up to 15 pts)
    if (trade.snipedBlockZero || wallet.alphaSignature.earlyEntryPercent > 80) {
        score += 15;
        reasons.push(`Early Entry / Block Sniper Advantage (+15pts)`);
    }
    else {
        score += 8;
        reasons.push(`Normal Secondary Entry (+8pts)`);
    }
    const boundedScore = Math.max(0, Math.min(100, score));
    const passed = boundedScore >= 80;
    return {
        score: boundedScore,
        passed,
        reasons,
    };
}
// Generates an autonomous bot tick:
// 1. Checks open positions against TP/SL triggers or simulated price movements
// 2. Records closed trades with forensic metrics (entry/exit times, prices, multiplier, P&L)
// 3. Checks cash balance and auto-reloads $100 if exhausted
// 4. Evaluates prospective trades from top wallets
function runDemoBotTick(portfolio, positions, logs, closedTradesInput) {
    if (!portfolio.isBotRunning) {
        return { updatedPortfolio: portfolio, updatedPositions: positions, newLogs: [] };
    }
    let cash = portfolio.currentCash;
    let reloadCount = portfolio.reloadCount;
    let totalDemoCapitalLoaded = portfolio.totalDemoCapitalLoaded;
    let realizedPnl = portfolio.totalRealizedPnlUsd;
    let wins = portfolio.totalWins;
    let losses = portfolio.totalLosses;
    const newLogs = [];
    const updatedPositions = [];
    const updatedClosedTrades = [...(closedTradesInput || portfolio.closedTrades || [])];
    // Step 1: Evaluate Open Positions (Check for Take Profit or Stop Loss)
    for (const pos of positions) {
        if (pos.status === 'CLOSED')
            continue;
        // Small random simulated price drift (-2% to +3%) simulating live market tick
        const drift = 1 + (Math.random() * 0.05 - 0.02);
        const newPrice = +(pos.currentPriceUsd * drift).toFixed(6);
        const newPnlUsd = +((newPrice - pos.entryPriceUsd) * pos.tokenAmount).toFixed(2);
        const newPnlPercent = +(((newPrice - pos.entryPriceUsd) / pos.entryPriceUsd) * 100).toFixed(1);
        // Check Take Profit: reached 2x target?
        if (newPrice >= pos.takeProfitPrice1) {
            // Close position with profit!
            const totalReturned = +(pos.investedUsd + newPnlUsd).toFixed(2);
            cash = +(cash + totalReturned).toFixed(2);
            realizedPnl = +(realizedPnl + newPnlUsd).toFixed(2);
            wins++;
            const closedRecord = {
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
                exitPriceUsd: newPrice,
                investedUsd: pos.investedUsd,
                returnedUsd: totalReturned,
                netPnlUsd: newPnlUsd,
                netPnlPercent: newPnlPercent,
                multiplier: +(newPrice / pos.entryPriceUsd).toFixed(2),
                exitReason: 'TAKE_PROFIT',
                exitReasonDetail: `Take-Profit Target Hit (+${newPnlPercent}%) at $${newPrice}`,
                alphaScoreAtEntry: pos.alphaScoreAtEntry,
                entryRationale: pos.entryRationale,
                simulatedGasFeeUsd: pos.chain === 'solana' ? 0.01 : pos.chain === 'base' ? 0.02 : pos.chain === 'bsc' ? 0.05 : 0.25,
            };
            updatedClosedTrades.unshift(closedRecord);
            newLogs.unshift({
                id: `log-${Date.now()}-${Math.random().toString(36).substring(7)}`,
                timestamp: Date.now(),
                type: 'EXIT_TAKE_PROFIT',
                tokenSymbol: pos.tokenSymbol,
                tokenAddress: pos.tokenAddress,
                chain: pos.chain,
                triggeredByWallet: pos.copiedFromWallet,
                triggeredByWalletLabel: pos.copiedFromWalletLabel,
                convictionScore: pos.alphaScoreAtEntry,
                action: `TAKE PROFIT (+${newPnlPercent}%) - Sold all ${pos.tokenSymbol} at $${newPrice}`,
                rationale: `Automated Take-Profit triggered at target price $${pos.takeProfitPrice1}. Capital returned: $${totalReturned}. Net P&L: +$${newPnlUsd}.`,
                outcomePnlUsd: newPnlUsd,
                outcomePnlPercent: newPnlPercent,
                improvementLessonTag: '[WIN: TAKE_PROFIT_TRIGGERED]',
                improvementNote: `Taking profit mechanically at pre-set targets locks in gains and prevents giving back profits during volatility.`,
            });
            continue;
        }
        // Check Stop Loss: dropped below stop price?
        if (newPrice <= pos.stopLossPrice) {
            // Close position with loss
            const totalReturned = +(pos.investedUsd + newPnlUsd).toFixed(2);
            cash = +(cash + Math.max(0, totalReturned)).toFixed(2);
            realizedPnl = +(realizedPnl + newPnlUsd).toFixed(2);
            losses++;
            const closedRecord = {
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
                exitPriceUsd: newPrice,
                investedUsd: pos.investedUsd,
                returnedUsd: Math.max(0, totalReturned),
                netPnlUsd: newPnlUsd,
                netPnlPercent: newPnlPercent,
                multiplier: +(newPrice / pos.entryPriceUsd).toFixed(2),
                exitReason: 'STOP_LOSS',
                exitReasonDetail: `Hard Stop-Loss Cut (${newPnlPercent}%) at $${newPrice}`,
                alphaScoreAtEntry: pos.alphaScoreAtEntry,
                entryRationale: pos.entryRationale,
                simulatedGasFeeUsd: pos.chain === 'solana' ? 0.01 : pos.chain === 'base' ? 0.02 : pos.chain === 'bsc' ? 0.05 : 0.25,
            };
            updatedClosedTrades.unshift(closedRecord);
            newLogs.unshift({
                id: `log-${Date.now()}-${Math.random().toString(36).substring(7)}`,
                timestamp: Date.now(),
                type: 'EXIT_STOP_LOSS',
                tokenSymbol: pos.tokenSymbol,
                tokenAddress: pos.tokenAddress,
                chain: pos.chain,
                triggeredByWallet: pos.copiedFromWallet,
                triggeredByWalletLabel: pos.copiedFromWalletLabel,
                convictionScore: pos.alphaScoreAtEntry,
                action: `STOP LOSS HIT (${newPnlPercent}%) - Cut ${pos.tokenSymbol} at $${newPrice}`,
                rationale: `Automated Stop-Loss triggered below threshold ($${pos.stopLossPrice}). Capital preserved by cutting loss at -$${Math.abs(newPnlUsd)}.`,
                outcomePnlUsd: newPnlUsd,
                outcomePnlPercent: newPnlPercent,
                improvementLessonTag: '[LOSS: STOP_LOSS_PROTECTION]',
                improvementNote: `Stop-loss execution prevented catastrophic 90%+ drawdown. Review entry timing and slippage tolerance for future entries.`,
            });
            continue;
        }
        // Position remains open with updated valuation
        updatedPositions.push({
            ...pos,
            currentPriceUsd: newPrice,
            pnlUsd: newPnlUsd,
            pnlPercent: newPnlPercent,
        });
    }
    // Step 2: Check for Exhaustion & Auto-Reload
    const activePositionCount = updatedPositions.filter((p) => p.status === 'OPEN').length;
    const currentInvestedPrincipal = updatedPositions
        .filter((p) => p.status === 'OPEN')
        .reduce((acc, p) => acc + p.investedUsd, 0);
    const currentOpenPositionsMarketValue = updatedPositions
        .filter((p) => p.status === 'OPEN')
        .reduce((acc, p) => acc + (p.investedUsd + p.pnlUsd), 0);
    const totalEquity = +(cash + currentOpenPositionsMarketValue).toFixed(2);
    // If cash < minimum allocation and total equity is exhausted or below $25, reload $100!
    if (cash < portfolio.allocationPerTradeUsd && totalEquity < 25 && portfolio.isAutoReloadEnabled) {
        cash = +(cash + 100).toFixed(2);
        reloadCount++;
        totalDemoCapitalLoaded += 100;
        newLogs.unshift({
            id: `log-reload-${Date.now()}`,
            timestamp: Date.now(),
            type: 'AUTO_RELOAD',
            tokenSymbol: 'USD_DEMO',
            tokenAddress: '0x0',
            chain: 'solana',
            convictionScore: 100,
            action: `RELOADED DEMO $100 (Cycle #${reloadCount + 1})`,
            rationale: `Demo funds were exhausted. Auto-reload triggered to continue running live trade simulations without interruption.`,
            improvementLessonTag: '[AUTO_RELOAD_CYCLE]',
            improvementNote: `Cycle completed. Total capital deposited: $${totalDemoCapitalLoaded}. Analyze past loss logs to tighten conviction filters.`,
        });
    }
    // Step 3: Opportunity Evaluation (Can we open a new position?)
    if (activePositionCount < portfolio.maxConcurrentPositions &&
        cash >= portfolio.allocationPerTradeUsd) {
        // Pick an active opportunity from our top ranked wallets
        const topWallet = wallet_engine_1.SEED_WALLETS[Math.floor(Math.random() * 3)]; // Top 3 wallets
        const chainTokens = dexscreener_1.FEATURED_MEMECOINS[topWallet.chain];
        const candidateToken = chainTokens[Math.floor(Math.random() * chainTokens.length)];
        // Check if we already hold this token
        const alreadyHolding = updatedPositions.some((p) => p.tokenAddress === candidateToken.address);
        if (!alreadyHolding) {
            const simulatedTrade = {
                id: `cand-${Date.now()}`,
                walletAddress: topWallet.address,
                chain: topWallet.chain,
                tokenAddress: candidateToken.address,
                tokenSymbol: candidateToken.symbol,
                tokenName: candidateToken.name,
                action: 'BUY',
                priceUsd: candidateToken.priceUsd,
                amountTokens: Math.round(portfolio.allocationPerTradeUsd / candidateToken.priceUsd),
                volumeUsd: candidateToken.volume24h,
                nativeAmount: 1.5,
                nativeSymbol: topWallet.nativeSymbol,
                marketCapAtTrade: candidateToken.marketCap,
                timestamp: Date.now(),
                blockNumber: 12093842,
                txHash: '0xsimulated',
                dex: candidateToken.dex,
                snipedBlockZero: true,
            };
            const evaluation = evaluateAlphaConviction(topWallet, candidateToken, simulatedTrade);
            if (evaluation.passed && evaluation.score >= portfolio.minConvictionThreshold) {
                // High conviction confirmed! Execute demo entry
                const allocation = portfolio.allocationPerTradeUsd;
                cash = +(cash - allocation).toFixed(2);
                const tokenAmount = +(allocation / candidateToken.priceUsd).toFixed(4);
                const newPosition = {
                    id: `pos-${Date.now()}-${candidateToken.symbol}`,
                    tokenAddress: candidateToken.address,
                    tokenSymbol: candidateToken.symbol,
                    tokenName: candidateToken.name,
                    chain: candidateToken.chain,
                    copiedFromWallet: topWallet.address,
                    copiedFromWalletLabel: topWallet.label,
                    entryTimestamp: Date.now(),
                    entryPriceUsd: candidateToken.priceUsd,
                    currentPriceUsd: candidateToken.priceUsd,
                    investedUsd: allocation,
                    tokenAmount: tokenAmount,
                    pnlUsd: 0,
                    pnlPercent: 0,
                    takeProfitPrice1: +(candidateToken.priceUsd * 2.0).toFixed(6),
                    takeProfitPrice2: +(candidateToken.priceUsd * 5.0).toFixed(6),
                    stopLossPrice: +(candidateToken.priceUsd * (1 + portfolio.stopLossPercent / 100)).toFixed(6),
                    status: 'OPEN',
                    alphaScoreAtEntry: evaluation.score,
                    entryRationale: `Triggered by ${topWallet.label} (${topWallet.winRate}% win rate). Conviction: ${evaluation.score}/100. ${evaluation.reasons[0]}.`,
                };
                updatedPositions.push(newPosition);
                newLogs.unshift({
                    id: `log-entry-${Date.now()}`,
                    timestamp: Date.now(),
                    type: 'ENTRY_EXECUTED',
                    tokenSymbol: candidateToken.symbol,
                    tokenAddress: candidateToken.address,
                    chain: candidateToken.chain,
                    triggeredByWallet: topWallet.address,
                    triggeredByWalletLabel: topWallet.label,
                    convictionScore: evaluation.score,
                    action: `ENTERED ${candidateToken.symbol}: Invested $${allocation} at $${candidateToken.priceUsd}`,
                    rationale: `High Conviction Opportunity (${evaluation.score}/100). ${evaluation.reasons.join('; ')}`,
                    improvementLessonTag: '[WIN_OPPORTUNITY: HIGH_CONVICTION]',
                    improvementNote: `Entry confirmed with strict filters. Monitored for 2x Take Profit and -20% Stop Loss.`,
                });
            }
            else {
                // Rejected trade logged for learning & refinement!
                newLogs.unshift({
                    id: `log-reject-${Date.now()}`,
                    timestamp: Date.now(),
                    type: 'EVALUATION_REJECT',
                    tokenSymbol: candidateToken.symbol,
                    tokenAddress: candidateToken.address,
                    chain: candidateToken.chain,
                    triggeredByWallet: topWallet.address,
                    triggeredByWalletLabel: topWallet.label,
                    convictionScore: evaluation.score,
                    action: `REJECTED ${candidateToken.symbol} (Score: ${evaluation.score}/${portfolio.minConvictionThreshold})`,
                    rationale: `Trade passed wallet trigger but failed aggregate safety/conviction threshold. Reasons: ${evaluation.reasons.join(', ')}`,
                    improvementLessonTag: '[FILTER_PASSED: DISCIPLINED_SKIP]',
                    improvementNote: `Preserving capital by refusing marginal setups. Only trade setups scoring >= ${portfolio.minConvictionThreshold}.`,
                });
            }
        }
    }
    // Calculate final equity and win rate strictly
    const finalInvestedPrincipal = updatedPositions
        .filter((p) => p.status === 'OPEN')
        .reduce((acc, p) => acc + p.investedUsd, 0);
    const finalMarketValue = updatedPositions
        .filter((p) => p.status === 'OPEN')
        .reduce((acc, p) => acc + (p.investedUsd + p.pnlUsd), 0);
    const finalEquity = +(cash + finalMarketValue).toFixed(2);
    const totalCompletedTrades = wins + losses;
    const currentWinRate = totalCompletedTrades > 0 ? +((wins / totalCompletedTrades) * 100).toFixed(1) : 0;
    const finalUnrealizedPnl = +(finalMarketValue - finalInvestedPrincipal).toFixed(2);
    const newHistory = [...portfolio.equityHistory];
    if (newHistory.length === 0 || Date.now() - newHistory[newHistory.length - 1].timestamp > 60000) {
        newHistory.push({ timestamp: Date.now(), equityUsd: finalEquity });
        if (newHistory.length > 50)
            newHistory.shift();
    }
    const updatedPortfolio = {
        ...portfolio,
        currentCash: cash,
        investedInPositionsUsd: +finalInvestedPrincipal.toFixed(2),
        totalEquityUsd: finalEquity,
        totalRealizedPnlUsd: realizedPnl,
        totalUnrealizedPnlUsd: finalUnrealizedPnl,
        totalWins: wins,
        totalLosses: losses,
        winRate: currentWinRate,
        reloadCount: reloadCount,
        totalDemoCapitalLoaded: totalDemoCapitalLoaded,
        equityHistory: newHistory,
        closedTrades: updatedClosedTrades,
    };
    return {
        updatedPortfolio,
        updatedPositions,
        newLogs: [...newLogs, ...logs].slice(0, 100), // Keep last 100 logs
    };
}
