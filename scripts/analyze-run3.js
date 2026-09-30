const fs = require('fs');

// We will read the transcript or the user input to get all closed trades provided in the prompt
const fullInput = process.argv[2] ? fs.readFileSync(process.argv[2], 'utf8') : '';

// Extract all JSON objects representing closed trades using regex
const regex = /\{"id":"closed-[^"]+","tokenAddress":"[^"]+","tokenSymbol":"([^"]+)","tokenName":"[^"]+","chain":"solana","copiedFromWallet":"([^"]+)","copiedFromWalletLabel":"([^"]+)","entryTimestamp":(\d+),"exitTimestamp":(\d+),"holdDurationSeconds":(\d+),"entryPriceUsd":([0-9.e-]+),"exitPriceUsd":([0-9.e-]+),"investedUsd":([0-9.]+),"returnedUsd":([0-9.]+),"netPnlUsd":([0-9.-]+),"netPnlPercent":([0-9.-]+),"multiplier":([0-9.]+),"exitReason":"([^"]+)"/g;

const trades = [];
let match;
while ((match = regex.exec(fullInput)) !== null) {
  trades.push({
    symbol: match[1],
    wallet: match[2],
    walletLabel: match[3],
    entryTs: parseInt(match[4]),
    exitTs: parseInt(match[5]),
    durationSec: parseInt(match[6]),
    entryPrice: parseFloat(match[7]),
    exitPrice: parseFloat(match[8]),
    invested: parseFloat(match[9]),
    returned: parseFloat(match[10]),
    pnlUsd: parseFloat(match[11]),
    pnlPercent: parseFloat(match[12]),
    multiplier: parseFloat(match[13]),
    exitReason: match[14],
  });
}

console.log(`Parsed ${trades.length} sample trades from log chunk`);

// 1. Exit Reason breakdown
const byReason = {};
trades.forEach(t => {
  if (!byReason[t.exitReason]) {
    byReason[t.exitReason] = { count: 0, wins: 0, losses: 0, totalPnlUsd: 0, avgPnlPercent: 0, sumPnlPercent: 0 };
  }
  byReason[t.exitReason].count++;
  if (t.pnlUsd >= 0) byReason[t.exitReason].wins++;
  else byReason[t.exitReason].losses++;
  byReason[t.exitReason].totalPnlUsd += t.pnlUsd;
  byReason[t.exitReason].sumPnlPercent += t.pnlPercent;
});

Object.keys(byReason).forEach(r => {
  byReason[r].avgPnlPercent = +(byReason[r].sumPnlPercent / byReason[r].count).toFixed(2);
  byReason[r].totalPnlUsd = +byReason[r].totalPnlUsd.toFixed(2);
});

console.log('\n--- PERFORMANCE BY EXIT REASON ---');
console.table(byReason);

// 2. Performance by Copied Wallet
const byWallet = {};
trades.forEach(t => {
  const label = t.walletLabel;
  if (!byWallet[label]) {
    byWallet[label] = { trades: 0, wins: 0, losses: 0, totalPnlUsd: 0, bigWins: 0, rugs: 0 };
  }
  byWallet[label].trades++;
  if (t.pnlUsd > 0) byWallet[label].wins++;
  else byWallet[label].losses++;
  byWallet[label].totalPnlUsd += t.pnlUsd;
  if (t.pnlPercent >= 50) byWallet[label].bigWins++;
  if (t.exitReason === 'LIQUIDITY_RUG_PULL') byWallet[label].rugs++;
});

Object.keys(byWallet).forEach(w => {
  byWallet[w].totalPnlUsd = +byWallet[w].totalPnlUsd.toFixed(2);
  byWallet[w].winRate = +((byWallet[w].wins / byWallet[w].trades) * 100).toFixed(1) + '%';
});

console.log('\n--- PERFORMANCE BY COPIED WALLET ---');
console.table(byWallet);

// 3. Top 10 Winners & Top 10 Losers
const sortedByPnl = [...trades].sort((a,b) => b.pnlUsd - a.pnlUsd);
console.log('\n--- TOP 8 BIGGEST WINS ---');
sortedByPnl.slice(0, 8).forEach(t => {
  console.log(`${t.symbol}: +$${t.pnlUsd} (+${t.pnlPercent}%, ${t.multiplier}x) in ${t.durationSec}s | Copied from: ${t.walletLabel}`);
});

console.log('\n--- TOP 8 BIGGEST LOSSES ---');
sortedByPnl.slice(-8).reverse().forEach(t => {
  console.log(`${t.symbol}: -$${Math.abs(t.pnlUsd)} (${t.pnlPercent}%) in ${t.durationSec}s [${t.exitReason}] | Copied from: ${t.walletLabel}`);
});
