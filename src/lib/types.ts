export type ChainId = 'solana' | 'base' | 'ethereum' | 'bsc';

export interface ChainConfig {
  id: ChainId;
  name: string;
  nativeSymbol: string;
  color: string;
  badgeBg: string;
  badgeText: string;
  explorerUrl: string;
  dexList: string[];
}

export interface Token {
  address: string;
  symbol: string;
  name: string;
  chain: ChainId;
  decimals: number;
  priceUsd: number;
  marketCap: number;
  liquidityUsd: number;
  volume24h: number;
  priceChange24h: number;
  dex: string;
  url?: string;
  iconUrl?: string;
  isHoneypot?: boolean;
  securityScore: number; // 0-100
  buyTax: number;
  sellTax: number;
  lpLockedPercent: number;
}

export interface Trade {
  id: string;
  walletAddress: string;
  chain: ChainId;
  tokenAddress: string;
  tokenSymbol: string;
  tokenName: string;
  action: 'BUY' | 'SELL';
  priceUsd: number;
  amountTokens: number;
  volumeUsd: number;
  nativeAmount: number;
  nativeSymbol: string;
  marketCapAtTrade: number;
  timestamp: number;
  blockNumber: number;
  txHash: string;
  dex: string;
  multiplier?: number; // e.g. 14.2 for 14.2x
  pnlUsd?: number;
  holdDurationSeconds?: number;
  snipedBlockZero?: boolean;
  priorityFeeUsd?: number;
}

export interface MultiplierDistribution {
  moonshots100xPlus: number;
  highWins10xTo100x: number;
  midWins2xTo10x: number;
  smallWins1xTo2x: number;
  breakeven: number;
  losses: number;
}

export interface WalletProfile {
  address: string;
  label: string;
  tags: string[];
  chain: ChainId;
  rank: number;
  totalNetProfitUsd: number;
  totalNetProfitNative: number;
  nativeSymbol: string;
  winRate: number; // 0-100
  totalTrades: number;
  winningTrades: number;
  losingTrades: number;
  profitFactor: number;
  avgMultiplier: number;
  avgHoldDurationMinutes: number;
  maxDrawdownPercent: number;
  sharpeRatio: number;
  alphaScore: number; // 0-100
  copyTradeReadiness: {
    grade: 'A+' | 'A' | 'A-' | 'B+' | 'B' | 'B-' | 'C+' | 'C' | 'D' | 'F';
    slippageRisk: 'LOW' | 'MEDIUM' | 'HIGH';
    frontrunRisk: 'LOW' | 'MEDIUM' | 'HIGH';
    recommendedCopySizeUsd: number;
    explanation: string;
  };
  alphaSignature: {
    sniperSpeedScore: number; // 0-100
    exitDisciplineScore: number; // 0-100
    rugAvoidanceRate: number; // 0-100
    insiderSuspicionScore: number; // 0-100 (lower = more organic smart money)
    earlyEntryPercent: number; // % entered in block 0-1
    avgProfitTakingLevels: string[];
  };
  equityCurve: Array<{
    timestamp: number;
    pnlUsd: number;
    portfolioValueUsd: number;
  }>;
  multiplierDistribution: MultiplierDistribution;
  trades: Trade[];
  walletCategory?: 'SMART_TRADER' | 'PRECISION_SNIPER' | 'SWING_WHALE' | 'MARKET_MAKER_ROUTER' | 'EXCHANGE_ROUTER';
  isCopyTradeable?: boolean;
  tradeStyle?: string;
  tradeFrequencyPerDay?: number;
  initialCapitalUsd?: number;
  capitalEfficiencyRatio?: number; // e.g. 42.5 for 42.5x ROI on deployed capital
  avgPositionSizeUsd?: number;
  profitToCapitalMultiplier?: number;
  lastActiveTimestamp?: number;
  activityStatus?: 'HOT_ACTIVE' | 'WARM' | 'COOLING_OFF' | 'SLACKING_INACTIVE';
  recentWinStreak?: number;
  dynamicRankScore?: number;
  rankTrend?: 'UP' | 'DOWN' | 'STABLE';
  rankChange24h?: number;
}

export interface DemoPosition {
  id: string;
  tokenAddress: string;
  tokenSymbol: string;
  tokenName: string;
  chain: ChainId;
  copiedFromWallet: string;
  copiedFromWalletLabel: string;
  entryTimestamp: number;
  entryPriceUsd: number;
  currentPriceUsd: number;
  investedUsd: number;
  tokenAmount: number;
  pnlUsd: number;
  pnlPercent: number;
  takeProfitPrice1: number;
  takeProfitPrice2: number;
  stopLossPrice: number;
  status: 'OPEN' | 'CLOSED';
  exitTimestamp?: number;
  exitPriceUsd?: number;
  exitReason?: string;
  alphaScoreAtEntry: number;
  entryRationale: string;
  strategy?: 'WHALE_COPY' | 'GEM_RADAR_BREAKOUT';
  gemPattern?: string;
  verifiedWhaleHolding?: boolean;
  whaleEntryTimestamp?: number;
}

