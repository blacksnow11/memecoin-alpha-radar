// Autonomous 24/7 Standalone Trading Daemon Runner
// Executes autonomous evaluation cycles every 20 seconds around the clock
// Completely independent of website visits or browser tabs.

const API_URL = process.env.BOT_API_URL || 'http://localhost:3000/api/demo-bot';
const INTERVAL_SECONDS = parseInt(process.env.BOT_INTERVAL_SECONDS || '20', 10);

console.log('====================================================');
console.log('  MEMEALPHA RADAR: 24/7 AUTONOMOUS TRADING DAEMON   ');
console.log('====================================================');
console.log(`📡 Target Endpoint : ${API_URL}`);
console.log(`⏱️  Evaluation Cycle: Every ${INTERVAL_SECONDS} seconds`);
console.log(`🌐 Mode            : Zero-Visitor Autonomous Execution`);
console.log('----------------------------------------------------\n');

let tickCount = 0;

async function executeCycle() {
  tickCount++;
  const timeStr = new Date().toLocaleTimeString();

  try {
    const res = await fetch(API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'tick' }),
    });

    if (!res.ok) {
      console.warn(`[${timeStr}] ⚠️ HTTP ${res.status}: Failed to reach trading engine.`);
      return;
    }

    const data = await res.json();
    if (!data.success) {
      console.warn(`[${timeStr}] ⚠️ Engine returned error:`, data.error);
      return;
    }

    const copy = data.copyBot?.portfolio || data.portfolio;
    const gem = data.gemRadarBot?.portfolio;
    const copyPos = data.copyBot?.positions || data.positions || [];
    const gemPos = data.gemRadarBot?.positions || [];

    console.log(`[${timeStr}] 🔄 Tick #${tickCount} Evaluated Successfully:`);
    console.log(`   🐋 Smart Money Copy Bot: Cash: $${copy?.currentCash?.toFixed(2)} | Equity: $${copy?.totalEquityUsd?.toFixed(2)} | Open Positions: ${copyPos.length}`);
    if (gem) {
      console.log(`   ⚡ Gem Radar Breakout  : Cash: $${gem?.currentCash?.toFixed(2)} | Equity: $${gem?.totalEquityUsd?.toFixed(2)} | Open Positions: ${gemPos.length}`);
    }

    // Print recent logs if any actions occurred
    const latestLogs = (data.gemRadarBot?.logs || []).concat(data.copyBot?.logs || []).filter(
      (l) => Date.now() - l.timestamp < INTERVAL_SECONDS * 1500
    );

    for (const log of latestLogs) {
      if (log.type === 'ENTRY_EXECUTED') {
        console.log(`   🎯 [TRADE ENTRY] ${log.action} (${log.tokenSymbol})`);
      } else if (log.type === 'EXIT_TAKE_PROFIT') {
        console.log(`   💰 [TAKE PROFIT] ${log.action} (+${log.outcomePnlPercent}%)`);
      } else if (log.type === 'EXIT_STOP_LOSS') {
        console.log(`   🛡️ [STOP LOSS] ${log.action} (${log.outcomePnlPercent}%)`);
      }
    }
  } catch (err) {
    console.error(`[${timeStr}] ❌ Daemon cycle error: ${err.message}`);
  }
}

// Initial cycle
executeCycle();

// 24/7 continuous autonomous interval
setInterval(executeCycle, INTERVAL_SECONDS * 1000);
