'use client';

import React from 'react';
import { Activity, Shield, Zap, Search, Bot, ExternalLink, RefreshCw } from 'lucide-react';
import { ChainId } from '@/lib/types';
import { SUPPORTED_CHAINS } from '@/lib/chains';

interface HeaderProps {
  activeTab: 'leaderboard' | 'demo' | 'logs';
  setActiveTab: (tab: 'leaderboard' | 'demo' | 'logs') => void;
  selectedChain: ChainId | 'all';
  setSelectedChain: (chain: ChainId | 'all') => void;
  demoBalance: number;
  demoPnl: number;
  demoWins: number;
  demoLosses: number;
  onOpenInspector: () => void;
  onOpenBotExport: () => void;
}

export function Header({
  activeTab,
  setActiveTab,
  selectedChain,
  setSelectedChain,
  demoBalance,
  demoPnl,
  demoWins,
  demoLosses,
  onOpenInspector,
  onOpenBotExport,
}: HeaderProps) {
  return (
    <header className="border-b border-cyber-border bg-cyber-card/80 backdrop-blur-md sticky top-0 z-40">
      {/* Live Market Pulse Ticker */}
      <div className="bg-cyber-bg/90 border-b border-cyber-border/50 px-4 py-1.5 text-xs flex items-center justify-between overflow-x-auto text-slate-400">
        <div className="flex items-center space-x-6 shrink-0">
          <span className="flex items-center text-emerald-400 font-medium">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping mr-2"></span>
            LIVE SOLANA ON-CHAIN RADAR • 100% REAL DATA
          </span>
          <span className="hidden md:inline flex items-center space-x-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
            <span>Helius RPC: <strong className="text-slate-200 font-mono">Connected</strong></span>
          </span>
          <span className="hidden md:inline flex items-center space-x-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
            <span>Birdeye API: <strong className="text-slate-200 font-mono">Live Spot</strong></span>
          </span>
          <span className="hidden lg:inline">
            Active Protocols: <strong className="text-slate-200 font-mono">Pump.fun • Raydium • Meteora • Orca</strong>
          </span>
        </div>

        {/* Demo Quick Balance Pill */}
        <button
          onClick={() => setActiveTab('demo')}
          className="flex items-center space-x-2 bg-slate-900/90 border border-cyber-accent/40 hover:border-cyber-accent px-2.5 py-0.5 rounded-full text-xs transition-colors shrink-0"
        >
          <Bot className="w-3.5 h-3.5 text-cyber-accent" />
          <span className="text-slate-300 font-medium">Autonomous $100 Demo:</span>
          <span className="font-mono font-bold text-white">${demoBalance.toFixed(2)}</span>
          <span
            className={`font-mono text-[11px] font-semibold ${
              demoPnl >= 0 ? 'text-emerald-400' : 'text-crimson'
            }`}
          >
            ({demoPnl >= 0 ? '+' : ''}${demoPnl.toFixed(2)})
          </span>
        </button>
      </div>

      {/* Main Navigation Bar */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3.5 flex flex-col md:flex-row items-center justify-between gap-4">
        {/* Logo and Tagline */}
        <div className="flex items-center space-x-3 cursor-pointer" onClick={() => setActiveTab('leaderboard')}>
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-cyber-accent via-purple-600 to-emerald-500 p-0.5 shadow-lg shadow-cyber-accent/10">
            <div className="w-full h-full bg-cyber-card rounded-[10px] flex items-center justify-center">
              <Zap className="w-5 h-5 text-cyber-accent" />
            </div>
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <span className="text-lg font-bold tracking-wider text-white">MEME<span className="text-cyber-accent">ALPHA</span></span>
              <span className="text-[10px] uppercase font-mono px-1.5 py-0.5 rounded bg-emerald-950/80 border border-emerald-500/30 text-emerald-400 font-semibold">
                RADAR v2.4
              </span>
            </div>
            <p className="text-xs text-slate-400">Solana Smart Money & Autonomous Copy Engine</p>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="flex items-center space-x-1.5 bg-cyber-bg p-1 rounded-xl border border-cyber-border">
          <button
            onClick={() => setActiveTab('leaderboard')}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center space-x-1.5 ${
              activeTab === 'leaderboard'
                ? 'bg-cyber-accent text-slate-950 shadow-md font-bold'
                : 'text-slate-400 hover:text-white hover:bg-slate-800/40'
            }`}
          >
            <Activity className="w-3.5 h-3.5" />
            <span>Ranked Leaderboard</span>
          </button>

          <button
            onClick={() => setActiveTab('demo')}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center space-x-1.5 ${
              activeTab === 'demo'
                ? 'bg-emerald-500 text-slate-950 shadow-md font-bold'
                : 'text-slate-400 hover:text-white hover:bg-slate-800/40'
            }`}
          >
            <Bot className="w-3.5 h-3.5" />
            <span>$100 Demo Bot</span>
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse ml-1"></span>
          </button>

          <button
            onClick={() => setActiveTab('logs')}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center space-x-1.5 ${
              activeTab === 'logs'
                ? 'bg-purple-500 text-white shadow-md font-bold'
                : 'text-slate-400 hover:text-white hover:bg-slate-800/40'
            }`}
          >
            <Shield className="w-3.5 h-3.5" />
            <span>Decision Logs & Post-Mortem</span>
          </button>
        </div>

        {/* Action Controls */}
        <div className="flex items-center space-x-2.5">
          <button
            onClick={onOpenInspector}
            className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-slate-900 border border-cyber-border hover:border-slate-500 text-slate-200 transition-colors"
          >
            <Search className="w-3.5 h-3.5 text-cyber-accent" />
            <span>Inspect Any Wallet</span>
          </button>

          <button
            onClick={onOpenBotExport}
            className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white shadow-md transition-all"
          >
            <Zap className="w-3.5 h-3.5" />
            <span>Export Copy Bot</span>
          </button>
        </div>
      </div>

      {/* Chain Filter Bar (Shown on Leaderboard tab) */}
      {activeTab === 'leaderboard' && (
        <div className="bg-cyber-bg/60 border-t border-cyber-border/40 px-4 py-2">
          <div className="max-w-7xl mx-auto flex items-center justify-between text-xs overflow-x-auto">
            <div className="flex items-center space-x-2">
              <span className="text-slate-400 uppercase text-[11px] font-semibold tracking-wider mr-1">
                Active Blockchain:
              </span>
              <button
                onClick={() => setSelectedChain('solana')}
                className="px-3 py-1 rounded-md text-xs font-semibold bg-purple-950/80 border border-purple-500/50 text-purple-300 shadow flex items-center space-x-1.5"
              >
                <span className="w-2 h-2 rounded-full bg-[#9945FF]"></span>
                <span>Solana (Mainnet-Beta)</span>
                <span className="text-[10px] text-emerald-400 bg-emerald-950/80 px-1 py-0.2 rounded border border-emerald-500/30">Avg Gas $0.005</span>
              </button>

              <div className="flex items-center space-x-1.5 pl-2 border-l border-slate-700/60">
                <span className="text-slate-400 text-[11px]">Protocols:</span>
                {['Pump.fun', 'Raydium', 'Meteora', 'Orca'].map((dex) => (
                  <span
                    key={dex}
                    className="px-2 py-0.5 rounded text-[11px] font-mono bg-slate-900/90 text-slate-300 border border-slate-700/50"
                  >
                    {dex}
                  </span>
                ))}
              </div>

              <span className="text-[11px] text-slate-400 italic hidden lg:inline pl-2 border-l border-slate-700/60">
                Base & Ethereum disabled (High gas protection)
              </span>
            </div>

            <div className="text-slate-400 text-xs hidden sm:block">
              Ranked strictly: <strong className="text-emerald-400">Most Profitable → Least Profitable</strong>
            </div>
          </div>
        </div>
      )}
    </header>
  );
}
