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
  sortBy: 'dynamic' | 'capitalEfficiency' | 'profit' | 'winrate' | 'activity';
  setSortBy: (sb: 'dynamic' | 'capitalEfficiency' | 'profit' | 'winrate' | 'activity') => void;
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
  const [excludeBots, setExcludeBots] = useState(true);
  const [activityFilter, setActivityFilter] = useState<'all' | 'hot' | 'active'>('all');

  const handleCopy = (address: string, e: React.MouseEvent) => {
    e.stopPropagation();
    navigator.clipboard.writeText(address);
    setCopiedAddress(address);
    setTimeout(() => setCopiedAddress(null), 2000);
  };

  const filteredWallets = wallets.filter((w) => {
    if (excludeBots && w.isCopyTradeable === false) return false;
    if (activityFilter === 'hot' && w.activityStatus !== 'HOT_ACTIVE') return false;
    if (activityFilter === 'active' && w.activityStatus !== 'HOT_ACTIVE' && w.activityStatus !== 'WARM') return false;

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
      <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-3 bg-cyber-card/60 p-4 rounded-xl border border-cyber-border">
        {/* Timeframe & Activity filters */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Timeframe selector */}
          <div className="flex items-center space-x-1 bg-cyber-bg p-1 rounded-lg border border-cyber-border text-xs">
            <span className="text-slate-400 px-2 font-medium">Timeframe:</span>
            {(['24h', '7d', '30d', 'all'] as const).map((tf) => (
              <button
                key={tf}
                onClick={() => setTimeframe(tf)}
                className={`px-2.5 py-1 rounded font-mono font-medium uppercase transition-colors ${
                  timeframe === tf
                    ? 'bg-cyber-accent text-slate-950 font-bold'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                {tf === 'all' ? 'All-Time' : tf}
              </button>
            ))}
          </div>

          {/* Activity State Filter */}
          <div className="flex items-center space-x-1 bg-cyber-bg p-1 rounded-lg border border-cyber-border text-xs">
            <span className="text-slate-400 px-2 font-medium">Activity:</span>
            <button
              onClick={() => setActivityFilter('all')}
              className={`px-2 py-1 rounded font-medium transition ${
                activityFilter === 'all' ? 'bg-slate-700 text-white font-bold' : 'text-slate-400 hover:text-white'
              }`}
            >
              All
            </button>
            <button
              onClick={() => setActivityFilter('hot')}
              className={`px-2 py-1 rounded font-medium flex items-center space-x-1 transition ${
                activityFilter === 'hot' ? 'bg-emerald-500/20 text-emerald-300 font-bold border border-emerald-500/40' : 'text-slate-400 hover:text-white'
              }`}
            >
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
              <span>Hot (&lt;24h)</span>
            </button>
          </div>
        </div>

        {/* Sort selector, Anti-Bot toggle, & Search */}
        <div className="flex flex-wrap items-center gap-3 w-full lg:w-auto">
          {/* Anti-MM Bot Filter Toggle */}
          <button
            onClick={() => setExcludeBots(!excludeBots)}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center space-x-1.5 border transition-all ${
              excludeBots
                ? 'bg-emerald-950/80 border-emerald-500/50 text-emerald-300 shadow-sm shadow-emerald-500/10'
                : 'bg-slate-800/80 border-slate-700 text-slate-400 hover:text-slate-200'
            }`}
            title="Automatically excludes institutional market makers, AMM routers, and arbitrage bots"
          >
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
            <span>Anti-Bot: {excludeBots ? 'Purge Routers' : 'Show All'}</span>
          </button>

          <div className="flex items-center space-x-1.5 text-xs text-slate-400">
            <ArrowUpDown className="w-3.5 h-3.5 text-cyber-accent" />
            <span>Rank By:</span>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as any)}
              className="bg-cyber-bg border border-cyber-border rounded px-2.5 py-1 text-slate-200 text-xs focus:outline-none focus:border-cyber-accent"
            >
              <option value="dynamic">⚡ Smart Dynamic Rank (Efficiency + Activity)</option>
              <option value="capitalEfficiency">🎯 Capital Efficiency (ROI Multiplier)</option>
              <option value="profit">💰 Net Realized Profit ($)</option>
              <option value="winrate">📈 Win Rate (%)</option>
              <option value="activity">⏱ Most Active Today</option>
            </select>
          </div>

          <input
            type="text"
            placeholder="Search wallet or tag..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="bg-cyber-bg border border-cyber-border rounded px-3 py-1 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-cyber-accent w-full sm:w-44"
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
                <th className="py-3.5 px-4">Smart Wallet / Alpha Entity</th>
                <th className="py-3.5 px-4 text-center">Activity Recency</th>
                <th className="py-3.5 px-4 text-center">
                  <span className="flex items-center justify-center space-x-1 text-cyber-accent">
                    <span>Capital Efficiency</span>
                    <Zap className="w-3 h-3" />
                  </span>
                </th>
                <th className="py-3.5 px-4 text-right">
                  <span className="flex items-center justify-end space-x-1">
                    <span>Net Profit</span>
                    <TrendingUp className="w-3 h-3 text-emerald-400" />
                  </span>
                </th>
                <th className="py-3.5 px-4 text-center">Win Rate</th>
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
                    {/* Rank Badge & Movement Trend */}
                    <td className="py-4 px-4 text-center">
                      <div className="flex flex-col items-center justify-center space-y-1">
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

                        {wallet.rankTrend === 'UP' && (
                          <span className="text-[10px] text-emerald-400 font-mono font-bold flex items-center">
                            ▲ +{wallet.rankChange24h || 1}
                          </span>
                        )}
                        {wallet.rankTrend === 'DOWN' && (
                          <span className="text-[10px] text-rose-400 font-mono font-bold flex items-center">
                            ▼ {wallet.rankChange24h || -1}
                          </span>
                        )}
                        {wallet.rankTrend === 'STABLE' && (
                          <span className="text-[10px] text-slate-500 font-mono">
                            —
                          </span>
                        )}
                      </div>
                    </td>

                    {/* Smart Wallet Details */}
                    <td className="py-4 px-4">
                      <div className="space-y-1">
                        <div className="flex items-center space-x-2">
                          <span className="font-bold text-white group-hover:text-cyber-accent transition-colors">
                            {wallet.label}
                          </span>
                          <span className="px-1.5 py-0.5 rounded text-[10px] font-mono bg-cyber-bg border border-cyber-border text-slate-300">
                            Score: {wallet.dynamicRankScore || wallet.alphaScore}
                          </span>
                          {wallet.isCopyTradeable ? (
                            <span className="px-1.5 py-0.2 rounded text-[10px] font-mono bg-emerald-950/80 border border-emerald-500/40 text-emerald-300">
                              Copy-Tradeable
                            </span>
                          ) : (
                            <span className="px-1.5 py-0.2 rounded text-[10px] font-mono bg-rose-950/80 border border-rose-500/40 text-rose-300">
                              MM Router
                            </span>
                          )}
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
                            title="Open Solscan Explorer"
                          >
                            <ExternalLink className="w-3 h-3" />
                          </a>
                        </div>
                        <div className="flex flex-wrap items-center gap-1.5 mt-1">
                          <span className="text-[10px] text-emerald-400 font-mono">
                            🎯 {wallet.tradeStyle || 'Directional Alpha'}
                          </span>
                          <span className="text-slate-600">•</span>
                          <span className="text-[10px] text-slate-300 font-mono">
                            {wallet.totalTrades} deliberate trades
                          </span>
                        </div>
                      </div>
                    </td>

                    {/* Activity Recency & Streak */}
                    <td className="py-4 px-4 text-center whitespace-nowrap">
                      <div className="flex flex-col items-center space-y-1">
                        {wallet.activityStatus === 'HOT_ACTIVE' && (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-emerald-500/10 border border-emerald-500/30 text-emerald-400">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping mr-1.5"></span>
                            Hot Today
                          </span>
                        )}
                        {wallet.activityStatus === 'WARM' && (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-mono font-semibold bg-amber-500/10 border border-amber-500/30 text-amber-400">
                            <span className="w-1.5 h-1.5 rounded-full bg-amber-400 mr-1.5"></span>
                            Active (&lt;3d)
                          </span>
                        )}
                        {wallet.activityStatus === 'SLACKING_INACTIVE' && (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-mono font-semibold bg-rose-500/10 border border-rose-500/30 text-rose-400">
                            <span className="w-1.5 h-1.5 rounded-full bg-rose-400 mr-1.5"></span>
                            Slacking (&gt;7d)
                          </span>
                        )}
                        {(!wallet.activityStatus || wallet.activityStatus === 'COOLING_OFF') && (
                          <span className="text-[11px] text-slate-400 font-mono">
                            Active this week
                          </span>
                        )}

                        {(wallet.recentWinStreak || 0) > 0 && (
                          <span className="text-[10px] text-amber-300 font-mono font-bold flex items-center space-x-1">
                            <Flame className="w-2.5 h-2.5 text-amber-400 fill-current" />
                            <span>{wallet.recentWinStreak}W streak</span>
                          </span>
                        )}
                      </div>
                    </td>

                    {/* Capital Efficiency (ROI Multiplier on Deployed Capital) */}
                    <td className="py-4 px-4 text-center whitespace-nowrap">
                      <div className="space-y-0.5">
                        <div className="font-mono text-sm font-bold text-cyber-accent">
                          +{wallet.capitalEfficiencyRatio || +(wallet.totalNetProfitUsd / (wallet.initialCapitalUsd || 1000)).toFixed(1)}x ROI
                        </div>
                        <div className="text-[10px] text-slate-400 font-mono">
                          Turned ${wallet.initialCapitalUsd?.toLocaleString() || 500} → ${wallet.totalNetProfitUsd.toLocaleString()}
                        </div>
                      </div>
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

                    {/* Avg Multiplier */}
                    <td className="py-4 px-4 text-center font-mono font-bold text-cyber-accent">
                      +{wallet.avgMultiplier}x
                    </td>

                    {/* Avg Hold Duration */}
                    <td className="py-4 px-4 text-center">
                      {wallet.avgHoldDurationMinutes < 1 ? (
                        <span className="text-amber-400 font-mono text-[11px] font-bold">
                          {Math.round(wallet.avgHoldDurationMinutes * 60)}s (High-Freq Bot)
                        </span>
                      ) : (
                        <div className="space-y-0.5">
                          <div className="font-bold text-slate-200 font-mono">
                            {wallet.avgHoldDurationMinutes >= 60
                              ? `${(wallet.avgHoldDurationMinutes / 60).toFixed(1)}h`
                              : `${wallet.avgHoldDurationMinutes.toFixed(0)}m`}
                          </div>
                          <div className="text-[10px] text-emerald-400 font-mono">Directional Swing</div>
                        </div>
                      )}
                    </td>

                    {/* Copy Readiness Grade */}
                    <td className="py-4 px-4 text-center">
                      {wallet.isCopyTradeable === false ? (
                        <span className="inline-block px-2 py-0.5 rounded-md font-mono font-bold text-[10px] bg-rose-950/80 border border-rose-500/50 text-rose-300">
                          DO NOT COPY (MM)
                        </span>
                      ) : (
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
                      )}
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
