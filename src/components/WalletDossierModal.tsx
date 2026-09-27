'use client';

import React, { useState } from 'react';
import {
  X,
  TrendingUp,
  ExternalLink,
  ShieldCheck,
  Zap,
  Clock,
  Target,
  AlertTriangle,
  Award,
  BarChart2,
  Copy,
  Check,
} from 'lucide-react';
import { WalletProfile } from '@/lib/types';
import { SUPPORTED_CHAINS, getExplorerAddressUrl, getExplorerTxUrl, formatUsd, shortenAddress } from '@/lib/chains';

interface WalletDossierModalProps {
  wallet: WalletProfile;
  onClose: () => void;
  onStartCopy: (wallet: WalletProfile) => void;
}

export function WalletDossierModal({ wallet, onClose, onStartCopy }: WalletDossierModalProps) {
  const [activeTab, setActiveTab] = useState<'proof' | 'trades' | 'signature'>('proof');
  const [copied, setCopied] = useState(false);
  const chain = SUPPORTED_CHAINS[wallet.chain];

  const handleCopy = () => {
    navigator.clipboard.writeText(wallet.address);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Render SVG Equity Curve
  const renderEquityChart = () => {
    const points = wallet.equityCurve;
    if (!points || points.length === 0) return null;

    const maxVal = Math.max(...points.map((p) => p.pnlUsd));
    const minVal = Math.min(...points.map((p) => p.pnlUsd), 0);
    const range = maxVal - minVal || 1;

    const width = 640;
    const height = 180;
    const padX = 20;
    const padY = 20;

    const svgPoints = points
      .map((p, i) => {
        const x = padX + (i / (points.length - 1)) * (width - padX * 2);
        const y = height - padY - ((p.pnlUsd - minVal) / range) * (height - padY * 2);
        return `${x},${y}`;
      })
      .join(' ');

    const areaPath = `M ${padX},${height - padY} L ${svgPoints} L ${width - padX},${height - padY} Z`;

    return (
      <div className="bg-cyber-bg/80 p-4 rounded-xl border border-cyber-border">
        <div className="flex justify-between items-center mb-2">
          <span className="text-xs font-bold text-slate-300 flex items-center space-x-1.5">
            <TrendingUp className="w-4 h-4 text-emerald-400" />
            <span>Cumulative Realized P&L Growth Timeline</span>
          </span>
          <span className="text-xs font-mono font-bold text-emerald-400">
            +{formatUsd(wallet.totalNetProfitUsd)} ({wallet.totalNetProfitNative} {wallet.nativeSymbol})
          </span>
        </div>
        <div className="w-full overflow-hidden">
          <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-44">
            <defs>
              <linearGradient id="equityGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#10B981" stopOpacity="0.35" />
                <stop offset="100%" stopColor="#10B981" stopOpacity="0.0" />
              </linearGradient>
            </defs>
            {/* Grid lines */}
            <line x1={padX} y1={height / 2} x2={width - padX} y2={height / 2} stroke="#1e293b" strokeDasharray="3 3" />
            {/* Gradient area */}
            <path d={areaPath} fill="url(#equityGrad)" />
            {/* Curve line */}
            <polyline fill="none" stroke="#10B981" strokeWidth="2.5" points={svgPoints} />
            {/* Endpoint Dot */}
            {points.length > 0 && (
              <circle
                cx={width - padX}
                cy={height - padY - ((points[points.length - 1].pnlUsd - minVal) / range) * (height - padY * 2)}
                r="4.5"
                fill="#38BDF8"
                className="animate-pulse"
              />
            )}
          </svg>
        </div>
        <div className="flex justify-between text-[11px] text-slate-500 font-mono mt-1">
          <span>30 Days Ago</span>
          <span>15 Days Ago</span>
          <span>Today (Peak Alpha)</span>
        </div>
      </div>
    );
  };

  // Render Multiplier Distribution Bar Chart
  const renderDistribution = () => {
    const dist = wallet.multiplierDistribution;
    const total =
      dist.moonshots100xPlus +
      dist.highWins10xTo100x +
      dist.midWins2xTo10x +
      dist.smallWins1xTo2x +
      dist.breakeven +
      dist.losses || 1;

    const buckets = [
      { label: '100x+ Moonshots', count: dist.moonshots100xPlus, color: 'bg-purple-500', text: 'text-purple-300' },
      { label: '10x - 100x High Wins', count: dist.highWins10xTo100x, color: 'bg-emerald-400', text: 'text-emerald-300' },
      { label: '2x - 10x Mid Wins', count: dist.midWins2xTo10x, color: 'bg-cyan-400', text: 'text-cyan-300' },
      { label: '1x - 2x Small Wins', count: dist.smallWins1xTo2x, color: 'bg-blue-400', text: 'text-blue-300' },
      { label: 'Breakeven', count: dist.breakeven, color: 'bg-slate-500', text: 'text-slate-400' },
      { label: 'Losses / Cut', count: dist.losses, color: 'bg-crimson', text: 'text-rose-400' },
    ];

    return (
      <div className="bg-cyber-bg/80 p-4 rounded-xl border border-cyber-border">
        <span className="text-xs font-bold text-slate-300 flex items-center space-x-1.5 mb-3">
          <BarChart2 className="w-4 h-4 text-cyber-accent" />
          <span>Multiplier & Win/Loss Distribution Spectrum</span>
        </span>
        <div className="space-y-2">
          {buckets.map((b, idx) => {
            const pct = Math.round((b.count / total) * 100);
            return (
              <div key={idx} className="space-y-0.5">
                <div className="flex justify-between text-[11px] font-mono">
                  <span className={b.text}>{b.label}</span>
                  <span className="text-slate-300">
                    {b.count} trades ({pct}%)
                  </span>
                </div>
                <div className="w-full h-2 bg-slate-900 rounded-full overflow-hidden">
                  <div className={`h-full ${b.color} rounded-full`} style={{ width: `${pct}%` }}></div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md overflow-y-auto">
      <div className="bg-cyber-card border border-cyber-border rounded-2xl w-full max-w-4xl shadow-2xl overflow-hidden my-8">
        {/* Modal Header */}
        <div className="p-6 border-b border-cyber-border flex items-start justify-between bg-slate-900/60">
          <div className="space-y-1.5">
            <div className="flex items-center space-x-2.5">
              <span className="px-2 py-0.5 rounded-full font-mono text-xs font-bold bg-amber-500/20 text-amber-300 border border-amber-500/50">
                Rank #{wallet.rank} Top Pick
              </span>
              <h2 className="text-xl font-bold text-white tracking-wide">{wallet.label}</h2>
              <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold border ${chain.badgeBg}`}>
                {chain.name}
              </span>
            </div>

            <div className="flex items-center space-x-3 text-xs text-slate-400 font-mono">
              <span>{wallet.address}</span>
              <button
                onClick={handleCopy}
                className="hover:text-white transition-colors"
                title="Copy Address"
              >
                {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
              </button>
              <a
                href={getExplorerAddressUrl(wallet.chain, wallet.address)}
                target="_blank"
                rel="noopener noreferrer"
                className="text-cyber-accent hover:underline flex items-center space-x-1"
              >
                <span>Explorer</span>
                <ExternalLink className="w-3 h-3" />
              </a>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            <button
              onClick={() => onStartCopy(wallet)}
              className="px-4 py-2 rounded-xl text-xs font-bold bg-emerald-500 hover:bg-emerald-400 text-slate-950 flex items-center space-x-1.5 shadow-lg shadow-emerald-500/20 transition-all"
            >
              <Zap className="w-4 h-4" />
              <span>Copy This Wallet</span>
            </button>
            <button
              onClick={onClose}
              className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Forensic Dossier Tab Navigation */}
        <div className="flex border-b border-cyber-border bg-cyber-bg/50 px-6">
          <button
            onClick={() => setActiveTab('proof')}
            className={`py-3 px-4 text-xs font-bold border-b-2 transition-all flex items-center space-x-2 ${
              activeTab === 'proof'
                ? 'border-cyber-accent text-cyber-accent'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <TrendingUp className="w-4 h-4" />
            <span>Why This Pick Wins (Forensic Evidence)</span>
          </button>

          <button
            onClick={() => setActiveTab('trades')}
            className={`py-3 px-4 text-xs font-bold border-b-2 transition-all flex items-center space-x-2 ${
              activeTab === 'trades'
                ? 'border-cyber-accent text-cyber-accent'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Clock className="w-4 h-4" />
            <span>Historical Trades Ledger ({wallet.trades.length})</span>
          </button>

          <button
            onClick={() => setActiveTab('signature')}
            className={`py-3 px-4 text-xs font-bold border-b-2 transition-all flex items-center space-x-2 ${
              activeTab === 'signature'
                ? 'border-cyber-accent text-cyber-accent'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <ShieldCheck className="w-4 h-4" />
            <span>Alpha Signature & Copy Viability</span>
          </button>
        </div>

        {/* Modal Content */}
        <div className="p-6 max-h-[70vh] overflow-y-auto space-y-6">
          {activeTab === 'proof' && (
            <div className="space-y-6">
              {/* Key Quantitative Proof Metrics */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="bg-cyber-bg p-3.5 rounded-xl border border-cyber-border">
                  <span className="text-[11px] text-slate-400 uppercase font-semibold">Total Realized Profit</span>
                  <div className="font-mono text-lg font-bold text-emerald-400 mt-1">
                    +{formatUsd(wallet.totalNetProfitUsd)}
                  </div>
                  <span className="text-[11px] text-slate-500 font-mono">
                    +{wallet.totalNetProfitNative} {wallet.nativeSymbol}
                  </span>
                </div>

                <div className="bg-cyber-bg p-3.5 rounded-xl border border-cyber-border">
                  <span className="text-[11px] text-slate-400 uppercase font-semibold">Win Rate (Confirmed)</span>
                  <div className="font-mono text-lg font-bold text-slate-100 mt-1">
                    {wallet.winRate}%
                  </div>
                  <span className="text-[11px] text-slate-500 font-mono">
                    {wallet.winningTrades} Wins / {wallet.losingTrades} Losses
                  </span>
                </div>

                <div className="bg-cyber-bg p-3.5 rounded-xl border border-cyber-border">
                  <span className="text-[11px] text-slate-400 uppercase font-semibold">Profit Factor</span>
                  <div className="font-mono text-lg font-bold text-cyber-accent mt-1">
                    {wallet.profitFactor}x
                  </div>
                  <span className="text-[11px] text-slate-500 font-mono">
                    Gross Wins / Losses
                  </span>
                </div>

                <div className="bg-cyber-bg p-3.5 rounded-xl border border-cyber-border">
                  <span className="text-[11px] text-slate-400 uppercase font-semibold">Sharpe Ratio</span>
                  <div className="font-mono text-lg font-bold text-purple-400 mt-1">
                    {wallet.sharpeRatio}
                  </div>
                  <span className="text-[11px] text-slate-500 font-mono">
                    Max Drawdown: -{wallet.maxDrawdownPercent}%
                  </span>
                </div>
              </div>

              {/* Equity Curve & Multiplier Distribution */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {renderEquityChart()}
                {renderDistribution()}
              </div>

              {/* "Why Our Top Picks Are Top Picks" Forensic Evidence Card */}
              <div className="bg-gradient-to-br from-slate-900 to-cyber-bg p-5 rounded-xl border border-cyber-border space-y-3">
                <div className="flex items-center space-x-2 text-cyber-accent">
                  <Award className="w-5 h-5" />
                  <h3 className="font-bold text-sm text-white">Why {wallet.label} is Ranked #{wallet.rank}</h3>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
                  <div className="p-3 bg-cyber-card rounded-lg border border-cyber-border/80">
                    <span className="font-bold text-emerald-400 block mb-1">1. Ultra-Early Entry Edge</span>
                    <p className="text-slate-300 leading-relaxed">
                      Enters within the first <strong className="text-white">{wallet.alphaSignature.earlyEntryPercent}%</strong> of pool deployment (Block 0-1 snipes), securing ground-floor liquidity pricing before retail FOMO.
                    </p>
                  </div>

                  <div className="p-3 bg-cyber-card rounded-lg border border-cyber-border/80">
                    <span className="font-bold text-cyber-accent block mb-1">2. Disciplined DCA Scaling</span>
                    <p className="text-slate-300 leading-relaxed">
                      Never round-trips winners to zero. Mechanically takes profit at{' '}
                      <strong className="text-white">{wallet.alphaSignature.avgProfitTakingLevels.join(', ')}</strong>.
                    </p>
                  </div>

                  <div className="p-3 bg-cyber-card rounded-lg border border-cyber-border/80">
                    <span className="font-bold text-purple-400 block mb-1">3. Zero-Honeypot Track Record</span>
                    <p className="text-slate-300 leading-relaxed">
                      Maintains a <strong className="text-white">{wallet.alphaSignature.rugAvoidanceRate}%</strong> scam avoidance rate, filtering out unverified mint authorities and fake liquidity traps.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'trades' && (
            <div className="space-y-4">
              <div className="flex justify-between items-center text-xs text-slate-400">
                <span>Verified On-Chain Memecoin Trades Ledger</span>
                <span>All timestamps synced to DEX blocks</span>
              </div>

              {wallet.trades.length === 0 ? (
                <div className="text-center py-12 text-slate-500 text-xs">
                  No recent trades recorded for this wallet in the current sampling window.
                </div>
              ) : (
                <div className="border border-cyber-border rounded-xl overflow-hidden">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-900 text-slate-400 font-semibold border-b border-cyber-border">
                      <tr>
                        <th className="py-2.5 px-3">Token</th>
                        <th className="py-2.5 px-3">Action</th>
                        <th className="py-2.5 px-3 text-right">Exit Multiplier</th>
                        <th className="py-2.5 px-3 text-right">Realized Gain</th>
                        <th className="py-2.5 px-3 text-center">Hold Time</th>
                        <th className="py-2.5 px-3 text-center">DEX</th>
                        <th className="py-2.5 px-3 text-right">Tx Explorer</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-cyber-border/60 font-mono">
                      {wallet.trades.map((t) => (
                        <tr key={t.id} className="hover:bg-slate-900/50">
                          <td className="py-3 px-3">
                            <div className="font-bold text-white">{t.tokenSymbol}</div>
                            <div className="text-[10px] text-slate-500">{t.tokenName}</div>
                          </td>
                          <td className="py-3 px-3">
                            <span
                              className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                                t.action === 'BUY'
                                  ? 'bg-emerald-950 text-emerald-400 border border-emerald-500/40'
                                  : 'bg-blue-950 text-blue-400 border border-blue-500/40'
                              }`}
                            >
                              {t.action}
                            </span>
                          </td>
                          <td className="py-3 px-3 text-right font-bold text-cyber-accent">
                            {t.multiplier ? `+${t.multiplier}x` : 'Open'}
                          </td>
                          <td className="py-3 px-3 text-right text-emerald-400 font-bold">
                            {t.pnlUsd ? `+${formatUsd(t.pnlUsd)}` : '-'}
                          </td>
                          <td className="py-3 px-3 text-center text-slate-300">
                            {t.holdDurationSeconds
                              ? t.holdDurationSeconds > 3600
                                ? `${(t.holdDurationSeconds / 3600).toFixed(1)}h`
                                : `${(t.holdDurationSeconds / 60).toFixed(0)}m`
                              : '-'}
                          </td>
                          <td className="py-3 px-3 text-center text-slate-400 text-[11px]">{t.dex}</td>
                          <td className="py-3 px-3 text-right">
                            <a
                              href={getExplorerTxUrl(wallet.chain, t.txHash)}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-cyber-accent hover:underline inline-flex items-center space-x-1"
                            >
                              <span>{shortenAddress(t.txHash, 3)}</span>
                              <ExternalLink className="w-3 h-3" />
                            </a>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {activeTab === 'signature' && (
            <div className="space-y-6">
              {/* Copy Trade Readiness Assessment */}
              <div className="bg-cyber-bg p-5 rounded-xl border border-cyber-border space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <ShieldCheck className="w-5 h-5 text-emerald-400" />
                    <h3 className="font-bold text-sm text-white">Copy-Trading Viability Grade</h3>
                  </div>
                  <span className="px-3 py-1 rounded-lg font-mono font-bold text-sm bg-emerald-950 text-emerald-300 border border-emerald-500/50">
                    Grade {wallet.copyTradeReadiness.grade}
                  </span>
                </div>

                <p className="text-xs text-slate-300 leading-relaxed">
                  {wallet.copyTradeReadiness.explanation}
                </p>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2">
                  <div className="p-3 bg-cyber-card rounded-lg border border-cyber-border">
                    <span className="text-[10px] text-slate-400 uppercase font-semibold">Slippage Risk</span>
                    <div className="font-mono text-xs font-bold text-emerald-400 mt-1">
                      {wallet.copyTradeReadiness.slippageRisk}
                    </div>
                  </div>

                  <div className="p-3 bg-cyber-card rounded-lg border border-cyber-border">
                    <span className="text-[10px] text-slate-400 uppercase font-semibold">Front-Run Vulnerability</span>
                    <div className="font-mono text-xs font-bold text-emerald-400 mt-1">
                      {wallet.copyTradeReadiness.frontrunRisk}
                    </div>
                  </div>

                  <div className="p-3 bg-cyber-card rounded-lg border border-cyber-border">
                    <span className="text-[10px] text-slate-400 uppercase font-semibold">Recommended Copy Sizing</span>
                    <div className="font-mono text-xs font-bold text-cyber-accent mt-1">
                      ${wallet.copyTradeReadiness.recommendedCopySizeUsd} per trade
                    </div>
                  </div>
                </div>
              </div>

              {/* Behavioral Radar Metrics */}
              <div className="bg-cyber-bg p-5 rounded-xl border border-cyber-border space-y-4">
                <h3 className="font-bold text-sm text-white flex items-center space-x-2">
                  <Target className="w-4 h-4 text-cyber-accent" />
                  <span>On-Chain Behavioral Diagnostics</span>
                </h3>

                <div className="space-y-3">
                  <div>
                    <div className="flex justify-between text-xs font-mono mb-1">
                      <span className="text-slate-300">Sniper Execution Speed</span>
                      <span className="text-emerald-400 font-bold">{wallet.alphaSignature.sniperSpeedScore}/100</span>
                    </div>
                    <div className="w-full h-2 bg-slate-900 rounded-full overflow-hidden">
                      <div className="h-full bg-emerald-500 rounded-full" style={{ width: `${wallet.alphaSignature.sniperSpeedScore}%` }}></div>
                    </div>
                  </div>

                  <div>
                    <div className="flex justify-between text-xs font-mono mb-1">
                      <span className="text-slate-300">Exit Discipline (DCA Laddering)</span>
                      <span className="text-cyber-accent font-bold">{wallet.alphaSignature.exitDisciplineScore}/100</span>
                    </div>
                    <div className="w-full h-2 bg-slate-900 rounded-full overflow-hidden">
                      <div className="h-full bg-cyber-accent rounded-full" style={{ width: `${wallet.alphaSignature.exitDisciplineScore}%` }}></div>
                    </div>
                  </div>

                  <div>
                    <div className="flex justify-between text-xs font-mono mb-1">
                      <span className="text-slate-300">Scam & Honeypot Avoidance</span>
                      <span className="text-purple-400 font-bold">{wallet.alphaSignature.rugAvoidanceRate}%</span>
                    </div>
                    <div className="w-full h-2 bg-slate-900 rounded-full overflow-hidden">
                      <div className="h-full bg-purple-500 rounded-full" style={{ width: `${wallet.alphaSignature.rugAvoidanceRate}%` }}></div>
                    </div>
                  </div>

                  <div>
                    <div className="flex justify-between text-xs font-mono mb-1">
                      <span className="text-slate-300">Insider / Dev Collusion Suspicion (Lower is better)</span>
                      <span className="text-slate-400 font-bold">{wallet.alphaSignature.insiderSuspicionScore}% (Organic Smart Money)</span>
                    </div>
                    <div className="w-full h-2 bg-slate-900 rounded-full overflow-hidden">
                      <div className="h-full bg-slate-600 rounded-full" style={{ width: `${wallet.alphaSignature.insiderSuspicionScore}%` }}></div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
