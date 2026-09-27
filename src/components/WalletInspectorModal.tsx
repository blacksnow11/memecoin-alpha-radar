'use client';

import React, { useState } from 'react';
import { Search, X, Loader2, AlertCircle, ArrowRight } from 'lucide-react';
import { WalletProfile } from '@/lib/types';

interface WalletInspectorModalProps {
  onClose: () => void;
  onInspectResult: (wallet: WalletProfile) => void;
}

export function WalletInspectorModal({ onClose, onInspectResult }: WalletInspectorModalProps) {
  const [addressInput, setAddressInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const sampleAddresses = [
    { label: 'Raydium Volume Leader', address: 'MfDuWeqSHEqTFVYZ7LoexgAK9dxk7cy4DFJWjWMGVWa' },
    { label: 'Raydium HF Sniper', address: 'CsVdJ8WH8Q9eHSTRpwtwN3TYApm24QnLKYUMNxJ3DaED' },
    { label: 'Pump.fun Curve Sniper', address: '8fNpaxbJRyyKec7FNT3mC84Ca21umoU7ejd59LBZDZp9' },
  ];

  const handleInspect = async (addrToInspect?: string) => {
    const target = addrToInspect || addressInput;
    if (!target.trim()) {
      setError('Please paste a wallet address');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const res = await fetch('/api/inspect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ address: target.trim() }),
      });

      const data = await res.json();
      if (data.success && data.profile) {
        onInspectResult(data.profile);
        onClose();
      } else {
        setError(data.error || 'Failed to inspect wallet');
      }
    } catch (err: any) {
      setError(err.message || 'Inspection error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md">
      <div className="bg-cyber-card border border-cyber-border rounded-2xl w-full max-w-lg p-6 shadow-2xl space-y-5">
        <div className="flex items-center justify-between border-b border-cyber-border/80 pb-3">
          <div className="flex items-center space-x-2">
            <Search className="w-5 h-5 text-cyber-accent" />
            <h3 className="text-base font-bold text-white">Inspect Any Memecoin Wallet</h3>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-white">
            <X className="w-5 h-5" />
          </button>
        </div>

        <p className="text-xs text-slate-400 leading-relaxed">
          Paste any wallet address from <strong className="text-slate-200">Solana (Raydium, Pump.fun, Meteora, Orca)</strong>. The engine queries Helius for live on-chain swap transactions, calculates win rates, P&L, and evaluates whether it should be copy-traded.
        </p>

        <div className="space-y-2">
          <input
            type="text"
            placeholder="Paste Solana wallet address (e.g. MfDuWeq... or 8fNpaxb...)"
            value={addressInput}
            onChange={(e) => {
              setAddressInput(e.target.value);
              if (error) setError(null);
            }}
            className="w-full bg-cyber-bg border border-cyber-border rounded-xl px-4 py-3 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-cyber-accent font-mono"
          />

          {error && (
            <div className="flex items-center space-x-1.5 text-xs text-crimson">
              <AlertCircle className="w-3.5 h-3.5" />
              <span>{error}</span>
            </div>
          )}
        </div>

        {/* Quick sample pickers */}
        <div className="space-y-1.5">
          <span className="text-[11px] text-slate-500 font-semibold uppercase">Or inspect a verified top whale:</span>
          <div className="space-y-1">
            {sampleAddresses.map((s, idx) => (
              <button
                key={idx}
                onClick={() => {
                  setAddressInput(s.address);
                  handleInspect(s.address);
                }}
                className="w-full text-left p-2 rounded-lg bg-cyber-bg hover:bg-slate-800 border border-cyber-border/50 text-xs text-slate-300 flex items-center justify-between transition-colors font-mono"
              >
                <span>{s.label} ({s.address.slice(0, 6)}...{s.address.slice(-4)})</span>
                <ArrowRight className="w-3.5 h-3.5 text-cyber-accent" />
              </button>
            ))}
          </div>
        </div>

        <div className="flex items-center justify-end space-x-3 pt-2">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-xs text-slate-400 hover:text-white"
          >
            Cancel
          </button>
          <button
            onClick={() => handleInspect()}
            disabled={loading}
            className="px-5 py-2.5 rounded-xl text-xs font-bold bg-cyber-accent text-slate-950 hover:bg-sky-400 transition-colors flex items-center space-x-2 disabled:opacity-50"
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
            <span>{loading ? 'Inspecting On-Chain...' : 'Inspect Wallet'}</span>
          </button>
        </div>
      </div>
    </div>
  );
}
