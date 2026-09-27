// Comprehensive Verification Suite for MemeAlpha Radar Core Engine & Math Rigor
const assert = require('assert');
const path = require('path');

console.log('================================================================');
console.log(' MEMEALPHA RADAR: QUANT ENGINE & BOT VERIFICATION SUITE');
console.log('================================================================\n');

// Test 1: Seed Wallets Sorting
console.log('--- Test 1: Verifying Wallet Profitability Ranking ---');
const { SEED_WALLETS, getRankedWallets } = require('../dist_test/wallet-engine');

const ranked = getRankedWallets('all', 'all', 'profit');
assert(ranked.length > 0, 'Ranked list should not be empty');

for (let i = 0; i < ranked.length - 1; i++) {
  assert(
    ranked[i].totalNetProfitUsd >= ranked[i + 1].totalNetProfitUsd,
    `Wallet at index ${i} ($${ranked[i].totalNetProfitUsd}) must have >= profit than index ${i + 1} ($${ranked[i + 1].totalNetProfitUsd})`
  );
  assert.strictEqual(ranked[i].rank, i + 1, `Wallet rank must match index + 1 (expected ${i + 1}, got ${ranked[i].rank})`);
}
console.log(`✅ Passed: All ${ranked.length} wallets are strictly ranked from most profitable to least profitable.`);
console.log(`   🏆 Top #1 Pick: ${ranked[0].label} ($${ranked[0].totalNetProfitUsd.toLocaleString()}) - Win Rate: ${ranked[0].winRate}%`);
console.log(`   🥈 Top #2 Pick: ${ranked[1].label} ($${ranked[1].totalNetProfitUsd.toLocaleString()}) - Win Rate: ${ranked[1].winRate}%`);
console.log(`   🥉 Top #3 Pick: ${ranked[2].label} ($${ranked[2].totalNetProfitUsd.toLocaleString()}) - Win Rate: ${ranked[2].winRate}%`);
console.log(`   📉 Bottom Pick: ${ranked[ranked.length - 1].label} ($${ranked[ranked.length - 1].totalNetProfitUsd.toLocaleString()})`);

// Test 2: Multi-Chain Filtering
console.log('\n--- Test 2: Verifying Multi-Chain Ecosystem Isolation ---');
const solanaWallets = getRankedWallets('solana', 'all', 'profit');
const baseWallets = getRankedWallets('base', 'all', 'profit');
const ethWallets = getRankedWallets('ethereum', 'all', 'profit');
const bscWallets = getRankedWallets('bsc', 'all', 'profit');

assert(solanaWallets.every((w) => w.chain === 'solana'), 'Solana filter must only return Solana wallets');
assert(baseWallets.every((w) => w.chain === 'base'), 'Base filter must only return Base wallets');
assert(ethWallets.every((w) => w.chain === 'ethereum'), 'ETH filter must only return Ethereum wallets');
assert(bscWallets.every((w) => w.chain === 'bsc'), 'BSC filter must only return BSC wallets');
console.log(`✅ Passed: Multi-chain filtering confirmed (Solana: ${solanaWallets.length}, Base: ${baseWallets.length}, ETH: ${ethWallets.length}, BSC: ${bscWallets.length}).`);

// Test 3: Algorithmic Alpha Conviction Filter
console.log('\n--- Test 3: Verifying Autonomous Conviction Scoring ---');
const { evaluateAlphaConviction, DEFAULT_DEMO_PORTFOLIO, INITIAL_OPEN_POSITIONS, INITIAL_CLOSED_TRADES, runDemoBotTick } = require('../dist_test/demo-trading-engine');

const topWallet = SEED_WALLETS[0]; // 84.6% win rate
const goodToken = {
  address: 'good-token',
  symbol: 'SAFE',
  name: 'Safe Meme',
  chain: 'solana',
  buyTax: 0,
  sellTax: 0,
  lpLockedPercent: 100,
  liquidityUsd: 1500000,
  priceUsd: 1.0,
  volume24h: 500000,
};
const earlyTrade = { snipedBlockZero: true };

