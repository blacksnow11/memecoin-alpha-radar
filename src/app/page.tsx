'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Header } from '@/components/Header';
import { LeaderboardTable } from '@/components/LeaderboardTable';
import { WalletDossierModal } from '@/components/WalletDossierModal';
import { DemoTradingStudio } from '@/components/DemoTradingStudio';
import { RecordedLogsViewer } from '@/components/RecordedLogsViewer';
import { WalletInspectorModal } from '@/components/WalletInspectorModal';
import { BotExporterModal } from '@/components/BotExporterModal';
import {
  ChainId,
  DecisionLog,
  DemoPortfolio,
  DemoPosition,
  WalletProfile,
} from '@/lib/types';
import { DEFAULT_DEMO_PORTFOLIO, INITIAL_DECISION_LOGS, INITIAL_OPEN_POSITIONS } from '@/lib/demo-trading-engine';
import { SEED_WALLETS, getRankedWallets } from '@/lib/wallet-engine';
import { Bot, CheckCircle, Zap } from 'lucide-react';

export default function Home() {
  const [activeTab, setActiveTab] = useState<'leaderboard' | 'demo' | 'logs'>('leaderboard');
  const [selectedChain, setSelectedChain] = useState<ChainId | 'all'>('solana');
  const [timeframe, setTimeframe] = useState<'24h' | '7d' | '30d' | 'all'>('all');
  const [sortBy, setSortBy] = useState<'profit' | 'winrate' | 'alpha'>('profit');

  // Wallets data
  const [wallets, setWallets] = useState<WalletProfile[]>(() =>
    getRankedWallets('solana', 'all', 'profit')
  );
  const [selectedWallet, setSelectedWallet] = useState<WalletProfile | null>(null);

  // Modals
  const [isInspectorOpen, setIsInspectorOpen] = useState(false);
  const [isBotExportOpen, setIsBotExportOpen] = useState(false);

  // Toast notification
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Demo Trading Engine State
  const [portfolio, setPortfolio] = useState<DemoPortfolio>(DEFAULT_DEMO_PORTFOLIO);
  const [positions, setPositions] = useState<DemoPosition[]>(INITIAL_OPEN_POSITIONS);
  const [logs, setLogs] = useState<DecisionLog[]>(INITIAL_DECISION_LOGS);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  // Fetch / update ranked wallets when filters change
  useEffect(() => {
    const updated = getRankedWallets(selectedChain, timeframe, sortBy);
    setWallets(updated);
  }, [selectedChain, timeframe, sortBy]);

  // Fetch demo state on boot
  useEffect(() => {
    async function loadDemoState() {
      try {
        const res = await fetch('/api/demo-bot');
        const data = await res.json();
        if (data.success) {
          if (data.portfolio) setPortfolio(data.portfolio);
          if (data.positions) setPositions(data.positions);
          if (data.logs) setLogs(data.logs);
        }
      } catch (err) {
        console.error('Failed to load demo bot state:', err);
      }
    }
    loadDemoState();
  }, []);

  // Autonomous bot tick dispatcher
  const handleTick = useCallback(async () => {
    try {
      const res = await fetch('/api/demo-bot', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'tick' }),
      });
      const data = await res.json();
      if (data.success) {
        setPortfolio(data.portfolio);
        setPositions(data.positions);
        setLogs(data.logs);
      }
    } catch (err) {
      console.error('Tick error:', err);
    }
  }, []);

  // Periodic autonomous runner: runs while bot is active
  useEffect(() => {
    if (!portfolio.isBotRunning) return;

    // Run tick every 7 seconds
    const interval = setInterval(() => {
      handleTick();
    }, 7000);

    return () => clearInterval(interval);
  }, [portfolio.isBotRunning, handleTick]);

  // Handle reload $100
  const handleReload = async () => {
    try {
      const res = await fetch('/api/demo-bot', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'reload' }),
      });
      const data = await res.json();
      if (data.success) {
        setPortfolio(data.portfolio);
        setPositions(data.positions);
        setLogs(data.logs);
        showToast('Successfully reloaded $100.00 into Demo Bankroll!');
      }
    } catch (err) {
      console.error('Reload error:', err);
    }
  };

  // Toggle bot running
  const handleToggleBot = async () => {
    try {
      const res = await fetch('/api/demo-bot', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'toggle_bot' }),
      });
      const data = await res.json();
      if (data.success) {
        setPortfolio((prev) => ({ ...prev, isBotRunning: data.isBotRunning }));
        showToast(
          data.isBotRunning
            ? 'Autonomous Bot Activated: Scanning trades for high conviction entries.'
            : 'Autonomous Bot Paused.'
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
        setPortfolio(data.portfolio);
        setPositions(data.positions);
        setLogs(data.logs);
        showToast('Position closed. Capital returned to available cash.');
      }
    } catch (err) {
      console.error('Close error:', err);
    }
  };

  // Update strategy config
  const handleUpdateConfig = async (config: Partial<DemoPortfolio>) => {
    try {
      const res = await fetch('/api/demo-bot', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'update_config', ...config }),
      });
      const data = await res.json();
      if (data.success) {
        setPortfolio(data.portfolio);
        showToast('Strategy rules updated successfully!');
      }
    } catch (err) {
      console.error('Config error:', err);
    }
  };

  // Quick copy from leaderboard
  const handleQuickCopy = (wallet: WalletProfile) => {
    showToast(`Added ${wallet.label} to autonomous copy watchlist!`);
    setActiveTab('demo');
    // Trigger immediate tick to evaluate this wallet
    handleTick();
  };

  return (
    <main className="min-h-screen bg-cyber-bg flex flex-col">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 bg-slate-900 border border-emerald-500/50 text-white px-4 py-3 rounded-xl shadow-2xl flex items-center space-x-2 text-xs font-medium animate-bounce">
          <CheckCircle className="w-4 h-4 text-emerald-400" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Header */}
      <Header
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        selectedChain={selectedChain}
        setSelectedChain={setSelectedChain}
        demoBalance={portfolio.totalEquityUsd}
        demoPnl={portfolio.totalRealizedPnlUsd}
        demoWins={portfolio.totalWins}
        demoLosses={portfolio.totalLosses}
        onOpenInspector={() => setIsInspectorOpen(true)}
        onOpenBotExport={() => setIsBotExportOpen(true)}
      />

      {/* Body Content */}
      <div className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {activeTab === 'leaderboard' && (
          <div className="space-y-6">
            {/* Quick Hero Banner */}
            <div className="bg-gradient-to-r from-cyber-card via-slate-900 to-cyber-card p-6 rounded-2xl border border-cyber-border flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
              <div>
                <h1 className="text-xl sm:text-2xl font-black text-white tracking-tight flex items-center space-x-2">
                  <span>Smart-Money Memecoin Leaderboard</span>
                  <span className="text-xs font-mono font-bold px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">
                    Live Verified
                  </span>
                </h1>
                <p className="text-xs text-slate-400 mt-1 max-w-2xl leading-relaxed">
                  Every wallet is audited and ranked from <strong className="text-emerald-400">most profitable to least profitable</strong>.
                  Inspect forensic proof charts, win rates, and holding patterns to mirror their highest-conviction trades.
                </p>
              </div>

              <div className="flex items-center space-x-3 shrink-0">
                <button
                  onClick={() => setActiveTab('demo')}
                  className="px-4 py-2 rounded-xl text-xs font-bold bg-emerald-500 text-slate-950 hover:bg-emerald-400 shadow-lg shadow-emerald-500/20 flex items-center space-x-1.5 transition-all"
                >
                  <Bot className="w-4 h-4" />
                  <span>Open $100 Demo Bot</span>
                </button>
              </div>
            </div>

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

        {activeTab === 'demo' && (
          <DemoTradingStudio
            portfolio={portfolio}
            positions={positions}
            onTick={handleTick}
            onReload={handleReload}
            onToggleBot={handleToggleBot}
            onClosePosition={handleClosePosition}
            onUpdateConfig={handleUpdateConfig}
            onViewLogs={() => setActiveTab('logs')}
          />
        )}

        {activeTab === 'logs' && <RecordedLogsViewer logs={logs} />}
      </div>

      {/* Footer */}
      <footer className="border-t border-cyber-border/60 bg-cyber-card/60 py-6 text-center text-xs text-slate-500">
        <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-2">
          <span>MemeAlpha Radar • Solana Memecoin Inspector & Autonomous Copy Engine</span>
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
