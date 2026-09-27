# MemeAlpha Radar: Multi-Chain Memecoin Inspector & Autonomous Copy-Trading Engine

> **Inspect all memecoins and trades across Solana, Base, Ethereum, and BSC. Discover and rank smart-money wallets from most to least profitable, audit forensic evidence charts showing *why* top picks succeed, and run an autonomous $100 demo bot with automated reload and recorded decision logs.**

---

## 🚀 Key Features

### 1. Multi-Chain Memecoin Ingestion & DEX Radar
- **Blockchains Covered**:
  - **Solana**: Pump.fun bonding curves, Raydium v4/CPMM, Meteora DLMM.
  - **Base**: Aerodrome Finance, Uniswap v3, SushiSwap.
  - **Ethereum**: Uniswap v2/v3, Curve.
  - **BNB Chain**: PancakeSwap v2/v3, Biswap.
- **DexScreener API Integration**: Real-time multi-chain token pricing, 5m/1h volume, and liquidity tracking.

### 2. Ranked Smart-Money Leaderboard ("Most Profitable to Least Profitable")
- Wallets are strictly ranked by total net realized profit, win rate, or alpha score.
- **Metrics Computed**:
  - Net Profit in USD and native tokens (e.g. `+$2,845,620 (+15,465.3 SOL)`).
  - Win Rate percentage with visual progress bar (`99W / 18L`).
  - Profit Factor (Gross Wins / Gross Losses).
  - Average Exit Multiplier (e.g. `+11.4x`).
  - Median Holding Duration (e.g. `14.5m` sniper vs `3.0d` whale).
  - Copy-Trade Readiness Grade (`A+`, `A`, `B+`, `C`, `D`).

### 3. Forensic Evidence Dossiers ("Why Our Top Picks Are Top Picks")
Click **"Inspect Proof"** on any ranked wallet to view:
- **Cumulative Equity Growth Curve**: Interactive SVG timeline showing wallet portfolio value and net P&L over time.
- **Multiplier & Win Spectrum Chart**: Breakdown of 100x+ moonshots, 10x-100x high wins, 2x-10x mid wins, breakevens, and cut losses.
- **Alpha Signature Edge Diagnostics**:
  - *Sniper Execution Speed* (Block 0-1 buys).
  - *Exit Discipline* (Mechanic DCA scale-out ladder: 2x, 5x, 10x+ moonbags).
  - *Honeypot & Scam Avoidance Rate* (0/0 tax verification, LP lock check).
  - *Insider/Dev Suspicion Score* (Distinguishes organic smart money from dev wash trading).
- **Historical On-Chain Trades Ledger**: Line-by-line buy/sell details, entry/exit market caps, multipliers, hold times, and clickable block explorer links (Solscan, Basescan, Etherscan, Bscscan).

### 4. Autonomous $100 Demo Paper Trading Bot
- **Virtual Bankroll**: Starts with **\$100.00**.
- **High-Conviction Filter**: Strictly enters trades only when an incoming setup scores &ge; 80/100 (based on top wallet win rate, 0/0 tax contract, locked LP > 95%, liquidity depth > $25k, and early block timing).
- **Position Sizing & Risk Management**:
  - Allocates fractional capital (\$15–\$25 per trade) to prevent single-trade wipeouts.
  - Automated Take-Profit targets (+100% on 50% position, +400% on runner).
  - Automated Hard Stop-Loss (-20%).
- **Auto-Reload on Exhaustion**: When funds are depleted or exhausted, the engine automatically reloads another \$100 (while tracking total cycles, reload counts, and cumulative lifetime P&L).
- **Autonomous Continuous Running**: Leave running in your browser tab or server; it continuously evaluates incoming trades, drifts simulated prices, and triggers TP/SL exits.

### 5. Recorded Decision Logs & Strategy Improvement Lab
- **Forensic Post-Mortem Log**:
  - Records every single action with algorithmic rationale:
    - *Why it entered* (triggering wallet, win rate, safety audit, volume momentum).
    - *Why it rejected* (scam detected, low liquidity, tax hazard).
    - *Why it exited* (TP reached, Stop Loss cut, manual intervention).
  - Diagnostic **Improvement Lesson Tags** (e.g. `[WIN: SNIPER_CONSENSUS]`, `[AVOIDED: HONEYPOT_RISK]`, `[LOSS: STOP_LOSS_PROTECTION]`).
- **Export to CSV / JSON**: Download all decision logs with a single click to perform offline quant analysis and tune strategy parameters.

### 6. Custom Wallet Inspector & Copy Bot Exporter
- **Custom Wallet Inspector**: Paste *any* Solana or EVM address to generate an on-chain audit and evaluate its copy-trading feasibility.
- **Copy Bot Exporter**: Ready-to-copy configurations for **Trojan on Solana**, **Maestro**, **BonkBot**, and **Custom Webhook** integration.

---

## 🛠️ Tech Stack & Architecture

- **Framework**: Next.js 14 (App Router) + TypeScript
- **Styling**: Tailwind CSS (Cyber-Finance Dark Mode Theme)
- **Icons**: Lucide React
- **Engine**: Pure TypeScript / Node.js Quant Profiler & Paper Trading Simulator
- **Deployment**: Vercel Serverless & Edge Ready

---

## 📦 Local Installation & Running

```bash
# Navigate to the project directory
cd /Users/mac/.gemini/antigravity/scratch/memecoin-alpha-radar

# Install dependencies (if not already installed)
npm install

# Run the test verification suite
npm test

# Run the Next.js development server
npm run dev

# Or run the production build
npm run build
npm start
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

---

## ☁️ Deploying to Vercel

This project is 100% configured for one-click deployment on Vercel:

### Method 1: Vercel CLI
```bash
npm i -g vercel
vercel
```

### Method 2: Git Push to GitHub
1. Create a repository on GitHub.
2. Push this folder to your repository:
   ```bash
   git init
   git add .
   git commit -m "feat: MemeAlpha Radar v2.4"
   git remote add origin https://github.com/your-username/memecoin-alpha-radar.git
   git push -u origin main
   ```
3. Import the repository into your Vercel Dashboard. Vercel will automatically detect Next.js and deploy with zero extra configuration.

---

## ⚙️ Environment Variables (Optional)

All core features work immediately out-of-the-box without requiring API keys. If you want custom RPC endpoints, you can optionally define:
```env
NEXT_PUBLIC_SOLANA_RPC=https://api.mainnet-beta.solana.com
NEXT_PUBLIC_BASE_RPC=https://mainnet.base.org
NEXT_PUBLIC_ETH_RPC=https://eth.llamarpc.com
NEXT_PUBLIC_BSC_RPC=https://binance.llamarpc.com
```
