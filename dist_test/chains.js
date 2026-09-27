"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SUPPORTED_CHAINS = void 0;
exports.getExplorerTxUrl = getExplorerTxUrl;
exports.getExplorerAddressUrl = getExplorerAddressUrl;
exports.shortenAddress = shortenAddress;
exports.formatUsd = formatUsd;
exports.formatMultiplier = formatMultiplier;
exports.SUPPORTED_CHAINS = {
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
        name: 'Base',
        nativeSymbol: 'ETH',
        color: '#0052FF',
        badgeBg: 'bg-blue-950/70 border-blue-500/40 text-blue-300',
        badgeText: 'text-blue-400',
        explorerUrl: 'https://basescan.org',
        dexList: ['Aerodrome', 'Uniswap v3', 'SushiSwap'],
    },
    ethereum: {
        id: 'ethereum',
        name: 'Ethereum',
        nativeSymbol: 'ETH',
        color: '#627EEA',
        badgeBg: 'bg-indigo-950/70 border-indigo-500/40 text-indigo-300',
        badgeText: 'text-indigo-400',
        explorerUrl: 'https://etherscan.io',
        dexList: ['Uniswap v2', 'Uniswap v3', 'Curve'],
    },
    bsc: {
        id: 'bsc',
        name: 'BNB Chain',
        nativeSymbol: 'BNB',
        color: '#F3BA2F',
        badgeBg: 'bg-amber-950/70 border-amber-500/40 text-amber-300',
        badgeText: 'text-amber-400',
        explorerUrl: 'https://bscscan.com',
        dexList: ['PancakeSwap v2', 'PancakeSwap v3', 'Biswap'],
    },
};
function getExplorerTxUrl(chain, txHash) {
    const config = exports.SUPPORTED_CHAINS[chain];
    if (chain === 'solana') {
        return `${config.explorerUrl}/tx/${txHash}`;
    }
    return `${config.explorerUrl}/tx/${txHash}`;
}
function getExplorerAddressUrl(chain, address) {
    const config = exports.SUPPORTED_CHAINS[chain];
    if (chain === 'solana') {
        return `${config.explorerUrl}/account/${address}`;
    }
    return `${config.explorerUrl}/address/${address}`;
}
function shortenAddress(address, chars = 4) {
    if (!address)
        return '';
    if (address.length <= chars * 2 + 2)
        return address;
    return `${address.slice(0, chars + 2)}...${address.slice(-chars)}`;
}
function formatUsd(amount) {
    if (Math.abs(amount) >= 1000000) {
        return `$${(amount / 1000000).toFixed(2)}M`;
    }
    if (Math.abs(amount) >= 1000) {
        return `$${(amount / 1000).toFixed(1)}k`;
    }
    if (Math.abs(amount) < 0.01 && amount !== 0) {
        return `$${amount.toFixed(4)}`;
    }
    return `$${amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}
function formatMultiplier(multiplier) {
    return `${multiplier >= 0 ? '+' : ''}${multiplier.toFixed(1)}x`;
}
