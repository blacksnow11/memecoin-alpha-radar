import fs from 'fs';
import path from 'path';
import os from 'os';
import {
  DEFAULT_DEMO_PORTFOLIO,
  DEFAULT_GEM_RADAR_PORTFOLIO,
  INITIAL_DECISION_LOGS,
  INITIAL_GEM_RADAR_LOGS,
  createDefaultTournamentAccounts,
} from './demo-trading-engine';
import { BotAccountProfile, DecisionLog, DemoPortfolio, DemoPosition } from './types';

export const CURRENT_STATE_VERSION = 14;

export interface StoredBotState {
  version?: number;
  copyBot: {
    portfolio: DemoPortfolio;
    positions: DemoPosition[];
    logs: DecisionLog[];
  };
  gemRadarBot: {
    portfolio: DemoPortfolio;
    positions: DemoPosition[];
    logs: DecisionLog[];
  };
  tournamentAccounts: Record<string, BotAccountProfile>;
  lastServerTickTimestamp: number;
  totalTicksExecuted: number;
  workerStartedAt: number;
}

let activeFilePath: string | null = null;
let memoryState: StoredBotState | null = null;

function resolveStoragePath(): string {
  if (activeFilePath) return activeFilePath;

  // On Vercel / AWS Lambda, the application directory (/var/task) is strictly read-only.
  // /tmp is the only writable directory in serverless environments.
  if (process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME) {
    activeFilePath = path.join(os.tmpdir(), 'memecoin-radar-bot-state.json');
    return activeFilePath;
  }

  // Self-hosted / local Node environment: persist in ./data/bot-state.json
  const defaultDir = path.join(process.cwd(), 'data');
  activeFilePath = path.join(defaultDir, 'bot-state.json');
  return activeFilePath;
}

export function getInitialState(): StoredBotState {
  const tournamentAccounts = createDefaultTournamentAccounts();
  const defaultGemAccount = tournamentAccounts['gem_radar_12to6'];

  return {
    version: CURRENT_STATE_VERSION,
    copyBot: {
      portfolio: {
        ...DEFAULT_DEMO_PORTFOLIO,
        equityHistory: [{ timestamp: Date.now(), equityUsd: 1000.00 }],
        closedTrades: [],
      },
      positions: [],
      logs: [...INITIAL_DECISION_LOGS],
    },
    gemRadarBot: {
      portfolio: defaultGemAccount.portfolio,
      positions: defaultGemAccount.positions,
      logs: defaultGemAccount.logs,
    },
    tournamentAccounts,
    lastServerTickTimestamp: 0,
    totalTicksExecuted: 0,
    workerStartedAt: Date.now(),
  };
}

export function resetBotState(): StoredBotState {
  const fresh = getInitialState();
  memoryState = fresh;
  saveBotStateToDisk(fresh);
  return fresh;
}

export function loadBotStateFromDisk(): StoredBotState {
  const filePath = resolveStoragePath();

  try {
    const dir = path.dirname(filePath);
    if (!fs.existsSync(dir)) {
      try {
        fs.mkdirSync(dir, { recursive: true });
      } catch (err: any) {
        // If mkdir fails with EROFS, fallback to tmpdir
        if (err.code === 'EROFS') {
          activeFilePath = path.join(os.tmpdir(), 'memecoin-radar-bot-state.json');
        }
      }
    }

    const targetFile = activeFilePath || filePath;
    if (fs.existsSync(targetFile)) {
      const raw = fs.readFileSync(targetFile, 'utf-8');
      const parsed = JSON.parse(raw);
      if (parsed && parsed.copyBot && parsed.gemRadarBot) {
        // Auto-Migration & Reset: Version 14 initializes the V3.3 Multi-Account Schedule Tournament (12am-6am, 2am-6am, 4am-6am, 24/7) and Rug Shield
        if (!parsed.version || parsed.version < CURRENT_STATE_VERSION || !parsed.tournamentAccounts) {
          console.log(`[BotStorage] Auto-migrating state to Version ${CURRENT_STATE_VERSION}: clean-slate reset with V3.3 Multi-Account Schedule Tournament and Rug Shield`);
          const fresh = getInitialState();
          memoryState = fresh;
          saveBotStateToDisk(fresh);
          return fresh;
        }

        memoryState = parsed;
        return memoryState!;
      }
    }
  } catch (err) {
    // Non-blocking: continue with fresh state in memory
  }

  const fresh = getInitialState();
  memoryState = fresh;
  saveBotStateToDisk(fresh);
  return fresh;
}

export function saveBotStateToDisk(state: StoredBotState): void {
  memoryState = state;
  let targetPath = resolveStoragePath();

  const writeToFile = (file: string): boolean => {
    try {
      const dir = path.dirname(file);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      fs.writeFileSync(file, JSON.stringify(state, null, 2), 'utf-8');
      return true;
    } catch (err: any) {
      if (err.code === 'EROFS') {
        // Fallback permanently to /tmp
        activeFilePath = path.join(os.tmpdir(), 'memecoin-radar-bot-state.json');
        try {
          fs.writeFileSync(activeFilePath, JSON.stringify(state, null, 2), 'utf-8');
          return true;
        } catch {
          return false;
        }
      }
      return false;
    }
  };

  writeToFile(targetPath);
}

export function getBotState(): StoredBotState {
  if (!memoryState) {
    return loadBotStateFromDisk();
  }
  return memoryState;
}

export function updateBotState(
  updater: (prev: StoredBotState) => StoredBotState
): StoredBotState {
  const current = getBotState();
  const next = updater(current);
  saveBotStateToDisk(next);
  return next;
}
