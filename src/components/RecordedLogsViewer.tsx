'use client';

import React, { useState } from 'react';
import {
  Shield,
  Download,
  Search,
  Filter,
  CheckCircle,
  XCircle,
  AlertTriangle,
  RotateCcw,
  TrendingUp,
  FileText,
  HelpCircle,
  Tag,
  ArrowRight,
} from 'lucide-react';
import { DecisionLog } from '@/lib/types';
import { SUPPORTED_CHAINS } from '@/lib/chains';

interface RecordedLogsViewerProps {
  logs: DecisionLog[];
}

export function RecordedLogsViewer({ logs }: RecordedLogsViewerProps) {
  const [filterType, setFilterType] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState('');

  const filteredLogs = logs.filter((log) => {
    // Filter by type
    if (filterType === 'ENTRIES' && log.type !== 'ENTRY_EXECUTED') return false;
    if (filterType === 'EXITS' && !log.type.startsWith('EXIT_')) return false;
    if (filterType === 'REJECTS' && log.type !== 'EVALUATION_REJECT') return false;
    if (filterType === 'RELOADS' && log.type !== 'AUTO_RELOAD') return false;

    // Search
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (
      log.tokenSymbol.toLowerCase().includes(q) ||
      log.action.toLowerCase().includes(q) ||
      log.rationale.toLowerCase().includes(q) ||
      log.improvementLessonTag.toLowerCase().includes(q) ||
      (log.triggeredByWalletLabel && log.triggeredByWalletLabel.toLowerCase().includes(q))
    );
  });

  const exportJson = () => {
    const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(logs, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute('href', dataStr);
    downloadAnchor.setAttribute('download', `memealpha_decision_logs_${Date.now()}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  };

  const exportCsv = () => {
    const headers = ['Timestamp', 'Type', 'Token', 'Chain', 'TriggeredBy', 'ConvictionScore', 'Action', 'Rationale', 'OutcomePnlUsd', 'LessonTag', 'ImprovementNote'];
    const rows = logs.map((l) => [
      new Date(l.timestamp).toISOString(),
      l.type,
      l.tokenSymbol,
      l.chain,
      `"${l.triggeredByWalletLabel || l.triggeredByWallet || ''}"`,
      l.convictionScore,
      `"${l.action.replace(/"/g, '""')}"`,
      `"${l.rationale.replace(/"/g, '""')}"`,
      l.outcomePnlUsd ?? '',
      `"${l.improvementLessonTag}"`,
      `"${l.improvementNote.replace(/"/g, '""')}"`,
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map((e) => e.join(','))].join('\n');
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute('href', encodeURI(csvContent));
    downloadAnchor.setAttribute('download', `memealpha_decision_logs_${Date.now()}.csv`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  };

  return (
    <div className="space-y-6">
      {/* Header & Export Controls */}
      <div className="bg-cyber-card p-6 rounded-2xl border border-cyber-border flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center space-x-2.5">
            <div className="w-8 h-8 rounded-lg bg-purple-500/20 border border-purple-500/40 flex items-center justify-center">
              <FileText className="w-5 h-5 text-purple-400" />
            </div>
            <h2 className="text-xl font-bold text-white tracking-wide">
              Forensic Decision Logs & Strategy Improvement Lab
            </h2>
          </div>
          <p className="text-xs text-slate-400 max-w-2xl leading-relaxed">
            Every trade decision, rejection, and exit is timestamped with algorithmic rationale and diagnostic lesson tags so you can analyze patterns and improve the bot’s profitability.
          </p>
        </div>

        {/* Export Buttons */}
        <div className="flex items-center space-x-2 shrink-0">
          <button
            onClick={exportCsv}
            className="px-3.5 py-2 rounded-xl text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-200 border border-cyber-border flex items-center space-x-1.5 transition-colors"
          >
            <Download className="w-4 h-4 text-emerald-400" />
            <span>Export CSV</span>
          </button>
          <button
            onClick={exportJson}
            className="px-3.5 py-2 rounded-xl text-xs font-semibold bg-purple-600 hover:bg-purple-500 text-white flex items-center space-x-1.5 shadow-lg transition-colors"
          >
            <Download className="w-4 h-4" />
            <span>Export JSON</span>
          </button>
        </div>
      </div>

      {/* Filter & Search Bar */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 bg-cyber-card/60 p-4 rounded-xl border border-cyber-border">
        {/* Category Tabs */}
        <div className="flex items-center space-x-1.5 bg-cyber-bg p-1 rounded-lg border border-cyber-border text-xs">
          <button
            onClick={() => setFilterType('ALL')}
            className={`px-3 py-1 rounded font-medium transition-colors ${
              filterType === 'ALL' ? 'bg-purple-500 text-white font-bold' : 'text-slate-400 hover:text-white'
            }`}
          >
            All Logs ({logs.length})
          </button>
          <button
            onClick={() => setFilterType('ENTRIES')}
            className={`px-3 py-1 rounded font-medium transition-colors ${
              filterType === 'ENTRIES' ? 'bg-emerald-500 text-slate-950 font-bold' : 'text-slate-400 hover:text-white'
            }`}
          >
            Entries
          </button>
          <button
            onClick={() => setFilterType('EXITS')}
            className={`px-3 py-1 rounded font-medium transition-colors ${
              filterType === 'EXITS' ? 'bg-cyber-accent text-slate-950 font-bold' : 'text-slate-400 hover:text-white'
            }`}
          >
            Exits (TP & SL)
          </button>
          <button
            onClick={() => setFilterType('REJECTS')}
            className={`px-3 py-1 rounded font-medium transition-colors ${
              filterType === 'REJECTS' ? 'bg-crimson text-white font-bold' : 'text-slate-400 hover:text-white'
            }`}
          >
            Filtered Out / Rejections
          </button>
          <button
            onClick={() => setFilterType('RELOADS')}
            className={`px-3 py-1 rounded font-medium transition-colors ${
              filterType === 'RELOADS' ? 'bg-blue-600 text-white font-bold' : 'text-slate-400 hover:text-white'
            }`}
          >
            $100 Reloads
          </button>
        </div>

        {/* Search */}
        <div className="w-full sm:w-72">
          <input
            type="text"
            placeholder="Search rationale, token, lesson tag..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-cyber-bg border border-cyber-border rounded-lg px-3 py-1.5 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-purple-400"
          />
        </div>
      </div>

      {/* Decision Logs Stream Cards */}
      <div className="space-y-3.5">
        {filteredLogs.length === 0 ? (
          <div className="bg-cyber-card p-12 text-center rounded-xl border border-dashed border-cyber-border text-slate-500 text-xs">
            No decision logs match the current filter.
          </div>
        ) : (
          filteredLogs.map((log) => {
            const chain = SUPPORTED_CHAINS[log.chain];
            const isEntry = log.type === 'ENTRY_EXECUTED';
            const isTP = log.type === 'EXIT_TAKE_PROFIT';
            const isSL = log.type === 'EXIT_STOP_LOSS';
            const isReject = log.type === 'EVALUATION_REJECT';
            const isReload = log.type === 'AUTO_RELOAD';

            return (
              <div
                key={log.id}
                className="bg-cyber-card border border-cyber-border hover:border-slate-600 rounded-xl p-4.5 space-y-3 transition-colors shadow-md"
              >
                {/* Top Row: Type, Token, Timestamp, Score */}
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-cyber-border/40 pb-2.5">
                  <div className="flex items-center space-x-2">
                    {/* Badge */}
                    {isEntry && (
                      <span className="px-2.5 py-0.5 rounded-md text-[11px] font-bold bg-emerald-950/80 border border-emerald-500/50 text-emerald-300 flex items-center space-x-1">
                        <CheckCircle className="w-3 h-3 text-emerald-400" />
                        <span>ENTRY EXECUTED</span>
                      </span>
                    )}
                    {isTP && (
                      <span className="px-2.5 py-0.5 rounded-md text-[11px] font-bold bg-cyan-950/80 border border-cyan-500/50 text-cyan-300 flex items-center space-x-1">
                        <TrendingUp className="w-3 h-3 text-cyan-400" />
                        <span>TAKE PROFIT HIT (+{log.outcomePnlPercent}%)</span>
                      </span>
                    )}
                    {isSL && (
                      <span className="px-2.5 py-0.5 rounded-md text-[11px] font-bold bg-rose-950/80 border border-rose-500/50 text-rose-300 flex items-center space-x-1">
                        <XCircle className="w-3 h-3 text-rose-400" />
                        <span>STOP LOSS CUT ({log.outcomePnlPercent}%)</span>
                      </span>
                    )}
                    {isReject && (
                      <span className="px-2.5 py-0.5 rounded-md text-[11px] font-bold bg-slate-900 border border-slate-700 text-slate-400 flex items-center space-x-1">
                        <AlertTriangle className="w-3 h-3 text-amber-400" />
                        <span>FILTER REJECTED</span>
                      </span>
                    )}
                    {isReload && (
                      <span className="px-2.5 py-0.5 rounded-md text-[11px] font-bold bg-blue-950/80 border border-blue-500/50 text-blue-300 flex items-center space-x-1">
                        <RotateCcw className="w-3 h-3 text-blue-400" />
                        <span>AUTO-RELOAD DEPOSIT</span>
                      </span>
                    )}

                    {/* Token & Chain */}
                    <span className="font-bold text-white font-mono text-sm">{log.tokenSymbol}</span>
                    <span className={`px-2 py-0.5 rounded text-[10px] font-semibold border ${chain?.badgeBg || ''}`}>
                      {chain?.name || log.chain}
                    </span>
                  </div>

                  <div className="flex items-center space-x-3 text-xs">
                    <span className="font-mono text-slate-400">
                      Conviction: <strong className="text-white">{log.convictionScore}/100</strong>
                    </span>
                    <span className="text-slate-500 font-mono text-[11px]">
                      {new Date(log.timestamp).toLocaleTimeString()}
                    </span>
                  </div>
                </div>

                {/* Middle Row: Action & Rationale ("Why It Thought It Was Profitable") */}
                <div className="space-y-1.5 text-xs">
                  <div className="text-slate-200 font-medium font-mono text-[13px]">
                    {log.action}
                  </div>

                  <div className="bg-cyber-bg/80 p-3 rounded-lg border border-cyber-border/70 space-y-1">
                    <span className="text-[10px] text-slate-400 uppercase font-bold tracking-wider block">
                      Algorithmic Rationale & Entry Evidence:
                    </span>
                    <p className="text-slate-300 leading-relaxed">{log.rationale}</p>
                    {log.triggeredByWalletLabel && (
                      <div className="text-[11px] text-cyber-accent font-mono pt-1">
                        Triggered by Smart Wallet: <strong>{log.triggeredByWalletLabel}</strong>
                      </div>
                    )}
                  </div>
                </div>

                {/* Bottom Row: Improvement Lesson & Actionable Insight */}
                <div className="bg-slate-900/60 p-3 rounded-lg border border-cyber-border/40 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 text-xs">
                  <div className="flex items-center space-x-2">
                    <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-purple-950/80 border border-purple-500/40 text-purple-300">
                      {log.improvementLessonTag}
                    </span>
                    <span className="text-slate-300">{log.improvementNote}</span>
                  </div>

                  {log.outcomePnlUsd !== undefined && (
                    <div
                      className={`font-mono font-bold shrink-0 ${
                        log.outcomePnlUsd >= 0 ? 'text-emerald-400' : 'text-crimson'
                      }`}
                    >
                      {log.outcomePnlUsd >= 0 ? '+' : ''}${log.outcomePnlUsd.toFixed(2)}
                    </div>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
