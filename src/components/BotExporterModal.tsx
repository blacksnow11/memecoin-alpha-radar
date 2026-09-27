'use client';

import React, { useState } from 'react';
import { X, Copy, Check, Zap, Bot, Send, Terminal } from 'lucide-react';
import { SEED_WALLETS } from '@/lib/wallet-engine';

interface BotExporterModalProps {
  onClose: () => void;
}

export function BotExporterModal({ onClose }: BotExporterModalProps) {
  const [selectedBot, setSelectedBot] = useState<'trojan' | 'maestro' | 'bonkbot' | 'webhook'>('trojan');
  const [copied, setCopied] = useState(false);

  // Generate configuration JSON / commands
  const topWallets = SEED_WALLETS.slice(0, 5);

  const getBotConfig = () => {
    if (selectedBot === 'trojan') {
      return topWallets
        .filter((w) => w.chain === 'solana')
        .map(
          (w) =>
            `/copy add ${w.address} buy_amount=0.25 max_slippage=2.5 auto_tp="50%@2x,50%@5x" sl=20 tag="${w.label}"`
        )
        .join('\n');
    }

    if (selectedBot === 'maestro') {
      return JSON.stringify(
        {
          bot: 'Maestro Sniper Bot',
          copy_targets: topWallets.map((w) => ({
            chain: w.chain,
            target_wallet: w.address,
            label: w.label,
            buy_fixed_usd: 25,
            slippage_percent: 2.0,
            anti_mev_private_tx: true,
            take_profit_ladder: [
              { multiplier: 2.0, sell_percent: 50 },
              { multiplier: 5.0, sell_percent: 50 },
            ],
            stop_loss_percent: -20,
          })),
        },
        null,
        2
      );
    }

    if (selectedBot === 'bonkbot') {
      return topWallets
        .filter((w) => w.chain === 'solana')
        .map((w) => `/track ${w.address} auto_buy=0.5sol priority_fee=0.005sol`)
        .join('\n');
    }

    // Webhook configuration
    return JSON.stringify(
      {
        webhook_endpoint: 'https://your-domain.vercel.app/api/webhook/copy-trade',
        auth_header: 'Bearer MEME_ALPHA_SECRET_KEY',
        event: 'SMART_WALLET_BUY_SIGNAL',
        min_alpha_conviction: 80,
        tracked_wallets_count: topWallets.length,
        targets: topWallets.map((w) => ({
          address: w.address,
          chain: w.chain,
          win_rate: w.winRate,
        })),
      },
      null,
      2
    );
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(getBotConfig());
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md">
      <div className="bg-cyber-card border border-cyber-border rounded-2xl w-full max-w-2xl p-6 shadow-2xl space-y-5">
        <div className="flex items-center justify-between border-b border-cyber-border pb-3">
          <div className="flex items-center space-x-2">
            <Zap className="w-5 h-5 text-cyber-accent" />
            <h3 className="text-base font-bold text-white">Export Copy-Trading Bot Configurations</h3>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-white">
            <X className="w-5 h-5" />
          </button>
        </div>

        <p className="text-xs text-slate-400 leading-relaxed">
          Instantly export optimized copy-trading commands or webhook payloads configured with our top-ranked smart wallets, dynamic take-profit ladders, and anti-MEV protection.
        </p>

        {/* Bot selector */}
        <div className="grid grid-cols-4 gap-2 text-xs">
          {[
            { id: 'trojan', label: 'Trojan on Solana' },
            { id: 'maestro', label: 'Maestro Sniper' },
            { id: 'bonkbot', label: 'BonkBot' },
            { id: 'webhook', label: 'Custom Webhook' },
          ].map((bot) => (
            <button
              key={bot.id}
              onClick={() => setSelectedBot(bot.id as any)}
              className={`py-2 px-3 rounded-lg font-medium transition-colors text-center ${
                selectedBot === bot.id
                  ? 'bg-cyber-accent text-slate-950 font-bold shadow'
                  : 'bg-cyber-bg text-slate-400 hover:text-slate-200 border border-cyber-border'
              }`}
            >
              {bot.label}
            </button>
          ))}
        </div>

        {/* Code Output Box */}
        <div className="relative">
          <pre className="p-4 rounded-xl bg-cyber-bg border border-cyber-border text-slate-200 text-xs font-mono overflow-x-auto max-h-56 leading-relaxed whitespace-pre-wrap">
            {getBotConfig()}
          </pre>
          <button
            onClick={handleCopy}
            className="absolute top-3 right-3 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium flex items-center space-x-1.5 border border-slate-700 shadow"
          >
            {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
            <span>{copied ? 'Copied!' : 'Copy Config'}</span>
          </button>
        </div>

        <div className="flex items-center justify-between text-xs text-slate-500 pt-1">
          <span>Preset includes 50% Take-Profit at 2x and 20% Stop-Loss protection.</span>
          <button onClick={onClose} className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300">
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
