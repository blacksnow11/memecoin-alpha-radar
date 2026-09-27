'use client';

import React, { useState, useEffect } from 'react';
import {
  Radar,
  Zap,
  Flame,
  TrendingUp,
  Clock,
  ShieldCheck,
  ExternalLink,
  RefreshCw,
  CheckCircle,
  AlertCircle,
  Sparkles,
  ArrowRight,
  Layers,
} from 'lucide-react';
import { PreBreakoutGemSignal } from '@/lib/types';
import { formatUsd, shortenAddress, getExplorerAddressUrl } from '@/lib/chains';

interface GemRadarWidgetProps {
  onTradeExecuted?: () => void;
}

export function GemRadarWidget({ onTradeExecuted }: GemRadarWidgetProps) {
  const [signals, setSignals] = useState<PreBreakoutGemSignal[]>([]);
  const [loading, setLoading] = useState(true);
  const [executingId, setExecutingId] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const fetchSignals = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/gem-radar');
      const data = await res.json();
      if (data.success && Array.isArray(data.signals)) {
        setSignals(data.signals);
      }
    } catch (err) {
      console.error('Failed to load gem signals:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSignals();
  }, []);

  const handleExecuteDemoTrade = async (signal: PreBreakoutGemSignal) => {
    try {
      setExecutingId(signal.id);
      const res = await fetch('/api/demo-bot', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'open_gem_trade',
          signal,
        }),
      });

      const data = await res.json();
      if (data.success) {
        setSuccessMessage(`Demo Bought $${signal.suggestedDemoAllocationUsd} of ${signal.tokenSymbol} at ground floor!`);
        setTimeout(() => setSuccessMessage(null), 4000);
        if (onTradeExecuted) onTradeExecuted();
      }
    } catch (err) {
      console.error('Failed to execute demo gem trade:', err);
    } finally {
      setExecutingId(null);
    }
  };

  return (
    <div className="bg-slate-900/90 border border-cyber-border rounded-2xl overflow-hidden shadow-2xl backdrop-blur-md">
      {/* Header */}
      <div className="px-6 py-5 border-b border-cyber-border/80 flex flex-wrap items-center justify-between gap-4 bg-gradient-to-r from-slate-900 via-slate-900/95 to-cyber-bg">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 rounded-xl bg-purple-500/10 border border-purple-500/30 flex items-center justify-center text-purple-400 shadow-[0_0_15px_rgba(168,85,247,0.15)]">
            <Radar className="w-5 h-5 animate-pulse" />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <h2 className="text-base font-bold text-white tracking-wide">
                Predictive Pre-Breakout Gem Radar
              </h2>
              <span className="px-2 py-0.5 text-[10px] font-mono font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 rounded-full flex items-center space-x-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping"></span>
                <span>Active Pattern Scanner</span>
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              Identifies Solana memecoins before DEX trending via Smart-Money Co-Buys & Bonding Curve Velocity
            </p>
          </div>
        </div>

        <button
          onClick={fetchSignals}
          disabled={loading}
          className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-cyber-bg hover:bg-slate-800 text-slate-300 border border-cyber-border transition"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-cyber-accent' : ''}`} />
          <span>Scan Solana DEXes</span>
        </button>
      </div>

      {/* Success Notification */}
      {successMessage && (
        <div className="mx-6 mt-4 p-3 bg-emerald-500/10 border border-emerald-500/30 rounded-xl flex items-center space-x-2 text-xs text-emerald-400 animate-fade-in font-mono">
          <CheckCircle className="w-4 h-4 flex-shrink-0" />
          <span>{successMessage}</span>
        </div>
      )}

      {/* Content */}
      <div className="p-6">
        {loading && signals.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 space-y-3">
            <RefreshCw className="w-6 h-6 animate-spin text-purple-400" />
            <span className="text-xs text-slate-400 font-mono">
              Scanning Raydium, Pump.fun & Birdeye for early accumulation patterns...
            </span>
          </div>
        ) : signals.length === 0 ? (
          <div className="text-center py-10 text-slate-500 text-xs">
            No pre-breakout anomalies detected in the last scan cycle.
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            {signals.map((sig) => (
              <div
                key={sig.id}
                className="bg-cyber-bg/80 border border-cyber-border rounded-xl p-4 flex flex-col justify-between hover:border-purple-500/40 transition group relative overflow-hidden"
              >
                {/* Background glow */}
                <div className="absolute top-0 right-0 w-32 h-32 bg-purple-500/5 rounded-full blur-2xl pointer-events-none group-hover:bg-purple-500/10 transition"></div>

                <div className="space-y-3">
                  {/* Top Bar: Token & Probability */}
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="flex items-center space-x-2">
                        <span className="font-bold text-sm text-white font-mono">{sig.tokenSymbol}</span>
                        <span className="text-[11px] text-slate-400 truncate max-w-[120px]">{sig.tokenName}</span>
                      </div>
                      <div className="flex items-center space-x-2 mt-1">
                        <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-800 text-slate-400 border border-slate-700">
                          {sig.dex}
                        </span>
                        <a
                          href={getExplorerAddressUrl('solana', sig.tokenAddress)}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-[10px] text-cyber-accent hover:underline flex items-center space-x-0.5 font-mono"
                        >
                          <span>{shortenAddress(sig.tokenAddress)}</span>
                          <ExternalLink className="w-2.5 h-2.5" />
                        </a>
                      </div>
                    </div>

                    {/* Breakout Gauge */}
                    <div className="text-right">
                      <div className="flex items-center justify-end space-x-1 text-emerald-400 font-mono font-bold text-sm">
                        <Sparkles className="w-3.5 h-3.5" />
                        <span>{sig.breakoutProbability}%</span>
                      </div>
                      <span className="text-[9px] uppercase tracking-wider text-slate-400 font-semibold block">
                        Breakout Odds
                      </span>
                    </div>
                  </div>

                  {/* Pattern Banner */}
                  <div className="p-2.5 rounded-lg bg-purple-500/10 border border-purple-500/20 text-xs">
                    <div className="flex items-center space-x-1.5 text-purple-300 font-bold text-[11px] mb-1">
                      <Zap className="w-3.5 h-3.5 text-amber-400" />
                      <span>{sig.patternTitle}</span>
                    </div>
                    <p className="text-[11px] text-slate-300 leading-relaxed">
                      {sig.patternDescription}
                    </p>
                  </div>

                  {/* Financial Metrics */}
                  <div className="grid grid-cols-3 gap-2 text-center py-1">
                    <div className="bg-slate-900/60 p-2 rounded border border-cyber-border">
                      <span className="text-[9px] uppercase text-slate-400 font-semibold block">Market Cap</span>
                      <span className="font-mono text-xs font-bold text-slate-200">
                        {formatUsd(sig.marketCapUsd)}
                      </span>
                    </div>
                    <div className="bg-slate-900/60 p-2 rounded border border-cyber-border">
                      <span className="text-[9px] uppercase text-slate-400 font-semibold block">Liquidity</span>
                      <span className="font-mono text-xs font-bold text-slate-200">
                        {formatUsd(sig.liquidityUsd)}
                      </span>
                    </div>
                    <div className="bg-slate-900/60 p-2 rounded border border-cyber-border">
                      <span className="text-[9px] uppercase text-slate-400 font-semibold block">5m Influx</span>
                      <span className="font-mono text-xs font-bold text-emerald-400">
                        +{formatUsd(sig.volume5mUsd)}
                      </span>
                    </div>
                  </div>

                  {/* Smart Wallets Detected Cluster Evidence */}
                  <div className="space-y-1.5 pt-1">
                    <div className="flex items-center justify-between text-[10px] text-slate-400 uppercase font-semibold">
                      <span>Smart Money Cluster Proof</span>
                      <span>Historical Alpha</span>
                    </div>
                    {sig.smartWalletsDetected.map((w, idx) => (
                      <div
                        key={idx}
                        className="flex items-center justify-between p-2 rounded bg-slate-900/80 border border-cyber-border text-xs font-mono"
                      >
                        <div className="flex items-center space-x-1.5 truncate max-w-[170px]">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
                          <span className="text-white text-[11px] font-semibold truncate">{w.label}</span>
                        </div>
                        <div className="text-right">
                          <span className="text-emerald-400 font-bold text-[11px] block">
                            {w.capitalEfficiencyMultiplier}x ROI
                          </span>
                          <span className="text-[10px] text-slate-400">
                            {w.historicalWinRate}% Win ({w.timeAgo})
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Bottom Action: 1-Click Demo Buy */}
                <div className="mt-4 pt-3 border-t border-cyber-border/80 flex items-center justify-between">
                  <div className="text-[11px] font-mono text-slate-400">
                    Sugg. Alloc: <span className="text-white font-bold">${sig.suggestedDemoAllocationUsd}</span>
                  </div>

                  <button
                    onClick={() => handleExecuteDemoTrade(sig)}
                    disabled={executingId === sig.id}
                    className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-bold bg-gradient-to-r from-purple-600 to-cyber-accent hover:from-purple-500 hover:to-cyan-400 text-slate-950 shadow-md transition disabled:opacity-50"
                  >
                    {executingId === sig.id ? (
                      <>
                        <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                        <span>Entering...</span>
                      </>
                    ) : (
                      <>
                        <Zap className="w-3.5 h-3.5 fill-current" />
                        <span>1-Click Demo Buy</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