const evalGood = evaluateAlphaConviction(topWallet, goodToken, earlyTrade);
console.log(`   High-Conviction Setup: Score ${evalGood.score}/100 (Passed: ${evalGood.passed})`);
assert(evalGood.passed && evalGood.score >= 80, 'High quality setup must pass conviction filter');

const badToken = {
  address: 'bad-token',
  symbol: 'SCAM',
  name: 'Scam Meme',
  chain: 'solana',
  buyTax: 25,
  sellTax: 25,
  lpLockedPercent: 10,
  liquidityUsd: 2000,
  priceUsd: 0.001,
  volume24h: 1000,
};
const evalBad = evaluateAlphaConviction(topWallet, badToken, { snipedBlockZero: false });
console.log(`   Low-Conviction/Honeypot: Score ${evalBad.score}/100 (Passed: ${evalBad.passed})`);
assert(!evalBad.passed && evalBad.score < 50, 'Scam/honeypot setup must be rejected by filter');
console.log('✅ Passed: Autonomous conviction filter correctly differentiates high-probability setups from honeypots.');

// Test 4: Demo Bot Auto-Reload on Exhaustion
console.log('\n--- Test 4: Verifying Demo Engine Auto-Reload & Decision Logging ---');
const exhaustedPortfolio = {
  ...DEFAULT_DEMO_PORTFOLIO,
  currentCash: 2.0, // Only $2 cash left
  investedInPositionsUsd: 5.0, // $5 in positions
  totalEquityUsd: 7.0, // < $10 exhausted
  reloadCount: 0,
  totalDemoCapitalLoaded: 100,
  isAutoReloadEnabled: true,
  isBotRunning: true,
};

const tickResult = runDemoBotTick(exhaustedPortfolio, [], []);
assert(tickResult.updatedPortfolio.reloadCount === 1, 'Auto-reload must increment reloadCount to 1');
assert(tickResult.updatedPortfolio.totalEquityUsd >= 100, `Total equity must be replenished to >= $100 (got $${tickResult.updatedPortfolio.totalEquityUsd})`);
assert(tickResult.updatedPortfolio.totalDemoCapitalLoaded === 200, 'Total capital loaded must reflect $200');

const reloadLog = tickResult.newLogs.find((l) => l.type === 'AUTO_RELOAD');
assert(reloadLog, 'Must record AUTO_RELOAD decision log');
assert(reloadLog.improvementLessonTag === '[AUTO_RELOAD_CYCLE]', 'Must contain diagnostic lesson tag');
console.log(`✅ Passed: Auto-reload triggered successfully. Cash replenished to $${tickResult.updatedPortfolio.currentCash}, reload log recorded.`);

// Test 5: Closed Trades History Ledger Data Integrity
console.log('\n--- Test 5: Verifying Closed Trades History Ledger Details ---');
assert(Array.isArray(INITIAL_CLOSED_TRADES), 'INITIAL_CLOSED_TRADES must be an array');
assert(INITIAL_CLOSED_TRADES.length >= 3, 'Must have at least 3 initial closed trades');

