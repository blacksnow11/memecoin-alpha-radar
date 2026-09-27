import { getBotState, saveBotStateToDisk, StoredBotState } from './bot-storage';
import { runCopyBotTick, runGemRadarBotTick } from './demo-trading-engine';
import { ServerWorkerStatus } from './types';

const TICK_INTERVAL_MS = 20000; // 20 seconds
let isWorkerRunning = false;
let isTickRunning = false;
let workerTimer: NodeJS.Timeout | null = null;
let workerStartedAt = 0;
let lastTickTimestamp = 0;
let totalTicksExecuted = 0;

export async function executeBotTick(): Promise<StoredBotState> {
  if (isTickRunning) {
    return getBotState();
  }

  isTickRunning = true;
  try {
    const currentState = getBotState();

    // Concurrently evaluate Whale Copy Bot & Gem Radar Breakout Bot
    const [copyRes, gemRes] = await Promise.all([
      runCopyBotTick(
        currentState.copyBot.portfolio,
        currentState.copyBot.positions,
        currentState.copyBot.logs
      ),
      runGemRadarBotTick(
        currentState.gemRadarBot.portfolio,
        currentState.gemRadarBot.positions,
        currentState.gemRadarBot.logs
      ),
    ]);

    const newCopyLogs =
      copyRes.newLogs.length > 0
        ? [...copyRes.newLogs, ...currentState.copyBot.logs].slice(0, 100)
        : currentState.copyBot.logs;

    const newGemLogs =
      gemRes.newLogs.length > 0
        ? [...gemRes.newLogs, ...currentState.gemRadarBot.logs].slice(0, 100)
        : currentState.gemRadarBot.logs;

    lastTickTimestamp = Date.now();
    totalTicksExecuted += 1;

    const nextState: StoredBotState = {
      copyBot: {
        portfolio: copyRes.updatedPortfolio,
        positions: copyRes.updatedPositions,
        logs: newCopyLogs,
      },
      gemRadarBot: {
        portfolio: gemRes.updatedPortfolio,
        positions: gemRes.updatedPositions,
        logs: newGemLogs,
      },
      lastServerTickTimestamp: lastTickTimestamp,
      totalTicksExecuted: (currentState.totalTicksExecuted || 0) + 1,
      workerStartedAt: currentState.workerStartedAt || workerStartedAt,
    };

    saveBotStateToDisk(nextState);
    return nextState;
  } catch (err) {
    console.error('[24/7 Bot Worker] Error executing autonomous tick:', err);
    return getBotState();
  } finally {
    isTickRunning = false;
  }
}

export function start247BotWorker(): void {
  // Prevent duplicate worker loops in development/HMR or re-invocations
  if (isWorkerRunning) {
    return;
  }

  isWorkerRunning = true;
  workerStartedAt = Date.now();

  // Load existing state to sync counters
  const state = getBotState();
  totalTicksExecuted = state.totalTicksExecuted || 0;
  lastTickTimestamp = state.lastServerTickTimestamp || 0;

  console.log('----------------------------------------------------');
  console.log('🤖 [24/7 Bot Worker] Autonomous Server Daemon STARTED');
  console.log(`⏱️ Interval: Every ${TICK_INTERVAL_MS / 1000}s`);
  console.log(`📁 Persistence: data/bot-state.json`);
  console.log('----------------------------------------------------');

  // Initial delayed tick to let RPC connections establish
  setTimeout(() => {
    executeBotTick().catch((err) => {
      console.error('[24/7 Bot Worker] Initial tick failed:', err);
    });
  }, 4000);

  // 24/7 continuous autonomous loop
  workerTimer = setInterval(() => {
    executeBotTick().catch((err) => {
      console.error('[24/7 Bot Worker] Autonomous tick loop error:', err);
    });
  }, TICK_INTERVAL_MS);

  // Allow clean process exit if SIGINT/SIGTERM is sent
  if (workerTimer.unref) {
    workerTimer.unref();
  }
}

export function getServerWorkerStatus(): ServerWorkerStatus {
  const state = getBotState();
  return {
    isWorkerRunning,
    workerStartedAt: workerStartedAt || state.workerStartedAt || Date.now(),
    lastTickTimestamp: lastTickTimestamp || state.lastServerTickTimestamp || 0,
    totalTicksExecuted: totalTicksExecuted || state.totalTicksExecuted || 0,
    intervalSeconds: TICK_INTERVAL_MS / 1000,
  };
}
