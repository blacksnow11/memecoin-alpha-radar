import fs from 'fs';
import path from 'path';
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

const DATA_DIR = path.join(process.cwd(), 'data');
const STATE_FILE = path.join(DATA_DIR, 'bot-state.json');

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

let memoryState: StoredBotState | null = null;

export function loadBotStateFromDisk(): StoredBotState {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }

    if (fs.existsSync(STATE_FILE)) {
      const raw = fs.readFileSync(STATE_FILE, 'utf-8');
      const parsed = JSON.parse(raw);
      if (parsed && parsed.copyBot && parsed.gemRadarBot) {
        memoryState = parsed;
        return memoryState!;
      }
    }
  } catch (err) {
    console.error('[BotStorage] Failed to read bot-state.json, initializing fresh state:', err);
  }

  const fresh = getInitialState();
  memoryState = fresh;
  saveBotStateToDisk(fresh);
  return fresh;
}

export function saveBotStateToDisk(state: StoredBotState): void {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }

    const tempFile = `${STATE_FILE}.tmp.${Date.now()}`;
    fs.writeFileSync(tempFile, JSON.stringify(state, null, 2), 'utf-8');
    fs.renameSync(tempFile, STATE_FILE);
    memoryState = state;
  } catch (err) {
    console.error('[BotStorage] Error persisting bot-state.json to disk:', err);
  }
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