for (const trade of INITIAL_CLOSED_TRADES) {
  assert(trade.id, 'Trade must have an id');
  assert(trade.tokenSymbol, 'Trade must have token symbol');
  assert(trade.chain, 'Trade must have a chain');
  assert(trade.copiedFromWallet, 'Trade must record copied wallet');
  assert(trade.entryTimestamp < trade.exitTimestamp, 'Entry timestamp must be before exit timestamp');
  assert(trade.holdDurationSeconds > 0, 'Hold duration must be positive');
  assert(trade.entryPriceUsd > 0, 'Entry price must be positive');
  assert(trade.exitPriceUsd > 0, 'Exit price must be positive');
  assert(trade.investedUsd > 0, 'Invested USD must be positive');
  assert(typeof trade.netPnlUsd === 'number', 'Net PnL USD must be a number');
  assert(trade.exitReason, 'Must have an exit reason');
  assert(trade.exitReasonDetail, 'Must have exit reason detail');

  // Verify math consistency on each trade
  const calculatedReturn = +(trade.investedUsd + trade.netPnlUsd).toFixed(2);
  assert(
    Math.abs(calculatedReturn - trade.returnedUsd) < 0.05,
    `Trade ${trade.tokenSymbol}: Returned ($${trade.returnedUsd}) must equal Invested ($${trade.investedUsd}) + Net P&L ($${trade.netPnlUsd})`
  );
  console.log(`   Trade ${trade.tokenSymbol} (${trade.chain.toUpperCase()}): ${trade.exitReason} at $${trade.exitPriceUsd} -> P&L: ${trade.netPnlUsd >= 0 ? '+' : ''}$${trade.netPnlUsd} (${trade.netPnlPercent >= 0 ? '+' : ''}${trade.netPnlPercent}%, ${trade.multiplier}x) | Hold Time: ${Math.round(trade.holdDurationSeconds / 60)} mins`);
}
console.log(`✅ Passed: Closed Trades History contains granular timestamps, duration, entry/exit prices, and verified P&L.`);

// Test 6: Strict Mathematical Equity Reconciliation (Zero Double-Counting / Zero Inflation Proof)
console.log('\n--- Test 6: Auditing Portfolio Equity Math Invariant (Zero Inflation Test) ---');
const p = DEFAULT_DEMO_PORTFOLIO;
const openPositions = INITIAL_OPEN_POSITIONS;

// 1. Sum up open positions market value
const openInvested = openPositions.reduce((acc, pos) => acc + pos.investedUsd, 0);
const openUnrealizedPnl = openPositions.reduce((acc, pos) => acc + pos.pnlUsd, 0);
const openMarketValue = openPositions.reduce((acc, pos) => acc + (pos.investedUsd + pos.pnlUsd), 0);

console.log(`   Initial Free Cash:             $${p.currentCash.toFixed(2)}`);
console.log(`   Open Positions Invested:       $${openInvested.toFixed(2)}`);
console.log(`   Open Positions Unrealized P&L: +$${openUnrealizedPnl.toFixed(2)}`);
console.log(`   Open Positions Market Value:   $${openMarketValue.toFixed(2)}`);
console.log(`   Realized P&L from Closed:      +$${p.totalRealizedPnlUsd.toFixed(2)}`);
console.log(`   Total Portfolio Equity:        $${p.totalEquityUsd.toFixed(2)}`);
console.log(`   Capital Loaded:                $${p.totalDemoCapitalLoaded.toFixed(2)}`);

// INVARIANT 1: Total Equity == Free Cash + Market Value of Open Positions
const equityFromCashAndPositions = +(p.currentCash + openMarketValue).toFixed(2);
assert.strictEqual(
  p.totalEquityUsd,
  equityFromCashAndPositions,
  `INVARIANT 1 FAILED: Total Equity ($${p.totalEquityUsd}) must strictly equal Free Cash ($${p.currentCash}) + Open Positions Market Value ($${openMarketValue}) = $${equityFromCashAndPositions}`
);

// INVARIANT 2: Total Equity == Capital Deposited + Total Realized P&L + Total Unrealized P&L
const equityFromCapitalAndPnl = +(p.totalDemoCapitalLoaded + p.totalRealizedPnlUsd + openUnrealizedPnl).toFixed(2);
assert.strictEqual(
  p.totalEquityUsd,
  equityFromCapitalAndPnl,
  `INVARIANT 2 FAILED: Total Equity ($${p.totalEquityUsd}) must strictly equal Capital Deposited ($${p.totalDemoCapitalLoaded}) + Realized ($${p.totalRealizedPnlUsd}) + Unrealized ($${openUnrealizedPnl}) = $${equityFromCapitalAndPnl}`
);

