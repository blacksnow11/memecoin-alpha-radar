import fs from 'fs';
import path from 'path';
import os from 'os';
import {
  DEFAULT_DEMO_PORTFOLIO,
  DEFAULT_GEM_RADAR_PORTFOLIO,
  INITIAL_DECISION_LOGS,
  INITIAL_GEM_RADAR_LOGS,
} from './demo-trading-engine';
import { DecisionLog, DemoPortfolio, DemoPosition } from './types';

export interface StoredBotState {
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

function getInitialState(): StoredBotState {
  return {
    copyBot: {
      portfolio: { ...DEFAULT_DEMO_PORTFOLIO },
      positions: [],
      logs: [...INITIAL_DECISION_LOGS],
    },
    gemRadarBot: {
      portfolio: { ...DEFAULT_GEM_RADAR_PORTFOLIO },
      positions: [],
      logs: [...INITIAL_GEM_RADAR_LOGS],
    },
    lastServerTickTimestamp: 0,
    totalTicksExecuted: 0,
    workerStartedAt: Date.now(),
  };
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
        // Upgrade stored demo state: uncap limits to $1,000 capital and 25 concurrent slots
        for (const bot of [parsed.copyBot, parsed.gemRadarBot]) {
          if (bot && bot.portfolio) {
            if (!bot.portfolio.maxConcurrentPositions || bot.portfolio.maxConcurrentPositions < 25) {
              bot.portfolio.maxConcurrentPositions = 25;
            }
            if (!bot.portfolio.startingCash || bot.portfolio.startingCash < 1000) {
              const diff = 1000 - (bot.portfolio.startingCash || 100);
              bot.portfolio.startingCash = 1000;
              bot.portfolio.currentCash = +((bot.portfolio.currentCash || 0) + diff).toFixed(2);
              bot.portfolio.totalDemoCapitalLoaded = +((bot.portfolio.totalDemoCapitalLoaded || 0) + diff).toFixed(2);
              bot.portfolio.totalEquityUsd = +((bot.portfolio.totalEquityUsd || 0) + diff).toFixed(2);
            }
          }
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
