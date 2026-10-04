'use client';

import React, { useState, useMemo } from 'react';
import {
  Bot,
  Play,
  Pause,
  RotateCcw,
  TrendingUp,
  TrendingDown,
  DollarSign,
  Shield,
  Sliders,
  Target,
  AlertCircle,
  ExternalLink,
  ChevronRight,
  ChevronDown,
  Zap,
  CheckCircle2,
  History,
  Clock,
  ArrowUpRight,
  ArrowDownRight,
  Sparkles,
  Layers,
  HelpCircle,
  Calendar,
  CalendarDays,
  CalendarRange,
  BarChart3,
  ListFilter,
  Check,
  Activity,
  Trash2,
} from 'lucide-react';
import { DemoClosedTrade, DemoPortfolio, DemoPosition, PeriodicPnlSummary, ProfitLadderAnalytics, ServerWorkerStatus } from '@/lib/types';
import { SUPPORTED_CHAINS, formatUsd, getExplorerAddressUrl } from '@/lib/chains';
import {
  aggregatePnlByDay,
  aggregatePnlByWeek,
  aggregatePnlByMonth,
  calculateTimeframePnlMetrics,
  calculateProfitLadderAnalytics,
  filterTradesByTimeframe,
  computeHourlyPerformanceStats,
  isWithinActiveTradingHours,
  calculateTradeAllocation,
} from '@/lib/demo-trading-engine';

interface DemoTradingStudioProps {
  portfolio: DemoPortfolio;
  positions: DemoPosition[];
  botMode?: 'copy' | 'gem_radar';
  onSelectBotMode?: (mode: 'copy' | 'gem_radar') => void;
  copyPortfolio?: DemoPortfolio;
  gemPortfolio?: DemoPortfolio;
  onTick: () => void;
  onReload: () => void;
  onReset?: () => void;
  onToggleBot: () => void;
  onClosePosition: (posId: string) => void;
  onUpdateConfig: (config: Partial<DemoPortfolio>) => void;
  onViewLogs: () => void;
  serverWorker?: ServerWorkerStatus | null;
  profitLadder?: ProfitLadderAnalytics | null;
}

function formatDuration(seconds: number): string {
  if (!seconds || seconds <= 0) return '< 1m';
  if (seconds < 60) return `${seconds}s`;
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  if (mins < 60) return `${mins}m ${secs > 0 ? `${secs}s` : ''}`;
  const hours = Math.floor(mins / 60);
  const remMins = mins % 60;
  if (hours < 24) return `${hours}h ${remMins > 0 ? `${remMins}m` : ''}`;
  const days = Math.floor(hours / 24);
  const remHours = hours % 24;
  return `${days}d ${remHours > 0 ? `${remHours}h` : ''}`;
}

function formatDateTime(timestamp: number): string {
  if (!timestamp) return '—';
  const d = new Date(timestamp);
  return d.toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: true,
  });
}