export interface DemoClosedTrade {
  id: string;
  tokenAddress: string;
  tokenSymbol: string;
  tokenName: string;
  chain: ChainId;
  copiedFromWallet: string;
  copiedFromWalletLabel: string;
  entryTimestamp: number;
  exitTimestamp: number;
  holdDurationSeconds: number;
  entryPriceUsd: number;
  exitPriceUsd: number;
  entryMarketCap?: number;
  exitMarketCap?: number;
  investedUsd: number;
  returnedUsd: number;
  netPnlUsd: number;
  netPnlPercent: number;
  multiplier: number; // e.g. 2.0x, 0.8x
  exitReason: 'TAKE_PROFIT' | 'STOP_LOSS' | 'MANUAL_CLOSE' | 'TRAILING_STOP';
  exitReasonDetail: string;
  alphaScoreAtEntry: number;
  entryRationale: string;
  txHash?: string;
  simulatedGasFeeUsd: number;
}

export interface PeriodicPnlSummary {
  periodKey: string; // e.g. "2026-09-27", "2026-W39", "2026-09"
  periodType: 'day' | 'week' | 'month';
  periodLabel: string; // e.g. "Today (Sep 27)", "Week 39 (Sep 21 - Sep 27)", "September 2026"
  startDate: number;
  endDate: number;
  totalTrades: number;
  wins: number;
  losses: number;
  winRate: number;
  totalInvestedUsd: number;
  totalReturnedUsd: number;
  netPnlUsd: number;
  netPnlPercent: number;
  bestTradeSymbol?: string;
  bestTradeMultiplier?: number;
  trades: DemoClosedTrade[];
}

export interface DemoPortfolio {
  startingCash: number; // default $100
  currentCash: number;
  investedInPositionsUsd: number;
  totalEquityUsd: number;
  totalRealizedPnlUsd: number;
  totalUnrealizedPnlUsd: number;
  totalWins: number;
  totalLosses: number;
  winRate: number;
  reloadCount: number;
  totalDemoCapitalLoaded: number;
  isAutoReloadEnabled: boolean;
  isBotRunning: boolean;
  minConvictionThreshold: number; // e.g. 75
  allocationPerTradeUsd: number; // e.g. $15
  maxConcurrentPositions: number; // e.g. 4
  stopLossPercent: number; // e.g. -20
  takeProfitTargets: Array<{ targetMultiplier: number; sellPercent: number }>;
  equityHistory: Array<{ timestamp: number; equityUsd: number }>;
  closedTrades: DemoClosedTrade[];
}

export interface DecisionLog {
  id: string;
  timestamp: number;
  type: 'EVALUATION_PASS' | 'EVALUATION_REJECT' | 'ENTRY_EXECUTED' | 'EXIT_TAKE_PROFIT' | 'EXIT_STOP_LOSS' | 'EXIT_MANUAL' | 'AUTO_RELOAD';
  tokenSymbol: string;
  tokenAddress: string;
  chain: ChainId;
  triggeredByWallet?: string;
  triggeredByWalletLabel?: string;
  convictionScore: number;
  action: string;
  rationale: string;
  outcomePnlUsd?: number;
  outcomePnlPercent?: number;
  improvementLessonTag: string; // e.g. "[WIN: SNIPER_CONSENSUS]", "[LOSS: SLIPPAGE_FADE]"
  improvementNote: string;
}

export type BotStrategyMode = 'COPY_TRADER' | 'GEM_RADAR_HUNTER';

export interface DualBotState {
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
}

export interface SmartWalletDetectorEvidence {
  address: string;
  label: string;
  action: 'BUY' | 'ACCUMULATE' | 'SNIPE';
  amountUsd: number;
  timeAgo: string;
  historicalWinRate: number;
  capitalEfficiencyMultiplier: number;
}

export interface PreBreakoutGemSignal {
  id: string;
  tokenAddress: string;
  tokenSymbol: string;
  tokenName: string;
  chain: ChainId;
  priceUsd: number;
  marketCapUsd: number;
  liquidityUsd: number;
  volume1hUsd: number;
  volume5mUsd: number;
  poolCreatedMinutesAgo: number;
  breakoutProbability: number; // 0-100%
  patternType: 'SMART_MONEY_CLUSTER' | 'GROUND_FLOOR_ACCUMULATION' | 'VOLUME_ACCELERATION' | 'PUMP_BONDING_BREAKOUT';
  patternTitle: string;
  patternDescription: string;
  smartWalletsDetected: SmartWalletDetectorEvidence[];
  entryWindow: 'EARLY_ACCUMULATION' | 'BREAKOUT_IMMINENT' | 'OPTIMAL_DIP';
  suggestedDemoAllocationUsd: number;
  confidenceScore: number;
  detectedAt: number;
  dex: string;
  bondingCurvePercent?: number;
}

