import { ChainConfig, ChainId } from './types';

export const SUPPORTED_CHAINS: Record<ChainId, ChainConfig> = {
  solana: {
    id: 'solana',
    name: 'Solana',
    nativeSymbol: 'SOL',
    color: '#9945FF',
    badgeBg: 'bg-purple-950/70 border-purple-500/40 text-purple-300',
    badgeText: 'text-purple-400',
    explorerUrl: 'https://solscan.io',
    dexList: ['Pump.fun', 'Raydium', 'Meteora', 'Orca'],
  },
  base: {
    id: 'base',
    name: 'Base (Disabled - High Gas)',
    nativeSymbol: 'ETH',
    color: '#0052FF',
    badgeBg: 'bg-blue-950/30 border-blue-500/20 text-slate-500',
    badgeText: 'text-slate-500',
    explorerUrl: 'https://basescan.org',
    dexList: ['Aerodrome'],
  },
  ethereum: {
    id: 'ethereum',
    name: 'Ethereum (Disabled - High Gas)',
    nativeSymbol: 'ETH',
    color: '#627EEA',
    badgeBg: 'bg-indigo-950/30 border-indigo-500/20 text-slate-500',
    badgeText: 'text-slate-500',
    explorerUrl: 'https://etherscan.io',
    dexList: ['Uniswap v3'],
  },
  bsc: {
    id: 'bsc',
    name: 'BNB Chain (Disabled)',
    nativeSymbol: 'BNB',
    color: '#F3BA2F',
    badgeBg: 'bg-amber-950/30 border-amber-500/20 text-slate-500',
    badgeText: 'text-slate-500',
    explorerUrl: 'https://bscscan.com',
    dexList: ['PancakeSwap'],
  },
};

export function getExplorerTxUrl(chain: ChainId, txHash: string): string {
  const config = SUPPORTED_CHAINS[chain];
  if (chain === 'solana') {
    return `${config.explorerUrl}/tx/${txHash}`;
  }
  return `${config.explorerUrl}/tx/${txHash}`;
}

export function getExplorerAddressUrl(chain: ChainId, address: string): string {
  const config = SUPPORTED_CHAINS[chain];
  if (chain === 'solana') {
    return `${config.explorerUrl}/account/${address}`;
  }
  return `${config.explorerUrl}/address/${address}`;
}

export function shortenAddress(address: string, chars: number = 4): string {
  if (!address) return '';
  if (address.length <= chars * 2 + 2) return address;
  return `${address.slice(0, chars + 2)}...${address.slice(-chars)}`;
}

export function formatUsd(amount: number): string {
  if (Math.abs(amount) >= 1_000_000) {
    return `$${(amount / 1_000_000).toFixed(2)}M`;
  }
  if (Math.abs(amount) >= 1_000) {
    return `$${(amount / 1_000).toFixed(1)}k`;
  }
  if (Math.abs(amount) < 0.01 && amount !== 0) {
    return `$${amount.toFixed(4)}`;
  }
  return `$${amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function formatMultiplier(multiplier: number): string {
  return `${multiplier >= 0 ? '+' : ''}${multiplier.toFixed(1)}x`;
}