export function DemoTradingStudio({
  portfolio,
  positions,
  botMode = 'copy',
  onSelectBotMode,
  copyPortfolio,
  gemPortfolio,
  onTick,
  onReload,
  onReset,
  onToggleBot,
  onClosePosition,
  onUpdateConfig,
  onViewLogs,
  serverWorker,
  profitLadder,
}: DemoTradingStudioProps) {
  const [minScore, setMinScore] = useState(portfolio.minConvictionThreshold);
  const [allocation, setAllocation] = useState(portfolio.allocationPerTradeUsd);
  const [stopLoss, setStopLoss] = useState(portfolio.stopLossPercent);
  const [autoReload, setAutoReload] = useState(portfolio.isAutoReloadEnabled);

  // Profitability Milestone Ladder collapse toggle
  const [showMilestoneLadder, setShowMilestoneLadder] = useState(true);

  // Timeframe selector for top-level metrics
  const [metricTimeframe, setMetricTimeframe] = useState<'all' | '24h' | '7d' | '30d'>('all');

  // Studio tabs: 'positions', 'history', or 'hourly'
  const [activeStudioTab, setActiveStudioTab] = useState<'positions' | 'history' | 'hourly'>('positions');

  // Closed trades ledger view mode: 'individual' trades vs 'periodic' (Day/Week/Month)
  const [historyViewMode, setHistoryViewMode] = useState<'individual' | 'periodic'>('individual');
  const [periodGranularity, setPeriodGranularity] = useState<'day' | 'week' | 'month'>('day');
  const [expandedPeriodKey, setExpandedPeriodKey] = useState<string | null>(null);

  // Individual trades filters
  const [historyFilter, setHistoryFilter] = useState<'all' | 'wins' | 'losses'>('all');
  const [historyTimeframeFilter, setHistoryTimeframeFilter] = useState<'all' | '24h' | '7d' | '30d'>('all');
  const [expandedTradeId, setExpandedTradeId] = useState<string | null>(null);
  const [showMathExplainer, setShowMathExplainer] = useState(true);

  const handleSaveConfig = () => {
    onUpdateConfig({
      minConvictionThreshold: minScore,
      allocationPerTradeUsd: allocation,
      stopLossPercent: stopLoss,
      isAutoReloadEnabled: autoReload,
    });
  };

  const openPositions = positions.filter((p) => p.status === 'OPEN');
  const closedTrades = portfolio.closedTrades || [];

  // V3.2 Hourly Performance Analytics & Active Hours Check
  const hourlyStats = useMemo(() => computeHourlyPerformanceStats(closedTrades), [closedTrades]);
  const activeHoursCheck = useMemo(() => isWithinActiveTradingHours(portfolio), [portfolio]);
  const currentTradeAllocation = useMemo(() => calculateTradeAllocation(portfolio), [portfolio]);

  // MFE Profitability Ladder Analytics
  const activeProfitLadder = useMemo(() => {
    if (profitLadder) return profitLadder;
    return calculateProfitLadderAnalytics(closedTrades, positions);
  }, [profitLadder, closedTrades, positions]);

  // Top-level timeframe metrics
  const timeframeMetrics = useMemo(() => {
    return calculateTimeframePnlMetrics(closedTrades, metricTimeframe);
  }, [closedTrades, metricTimeframe]);

  // Periodic P&L aggregations (Day / Week / Month)
  const dailyPnlSummaries = useMemo(() => aggregatePnlByDay(closedTrades), [closedTrades]);
  const weeklyPnlSummaries = useMemo(() => aggregatePnlByWeek(closedTrades), [closedTrades]);
  const monthlyPnlSummaries = useMemo(() => aggregatePnlByMonth(closedTrades), [closedTrades]);

  const activePeriodicSummaries = useMemo(() => {
    if (periodGranularity === 'day') return dailyPnlSummaries;
    if (periodGranularity === 'week') return weeklyPnlSummaries;
    return monthlyPnlSummaries;
  }, [periodGranularity, dailyPnlSummaries, weeklyPnlSummaries, monthlyPnlSummaries]);

  // Max absolute P&L among periods for rendering proportional mini-bars
  const maxPeriodPnl = useMemo(() => {
    if (activePeriodicSummaries.length === 0) return 1;
    return Math.max(...activePeriodicSummaries.map((s) => Math.abs(s.netPnlUsd)), 1);
  }, [activePeriodicSummaries]);

  // Filtered individual trades
  const filteredClosedTrades = useMemo(() => {
    let result = filterTradesByTimeframe(closedTrades, historyTimeframeFilter);
    if (historyFilter === 'wins') {
      result = result.filter((t) => t.netPnlUsd >= 0);
    } else if (historyFilter === 'losses') {
      result = result.filter((t) => t.netPnlUsd < 0);
    }
    return result;
  }, [closedTrades, historyTimeframeFilter, historyFilter]);

  // Calculate strict numbers for equity balance
  const currentOpenMarketValue = openPositions.reduce(
    (acc, p) => acc + (p.investedUsd + p.pnlUsd),
    0
  );
  const netPnlPercent =
    portfolio.totalDemoCapitalLoaded > 0
      ? ((portfolio.totalEquityUsd - portfolio.totalDemoCapitalLoaded) /
          portfolio.totalDemoCapitalLoaded) *
        100
      : 0;

  // Closed trades statistics
  const totalClosedCount = closedTrades.length;
  const closedWins = closedTrades.filter((t) => t.netPnlUsd >= 0).length;
  const closedLosses = closedTrades.filter((t) => t.netPnlUsd < 0).length;
  const closedWinRate = totalClosedCount > 0 ? +((closedWins / totalClosedCount) * 100).toFixed(1) : 0;
  const totalClosedRealizedPnl = closedTrades.reduce((acc, t) => acc + t.netPnlUsd, 0);
  const bestTradeMultiplier = closedTrades.length > 0
    ? Math.max(...closedTrades.map((t) => t.multiplier || 1))
    : 1;

  // Periodic stats summary
  const profitablePeriodsCount = activePeriodicSummaries.filter((s) => s.netPnlUsd > 0).length;
  const profitablePeriodsPercent =
    activePeriodicSummaries.length > 0
      ? +((profitablePeriodsCount / activePeriodicSummaries.length) * 100).toFixed(1)
      : 0;
  const bestPeriod =
    activePeriodicSummaries.length > 0
      ? [...activePeriodicSummaries].sort((a, b) => b.netPnlUsd - a.netPnlUsd)[0]
      : null;
  const avgPnlPerPeriod =
    activePeriodicSummaries.length > 0
      ? +(totalClosedRealizedPnl / activePeriodicSummaries.length).toFixed(2)
      : 0;

  // Render Equity Chart
  const renderEquityCurve = () => {
    const history = portfolio.equityHistory || [{ timestamp: Date.now(), equityUsd: 100 }];
    const points =
      history.length > 1
        ? history
        : [...history, { timestamp: Date.now() + 1000, equityUsd: portfolio.totalEquityUsd }];

    const maxVal = Math.max(...points.map((p) => p.equityUsd), 110);
    const minVal = Math.min(...points.map((p) => p.equityUsd), 80);
    const range = maxVal - minVal || 1;

    const width = 640;
    const height = 130;
    const padX = 20;
    const padY = 20;

    const svgPoints = points
      .map((p, i) => {
        const x = padX + (i / (points.length - 1)) * (width - padX * 2);
        const y = height - padY - ((p.equityUsd - minVal) / range) * (height - padY * 2);
        return `${x},${y}`;
      })
      .join(' ');

    const isProfitable = portfolio.totalEquityUsd >= portfolio.totalDemoCapitalLoaded;

    return (
      <div className="bg-cyber-bg/90 p-4 rounded-xl border border-cyber-border">
        <div className="flex justify-between items-center mb-2">
          <span className="text-xs font-bold text-slate-300 flex items-center space-x-1.5">
            <TrendingUp className="w-4 h-4 text-emerald-400" />
            <span>Autonomous Demo Bankroll Equity Curve ($100 Starting)</span>
          </span>
          <span
            className={`text-xs font-mono font-bold ${
              isProfitable ? 'text-emerald-400' : 'text-crimson'
            }`}
          >
            ${portfolio.totalEquityUsd.toFixed(2)} ({isProfitable ? '+' : ''}
            {netPnlPercent.toFixed(1)}%)
          </span>
        </div>

        <div className="w-full overflow-hidden">
          <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-28">
            <defs>
              <linearGradient id="demoGrad" x1="0" y1="0" x2="0" y2="1">
                <stop
                  offset="0%"
                  stopColor={isProfitable ? '#10B981' : '#F43F5E'}
                  stopOpacity="0.3"
                />
                <stop
                  offset="100%"
                  stopColor={isProfitable ? '#10B981' : '#F43F5E'}
                  stopOpacity="0.0"
                />
              </linearGradient>
            </defs>
            <line
              x1={padX}
              y1={height / 2}
              x2={width - padX}
              y2={height / 2}
              stroke="#1e293b"
              strokeDasharray="3 3"
            />
            <polyline
              fill="none"
              stroke={isProfitable ? '#10B981' : '#F43F5E'}
              strokeWidth="2.5"
              points={svgPoints}
            />
          </svg>
        </div>
      </div>
    );
  };

  // Render Profitability Milestone Ladder & Target Optimizer (MFE Analytics)
  const renderProfitabilityMilestoneLadder = () => {
    const {
      milestones,
      totalTradesTracked,
      avgPeakPnlAllPercent,
      avgPeakPnlWinnersPercent,
      avgPeakPnlLossesPercent,
      optimalTakeProfitTargetPercent,
      tradesReversingAfterProfitCount,
    } = activeProfitLadder;

    return (
      <div className="bg-cyber-card rounded-2xl border border-cyber-border p-5 space-y-4 shadow-xl relative overflow-hidden">
        {/* Subtle Ambient Glow */}
        <div className="absolute top-0 right-1/4 w-96 h-24 bg-cyan-500/10 rounded-full blur-3xl pointer-events-none" />

        {/* Header */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 border-b border-cyber-border/70 pb-3">
          <div className="flex items-center space-x-2.5">
            <div className="p-2 rounded-xl bg-cyan-500/10 border border-cyan-500/30 text-cyan-400">
              <Target className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h3 className="text-sm font-black text-white tracking-tight">
                  Profitability Milestone Ladder & Target Optimizer
                </h3>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-cyan-500/20 text-cyan-300 border border-cyan-500/40">
                  MFE Engine
                </span>
              </div>
              <p className="text-[11px] text-slate-400">
                Maximum Favorable Excursion analysis &mdash; tracking profit levels trades hit before reversing to discover optimal Take-Profit targets.
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-2 self-end sm:self-center">
            <button
              onClick={() => setShowMilestoneLadder(!showMilestoneLadder)}
              className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-slate-900 hover:bg-slate-800 text-slate-300 border border-cyber-border transition-colors flex items-center space-x-1.5"
            >
              <span>{showMilestoneLadder ? 'Collapse Ladder' : 'Expand Ladder'}</span>
              {showMilestoneLadder ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
            </button>
          </div>
        </div>

        {showMilestoneLadder && (
          <div className="space-y-4">
            {/* Top Stat Cards Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {/* Optimal Target Card */}
              <div className="bg-slate-950/70 p-3 rounded-xl border border-cyan-500/40 relative">
                <div className="text-[10px] text-cyan-400 font-bold uppercase tracking-wider flex items-center space-x-1">
                  <Sparkles className="w-3 h-3" />
                  <span>Optimal Take-Profit</span>
                </div>
                <div className="text-xl sm:text-2xl font-black text-white font-mono mt-0.5">
                  +{optimalTakeProfitTargetPercent}%
                </div>
                <div className="text-[10px] text-slate-400 mt-0.5 leading-tight">
                  Calibrated for highest EV hit rate
                </div>
              </div>

              {/* Avg Peak All Trades */}
              <div className="bg-slate-950/70 p-3 rounded-xl border border-cyber-border">
                <div className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">
                  Avg Peak (All Trades)
                </div>
                <div className="text-xl sm:text-2xl font-black text-cyan-300 font-mono mt-0.5">
                  +{avgPeakPnlAllPercent}%
                </div>
                <div className="text-[10px] text-slate-500 mt-0.5 leading-tight">
                  Across {totalTradesTracked} total evaluated
                </div>
              </div>

              {/* Avg Peak on Stopped-Out Trades */}
              <div className="bg-slate-950/70 p-3 rounded-xl border border-rose-500/30">
                <div className="text-[10px] text-rose-400 font-bold uppercase tracking-wider flex items-center space-x-1">
                  <Shield className="w-3 h-3" />
                  <span>Peak on Stop-Outs</span>
                </div>
                <div className="text-xl sm:text-2xl font-black text-rose-300 font-mono mt-0.5">
                  +{avgPeakPnlLossesPercent}%
                </div>
                <div className="text-[10px] text-slate-400 mt-0.5 leading-tight">
                  Profit reached before retracement
                </div>
              </div>

              {/* Reversals Defended */}
              <div className="bg-slate-950/70 p-3 rounded-xl border border-emerald-500/30">
                <div className="text-[10px] text-emerald-400 font-bold uppercase tracking-wider flex items-center space-x-1">
                  <Zap className="w-3 h-3" />
                  <span>Reversals Defended</span>
                </div>
                <div className="text-xl sm:text-2xl font-black text-emerald-300 font-mono mt-0.5">
                  {tradesReversingAfterProfitCount} Trades
                </div>
                <div className="text-[10px] text-slate-400 mt-0.5 leading-tight">
                  Peaked &ge; +15% before pullback
                </div>
              </div>
            </div>

            {/* 6-Tier Progression Ladder */}
            <div className="bg-slate-950/60 p-4 rounded-xl border border-cyber-border space-y-3">
              <div className="flex items-center justify-between text-xs font-bold text-slate-300">
                <span className="flex items-center space-x-1.5">
                  <BarChart3 className="w-4 h-4 text-cyber-accent" />
                  <span>Profitability Milestone Conversion Rates (% of Trades Reaching Target)</span>
                </span>
                <span className="text-[11px] text-slate-400 font-mono">
                  Sample: {totalTradesTracked} trades
                </span>
              </div>

              <div className="space-y-2.5 pt-1">
                {milestones.map((m) => {
                  const isOptimal = m.milestonePercent === optimalTakeProfitTargetPercent;
                  const isHighRate = m.hitRatePercent >= 50;
                  const isMediumRate = m.hitRatePercent >= 25;

                  return (
                    <div key={m.milestonePercent} className="space-y-1">
                      <div className="flex items-center justify-between text-xs">
                        <div className="flex items-center space-x-2">
                          <span className="font-bold text-white font-mono w-28">
                            {m.label}
                          </span>
                          {isOptimal && (
                            <span className="px-1.5 py-0.2 rounded text-[9px] font-extrabold bg-cyan-500/20 text-cyan-300 border border-cyan-500/50">
                              RECOMMENDED TARGET
                            </span>
                          )}
                        </div>
                        <div className="flex items-center space-x-2 font-mono">
                          <span className="text-slate-400 text-[11px]">
                            {m.hitCount} / {m.totalEvaluated} trades
                          </span>
                          <span
                            className={`font-black text-xs ${
                              isHighRate
                                ? 'text-emerald-400'
                                : isMediumRate
                                ? 'text-cyan-400'
                                : 'text-slate-400'
                            }`}
                          >
                            {m.hitRatePercent.toFixed(1)}%
                          </span>
                        </div>
                      </div>

                      {/* Bar */}
                      <div className="h-2.5 w-full bg-slate-900 rounded-full overflow-hidden border border-slate-800">
                        <div
                          className={`h-full rounded-full transition-all duration-500 ${
                            isOptimal
                              ? 'bg-gradient-to-r from-cyan-500 to-emerald-400 shadow-sm shadow-cyan-500/50'
                              : isHighRate
                              ? 'bg-gradient-to-r from-emerald-600 to-emerald-400'
                              : isMediumRate
                              ? 'bg-gradient-to-r from-cyan-600 to-cyan-400'
                              : 'bg-gradient-to-r from-purple-600 to-slate-500'
                          }`}
                          style={{ width: `${Math.max(m.hitRatePercent, 2)}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Smart Autonomous Mechanism Status Footer */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-2.5 pt-1 text-[11px] font-sans">
              <div className="bg-slate-900/60 p-2.5 rounded-lg border border-slate-800/80 flex items-start space-x-2">
                <span className="text-base">🛡️</span>
                <div>
                  <span className="font-bold text-white">Breakeven Ratchet:</span>
                  <p className="text-slate-400 text-[10px] leading-relaxed">
                    At +20% unrealized gain, stop-loss ratchets to Entry + 3% to guarantee zero-loss exit.
                  </p>
                </div>
              </div>

              <div className="bg-slate-900/60 p-2.5 rounded-lg border border-slate-800/80 flex items-start space-x-2">
                <span className="text-base">🎯</span>
                <div>
                  <span className="font-bold text-white">Dynamic Trailing Stop:</span>
                  <p className="text-slate-400 text-[10px] leading-relaxed">
                    At +30% gain, activates trailing stop 15% below peak to lock in breakout profits.
                  </p>
                </div>
              </div>

              <div className="bg-slate-900/60 p-2.5 rounded-lg border border-slate-800/80 flex items-start space-x-2">
                <span className="text-base">⏱️</span>
                <div>
                  <span className="font-bold text-white">45m Anti-Churn Cooldown:</span>
                  <p className="text-slate-400 text-[10px] leading-relaxed">
                    Stopped-out tokens are blacklisted for 45 minutes to prevent re-entering dumping knives.
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-6">
      {/* Dual Engine Switcher Tabs */}
      <div className="flex flex-col sm:flex-row items-center bg-slate-900/90 p-2 rounded-2xl border border-cyber-border shadow-xl gap-2">
        <button
          onClick={() => onSelectBotMode && onSelectBotMode('copy')}
          className={`flex-1 w-full py-3 px-4 rounded-xl text-xs font-semibold flex items-center justify-between transition-all ${
            botMode !== 'gem_radar'
              ? 'bg-purple-950/70 border border-purple-500/80 text-purple-100 shadow-lg shadow-purple-900/30'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/40 border border-transparent'
          }`}
        >
          <div className="flex items-center space-x-2.5">
            <div className="w-7 h-7 rounded-lg bg-purple-500/20 border border-purple-500/40 flex items-center justify-center">
              <Bot className="w-4 h-4 text-purple-400" />
            </div>
            <div className="text-left">
              <div className="font-bold text-slate-100">Smart Money Copy Bot</div>
              <div className="text-[10px] text-slate-400">Verified Solana Whales &bull; 15m Recency Guard &bull; On-Chain Holding Check</div>
            </div>
          </div>
          {copyPortfolio && (
            <div className="text-right">
              <div className="text-xs font-mono font-bold text-purple-300">${copyPortfolio.totalEquityUsd.toFixed(2)}</div>
              <div className="text-[10px] font-mono text-slate-400">Bankroll: ${copyPortfolio.startingCash || 1000}</div>
            </div>
          )}
        </button>

        <button
          onClick={() => onSelectBotMode && onSelectBotMode('gem_radar')}
          className={`flex-1 w-full py-3 px-4 rounded-xl text-xs font-semibold flex items-center justify-between transition-all ${
            botMode === 'gem_radar'
              ? 'bg-amber-950/70 border border-amber-500/80 text-amber-100 shadow-lg shadow-amber-900/30'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/40 border border-transparent'
          }`}
        >
          <div className="flex items-center space-x-2.5">
            <div className="w-7 h-7 rounded-lg bg-amber-500/20 border border-amber-500/40 flex items-center justify-center">
              <Zap className="w-4 h-4 text-amber-400" />
            </div>
            <div className="text-left">
              <div className="font-bold text-slate-100">Gem Radar Breakout Hunter</div>
              <div className="text-[10px] text-slate-400">5-Min Volume Velocity &bull; Early Bonding Curves &bull; DexScreener Live</div>
            </div>
          </div>
          {gemPortfolio && (
            <div className="text-right">
              <div className="text-xs font-mono font-bold text-amber-300">${gemPortfolio.totalEquityUsd.toFixed(2)}</div>
              <div className="text-[10px] font-mono text-slate-400">Bankroll: ${gemPortfolio.startingCash || 1000}</div>
            </div>
          )}
        </button>
      </div>

      {/* 24/7 Autonomous Server Daemon Live Status Banner */}
      <div className="bg-gradient-to-r from-slate-900/95 via-emerald-950/20 to-slate-900/95 border border-emerald-500/30 rounded-2xl p-4 shadow-xl flex flex-col md:flex-row items-start md:items-center justify-between gap-3">
        <div className="flex items-center space-x-3">
          <div className="relative flex items-center justify-center w-8 h-8 rounded-xl bg-emerald-500/20 border border-emerald-500/40 shrink-0">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-400"></span>
            <span className="absolute w-4 h-4 rounded-full border border-emerald-400 animate-ping opacity-60"></span>
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <span className="text-xs font-bold text-white tracking-wide uppercase flex items-center space-x-1.5">
                <span>24/7 Autonomous Server Engine: ACTIVE</span>
              </span>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-300">
                Solana Mainnet
              </span>
            </div>
            <p className="text-[11px] text-slate-400 mt-0.5">
              Runs continuously in the background on the server every 20s. Scans live swaps &amp; breakout setups even when your browser is closed.
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 text-[11px] font-mono">
          <div className="px-2.5 py-1 rounded-lg bg-slate-800/80 border border-slate-700/60 text-slate-300 flex items-center space-x-1.5">
            <Clock className="w-3.5 h-3.5 text-cyan-400" />
            <span>
              Last Server Tick:{' '}
              {serverWorker?.lastTickTimestamp
                ? `${Math.max(1, Math.round((Date.now() - serverWorker.lastTickTimestamp) / 1000))}s ago`
                : 'Active (20s cycle)'}
            </span>
          </div>
          <div className="px-2.5 py-1 rounded-lg bg-slate-800/80 border border-slate-700/60 text-slate-300 flex items-center space-x-1.5">
            <Activity className="w-3.5 h-3.5 text-emerald-400" />
            <span>Ticks: {serverWorker?.totalTicksExecuted || 0}</span>
          </div>
          <div className="px-2.5 py-1 rounded-lg bg-slate-800/80 border border-slate-700/60 text-slate-300 flex items-center space-x-1.5">
            <Shield className="w-3.5 h-3.5 text-purple-400" />
            <span>Disk Synced</span>
          </div>
        </div>
      </div>

      {/* Top Banner: Status & Controls */}
      <div className="bg-gradient-to-r from-slate-900 via-cyber-card to-slate-900 p-6 rounded-2xl border border-cyber-border shadow-2xl flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center space-x-2.5">
            <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
              botMode === 'gem_radar' ? 'bg-amber-500/20 border border-amber-500/40' : 'bg-emerald-500/20 border border-emerald-500/40'
            }`}>
              {botMode === 'gem_radar' ? (
                <Zap className="w-5 h-5 text-amber-400" />
              ) : (
                <Bot className="w-5 h-5 text-emerald-400" />
              )}
            </div>
            <h2 className="text-xl font-bold text-white tracking-wide">
              {botMode === 'gem_radar' ? 'Gem Radar Breakout Hunter ($1,000 Bankroll)' : 'Smart Money Copy-Trade Bot ($1,000 Bankroll)'}
            </h2>
            <span
              className={`px-2.5 py-0.5 rounded-full text-xs font-mono font-bold flex items-center space-x-1.5 ${
                portfolio.isBotRunning
                  ? 'bg-emerald-950/80 border border-emerald-500/50 text-emerald-300'
                  : 'bg-amber-950/80 border border-amber-500/50 text-amber-300'
              }`}
            >
              <span
                className={`w-2 h-2 rounded-full ${
                  portfolio.isBotRunning ? 'bg-emerald-400 animate-ping' : 'bg-amber-400'
                }`}
              ></span>
              <span>{portfolio.isBotRunning ? 'RUNNING AUTONOMOUSLY' : 'PAUSED'}</span>
            </span>
          </div>
          <div className="flex flex-wrap items-center gap-2 pt-0.5">
            <span className="px-2.5 py-0.5 rounded-full text-[11px] font-mono font-medium bg-purple-950/80 border border-purple-500/50 text-purple-300 flex items-center space-x-1">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
              <span>100% Live Solana Spot Pricing (Birdeye &amp; DexScreener)</span>
            </span>
            <span className="px-2.5 py-0.5 rounded-full text-[11px] font-mono text-slate-400 bg-slate-900 border border-slate-700/60">
              Avg Solana Gas: $0.005
            </span>
            {botMode === 'gem_radar' ? (
              <span className="px-2.5 py-0.5 rounded-full text-[11px] font-mono text-amber-300 bg-amber-950/80 border border-amber-500/50">
                Strategy: Velocity Breakout Sniper
              </span>
            ) : (
              <span className="px-2.5 py-0.5 rounded-full text-[11px] font-mono text-purple-300 bg-purple-950/80 border border-purple-500/50">
                Strategy: Verified Whale Follower
              </span>
            )}
          </div>
          <p className="text-xs text-slate-400 pt-0.5">
            {botMode === 'gem_radar'
              ? `Auto-buys and sells high-probability early breakout gems surfaced by the Gem Radar when 5m volume velocity spikes and liquidity is locked.`
              : `Monitors tracked Solana smart money trades on Helius and only executes entries when whale holding is confirmed and conviction \u2265 ${portfolio.minConvictionThreshold}%.`}
          </p>
        </div>

        {/* Bot Controls, Reload & Reset Buttons */}
        <div className="flex flex-wrap items-center gap-2.5 w-full md:w-auto">
          <button
            onClick={onTick}
            className="px-3.5 py-2 rounded-xl text-xs font-semibold bg-cyber-accent text-slate-950 hover:bg-cyber-accent/90 transition-all flex items-center space-x-1.5 shadow-md shadow-cyber-accent/20"
            title="Fetch live market spot prices and evaluate trades"
          >
            <Zap className="w-4 h-4 fill-slate-950 text-slate-950" />
            <span>Live Spot Tick</span>
          </button>

          <button
            onClick={onToggleBot}
            className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all flex items-center space-x-1.5 ${
              portfolio.isBotRunning
                ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40 hover:bg-amber-500/30'
                : 'bg-emerald-500 text-slate-950 hover:bg-emerald-400 font-bold shadow-lg shadow-emerald-500/20'
            }`}
          >
            {portfolio.isBotRunning ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
            <span>{portfolio.isBotRunning ? 'Pause Bot' : 'Start Auto'}</span>
          </button>

          <button
            onClick={onReload}
            className="px-3.5 py-2 rounded-xl text-xs font-bold bg-blue-600 hover:bg-blue-500 text-white shadow-lg transition-colors flex items-center space-x-1.5"
            title="Add another demo $100 immediately"
          >
            <RotateCcw className="w-4 h-4" />
            <span>Reload $100</span>
          </button>

          {onReset && (
            <button
              onClick={() => {
                if (window.confirm('Reset both portfolios to a fresh $1,000 clean slate? This will clear previous closed trades and open positions to benchmark the new v2.2 enhancements.')) {
                  onReset();
                }
              }}
              className="px-3 py-2 rounded-xl text-xs font-semibold bg-rose-950/70 hover:bg-rose-900/90 text-rose-300 border border-rose-500/40 transition-colors flex items-center space-x-1.5"
              title="Reset both bots to pristine $1,000 clean slate"
            >
              <Trash2 className="w-3.5 h-3.5 text-rose-400" />
              <span>Reset Data</span>
            </button>
          )}
        </div>
      </div>

      {/* Financial Health Grid with Timeframe Filter Bar */}
      <div className="space-y-2.5">
        {/* Metric Timeframe Switcher */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 px-1">
          <span className="text-xs text-slate-400 font-medium flex items-center space-x-1.5">
            <BarChart3 className="w-3.5 h-3.5 text-cyber-accent" />
            <span>Portfolio Performance Overview</span>
          </span>

          <div className="flex items-center space-x-1 bg-slate-900/90 p-1 rounded-lg border border-cyber-border text-xs">
            <span className="text-[10px] text-slate-400 font-semibold px-2 uppercase">P/L Period:</span>
            {(['all', '24h', '7d', '30d'] as const).map((tf) => (
              <button
                key={tf}
                onClick={() => setMetricTimeframe(tf)}
                className={`px-2.5 py-1 rounded text-[11px] font-bold transition-all ${
                  metricTimeframe === tf
                    ? 'bg-cyber-accent text-slate-950 shadow-md'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                {tf === 'all'
                  ? 'All-Time'
                  : tf === '24h'
                  ? 'Today (24h)'
                  : tf === '7d'
                  ? 'This Week (7d)'
                  : 'This Month (30d)'}
              </button>
            ))}
          </div>
        </div>

        {/* 5-Card Health Grid */}
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-3.5">
          {/* Total Equity */}
          <div className="bg-cyber-card p-4 rounded-xl border border-cyber-border">
            <span className="text-[11px] text-slate-400 uppercase font-semibold">Total Portfolio Equity</span>
            <div className="font-mono text-xl font-bold text-white mt-1">
              ${portfolio.totalEquityUsd.toFixed(2)}
            </div>
            <div className="text-[11px] text-slate-400 font-mono mt-0.5">
              Initial: ${portfolio.startingCash} • Deposited: ${portfolio.totalDemoCapitalLoaded}
            </div>
          </div>

          {/* Available Cash */}
          <div className="bg-cyber-card p-4 rounded-xl border border-cyber-border">
            <span className="text-[11px] text-slate-400 uppercase font-semibold">Available Free Cash</span>
            <div className="font-mono text-xl font-bold text-slate-200 mt-1">
              ${portfolio.currentCash.toFixed(2)}
            </div>
            <div className="text-[11px] text-slate-400 font-mono mt-0.5">
              ${portfolio.allocationPerTradeUsd}/trade sizing
            </div>
          </div>

          {/* Invested in Positions */}
          <div className="bg-cyber-card p-4 rounded-xl border border-cyber-border">
            <span className="text-[11px] text-slate-400 uppercase font-semibold">Invested in Positions</span>
            <div className="font-mono text-xl font-bold text-cyber-accent mt-1">
              ${portfolio.investedInPositionsUsd.toFixed(2)}
            </div>
            <div className="text-[11px] text-slate-400 font-mono mt-0.5">
              {openPositions.length} active position{openPositions.length === 1 ? '' : 's'}
            </div>
          </div>

          {/* Realized Net P&L (Reflects Metric Timeframe) */}
          <div className="bg-cyber-card p-4 rounded-xl border border-cyber-border">
            <div className="flex items-center justify-between">
              <span className="text-[11px] text-slate-400 uppercase font-semibold">
                Realized P/L ({metricTimeframe === 'all' ? 'All' : metricTimeframe})
              </span>
              <span className="text-[9px] font-mono font-bold px-1.5 py-0.2 rounded bg-slate-800 text-slate-300">
                {metricTimeframe === 'all'
                  ? 'All-Time'
                  : metricTimeframe === '24h'
                  ? 'Today'
                  : metricTimeframe === '7d'
                  ? '7 Days'
                  : '30 Days'}
              </span>
            </div>
            <div
              className={`font-mono text-xl font-bold mt-1 ${
                timeframeMetrics.realizedPnl >= 0 ? 'text-emerald-400' : 'text-crimson'
              }`}
            >
              {timeframeMetrics.realizedPnl >= 0 ? '+' : ''}${timeframeMetrics.realizedPnl.toFixed(2)}
            </div>
            <div className="text-[11px] text-slate-400 font-mono mt-0.5">
              {timeframeMetrics.wins}W / {timeframeMetrics.losses}L ({timeframeMetrics.winRate}%)
            </div>
          </div>

          {/* Auto Reload Status */}
          <div className="bg-cyber-card p-4 rounded-xl border border-cyber-border col-span-2 lg:col-span-1">
            <span className="text-[11px] text-slate-400 uppercase font-semibold">Auto-Reload Status</span>
            <div className="font-mono text-sm font-bold text-slate-200 mt-1 flex items-center space-x-1.5">
              <span
                className={`w-2 h-2 rounded-full ${
                  portfolio.isAutoReloadEnabled ? 'bg-emerald-400' : 'bg-slate-500'
                }`}
              ></span>
              <span>{portfolio.isAutoReloadEnabled ? 'Auto-Reload ON' : 'Manual Only'}</span>
            </div>
            <div className="text-[11px] text-slate-400 font-mono mt-0.5">
              Reloads triggered: <strong className="text-white">{portfolio.reloadCount}</strong>
            </div>
          </div>
        </div>

        {/* Real-Time Risk & Exposure Telemetry Bar */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-slate-900/80 p-3 rounded-xl border border-cyber-border/70 text-xs">
          <div className="flex flex-col sm:flex-row sm:items-center space-y-0.5 sm:space-y-0 sm:space-x-2">
            <span className="text-slate-400 text-[11px]">Peak Equity:</span>
            <span className="font-mono font-bold text-emerald-400">
              ${(portfolio.peakEquityUsd || portfolio.totalEquityUsd).toFixed(2)}
            </span>
          </div>
          <div className="flex flex-col sm:flex-row sm:items-center space-y-0.5 sm:space-y-0 sm:space-x-2">
            <span className="text-slate-400 text-[11px]">Max Drawdown:</span>
            <span className="font-mono font-bold text-amber-400">
              -${(portfolio.maxDrawdownUsd || 0).toFixed(2)} ({(portfolio.maxDrawdownPercent || 0).toFixed(2)}%)
            </span>
          </div>
          <div className="flex flex-col sm:flex-row sm:items-center space-y-0.5 sm:space-y-0 sm:space-x-2">
            <span className="text-slate-400 text-[11px]">Max Simultaneous Trades:</span>
            <span className="font-mono font-bold text-cyber-accent">
              {portfolio.maxSimultaneousPositionsObserved || openPositions.length} positions
            </span>
          </div>
          <div className="flex flex-col sm:flex-row sm:items-center space-y-0.5 sm:space-y-0 sm:space-x-2">
            <span className="text-slate-400 text-[11px]">Concurrency Limit:</span>
            <span className="font-mono text-slate-300">
              Max {portfolio.maxConcurrentPositions} (1 entry/tick)
            </span>
          </div>
        </div>

        {/* V3.2 Institutional Risk Budgeting & Sleep Protection Status */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 bg-slate-900/90 p-3 rounded-xl border border-indigo-500/30 text-xs">
          {/* Active Hours / Sleep Protection Guard */}
          <div className="flex items-center justify-between p-2.5 bg-slate-950/70 rounded-lg border border-slate-800">
            <div className="flex items-center space-x-2.5">
              <div className={`w-2.5 h-2.5 rounded-full ${activeHoursCheck.allowed ? 'bg-emerald-400 animate-pulse' : 'bg-amber-400'}`} />
              <div>
                <div className="text-[10px] text-slate-400 uppercase font-semibold">Active Market Window</div>
                <div className="font-bold text-white text-xs mt-0.5 flex items-center space-x-1.5">
                  <span>{activeHoursCheck.allowed ? '🟢 Live US Market Session' : '🌙 Sleep Protection Active'}</span>
                  <span className="text-[10px] font-mono text-slate-400 font-normal">({activeHoursCheck.currentUtcTime})</span>
                </div>
              </div>
            </div>
            <div className="text-right">
              <span className={`text-[10px] px-2 py-0.5 rounded font-mono font-medium ${activeHoursCheck.allowed ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30' : 'bg-amber-500/20 text-amber-300 border border-amber-500/30'}`}>
                {activeHoursCheck.allowed ? '13:30 - 22:00 UTC' : 'New Entries Paused'}
              </span>
            </div>
          </div>

          {/* Institutional Risk Budgeting Sizing Formula */}
          <div className="flex items-center justify-between p-2.5 bg-slate-950/70 rounded-lg border border-slate-800">
            <div>
              <div className="text-[10px] text-slate-400 uppercase font-semibold">Risk Budgeting Formula (12 Slots)</div>
              <div className="font-bold text-white text-xs mt-0.5 flex items-center space-x-1.5">
                <span className="text-cyber-accent font-mono">${currentTradeAllocation.toFixed(2)}/trade</span>
                <span className="text-[10px] text-slate-400 font-mono font-normal">(${portfolio.totalEquityUsd.toFixed(0)} ÷ 12)</span>
              </div>
            </div>
            <div className="text-right">
              <span className="text-[10px] px-2 py-0.5 rounded bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 font-mono">
                5 Concur + 4 DD + 2 Safety
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Mathematical Equity Reconciliation Box (Proof of Zero Double-Counting / Zero Inflation) */}
      <div className="bg-slate-900/95 rounded-xl border border-emerald-500/30 p-4 shadow-xl">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 pb-3 border-b border-cyber-border">
          <div className="flex items-center space-x-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
            <span className="text-xs font-bold text-white uppercase tracking-wider">
              Audited Portfolio Balance & Math Invariant (Zero Inflation Guarantee)
            </span>
            <span className="text-[10px] px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 font-mono">
              Strict Mathematical Rigor
            </span>
          </div>
          <button
            onClick={() => setShowMathExplainer(!showMathExplainer)}
            className="text-[11px] text-cyber-accent hover:underline flex items-center space-x-1"
          >
            <span>{showMathExplainer ? 'Hide Formula Details' : 'Show Formula Details'}</span>
            <ChevronDown
              className={`w-3.5 h-3.5 transition-transform ${showMathExplainer ? 'rotate-180' : ''}`}
            />
          </button>
        </div>

        {showMathExplainer && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 pt-3">
            <div className="bg-slate-950/70 p-3 rounded-lg border border-slate-800">
              <div className="text-[10px] text-slate-400 font-semibold uppercase">1. Available Free Cash</div>
              <div className="text-lg font-mono font-bold text-white mt-0.5">
                ${portfolio.currentCash.toFixed(2)}
              </div>
              <div className="text-[10px] text-slate-400 mt-0.5 font-mono">
                Formula: Deposited ($100) + Realized P&L (+${portfolio.totalRealizedPnlUsd.toFixed(2)}) - Invested ($40)
              </div>
            </div>

            <div className="bg-slate-950/70 p-3 rounded-lg border border-slate-800">
              <div className="text-[10px] text-slate-400 font-semibold uppercase">2. Open Positions Value</div>
              <div className="text-lg font-mono font-bold text-cyber-accent mt-0.5">
                +${currentOpenMarketValue.toFixed(2)}
              </div>
              <div className="text-[10px] text-slate-400 mt-0.5 font-mono">
                Invested: ${portfolio.investedInPositionsUsd.toFixed(2)} • Unrealized: {portfolio.totalUnrealizedPnlUsd >= 0 ? '+' : ''}${portfolio.totalUnrealizedPnlUsd.toFixed(2)}
              </div>
            </div>

            <div className="bg-slate-950/70 p-3 rounded-lg border border-emerald-500/40 bg-emerald-950/10">
              <div className="text-[10px] text-emerald-400 font-semibold uppercase">3. Total Portfolio Equity</div>
              <div className="text-lg font-mono font-bold text-white mt-0.5">
                =${portfolio.totalEquityUsd.toFixed(2)}
              </div>
              <div className="text-[10px] text-emerald-300 mt-0.5 font-mono">
                Sum: Cash (${portfolio.currentCash.toFixed(2)}) + Open Positions (${currentOpenMarketValue.toFixed(2)})
              </div>
            </div>

            <div className="bg-slate-950/70 p-3 rounded-lg border border-slate-800">
              <div className="text-[10px] text-slate-400 font-semibold uppercase">4. Net Profit Since Inception</div>
              <div
                className={`text-lg font-mono font-bold mt-0.5 ${
                  netPnlPercent >= 0 ? 'text-emerald-400' : 'text-crimson'
                }`}
              >
                {netPnlPercent >= 0 ? '+' : ''}${(portfolio.totalEquityUsd - portfolio.totalDemoCapitalLoaded).toFixed(2)} ({netPnlPercent >= 0 ? '+' : ''}{netPnlPercent.toFixed(1)}%)
              </div>
              <div className="text-[10px] text-slate-400 mt-0.5 font-mono">
                Capital Loaded: ${portfolio.totalDemoCapitalLoaded.toFixed(2)}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Live Equity Curve */}
      {renderEquityCurve()}

      {/* Profitability Milestone Ladder & Target Optimizer (MFE Analytics) */}
      {renderProfitabilityMilestoneLadder()}

      {/* Tab Switcher: Active Positions vs Closed Trades History */}
      <div className="flex items-center justify-between border-b border-cyber-border/80 pb-2">
        <div className="flex items-center space-x-2">
          <button
            onClick={() => setActiveStudioTab('positions')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center space-x-2 ${
              activeStudioTab === 'positions'
                ? 'bg-cyber-accent text-slate-950 shadow-lg shadow-cyber-accent/20'
                : 'bg-slate-900 text-slate-400 hover:text-slate-200 border border-cyber-border'
            }`}
          >
            <Target className="w-4 h-4" />
            <span>Active Open Positions</span>
            <span
              className={`px-1.5 py-0.2 rounded-full text-[10px] font-mono ${
                activeStudioTab === 'positions' ? 'bg-slate-950/40 text-slate-950' : 'bg-slate-800 text-slate-300'
              }`}
            >
              {openPositions.length}
            </span>
          </button>

          <button
            onClick={() => setActiveStudioTab('history')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center space-x-2 ${
              activeStudioTab === 'history'
                ? 'bg-emerald-500 text-slate-950 shadow-lg shadow-emerald-500/20'
                : 'bg-slate-900 text-slate-400 hover:text-slate-200 border border-cyber-border'
            }`}
          >
            <History className="w-4 h-4" />
            <span>Closed Trades & P/L Ledger</span>
            <span
              className={`px-1.5 py-0.2 rounded-full text-[10px] font-mono ${
                activeStudioTab === 'history' ? 'bg-slate-950/40 text-slate-950' : 'bg-slate-800 text-slate-300'
              }`}
            >
              {closedTrades.length}
            </span>
          </button>

          <button
            onClick={() => setActiveStudioTab('hourly')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center space-x-2 ${
              activeStudioTab === 'hourly'
                ? 'bg-amber-400 text-slate-950 shadow-lg shadow-amber-400/20'
                : 'bg-slate-900 text-slate-400 hover:text-slate-200 border border-cyber-border'
            }`}
          >
            <Clock className="w-4 h-4" />
            <span>Hourly Analytics</span>
            <span
              className={`px-1.5 py-0.2 rounded-full text-[10px] font-mono ${
                activeStudioTab === 'hourly' ? 'bg-slate-950/40 text-slate-950' : 'bg-slate-800 text-slate-300'
              }`}
            >
              24h Window
            </span>
          </button>
        </div>

        <div className="hidden sm:block text-xs text-slate-400 font-mono">
          {activeStudioTab === 'positions'
            ? `Max ${portfolio.maxConcurrentPositions} positions allowed concurrently`
            : activeStudioTab === 'history'
            ? `${closedWins} Wins / ${closedLosses} Losses recorded`
            : '24-Hour Market Session Win Rate & P&L Matrix'}
        </div>
      </div>

      {/* SECTION 1: Active Open Positions Table */}
      {activeStudioTab === 'positions' && (
        <div className="bg-cyber-card rounded-xl border border-cyber-border p-5 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <Target className="w-4 h-4 text-emerald-400" />
              <h3 className="font-bold text-sm text-white">
                Live Open Positions ({openPositions.length})
              </h3>
            </div>
            <span className="text-xs text-slate-400">
              Monitored in real-time against dynamic TP (+100%) and Stop-Loss ({portfolio.stopLossPercent}%)
            </span>
          </div>

          {openPositions.length === 0 ? (
            <div className="text-center py-10 border border-dashed border-cyber-border rounded-xl">
              <AlertCircle className="w-8 h-8 text-slate-500 mx-auto mb-2" />
              <p className="text-xs text-slate-400">No active positions open right now.</p>
              <p className="text-[11px] text-slate-500 mt-1">
                The bot is actively scanning multi-chain smart money trades and will automatically enter when conviction &ge; {portfolio.minConvictionThreshold}%.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto border border-cyber-border rounded-xl">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-900 text-slate-400 font-semibold border-b border-cyber-border">
                  <tr>
                    <th className="py-3 px-3.5">Token</th>
                    <th className="py-3 px-3.5">Chain</th>
                    <th className="py-3 px-3.5">Triggered By</th>
                    <th className="py-3 px-3.5 text-right">Entry / Current Price</th>
                    <th className="py-3 px-3.5 text-right">Invested</th>
                    <th className="py-3 px-3.5 text-right">Unrealized P&L</th>
                    <th className="py-3 px-3.5 text-center">TP / SL Targets</th>
                    <th className="py-3 px-3.5 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-cyber-border/60 font-mono">
                  {openPositions.map((pos) => {
                    const chain = SUPPORTED_CHAINS[pos.chain];
                    return (
                      <tr key={pos.id} className="hover:bg-slate-900/40">
                        <td className="py-3 px-3.5">
                          <div className="font-bold text-white">{pos.tokenSymbol}</div>
                          <div className="text-[10px] text-slate-500 font-sans">{pos.tokenName}</div>
                        </td>
                        <td className="py-3 px-3.5">
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-semibold border ${chain.badgeBg}`}
                          >
                            {chain.name}
                          </span>
                        </td>
                        <td className="py-3 px-3.5 text-slate-300 font-sans text-xs">
                          {pos.copiedFromWalletLabel}
                          <div className="text-[10px] text-slate-500 font-mono">
                            Conviction: {pos.alphaScoreAtEntry}/100
                          </div>
                        </td>
                        <td className="py-3 px-3.5 text-right">
                          <div className="text-slate-300">${pos.currentPriceUsd}</div>
                          <div className="text-[10px] text-slate-500">Entry: ${pos.entryPriceUsd}</div>
                        </td>
                        <td className="py-3 px-3.5 text-right font-bold text-slate-200">
                          ${pos.investedUsd.toFixed(2)}
                        </td>
                        <td className="py-3 px-3.5 text-right">
                          <div
                            className={`font-bold ${
                              pos.pnlUsd >= 0 ? 'text-emerald-400' : 'text-crimson'
                            }`}
                          >
                            {pos.pnlUsd >= 0 ? '+' : ''}${pos.pnlUsd.toFixed(2)}
                          </div>
                          <div
                            className={`text-[10px] ${
                              pos.pnlPercent >= 0 ? 'text-emerald-400' : 'text-crimson'
                            }`}
                          >
                            ({pos.pnlPercent >= 0 ? '+' : ''}{pos.pnlPercent}%)
                          </div>
                          {pos.peakPnlPercent !== undefined && pos.peakPnlPercent > 0 && (
                            <div className="text-[10px] text-cyan-400 font-mono mt-0.5" title={`Peaked at $${pos.peakPriceUsd}`}>
                              Peak: +{pos.peakPnlPercent.toFixed(1)}%
                            </div>
                          )}
                        </td>
                        <td className="py-3 px-3.5 text-center text-[10px] space-y-1">
                          <div className="text-emerald-400">TP: ${pos.takeProfitPrice1} (+100%)</div>
                          {pos.isTrailingActive ? (
                            <div className="px-1.5 py-0.5 rounded bg-cyan-950/80 border border-cyan-500/50 text-cyan-300 font-bold inline-block">
                              🎯 Trailing SL: ${pos.stopLossPrice}
                            </div>
                          ) : pos.isBreakevenProtected ? (
                            <div className="px-1.5 py-0.5 rounded bg-indigo-950/80 border border-indigo-500/50 text-indigo-300 font-bold inline-block">
                              🛡️ Breakeven SL: ${pos.stopLossPrice} (+3%)
                            </div>
                          ) : (
                            <div className="text-rose-400">
                              SL: ${pos.stopLossPrice} ({portfolio.stopLossPercent}%)
                            </div>
                          )}
                        </td>
                        <td className="py-3 px-3.5 text-right">
                          <button
                            onClick={() => onClosePosition(pos.id)}
                            className="px-2.5 py-1 rounded bg-slate-800 hover:bg-crimson/80 hover:text-white text-slate-300 text-xs font-sans transition-colors"
                          >
                            Close
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* SECTION 2: Closed Trades & P/L Ledger with Day / Week / Month Organization */}
      {activeStudioTab === 'history' && (
        <div className="bg-cyber-card rounded-xl border border-cyber-border p-5 space-y-5">
          {/* Top Switcher: View Mode (Individual Trades vs Periodic P/L Matrix) */}
          <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-3 pb-3 border-b border-cyber-border">
            <div>
              <div className="flex items-center space-x-2">
                <History className="w-5 h-5 text-emerald-400" />
                <h3 className="font-bold text-sm text-white">
                  Autonomous Bot Trades History & P/L Matrix
                </h3>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                Organize performance by individual trades or aggregated by <strong>Day</strong>, <strong>Week</strong>, and <strong>Month</strong>.
              </p>
            </div>

            {/* Mode Switcher: Individual Trades vs Periodic P&L Breakdown */}
            <div className="flex items-center space-x-1.5 bg-slate-900 p-1 rounded-xl border border-cyber-border">
              <button
                onClick={() => setHistoryViewMode('individual')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center space-x-1.5 ${
                  historyViewMode === 'individual'
                    ? 'bg-cyber-accent text-slate-950 shadow-md'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <ListFilter className="w-3.5 h-3.5" />
                <span>Individual Trades ({closedTrades.length})</span>
              </button>

              <button
                onClick={() => setHistoryViewMode('periodic')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center space-x-1.5 ${
                  historyViewMode === 'periodic'
                    ? 'bg-emerald-500 text-slate-950 shadow-md'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <Calendar className="w-3.5 h-3.5" />
                <span>P/L by Day / Week / Month</span>
              </button>
            </div>
          </div>

          {/* VIEW MODE 1: Periodic P&L Aggregation Matrix (Day / Week / Month) */}
          {historyViewMode === 'periodic' && (
            <div className="space-y-4">
              {/* Period Granularity Selector (Day / Week / Month) */}
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                <div className="flex items-center space-x-1 bg-slate-900 p-1 rounded-xl border border-cyber-border text-xs">
                  <button
                    onClick={() => setPeriodGranularity('day')}
                    className={`px-3 py-1.5 rounded-lg font-bold transition-all flex items-center space-x-1.5 ${
                      periodGranularity === 'day'
                        ? 'bg-cyber-accent text-slate-950 shadow-md'
                        : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    <Calendar className="w-3.5 h-3.5" />
                    <span>By Day (Daily P/L)</span>
                  </button>

                  <button
                    onClick={() => setPeriodGranularity('week')}
                    className={`px-3 py-1.5 rounded-lg font-bold transition-all flex items-center space-x-1.5 ${
                      periodGranularity === 'week'
                        ? 'bg-cyber-accent text-slate-950 shadow-md'
                        : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    <CalendarDays className="w-3.5 h-3.5" />
                    <span>By Week (Weekly P/L)</span>
                  </button>

                  <button
                    onClick={() => setPeriodGranularity('month')}
                    className={`px-3 py-1.5 rounded-lg font-bold transition-all flex items-center space-x-1.5 ${
                      periodGranularity === 'month'
                        ? 'bg-cyber-accent text-slate-950 shadow-md'
                        : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    <CalendarRange className="w-3.5 h-3.5" />
                    <span>By Month (Monthly P/L)</span>
                  </button>
                </div>

                <div className="text-xs text-slate-400 font-mono">
                  Showing <strong>{activePeriodicSummaries.length}</strong>{' '}
                  {periodGranularity === 'day' ? 'days' : periodGranularity === 'week' ? 'weeks' : 'months'} of active trading
                </div>
              </div>

              {/* Periodic Metrics Summary Header */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 bg-cyber-bg/80 p-3.5 rounded-xl border border-cyber-border">
                <div>
                  <div className="text-[10px] text-slate-400 font-semibold uppercase">Total Realized P/L</div>
                  <div
                    className={`font-mono text-base font-bold mt-0.5 ${
                      totalClosedRealizedPnl >= 0 ? 'text-emerald-400' : 'text-crimson'
                    }`}
                  >
                    {totalClosedRealizedPnl >= 0 ? '+' : ''}${totalClosedRealizedPnl.toFixed(2)}
                  </div>
                  <div className="text-[10px] text-slate-400 font-mono">Cumulative realized return</div>
                </div>

                <div>
                  <div className="text-[10px] text-slate-400 font-semibold uppercase">Profitable Periods</div>
                  <div className="font-mono text-base font-bold text-white mt-0.5">
                    {profitablePeriodsCount} / {activePeriodicSummaries.length}
                    <span className="text-xs text-emerald-400 font-bold ml-1.5">({profitablePeriodsPercent}%)</span>
                  </div>
                  <div className="text-[10px] text-slate-400 font-mono">
                    {periodGranularity === 'day' ? 'Green days' : periodGranularity === 'week' ? 'Green weeks' : 'Green months'}
                  </div>
                </div>

                <div>
                  <div className="text-[10px] text-slate-400 font-semibold uppercase">Best Period</div>
                  <div className="font-mono text-base font-bold text-emerald-400 mt-0.5">
                    {bestPeriod ? `+${bestPeriod.netPnlUsd.toFixed(2)}` : '$0.00'}
                  </div>
                  <div className="text-[10px] text-slate-300 font-sans truncate" title={bestPeriod?.periodLabel}>
                    {bestPeriod?.periodLabel || 'None'}
                  </div>
                </div>

                <div>
                  <div className="text-[10px] text-slate-400 font-semibold uppercase">Average P/L per Period</div>
                  <div
                    className={`font-mono text-base font-bold mt-0.5 ${
                      avgPnlPerPeriod >= 0 ? 'text-emerald-400' : 'text-crimson'
                    }`}
                  >
                    {avgPnlPerPeriod >= 0 ? '+' : ''}${avgPnlPerPeriod.toFixed(2)}
                  </div>
                  <div className="text-[10px] text-slate-400 font-mono">
                    Mean per {periodGranularity}
                  </div>
                </div>
              </div>

              {/* Periodic P&L Table */}
              {activePeriodicSummaries.length === 0 ? (
                <div className="text-center py-10 border border-dashed border-cyber-border rounded-xl">
                  <Calendar className="w-8 h-8 text-slate-500 mx-auto mb-2" />
                  <p className="text-xs text-slate-400">No closed trades recorded yet for periodic aggregation.</p>
                </div>
              ) : (
                <div className="overflow-x-auto border border-cyber-border rounded-xl">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-900 text-slate-400 font-semibold border-b border-cyber-border">
                      <tr>
                        <th className="py-3 px-3.5">
                          {periodGranularity === 'day' ? 'Day / Date' : periodGranularity === 'week' ? 'Week Period' : 'Month'}
                        </th>
                        <th className="py-3 px-3.5 text-right">Net Realized P/L</th>
                        <th className="py-3 px-3.5 text-center min-w-[120px]">P/L Magnitude</th>
                        <th className="py-3 px-3.5">Trades & Win Rate</th>
                        <th className="py-3 px-3.5 text-right">Volume (Cost &rarr; Return)</th>
                        <th className="py-3 px-3.5">Best Trade</th>
                        <th className="py-3 px-3.5 text-center">Inspect</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-cyber-border/60 font-mono">
                      {activePeriodicSummaries.map((summary) => {
                        const isProfit = summary.netPnlUsd >= 0;
                        const barWidthPercent = Math.min(
                          100,
                          Math.max(8, Math.round((Math.abs(summary.netPnlUsd) / maxPeriodPnl) * 100))
                        );
                        const isExpanded = expandedPeriodKey === summary.periodKey;

                        return (
                          <React.Fragment key={summary.periodKey}>
                            <tr
                              onClick={() => setExpandedPeriodKey(isExpanded ? null : summary.periodKey)}
                              className={`hover:bg-slate-900/50 cursor-pointer transition-colors ${
                                isExpanded ? 'bg-slate-900/70' : ''
                              }`}
                            >
                              {/* Period Name & Type */}
                              <td className="py-3 px-3.5">
                                <div className="font-bold text-white flex items-center space-x-1.5 font-sans">
                                  <span>{summary.periodLabel}</span>
                                </div>
                                <div className="text-[10px] text-slate-400 font-mono mt-0.5">
                                  Key: {summary.periodKey}
                                </div>
                              </td>

                              {/* Net Realized P/L */}
                              <td className="py-3 px-3.5 text-right">
                                <div
                                  className={`font-bold text-sm ${
                                    isProfit ? 'text-emerald-400' : 'text-crimson'
                                  }`}
                                >
                                  {isProfit ? '+' : ''}${summary.netPnlUsd.toFixed(2)}
                                </div>
                                <div className="text-[10px] text-slate-400">
                                  ROI: {isProfit ? '+' : ''}{summary.netPnlPercent.toFixed(1)}%
                                </div>
                              </td>

                              {/* Visual P/L Magnitude Bar */}
                              <td className="py-3 px-3.5 text-center">
                                <div className="w-full bg-slate-950 rounded-full h-2.5 overflow-hidden flex items-center p-0.5 border border-slate-800">
                                  <div
                                    className={`h-full rounded-full transition-all ${
                                      isProfit
                                        ? 'bg-gradient-to-r from-emerald-500 to-teal-400 shadow-sm shadow-emerald-500/50'
                                        : 'bg-gradient-to-r from-rose-500 to-red-600 shadow-sm shadow-rose-500/50'
                                    }`}
                                    style={{ width: `${barWidthPercent}%` }}
                                  ></div>
                                </div>
                              </td>

                              {/* Trades & Win Rate */}
                              <td className="py-3 px-3.5">
                                <div className="text-white font-bold flex items-center space-x-1.5">
                                  <span>{summary.totalTrades} trade{summary.totalTrades === 1 ? '' : 's'}</span>
                                  <span
                                    className={`px-1.5 py-0.2 rounded text-[10px] font-bold ${
                                      summary.winRate >= 50
                                        ? 'bg-emerald-500/20 text-emerald-300'
                                        : 'bg-rose-500/20 text-rose-300'
                                    }`}
                                  >
                                    {summary.winRate}% WR
                                  </span>
                                </div>
                                <div className="text-[10px] text-slate-400 font-mono mt-0.5">
                                  {summary.wins}W / {summary.losses}L
                                </div>
                              </td>

                              {/* Capital Flow (Cost vs Returned) */}
                              <td className="py-3 px-3.5 text-right font-mono">
                                <div className="text-slate-200">
                                  ${summary.totalReturnedUsd.toFixed(2)}
                                </div>
                                <div className="text-[10px] text-slate-500">
                                  Cost: ${summary.totalInvestedUsd.toFixed(2)}
                                </div>
                              </td>

                              {/* Best Trade in Period */}
                              <td className="py-3 px-3.5 font-sans">
                                {summary.bestTradeSymbol ? (
                                  <div className="text-xs text-emerald-400 font-bold flex items-center space-x-1">
                                    <span>{summary.bestTradeSymbol}</span>
                                    <span className="font-mono text-[10px] text-slate-300">
                                      (+{summary.bestTradeMultiplier?.toFixed(2)}x)
                                    </span>
                                  </div>
                                ) : (
                                  <span className="text-slate-500 text-xs">—</span>
                                )}
                              </td>

                              {/* Inspect Expand Button */}
                              <td className="py-3 px-3.5 text-center">
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setExpandedPeriodKey(isExpanded ? null : summary.periodKey);
                                  }}
                                  className="p-1 rounded hover:bg-slate-800 text-slate-400 hover:text-white transition-colors"
                                >
                                  <ChevronDown
                                    className={`w-4 h-4 transition-transform ${
                                      isExpanded ? 'rotate-180 text-cyber-accent' : ''
                                    }`}
                                  />
                                </button>
                              </td>
                            </tr>

                            {/* Expanded Period Trades Drawer */}
                            {isExpanded && (
                              <tr className="bg-slate-950/80 border-b border-cyber-border">
                                <td colSpan={7} className="p-4">
                                  <div className="space-y-2">
                                    <div className="flex items-center justify-between text-xs pb-1 border-b border-slate-800 font-sans">
                                      <span className="font-bold text-white flex items-center space-x-1.5">
                                        <History className="w-3.5 h-3.5 text-cyber-accent" />
                                        <span>Trades Executed in {summary.periodLabel} ({summary.trades.length} trades)</span>
                                      </span>
                                      <span className="text-slate-400 font-mono">
                                        Period Net: <strong className={isProfit ? 'text-emerald-400' : 'text-crimson'}>{isProfit ? '+' : ''}${summary.netPnlUsd.toFixed(2)}</strong>
                                      </span>
                                    </div>

                                    {/* Mini table of trades inside this period */}
                                    <div className="overflow-x-auto rounded-lg border border-slate-800">
                                      <table className="w-full text-left text-xs font-mono">
                                        <thead className="bg-slate-900 text-slate-400 text-[10px] border-b border-slate-800">
                                          <tr>
                                            <th className="py-2 px-3">Token & Chain</th>
                                            <th className="py-2 px-3 text-right">Return / P&L</th>
                                            <th className="py-2 px-3">Hold Time</th>
                                            <th className="py-2 px-3 text-right">Entry / Exit</th>
                                            <th className="py-2 px-3">Exit Reason</th>
                                            <th className="py-2 px-3">Copied Smart Wallet</th>
                                          </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-900 font-mono text-[11px]">
                                          {summary.trades.map((trade) => {
                                            const trChain = SUPPORTED_CHAINS[trade.chain];
                                            const trProfit = trade.netPnlUsd >= 0;
                                            return (
                                              <tr key={trade.id} className="hover:bg-slate-900/60">
                                                <td className="py-2 px-3">
                                                  <div className="flex items-center space-x-1.5">
                                                    <span className="font-bold text-white">{trade.tokenSymbol}</span>
                                                    <span className={`px-1 rounded text-[9px] border ${trChain.badgeBg}`}>
                                                      {trChain.name}
                                                    </span>
                                                  </div>
                                                </td>
                                                <td className="py-2 px-3 text-right">
                                                  <span className={`font-bold ${trProfit ? 'text-emerald-400' : 'text-crimson'}`}>
                                                    {trProfit ? '+' : ''}${trade.netPnlUsd.toFixed(2)} ({trProfit ? '+' : ''}{trade.netPnlPercent.toFixed(1)}%)
                                                  </span>
                                                </td>
                                                <td className="py-2 px-3 text-slate-300">
                                                  {formatDuration(trade.holdDurationSeconds)}
                                                </td>
                                                <td className="py-2 px-3 text-right text-slate-300">
                                                  ${trade.entryPriceUsd} &rarr; ${trade.exitPriceUsd}
                                                </td>
                                                <td className="py-2 px-3">
                                                  <span
                                                    className={`px-1.5 py-0.2 rounded text-[9px] font-bold ${
                                                      trade.exitReason === 'TAKE_PROFIT'
                                                        ? 'bg-emerald-950 text-emerald-300 border border-emerald-500/40'
                                                        : trade.exitReason === 'TRAILING_STOP'
                                                        ? 'bg-cyan-950 text-cyan-300 border border-cyan-500/40'
                                                        : trade.exitReason === 'BREAKEVEN_STOP'
                                                        ? 'bg-indigo-950 text-indigo-300 border border-indigo-500/40'
                                                        : trade.exitReason === 'LIQUIDITY_RUG_PULL'
                                                        ? 'bg-red-950 text-red-300 border border-red-500/60'
                                                        : trade.exitReason === 'STAGNATION_TIMEOUT'
                                                        ? 'bg-amber-950 text-amber-300 border border-amber-500/50'
                                                        : trade.exitReason === 'STOP_LOSS'
                                                        ? 'bg-rose-950 text-rose-300 border border-rose-500/40'
                                                        : 'bg-slate-900 text-slate-300 border border-slate-700/40'
                                                    }`}
                                                  >
                                                    {trade.exitReason === 'LIQUIDITY_RUG_PULL' ? 'RUG CIRCUIT BREAKER' : trade.exitReason === 'STAGNATION_TIMEOUT' ? 'STAGNATION TIMEOUT' : trade.exitReason}
                                                  </span>
                                                </td>
                                                <td className="py-2 px-3 text-slate-300 font-sans text-xs">
                                                  {trade.copiedFromWalletLabel}
                                                </td>
                                              </tr>
                                            );
                                          })}
                                        </tbody>
                                      </table>
                                    </div>
                                  </div>
                                </td>
                              </tr>
                            )}
                          </React.Fragment>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* VIEW MODE 2: Individual Closed Trades Ledger */}
          {historyViewMode === 'individual' && (
            <div className="space-y-4">
              {/* Header & Filter Controls */}
              <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-3">
                {/* Timeframe Filter Pills */}
                <div className="flex items-center space-x-1.5 bg-slate-900 p-1 rounded-lg border border-cyber-border text-xs">
                  <span className="text-[10px] text-slate-400 font-semibold px-2 uppercase">Timeframe:</span>
                  {(['all', '24h', '7d', '30d'] as const).map((tf) => (
                    <button
                      key={tf}
                      onClick={() => setHistoryTimeframeFilter(tf)}
                      className={`px-2.5 py-1 rounded text-xs font-medium transition-colors ${
                        historyTimeframeFilter === tf
                          ? 'bg-slate-800 text-white font-bold'
                          : 'text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      {tf === 'all'
                        ? 'All Trades'
                        : tf === '24h'
                        ? 'Today (24h)'
                        : tf === '7d'
                        ? 'This Week (7d)'
                        : 'This Month (30d)'}
                    </button>
                  ))}
                </div>

                {/* Outcome Filter Pills */}
                <div className="flex items-center space-x-1.5 bg-slate-900 p-1 rounded-lg border border-cyber-border">
                  <button
                    onClick={() => setHistoryFilter('all')}
                    className={`px-2.5 py-1 rounded text-xs font-medium transition-colors ${
                      historyFilter === 'all'
                        ? 'bg-slate-800 text-white font-bold'
                        : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    All ({closedTrades.length})
                  </button>
                  <button
                    onClick={() => setHistoryFilter('wins')}
                    className={`px-2.5 py-1 rounded text-xs font-medium transition-colors ${
                      historyFilter === 'wins'
                        ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 font-bold'
                        : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    Wins ({closedWins})
                  </button>
                  <button
                    onClick={() => setHistoryFilter('losses')}
                    className={`px-2.5 py-1 rounded text-xs font-medium transition-colors ${
                      historyFilter === 'losses'
                        ? 'bg-rose-500/20 text-rose-300 border border-rose-500/40 font-bold'
                        : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    Losses ({closedLosses})
                  </button>
                </div>
              </div>

              {/* Quick Ledger Metrics Bar */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 bg-cyber-bg/70 p-3.5 rounded-xl border border-cyber-border">
                <div>
                  <div className="text-[10px] text-slate-400 font-semibold uppercase">Total Realized Gain</div>
                  <div
                    className={`font-mono text-base font-bold mt-0.5 ${
                      totalClosedRealizedPnl >= 0 ? 'text-emerald-400' : 'text-crimson'
                    }`}
                  >
                    {totalClosedRealizedPnl >= 0 ? '+' : ''}${totalClosedRealizedPnl.toFixed(2)}
                  </div>
                </div>

                <div>
                  <div className="text-[10px] text-slate-400 font-semibold uppercase">Win Rate (Closed)</div>
                  <div className="font-mono text-base font-bold text-white mt-0.5">
                    {closedWinRate}% <span className="text-xs text-slate-400">({closedWins}W / {closedLosses}L)</span>
                  </div>
                </div>

                <div>
                  <div className="text-[10px] text-slate-400 font-semibold uppercase">Best Closed Multiplier</div>
                  <div className="font-mono text-base font-bold text-emerald-400 mt-0.5">
                    +{bestTradeMultiplier.toFixed(2)}x
                  </div>
                </div>

                <div>
                  <div className="text-[10px] text-slate-400 font-semibold uppercase">Average Hold Time</div>
                  <div className="font-mono text-base font-bold text-slate-200 mt-0.5">
                    {closedTrades.length > 0
                      ? formatDuration(
                          Math.round(
                            closedTrades.reduce((acc, t) => acc + (t.holdDurationSeconds || 0), 0) /
                              closedTrades.length
                          )
                        )
                      : '—'}
                  </div>
                </div>
              </div>

              {/* Detailed Closed Trades Table */}
              {filteredClosedTrades.length === 0 ? (
                <div className="text-center py-10 border border-dashed border-cyber-border rounded-xl">
                  <History className="w-8 h-8 text-slate-500 mx-auto mb-2" />
                  <p className="text-xs text-slate-400">No closed trades found matching this filter.</p>
                </div>
              ) : (
                <div className="overflow-x-auto border border-cyber-border rounded-xl">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-900 text-slate-400 font-semibold border-b border-cyber-border">
                      <tr>
                        <th className="py-3 px-3.5">Token & Network</th>
                        <th className="py-3 px-3.5 text-right">Net Profit / Multiplier</th>
                        <th className="py-3 px-3.5">Timeline (Open &rarr; Close)</th>
                        <th className="py-3 px-3.5 text-right">Entry / Exit Price</th>
                        <th className="py-3 px-3.5 text-right">Invested / Returned</th>
                        <th className="py-3 px-3.5">Exit Reason</th>
                        <th className="py-3 px-3.5">Copied Wallet</th>
                        <th className="py-3 px-3.5 text-center">Audit</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-cyber-border/60 font-mono">
                      {filteredClosedTrades.map((trade) => {
                        const chain = SUPPORTED_CHAINS[trade.chain];
                        const isProfit = trade.netPnlUsd >= 0;
                        const isExpanded = expandedTradeId === trade.id;

                        return (
                          <React.Fragment key={trade.id}>
                            <tr
                              onClick={() => setExpandedTradeId(isExpanded ? null : trade.id)}
                              className={`hover:bg-slate-900/50 cursor-pointer transition-colors ${
                                isExpanded ? 'bg-slate-900/60' : ''
                              }`}
                            >
                              {/* Token & Network */}
                              <td className="py-3 px-3.5">
                                <div className="flex items-center space-x-2">
                                  <div>
                                    <div className="font-bold text-white flex items-center space-x-1.5">
                                      <span>{trade.tokenSymbol}</span>
                                      <span
                                        className={`px-1.5 py-0.2 rounded text-[9px] font-semibold border ${chain.badgeBg}`}
                                      >
                                        {chain.name}
                                      </span>
                                    </div>
                                    <div className="text-[10px] text-slate-400 font-sans">{trade.tokenName}</div>
                                  </div>
                                </div>
                              </td>

                              {/* Net Profit & Multiplier */}
                              <td className="py-3 px-3.5 text-right">
                                <div
                                  className={`font-bold text-sm ${
                                    isProfit ? 'text-emerald-400' : 'text-crimson'
                                  }`}
                                >
                                  {isProfit ? '+' : ''}${trade.netPnlUsd.toFixed(2)}
                                </div>
                                <div className="flex items-center justify-end space-x-1 mt-0.5">
                                  <span
                                    className={`px-1.5 py-0.2 rounded text-[10px] font-bold ${
                                      isProfit
                                        ? 'bg-emerald-500/20 text-emerald-300'
                                        : 'bg-rose-500/20 text-rose-300'
                                    }`}
                                  >
                                    {trade.multiplier >= 1 ? `+${trade.multiplier}x` : `${trade.multiplier}x`}
                                  </span>
                                  <span className="text-[10px] text-slate-400">
                                    ({isProfit ? '+' : ''}{trade.netPnlPercent.toFixed(1)}%)
                                  </span>
                                </div>
                              </td>

                              {/* Timestamps & Duration */}
                              <td className="py-3 px-3.5">
                                <div className="flex items-center space-x-1 text-slate-300">
                                  <Clock className="w-3 h-3 text-slate-500" />
                                  <span className="font-bold text-xs text-white">
                                    {formatDuration(trade.holdDurationSeconds)}
                                  </span>
                                </div>
                                <div className="text-[10px] text-slate-400 space-y-0.5 mt-0.5">
                                  <div>Open: {formatDateTime(trade.entryTimestamp)}</div>
                                  <div>Close: {formatDateTime(trade.exitTimestamp)}</div>
                                </div>
                              </td>

                              {/* Entry / Exit Price */}
                              <td className="py-3 px-3.5 text-right">
                                <div className="text-slate-200">${trade.exitPriceUsd}</div>
                                <div className="text-[10px] text-slate-500">
                                  Entry: ${trade.entryPriceUsd}
                                </div>
                              </td>

                              {/* Invested / Returned */}
                              <td className="py-3 px-3.5 text-right">
                                <div className="text-slate-200 font-bold">
                                  ${trade.returnedUsd.toFixed(2)}
                                </div>
                                <div className="text-[10px] text-slate-500">
                                  Cost: ${trade.investedUsd.toFixed(2)} • Gas: ~${trade.simulatedGasFeeUsd || 0.02}
                                </div>
                              </td>

                              {/* Exit Reason */}
                              <td className="py-3 px-3.5">
                                <span
                                  className={`px-2 py-0.5 rounded text-[10px] font-bold inline-flex items-center space-x-1 ${
                                    trade.exitReason === 'TAKE_PROFIT'
                                      ? 'bg-emerald-950/80 text-emerald-300 border border-emerald-500/40'
                                      : trade.exitReason === 'TRAILING_STOP'
                                      ? 'bg-cyan-950/80 text-cyan-300 border border-cyan-500/40'
                                      : trade.exitReason === 'BREAKEVEN_STOP'
                                      ? 'bg-indigo-950/80 text-indigo-300 border border-indigo-500/40'
                                      : trade.exitReason === 'LIQUIDITY_RUG_PULL'
                                      ? 'bg-red-950/90 text-red-300 border border-red-500/70 shadow-sm shadow-red-900/40'
                                      : trade.exitReason === 'STAGNATION_TIMEOUT'
                                      ? 'bg-amber-950/80 text-amber-300 border border-amber-500/50'
                                      : trade.exitReason === 'STOP_LOSS'
                                      ? 'bg-rose-950/80 text-rose-300 border border-rose-500/40'
                                      : 'bg-slate-900 text-slate-300 border border-slate-700/40'
                                  }`}
                                >
                                  <span>
                                    {trade.exitReason === 'LIQUIDITY_RUG_PULL'
                                      ? '🚨 RUG CIRCUIT BREAKER'
                                      : trade.exitReason === 'STAGNATION_TIMEOUT'
                                      ? '⏱️ STAGNATION TIMEOUT'
                                      : trade.exitReason}
                                  </span>
                                </span>
                                {trade.peakPnlPercent !== undefined && trade.peakPnlPercent > 0 && (
                                  <div className="text-[10px] text-cyan-400 font-mono mt-0.5" title={`Peaked at $${trade.peakPriceUsd}`}>
                                    Peak MFE: +{trade.peakPnlPercent.toFixed(1)}%
                                  </div>
                                )}
                                <div className="text-[10px] text-slate-400 font-sans mt-0.5 max-w-[180px] truncate" title={trade.exitReasonDetail}>
                                  {trade.exitReasonDetail}
                                </div>
                              </td>

                              {/* Copied Wallet */}
                              <td className="py-3 px-3.5 font-sans">
                                <div className="text-xs text-slate-200 font-medium">
                                  {trade.copiedFromWalletLabel}
                                </div>
                                <div className="text-[10px] text-slate-400 font-mono">
                                  Conviction: {trade.alphaScoreAtEntry}/100
                                </div>
                              </td>

                              {/* Expand Button */}
                              <td className="py-3 px-3.5 text-center">
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setExpandedTradeId(isExpanded ? null : trade.id);
                                  }}
                                  className="p-1 rounded hover:bg-slate-800 text-slate-400 hover:text-white transition-colors"
                                >
                                  <ChevronDown
                                    className={`w-4 h-4 transition-transform ${
                                      isExpanded ? 'rotate-180 text-cyber-accent' : ''
                                    }`}
                                  />
                                </button>
                              </td>
                            </tr>

                            {/* Expanded Forensic Detail Drawer */}
                            {isExpanded && (
                              <tr className="bg-slate-950/80 border-b border-cyber-border">
                                <td colSpan={8} className="p-4">
                                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs font-sans">
                                    {/* Col 1: Thesis & Security */}
                                    <div className="space-y-1.5 bg-cyber-bg p-3 rounded-lg border border-slate-800">
                                      <div className="font-bold text-white flex items-center space-x-1.5">
                                        <Sparkles className="w-3.5 h-3.5 text-cyber-accent" />
                                        <span>Entry Alpha Rationale & Thesis</span>
                                      </div>
                                      <p className="text-slate-300 text-[11px] leading-relaxed">
                                        {trade.entryRationale}
                                      </p>
                                      <div className="text-[10px] text-slate-400 pt-1 font-mono">
                                        Target TP: +100% (2.0x) • Stop Loss: {portfolio.stopLossPercent}%
                                      </div>
                                    </div>

                                    {/* Col 2: Exit Breakdown & Liquidity */}
                                    <div className="space-y-1.5 bg-cyber-bg p-3 rounded-lg border border-slate-800">
                                      <div className="font-bold text-white flex items-center space-x-1.5">
                                        <Shield className="w-3.5 h-3.5 text-emerald-400" />
                                        <span>Execution Forensic Audit</span>
                                      </div>
                                      <div className="text-[11px] text-slate-300 space-y-1 font-mono">
                                        <div>Trigger: <strong className="text-white">{trade.exitReasonDetail}</strong></div>
                                        <div>Principal: ${trade.investedUsd.toFixed(2)} &rarr; Returned: ${trade.returnedUsd.toFixed(2)}</div>
                                        <div>Net Return: <strong className={isProfit ? 'text-emerald-400' : 'text-crimson'}>{isProfit ? '+' : ''}${trade.netPnlUsd.toFixed(2)} ({isProfit ? '+' : ''}{trade.netPnlPercent.toFixed(1)}%)</strong></div>
                                        <div>Peak MFE: <strong className="text-cyan-400">+{trade.peakPnlPercent ? trade.peakPnlPercent.toFixed(1) : (trade.netPnlPercent > 0 ? trade.netPnlPercent.toFixed(1) : '0.0')}%</strong> (High: ${trade.peakPriceUsd ?? trade.exitPriceUsd})</div>
                                        <div>Max Adverse (MAE): <strong className="text-rose-400">{trade.lowestPnlPercent ? trade.lowestPnlPercent.toFixed(1) : '0.0'}%</strong></div>
                                        <div>Gas Fee Deducted: ~${trade.simulatedGasFeeUsd || 0.02}</div>
                                      </div>
                                    </div>

                                    {/* Col 3: Blockchain Links & Verification */}
                                    <div className="space-y-1.5 bg-cyber-bg p-3 rounded-lg border border-slate-800">
                                      <div className="font-bold text-white flex items-center space-x-1.5">
                                        <Layers className="w-3.5 h-3.5 text-purple-400" />
                                        <span>On-Chain Verification</span>
                                      </div>
                                      <div className="text-[11px] space-y-1 text-slate-400">
                                        <div>Token Address: <span className="font-mono text-slate-300">{trade.tokenAddress.slice(0, 10)}...{trade.tokenAddress.slice(-6)}</span></div>
                                        <div>Copied Wallet: <span className="font-mono text-slate-300">{trade.copiedFromWallet.slice(0, 10)}...{trade.copiedFromWallet.slice(-6)}</span></div>
                                        <div className="pt-1 flex items-center space-x-2">
                                          <a
                                            href={getExplorerAddressUrl(trade.chain, trade.tokenAddress)}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="text-[10px] text-cyber-accent hover:underline flex items-center space-x-1"
                                          >
                                            <span>View on {chain.name} Explorer</span>
                                            <ExternalLink className="w-3 h-3" />
                                          </a>
                                        </div>
                                      </div>
                                    </div>
                                  </div>
                                </td>
                              </tr>
                            )}
                          </React.Fragment>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* SECTION 3: Live Hourly Performance Analytics */}
      {activeStudioTab === 'hourly' && (
        <div className="bg-cyber-card rounded-xl border border-cyber-border p-5 space-y-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-cyber-border">
            <div>
              <h3 className="text-sm font-bold text-white flex items-center space-x-2">
                <Clock className="w-4 h-4 text-amber-400" />
                <span>24-Hour Market Session Performance Analytics</span>
              </h3>
              <p className="text-xs text-slate-400 mt-1">
                Empirical win-rate and P&L breakdown across every hour of the day (UTC). Validates the US high-liquidity active window against overnight sleep selloffs.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2 text-xs font-mono">
              <span className="px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 text-[11px]">
                🟢 Active Session (14:00 - 21:59 UTC)
              </span>
              <span className="px-2 py-0.5 rounded bg-slate-800 text-slate-400 border border-slate-700 text-[11px]">
                🌙 Sleep / Low-Liquidity Window
              </span>
            </div>
          </div>

          {/* Hourly Performance Table */}
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs font-mono">
              <thead>
                <tr className="border-b border-cyber-border/80 text-slate-400 text-[11px]">
                  <th className="py-2.5 px-3">Hour (UTC)</th>
                  <th className="py-2.5 px-3">Market Session Status</th>
                  <th className="py-2.5 px-3 text-center">Trades</th>
                  <th className="py-2.5 px-3 text-center">Wins / Losses</th>
                  <th className="py-2.5 px-3 text-right">Win Rate</th>
                  <th className="py-2.5 px-3 text-right">Net P&L</th>
                  <th className="py-2.5 px-3 text-right">Avg Win</th>
                  <th className="py-2.5 px-3 text-right">Avg Loss</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-cyber-border/40">
                {hourlyStats.map((st) => {
                  const hasTrades = st.totalTrades > 0;
                  const isPositive = st.netPnlUsd > 0;
                  const isCurrentHour = new Date().getUTCHours() === st.hourUtc;

                  return (
                    <tr
                      key={st.hourUtc}
                      className={`hover:bg-slate-800/40 transition-colors ${
                        isCurrentHour ? 'bg-amber-500/10 border-l-2 border-amber-400' : ''
                      } ${st.isPeakSession ? 'bg-emerald-950/10' : ''}`}
                    >
                      <td className="py-2 px-3 font-bold text-white flex items-center space-x-2">
                        <span>{String(st.hourUtc).padStart(2, '0')}:00 UTC</span>
                        {isCurrentHour && (
                          <span className="px-1.5 py-0.2 text-[9px] font-bold rounded bg-amber-400 text-slate-950">
                            NOW
                          </span>
                        )}
                      </td>
                      <td className="py-2 px-3">
                        {st.isPeakSession ? (
                          <span className="text-[10px] px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                            🟢 High Liquidity (US Active)
                          </span>
                        ) : st.hourUtc >= 22 || st.hourUtc <= 9 ? (
                          <span className="text-[10px] px-2 py-0.5 rounded bg-slate-800 text-slate-400 border border-slate-700">
                            🌙 Sleep / Low-Liquidity Window
                          </span>
                        ) : (
                          <span className="text-[10px] px-2 py-0.5 rounded bg-blue-500/20 text-blue-300 border border-blue-500/30">
                            🌅 Europe Pre-Market
                          </span>
                        )}
                      </td>
                      <td className="py-2 px-3 text-center font-bold text-slate-200">
                        {st.totalTrades}
                      </td>
                      <td className="py-2 px-3 text-center">
                        <span className="text-emerald-400 font-bold">{st.wins}W</span>
                        <span className="text-slate-500 mx-1">/</span>
                        <span className="text-rose-400 font-bold">{st.losses}L</span>
                      </td>
                      <td className="py-2 px-3 text-right">
                        {hasTrades ? (
                          <span
                            className={`font-bold ${
                              st.winRatePercent >= 50
                                ? 'text-emerald-400'
                                : st.winRatePercent >= 35
                                ? 'text-amber-400'
                                : 'text-rose-400'
                            }`}
                          >
                            {st.winRatePercent}%
                          </span>
                        ) : (
                          <span className="text-slate-600">-</span>
                        )}
                      </td>
                      <td className="py-2 px-3 text-right font-bold">
                        {hasTrades ? (
                          <span className={isPositive ? 'text-emerald-400' : st.netPnlUsd < 0 ? 'text-rose-400' : 'text-slate-400'}>
                            {isPositive ? '+' : ''}${st.netPnlUsd.toFixed(2)}
                          </span>
                        ) : (
                          <span className="text-slate-600">$0.00</span>
                        )}
                      </td>
                      <td className="py-2 px-3 text-right text-emerald-400">
                        {st.wins > 0 ? `+$${st.avgWinUsd.toFixed(2)}` : '-'}
                      </td>
                      <td className="py-2 px-3 text-right text-rose-400">
                        {st.losses > 0 ? `-$${Math.abs(st.avgLossUsd).toFixed(2)}` : '-'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Autonomous Strategy Tuning & Parameters */}
      <div className="bg-cyber-card rounded-xl border border-cyber-border p-5 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Sliders className="w-4 h-4 text-cyber-accent" />
            <h3 className="font-bold text-sm text-white">Strategy Parameters & Risk Rules</h3>
          </div>
          <span className="text-xs text-slate-400">Tune filters to optimize performance</span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 pt-1">
          {/* Minimum Conviction Slider */}
          <div className="space-y-1.5 bg-cyber-bg p-3.5 rounded-xl border border-cyber-border">
            <div className="flex justify-between text-xs">
              <span className="text-slate-300 font-medium">Min Conviction Score:</span>
              <strong className="text-cyber-accent font-mono">{minScore}/100</strong>
            </div>
            <input
              type="range"
              min="50"
              max="95"
              step="5"
              value={minScore}
              onChange={(e) => setMinScore(Number(e.target.value))}
              className="w-full accent-cyber-accent cursor-pointer"
            />
            <p className="text-[10px] text-slate-500">
              Only takes trades when wallet win rate + security checks meet or exceed this score.
            </p>
          </div>

          {/* Allocation per trade */}
          <div className="space-y-1.5 bg-cyber-bg p-3.5 rounded-xl border border-cyber-border">
            <div className="flex justify-between text-xs">
              <span className="text-slate-300 font-medium">Trade Sizing:</span>
              <strong className="text-emerald-400 font-mono">${allocation}</strong>
            </div>
            <select
              value={allocation}
              onChange={(e) => setAllocation(Number(e.target.value))}
              className="w-full bg-slate-900 border border-cyber-border rounded px-2 py-1 text-xs text-slate-200 focus:outline-none"
            >
              <option value="83">$83 per trade (12-Slot Risk Divisor on $1,000)</option>
              <option value="20">$20 per trade (Conservative Demo Base)</option>
              <option value="15">$15 per trade (Micro Sizing)</option>
              <option value="10">$10 per trade (Ultra-Conservative)</option>
            </select>
            <p className="text-[10px] text-slate-500">
              Institutional 12-Slot Divisor (5 Concurrency + 4 DD Cushion + 2 Safety Margin).
            </p>
          </div>

          {/* Stop-Loss % */}
          <div className="space-y-1.5 bg-cyber-bg p-3.5 rounded-xl border border-cyber-border">
            <div className="flex justify-between text-xs">
              <span className="text-slate-300 font-medium">Hard Stop-Loss:</span>
              <strong className="text-crimson font-mono">{stopLoss}%</strong>
            </div>
            <select
              value={stopLoss}
              onChange={(e) => setStopLoss(Number(e.target.value))}
              className="w-full bg-slate-900 border border-cyber-border rounded px-2 py-1 text-xs text-slate-200 focus:outline-none"
            >
              <option value="-15">-15% Strict Cut</option>
              <option value="-20">-20% Standard Meme Cut</option>
              <option value="-25">-25% Volatility Buffer</option>
              <option value="-35">-35% High Tolerance</option>
            </select>
            <p className="text-[10px] text-slate-500">
              Mechanically cuts losing trades to protect capital.
            </p>
          </div>

          {/* Auto Reload Toggle & Save */}
          <div className="space-y-2 bg-cyber-bg p-3.5 rounded-xl border border-cyber-border flex flex-col justify-between">
            <label className="flex items-center space-x-2 cursor-pointer text-xs">
              <input
                type="checkbox"
                checked={autoReload}
                onChange={(e) => setAutoReload(e.target.checked)}
                className="rounded accent-emerald-500"
              />
              <span className="text-slate-300 font-medium">Auto-Reload $100 on Exhaustion</span>
            </label>
            <button
              onClick={handleSaveConfig}
              className="w-full py-1.5 rounded-lg text-xs font-bold bg-cyber-accent text-slate-950 hover:bg-sky-400 transition-colors"
            >
              Apply Strategy Rules
            </button>
          </div>
        </div>
      </div>

      {/* Post-Mortem Logs Link Banner */}
      <div
        onClick={onViewLogs}
        className="bg-purple-950/40 border border-purple-500/30 hover:border-purple-500/60 p-4 rounded-xl cursor-pointer flex items-center justify-between transition-colors group"
      >
        <div className="flex items-center space-x-3">
          <Shield className="w-5 h-5 text-purple-400 group-hover:scale-110 transition-transform" />
          <div>
            <h4 className="text-xs font-bold text-white">Forensic Decision Logs & Strategy Improvement Lab</h4>
            <p className="text-[11px] text-slate-400">
              Review every trade entry rationale, exit trigger, and lesson learned to refine algorithm parameters.
            </p>
          </div>
        </div>
        <div className="flex items-center space-x-1 text-xs font-bold text-purple-300 font-mono">
          <span>Open Logs</span>
          <ChevronRight className="w-4 h-4" />
        </div>
      </div>
    </div>
  );
}
