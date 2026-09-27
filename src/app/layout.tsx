import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'MemeAlpha Radar | Solana Memecoin Inspector & Autonomous Copy Trading',
  description: 'Inspects all memecoins and smart-money trades on Solana (Pump.fun, Raydium, Meteora, Orca). Powered 100% by live Birdeye and Helius on-chain data. Features an autonomous $100 demo bot with real spot pricing and recorded decision logs.',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark">
      <body className="bg-cyber-bg text-slate-100 min-h-screen antialiased selection:bg-cyber-accent/30 selection:text-white">
        {children}
      </body>
    </html>
  );
}