// INVARIANT 3: Free Cash == Capital Deposited + Total Realized P&L - Open Invested Principal
const expectedCash = +(p.totalDemoCapitalLoaded + p.totalRealizedPnlUsd - openInvested).toFixed(2);
assert.strictEqual(
  p.currentCash,
  expectedCash,
  `INVARIANT 3 FAILED: Free Cash ($${p.currentCash}) must strictly equal Deposited ($${p.totalDemoCapitalLoaded}) + Realized ($${p.totalRealizedPnlUsd}) - Invested ($${openInvested}) = $${expectedCash}`
);

// Test 7: Periodic P&L Aggregation (Day / Week / Month)
console.log('\n--- Test 7: Verifying Periodic P&L Aggregation (Day / Week / Month) ---');
const {
  aggregatePnlByDay,
  aggregatePnlByWeek,
  aggregatePnlByMonth,
  calculateTimeframePnlMetrics,
} = require('../dist_test/demo-trading-engine');

const daily = aggregatePnlByDay(p.closedTrades);
const weekly = aggregatePnlByWeek(p.closedTrades);
const monthly = aggregatePnlByMonth(p.closedTrades);

console.log(`   Daily Periods Count:   ${daily.length} days`);
console.log(`   Weekly Periods Count:  ${weekly.length} weeks`);
console.log(`   Monthly Periods Count: ${monthly.length} months`);

assert(daily.length > 0, 'Daily summaries should not be empty');
assert(weekly.length > 0, 'Weekly summaries should not be empty');
assert(monthly.length > 0, 'Monthly summaries should not be empty');

// Verify Sum of Daily PnL matches total realized PnL
const sumDailyPnl = +daily.reduce((acc, d) => acc + d.netPnlUsd, 0).toFixed(2);
assert.strictEqual(
  sumDailyPnl,
  p.totalRealizedPnlUsd,
  `Daily sum ($${sumDailyPnl}) must exactly match total realized PnL ($${p.totalRealizedPnlUsd})`
);

// Verify Sum of Weekly PnL matches total realized PnL
const sumWeeklyPnl = +weekly.reduce((acc, w) => acc + w.netPnlUsd, 0).toFixed(2);
assert.strictEqual(
  sumWeeklyPnl,
  p.totalRealizedPnlUsd,
  `Weekly sum ($${sumWeeklyPnl}) must exactly match total realized PnL ($${p.totalRealizedPnlUsd})`
);

// Verify Sum of Monthly PnL matches total realized PnL
const sumMonthlyPnl = +monthly.reduce((acc, m) => acc + m.netPnlUsd, 0).toFixed(2);
assert.strictEqual(
  sumMonthlyPnl,
  p.totalRealizedPnlUsd,
  `Monthly sum ($${sumMonthlyPnl}) must exactly match total realized PnL ($${p.totalRealizedPnlUsd})`
);

// Verify Timeframe metrics
const todayMetrics = calculateTimeframePnlMetrics(p.closedTrades, '24h');
const weekMetrics = calculateTimeframePnlMetrics(p.closedTrades, '7d');
const monthMetrics = calculateTimeframePnlMetrics(p.closedTrades, '30d');

console.log(`   Today (24h) P/L:      ${todayMetrics.realizedPnl >= 0 ? '+' : ''}$${todayMetrics.realizedPnl} (${todayMetrics.totalTrades} trades, ${todayMetrics.winRate}% win rate)`);
console.log(`   This Week (7d) P/L:   ${weekMetrics.realizedPnl >= 0 ? '+' : ''}$${weekMetrics.realizedPnl} (${weekMetrics.totalTrades} trades, ${weekMetrics.winRate}% win rate)`);
console.log(`   This Month (30d) P/L: ${monthMetrics.realizedPnl >= 0 ? '+' : ''}$${monthMetrics.realizedPnl} (${monthMetrics.totalTrades} trades, ${monthMetrics.winRate}% win rate)`);

console.log('✅ Passed: Daily, Weekly, and Monthly P&L aggregations strictly reconcile with 0.00% discrepancy.');

console.log('\n================================================================');
console.log(' 🎉 ALL SYSTEM VERIFICATIONS PASSED WITH 100% SUCCESS!');
console.log('================================================================\n');
