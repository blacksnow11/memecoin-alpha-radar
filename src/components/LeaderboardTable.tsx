'use client';

import React, { useState } from 'react';
import {
  ExternalLink,
  Copy,
  Check,
  TrendingUp,
  Award,
  Zap,
  BarChart2,
  Clock,
  ShieldCheck,
  Flame,
  ArrowUpDown,
} from 'lucide-react';
import { WalletProfile, ChainId } from '@/lib/types';
import { SUPPORTED_CHAINS, getExplorerAddressUrl, shortenAddress, formatUsd } from '@/lib/chains';

interface LeaderboardTableProps {
  wallets: WalletProfile[];
  timeframe: '24h' | '7d' | '30d' | 'all';
  setTimeframe: (tf: '24h' | '7d' | '30d' | 'all') => void;
  sortBy: 'profit' | 'winrate' | 'alpha';
  setSortBy: (sb: 'profit' | 'winrate' | 'alpha') => void;
  onSelectWallet: (wallet: WalletProfile) => void;
  onQuickCopy: (wallet: WalletProfile) => void;
}

export function LeaderboardTable({
  wallets,
  timeframe,
  setTimeframe,
  sortBy,
  setSortBy,
  onSelectWallet,
  onQuickCopy,
}: LeaderboardTableProps) {
  const [copiedAddress, setCopiedAddress] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  const handleCopy = (address: string, e: React.MouseEvent) => {
    e.stopPropagation();
    navigator.clipboard.writeText(address);
    setCopiedAddress(address);
    setTimeout(() => setCopiedAddress(null), 2000);
  };

  const filteredWallets = wallets.filter((w) => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return (
      w.address.toLowerCase().includes(query) ||
      w.label.toLowerCase().includes(query) ||
      w.tags.some((t) => t.toLowerCase().includes(query))
    );
  });

  return (
    <div className="space-y-4">
      {/* Table Controls Bar */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 bg-cyber-card/60 p-4 rounded-xl border border-cyber-border">
        {/* Timeframe selector */}
        <div className="flex items-center space-x-1.5 bg-cyber-bg p-1 rounded-lg border border-cyber-border text-xs">
          <span className="text-slate-400 px-2 font-medium">Timeframe:</span>
          {(['24h', '7d', '30d', 'all'] as const).map((tf) => (
            <button
              key={tf}
              onClick={() => setTimeframe(tf)}
              className={`px-3 py-1 rounded font-mono font-medium uppercase transition-colors ${
                timeframe === tf
                  ? 'bg-cyber-accent text-slate-950 font-bold'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              {tf === 'all' ? 'All-Time' : tf}
            </button>
          ))}
        </div>

        {/* Sort selector & Search */}
        <div className="flex flex-wrap items-center gap-3 w-full sm:w-auto">
          <div className="flex items-center space-x-1.5 text-xs text-slate-400">
            <ArrowUpDown className="w-3.5 h-3.5 text-cyber-accent" />
            <span>Sort By:</span>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as any)}
              className="bg-cyber-bg border border-cyber-border rounded px-2.5 py-1 text-slate-200 text-xs focus:outline-none focus:border-cyber-accent"
            >
              <option value="profit">Net Realized Profit ($)</option>
              <option value="winrate">Win Rate (%)</option>
              <option value="alpha">Alpha Smart-Money Score</option>
            </select>
          </div>

          <input
            type="text"
            placeholder="Search wallet, label, or tag..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="bg-cyber-bg border border-cyber-border rounded px-3 py-1 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-cyber-accent w-full sm:w-56"
          />
        </div>
      </div>

      {/* Main Leaderboard Table */}
      <div className="bg-cyber-card rounded-xl border border-cyber-border overflow-hidden shadow-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-900/90 text-slate-400 uppercase text-[11px] font-semibold border-b border-cyber-border">
              <tr>
                <th className="py-3.5 px-4 w-16 text-center">Rank</th>
                <th className="py-3.5 px-4">Smart Wallet / Entity</th>
                <th className="py-3.5 px-4">Chain</th>
                <th className="py-3.5 px-4 text-right">
                  <span className="flex items-center justify-end space-x-1">
                    <span>Net Profit</span>
                    <TrendingUp className="w-3 h-3 text-emerald-400" />
                  </span>
                </th>
                <th className="py-3.5 px-4 text-center">Win Rate</th>
                <th className="py-3.5 px-4 text-center">Profit Factor</th>
                <th className="py-3.5 px-4 text-center">Avg Multiplier</th>
                <th className="py-3.5 px-4 text-center">Avg Hold</th>
                <th className="py-3.5 px-4 text-center">Copy Readiness</th>
                <th className="py-3.5 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-cyber-border/60">
              {filteredWallets.map((wallet) => {
                const chain = SUPPORTED_CHAINS[wallet.chain];
                const isTop1 = wallet.rank === 1;
                const isTop2 = wallet.rank === 2;
                const isTop3 = wallet.rank === 3;

                return (
                  <tr
                    key={wallet.address}
                    onClick={() => onSelectWallet(wallet)}
                    className="hover:bg-cyber-cardHover/70 transition-colors cursor-pointer group"
                  >
                    {/* Rank Badge */}
                    <td className="py-4 px-4 text-center">
                      {isTop1 ? (
                        <div className="w-7 h-7 mx-auto rounded-full bg-amber-500/20 border border-amber-500/60 text-amber-300 font-bold font-mono flex items-center justify-center shadow-lg shadow-amber-500/10">
                          #1
                        </div>
                      ) : isTop2 ? (
                        <div className="w-7 h-7 mx-auto rounded-full bg-slate-300/20 border border-slate-300/60 text-slate-200 font-bold font-mono flex items-center justify-center">
                          #2
                        </div>
                      ) : isTop3 ? (
                        <div className="w-7 h-7 mx-auto rounded-full bg-amber-700/20 border border-amber-700/60 text-amber-500 font-bold font-mono flex items-center justify-center">
                          #3
                        </div>
                      ) : (
                        <span className="font-mono text-slate-500 font-medium">#{wallet.rank}</span>
                      )}
                    </td>

                    {/* Smart Wallet Details */}
                    <td className="py-4 px-4">
                      <div className="space-y-1">
                        <div className="flex items-center space-x-2">
                          <span className="font-bold text-white group-hover:text-cyber-accent transition-colors">
                            {wallet.label}
                          </span>
                          <span className="px-1.5 py-0.5 rounded text-[10px] font-mono bg-cyber-bg border border-cyber-border text-slate-400">
                            Alpha: {wallet.alphaScore}
                          </span>
                        </div>
                        <div className="flex items-center space-x-2 text-[11px] text-slate-400">
                          <span className="font-mono">{shortenAddress(wallet.address, 5)}</span>
                          <button
                            onClick={(e) => handleCopy(wallet.address, e)}
                            className="text-slate-500 hover:text-slate-300 transition-colors"
                            title="Copy Address"
                          >
                            {copiedAddress === wallet.address ? (
                              <Check className="w-3 h-3 text-emerald-400" />
                            ) : (
                              <Copy className="w-3 h-3" />
                            )}
                          </button>
                          <a
                            href={getExplorerAddressUrl(wallet.chain, wallet.address)}
                            target="_blank"
                            rel="noopener noreferrer"
                            onClick={(e) => e.stopPropagation()}
                            className="text-slate-500 hover:text-cyber-accent transition-colors"
                            title="Open Explorer"
                          >
                            <ExternalLink className="w-3 h-3" />
                          </a>
                        </div>
                        <div className="flex flex-wrap gap-1 mt-1">
                          {wallet.tags.slice(0, 2).map((tag, i) => (
                            <span
                              key={i}
                              className="text-[10px] px-1.5 py-0.2 rounded bg-slate-800/80 text-slate-300 border border-slate-700/60"
                            >
                              {tag}
                            </span>
                          ))}
                        </div>
                      </div>
                    </td>

                    {/* Chain */}
                    <td className="py-4 px-4 whitespace-nowrap">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium border ${chain.badgeBg}`}>
                        <span
                          className="w-1.5 h-1.5 rounded-full mr-1.5"
                          style={{ backgroundColor: chain.color }}
                        ></span>
                        {chain.name}
                      </span>
                    </td>

                    {/* Net Profit (USD & Native) */}
                    <td className="py-4 px-4 text-right whitespace-nowrap">
                      <div className="font-mono text-sm font-bold text-emerald-400">
                        +{formatUsd(wallet.totalNetProfitUsd)}
                      </div>
                      <div className="text-[11px] text-slate-400 font-mono">
                        +{wallet.totalNetProfitNative.toLocaleString()} {wallet.nativeSymbol}
                      </div>
                    </td>

                    {/* Win Rate */}
                    <td className="py-4 px-4 text-center">
                      <div className="inline-block text-left w-24">
                        <div className="flex justify-between text-[11px] font-mono mb-1">
                          <span className="font-bold text-slate-200">{wallet.winRate}%</span>
                          <span className="text-slate-500">
                            {wallet.winningTrades}W/{wallet.losingTrades}L
                          </span>
                        </div>
                        <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-gradient-to-r from-emerald-500 to-cyber-accent rounded-full"
                            style={{ width: `${wallet.winRate}%` }}
                          ></div>
                        </div>
                      </div>
                    </td>

                    {/* Profit Factor */}
                    <td className="py-4 px-4 text-center font-mono font-bold text-slate-200">
                      {wallet.profitFactor}x
                    </td>

                    {/* Avg Multiplier */}
                    <td className="py-4 px-4 text-center font-mono font-bold text-cyber-accent">
                      +{wallet.avgMultiplier}x
                    </td>

                    {/* Avg Hold Duration */}
                    <td className="py-4 px-4 text-center text-slate-300 font-mono">
                      {wallet.avgHoldDurationMinutes >= 60
                        ? `${(wallet.avgHoldDurationMinutes / 60).toFixed(1)}h`
                        : `${wallet.avgHoldDurationMinutes.toFixed(0)}m`}
                    </td>

                    {/* Copy Readiness Grade */}
                    <td className="py-4 px-4 text-center">
                      <span
                        className={`inline-block px-2.5 py-0.5 rounded-md font-mono font-bold text-xs ${
                          wallet.copyTradeReadiness.grade === 'A+'
                            ? 'bg-emerald-950/80 border border-emerald-500/50 text-emerald-300 glow-emerald'
                            : wallet.copyTradeReadiness.grade === 'A'
                            ? 'bg-emerald-950/60 border border-emerald-500/40 text-emerald-400'
                            : wallet.copyTradeReadiness.grade.startsWith('B')
                            ? 'bg-blue-950/60 border border-blue-500/40 text-blue-400'
                            : 'bg-amber-950/60 border border-amber-500/40 text-amber-400'
                        }`}
                      >
                        {wallet.copyTradeReadiness.grade}
                      </span>
                    </td>

                    {/* Actions */}
                    <td className="py-4 px-4 text-right whitespace-nowrap">
                      <div className="flex items-center justify-end space-x-2">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            onSelectWallet(wallet);
                          }}
                          className="px-2.5 py-1.5 rounded-lg text-xs font-medium bg-slate-800 hover:bg-slate-700 text-slate-200 transition-colors flex items-center space-x-1"
                        >
                          <BarChart2 className="w-3.5 h-3.5 text-cyber-accent" />
                          <span>Inspect Proof</span>
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            onQuickCopy(wallet);
                          }}
                          className="px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-emerald-500/90 hover:bg-emerald-400 text-slate-950 transition-colors flex items-center space-x-1"
                        >
                          <Zap className="w-3.5 h-3.5" />
                          <span>Copy</span>
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
