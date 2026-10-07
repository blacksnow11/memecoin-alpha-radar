import { getBotState, saveBotStateToDisk, StoredBotState } from './bot-storage';
import { createDefaultTournamentAccounts, runCopyBotTick, runGemRadarBotTick } from './demo-trading-engine';
import { BotAccountProfile, ServerWorkerStatus } from './types';

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
    const currentTourney = currentState.tournamentAccounts || createDefaultTournamentAccounts();
    const tourneyAccountIds = Object.keys(currentTourney);

    // Concurrently evaluate Whale Copy Bot & All 4 Gem Radar Tournament Accounts
    const [copyRes, ...tourneyEvaluations] = await Promise.all([
      runCopyBotTick(
        currentState.copyBot.portfolio,
        currentState.copyBot.positions,
        currentState.copyBot.logs
      ),
      ...tourneyAccountIds.map((accId) => {
        const acc = currentTourney[accId];
        return runGemRadarBotTick(
          acc.portfolio,
          acc.positions,
          acc.logs,
          undefined,
          acc
        );
      }),
    ]);

    const newCopyLogs =
      copyRes.newLogs.length > 0
        ? [...copyRes.newLogs, ...currentState.copyBot.logs].slice(0, 100)
        : currentState.copyBot.logs;

    const updatedTournamentAccounts: Record<string, BotAccountProfile> = {};
    tourneyAccountIds.forEach((accId, i) => {
      const orig = currentTourney[accId];
      const res = tourneyEvaluations[i];
      const mergedLogs =
        res.newLogs.length > 0
          ? [...res.newLogs, ...orig.logs].slice(0, 100)
          : orig.logs;

      updatedTournamentAccounts[accId] = {
        ...orig,
        portfolio: res.updatedPortfolio,
        positions: res.updatedPositions,
        logs: mergedLogs,
      };
    });

    const primaryGemAccount = updatedTournamentAccounts['gem_radar_12to6'] || Object.values(updatedTournamentAccounts)[0];

    lastTickTimestamp = Date.now();
    totalTicksExecuted += 1;

    const nextState: StoredBotState = {
      copyBot: {
        portfolio: copyRes.updatedPortfolio,
        positions: copyRes.updatedPositions,
        logs: newCopyLogs,
      },
      gemRadarBot: {
        portfolio: primaryGemAccount.portfolio,
        positions: primaryGemAccount.positions,
        logs: primaryGemAccount.logs,
      },
      tournamentAccounts: updatedTournamentAccounts,
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
