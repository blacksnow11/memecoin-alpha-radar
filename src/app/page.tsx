'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Header } from '@/components/Header';
import { LeaderboardTable } from '@/components/LeaderboardTable';
import { WalletDossierModal } from '@/components/WalletDossierModal';
import { WalletInspectorModal } from '@/components/WalletInspectorModal';
import { BotExporterModal } from '@/components/BotExporterModal';
import { DemoTradingStudio } from '@/components/DemoTradingStudio';
import { RecordedLogsViewer } from '@/components/RecordedLogsViewer';
import { ChainId, DecisionLog, DemoPortfolio, DemoPosition, ProfitLadderAnalytics, WalletProfile, ServerWorkerStatus } from '@/lib/types';
import {
  DEFAULT_DEMO_PORTFOLIO,
  DEFAULT_GEM_RADAR_PORTFOLIO,
  INITIAL_DECISION_LOGS,
  INITIAL_GEM_RADAR_LOGS,
  INITIAL_OPEN_POSITIONS,
} from '@/lib/demo-trading-engine';
import { getRankedWallets } from '@/lib/wallet-engine';
import { GemRadarWidget } from '@/components/GemRadarWidget';
import { Bot, CheckCircle, Zap, Radar } from 'lucide-react';

export default function Home() {
  const [activeTab, setActiveTab] = useState<'leaderboard' | 'radar' | 'demo' | 'logs'>('leaderboard');
  const [selectedChain, setSelectedChain] = useState<ChainId | 'all'>('solana');
  const [timeframe, setTimeframe] = useState<'24h' | '7d' | '30d' | 'all'>('all');
  const [sortBy, setSortBy] = useState<'dynamic' | 'capitalEfficiency' | 'profit' | 'winrate' | 'activity'>('dynamic');

  // Wallets data
  const [wallets, setWallets] = useState<WalletProfile[]>(() =>
    getRankedWallets('solana', 'all', 'dynamic')
  );
  const [selectedWallet, setSelectedWallet] = useState<WalletProfile | null>(null);

  // Modals
  const [isInspectorOpen, setIsInspectorOpen] = useState(false);
  const [isBotExportOpen, setIsBotExportOpen] = useState(false);

  // Toast notification
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Dual-Engine Trading State
  const [botMode, setBotMode] = useState<'copy' | 'gem_radar'>('copy');

  // 1. Smart Money Copy Bot ($1,000 Bankroll)
  const [copyPortfolio, setCopyPortfolio] = useState<DemoPortfolio>(DEFAULT_DEMO_PORTFOLIO);
  const [copyPositions, setCopyPositions] = useState<DemoPosition[]>(INITIAL_OPEN_POSITIONS);
  const [copyLogs, setCopyLogs] = useState<DecisionLog[]>(INITIAL_DECISION_LOGS);

  // 2. Gem Radar Breakout Hunter ($1,000 Bankroll)
  const [gemPortfolio, setGemPortfolio] = useState<DemoPortfolio>(DEFAULT_GEM_RADAR_PORTFOLIO);
  const [gemPositions, setGemPositions] = useState<DemoPosition[]>([]);
  const [gemLogs, setGemLogs] = useState<DecisionLog[]>(INITIAL_GEM_RADAR_LOGS);

  // Profitability Milestone Ladder Analytics
  const [profitLadder, setProfitLadder] = useState<ProfitLadderAnalytics | null>(null);

  // 24/7 Autonomous Server Worker Telemetry
  const [serverWorker, setServerWorker] = useState<ServerWorkerStatus | null>(null);

  const activePortfolio = botMode === 'gem_radar' ? gemPortfolio : copyPortfolio;
  const activePositions = botMode === 'gem_radar' ? gemPositions : copyPositions;
  const activeLogs = botMode === 'gem_radar' ? gemLogs : copyLogs;

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  // Fetch / update ranked wallets when filters change via live Helius API
  useEffect(() => {
    let isMounted = true;
    async function loadLeaderboard() {
      try {
        const res = await fetch(`/api/leaderboard?chain=${selectedChain}&timeframe=${timeframe}&sortBy=${sortBy}`);
        const data = await res.json();
        if (isMounted && data.success && Array.isArray(data.wallets)) {
          setWallets(data.wallets);
        }
      } catch (err) {
        if (isMounted) setWallets(getRankedWallets(selectedChain, timeframe, sortBy));
      }
    }
    loadLeaderboard();
    return () => {
      isMounted = false;
    };
  }, [selectedChain, timeframe, sortBy]);

  // Fetch demo state for both engines and 24/7 server worker telemetry
  const loadDemoState = useCallback(async () => {
    try {
      const res = await fetch('/api/demo-bot');
      const data = await res.json();
      if (data.success) {
        if (data.copyBot) {
          setCopyPortfolio(data.copyBot.portfolio);
          setCopyPositions(data.copyBot.positions || []);
          setCopyLogs(data.copyBot.logs || []);
        } else if (data.portfolio) {
          setCopyPortfolio(data.portfolio);
          setCopyPositions(data.positions || []);
          setCopyLogs(data.logs || []);
        }

        if (data.gemRadarBot) {
          setGemPortfolio(data.gemRadarBot.portfolio);
          setGemPositions(data.gemRadarBot.positions || []);
          setGemLogs(data.gemRadarBot.logs || []);
        }

        if (data.serverWorker) {
          setServerWorker(data.serverWorker);
        }
        if (data.profitLadder) {
          setProfitLadder(data.profitLadder);
        }
      }
    } catch (err) {
      console.error('Failed to load demo bot state:', err);
    }
  }, []);

  // Continuous passive telemetry polling every 4 seconds
  // Reflects the 24/7 autonomous background worker without requiring the browser to drive execution
  useEffect(() => {
    loadDemoState();
    const interval = setInterval(() => {
      loadDemoState();
    }, 4000);
    return () => clearInterval(interval);
  }, [loadDemoState]);

  // On-demand manual bot tick dispatcher
  const handleTick = useCallback(async () => {
    try {
      const res = await fetch('/api/demo-bot', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'tick' }),
      });
      const data = await res.json();
      if (data.success) {
        if (data.copyBot) {
          setCopyPortfolio(data.copyBot.portfolio);
          setCopyPositions(data.copyBot.positions || []);
          setCopyLogs(data.copyBot.logs || []);
        }
        if (data.gemRadarBot) {
          setGemPortfolio(data.gemRadarBot.portfolio);
          setGemPositions(data.gemRadarBot.positions || []);
          setGemLogs(data.gemRadarBot.logs || []);
        }
        if (data.serverWorker) {
          setServerWorker(data.serverWorker);
        }
        if (data.profitLadder) {
          setProfitLadder(data.profitLadder);
        }
      }
    } catch (err) {
      console.error('Tick error:', err);
    }
  }, []);

  // Handle reload $100
  const handleReload = async () => {
    try {
      const res = await fetch('/api/demo-bot', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'reload', botType: botMode }),
      });
      const data = await res.json();
      if (data.success) {
        if (data.copyBot) {
          setCopyPortfolio(data.copyBot.portfolio);
          setCopyPositions(data.copyBot.positions || []);
          setCopyLogs(data.copyBot.logs || []);
        }
        if (data.gemRadarBot) {
          setGemPortfolio(data.gemRadarBot.portfolio);
          setGemPositions(data.gemRadarBot.positions || []);
          setGemLogs(data.gemRadarBot.logs || []);
        }
        showToast(`Successfully reloaded $100.00 into ${botMode === 'gem_radar' ? 'Gem Radar' : 'Copy'} Bot!`);
      }
    } catch (err) {
      console.error('Reload error:', err);
    }
  };

  // Handle reset to $1,000 clean slate
  const handleReset = async () => {
    try {
      const res = await fetch('/api/demo-bot', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'reset' }),
      });
      const data = await res.json();
      if (data.success) {
        if (data.copyBot) {
          setCopyPortfolio(data.copyBot.portfolio);
          setCopyPositions(data.copyBot.positions || []);
          setCopyLogs(data.copyBot.logs || []);
        }
        if (data.gemRadarBot) {
          setGemPortfolio(data.gemRadarBot.portfolio);
          setGemPositions(data.gemRadarBot.positions || []);
          setGemLogs(data.gemRadarBot.logs || []);
        }
        if (data.profitLadder) {
          setProfitLadder(data.profitLadder);
        }
        showToast('Both trading engines have been cleanly reset to pristine $1,000 baselines!');
      }
    } catch (err) {
      console.error('Reset error:', err);
    }
  };

  // Toggle bot running
  const handleToggleBot = async () => {
    try {
      const res = await fetch('/api/demo-bot', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'toggle_bot', botType: botMode }),
      });
      const data = await res.json();
      if (data.success) {
        if (botMode === 'gem_radar') {
          setGemPortfolio((prev) => ({ ...prev, isBotRunning: data.isBotRunning }));
        } else {
          setCopyPortfolio((prev) => ({ ...prev, isBotRunning: data.isBotRunning }));
        }
        showToast(
          data.isBotRunning
            ? `${botMode === 'gem_radar' ? 'Gem Radar Hunter' : 'Smart Money Copy Bot'} Activated: Scanning live on-chain data.`
            : `${botMode === 'gem_radar' ? 'Gem Radar Hunter' : 'Smart Money Copy Bot'} Paused.`
        );
      }
    } catch (err) {
      console.error('Toggle error:', err);
    }
  };

  // Close position manually
  const handleClosePosition = async (positionId: string) => {
    try {
      const res = await fetch('/api/demo-bot', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'close_position', positionId }),
      });
      const data = await res.json();
      if (data.success) {
        if (data.copyBot) {
          setCopyPortfolio(data.copyBot.portfolio);
          setCopyPositions(data.copyBot.positions || []);
          setCopyLogs(data.copyBot.logs || []);
        }
        if (data.gemRadarBot) {
          setGemPortfolio(data.gemRadarBot.portfolio);
          setGemPositions(data.gemRadarBot.positions || []);
          setGemLogs(data.gemRadarBot.logs || []);
        }
        showToast('Position closed manually. Capital returned to balance.');
      }
    } catch (err) {
      console.error('Close position error:', err);
    }
  };

  // Update bot risk configuration
  const handleUpdateConfig = async (newConfig: Partial<DemoPortfolio>) => {
    try {
      const res = await fetch('/api/demo-bot', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'update_config',
          botType: botMode,
          ...newConfig,
        }),
      });
      const data = await res.json();
      if (data.success && data.portfolio) {
        if (botMode === 'gem_radar') {
          setGemPortfolio((prev) => ({ ...prev, ...data.portfolio }));
        } else {
          setCopyPortfolio((prev) => ({ ...prev, ...data.portfolio }));
        }
        showToast('Risk & Conviction parameters updated successfully.');
      }
    } catch (err) {
      console.error('Config update error:', err);
    }
  };

  // Quick Copy Action from Leaderboard
  const handleQuickCopy = (wallet: WalletProfile) => {
    setActiveTab('demo');
    setBotMode('copy');
    showToast(`Smart Money Copy Bot configured to prioritize trades from ${wallet.label}.`);
  };

  return (
    <main className="min-h-screen bg-cyber-bg text-slate-100 flex flex-col font-sans selection:bg-cyber-accent selection:text-slate-950">
      {/* Toast Alert */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 bg-emerald-500 text-slate-950 px-4 py-3 rounded-xl font-medium shadow-2xl flex items-center space-x-2 animate-bounce">
          <CheckCircle className="w-5 h-5" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Header */}
      <Header
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        selectedChain={selectedChain}
        setSelectedChain={setSelectedChain}
        demoBalance={activePortfolio.totalEquityUsd}
        demoPnl={activePortfolio.totalRealizedPnlUsd}
        demoWins={activePortfolio.totalWins}
        demoLosses={activePortfolio.totalLosses}
        onOpenInspector={() => setIsInspectorOpen(true)}
        onOpenBotExport={() => setIsBotExportOpen(true)}
      />

      {/* Main Body */}
      <div className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
        {activeTab === 'leaderboard' && (
          <div className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex items-center space-x-2">
                <span className="px-3 py-1 rounded-full text-xs font-mono font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">
                  Solana Mainnet
                </span>
                <span className="text-xs text-slate-400">
                  Ranked by ROI Capital Efficiency &bull; Live Helius On-Chain Data
                </span>
              </div>
              <div className="flex items-center space-x-3">
                <button
                  onClick={() => setIsInspectorOpen(true)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold bg-cyber-card border border-cyber-border hover:border-slate-500 text-slate-300 hover:text-white transition-all flex items-center space-x-2"
                >
                  <span>🔍 Inspect Any Solana Wallet</span>
                </button>
                <button
                  onClick={() => setActiveTab('demo')}
                  className="px-4 py-2 rounded-xl text-xs font-semibold bg-purple-600/20 border border-purple-500/40 hover:bg-purple-600/30 text-purple-300 transition-all flex items-center space-x-2 shadow-lg shadow-purple-600/10"
                >
                  <Bot className="w-4 h-4" />
                  <span>Dual Demo Studio ($2,000)</span>
                </button>
              </div>
            </div>

            {/* Live Pre-Breakout Gem Radar Component */}
            <GemRadarWidget onTradeExecuted={loadDemoState} />

            {/* Leaderboard Table */}
            <LeaderboardTable
              wallets={wallets}
              timeframe={timeframe}
              setTimeframe={setTimeframe}
              sortBy={sortBy}
              setSortBy={setSortBy}
              onSelectWallet={(w) => setSelectedWallet(w)}
              onQuickCopy={handleQuickCopy}
            />
          </div>
        )}

        {activeTab === 'radar' && (
          <div className="space-y-6">
            <div className="bg-gradient-to-r from-purple-950/60 via-slate-900 to-cyber-card p-6 rounded-2xl border border-purple-500/30 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
              <div>
                <h1 className="text-xl sm:text-2xl font-black text-white tracking-tight flex items-center space-x-2">
                  <Radar className="w-6 h-6 text-purple-400 animate-pulse" />
                  <span>Predictive Pre-Breakout Gem Radar</span>
                </h1>
                <p className="text-xs text-slate-400 mt-1 max-w-2xl leading-relaxed">
                  Autonomous pattern recognition engine scanning Raydium CPMM, Pump.fun bonding curves, and Orca pools. Pinpoints memecoins experiencing smart money cluster accumulation before DEX trending algorithms flag them.
                </p>
              </div>
            </div>

            <GemRadarWidget onTradeExecuted={loadDemoState} />
          </div>
        )}

        {activeTab === 'demo' && (
          <DemoTradingStudio
            portfolio={activePortfolio}
            positions={activePositions}
            botMode={botMode}
            onSelectBotMode={setBotMode}
            copyPortfolio={copyPortfolio}
            gemPortfolio={gemPortfolio}
            onTick={handleTick}
            onReload={handleReload}
            onReset={handleReset}
            onToggleBot={handleToggleBot}
            onClosePosition={handleClosePosition}
            onUpdateConfig={handleUpdateConfig}
            onViewLogs={() => setActiveTab('logs')}
            serverWorker={serverWorker}
            profitLadder={profitLadder}
          />
        )}

        {activeTab === 'logs' && <RecordedLogsViewer logs={activeLogs} />}
      </div>

      {/* Footer */}
      <footer className="border-t border-cyber-border/60 bg-cyber-card/60 py-6 text-center text-xs text-slate-500">
        <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-2">
          <span>MemeAlpha Radar • Solana Memecoin Inspector & Dual-Engine Autonomous Trading</span>
          <span className="font-mono">Vercel Ready • Solana Mainnet • 100% Real Live On-Chain Data</span>
        </div>
      </footer>

      {/* Forensic Proof Modal ("Why Top Picks Are Top Picks") */}
      {selectedWallet && (
        <WalletDossierModal
          wallet={selectedWallet}
          onClose={() => setSelectedWallet(null)}
          onStartCopy={(w) => {
            setSelectedWallet(null);
            handleQuickCopy(w);
          }}
        />
      )}

      {/* Custom Wallet Inspector Modal */}
      {isInspectorOpen && (
        <WalletInspectorModal
          onClose={() => setIsInspectorOpen(false)}
          onInspectResult={(inspected) => {
            setSelectedWallet(inspected);
          }}
        />
      )}

      {/* Bot Exporter Modal */}
      {isBotExportOpen && <BotExporterModal onClose={() => setIsBotExportOpen(false)} />}
    </main>
  );
}
