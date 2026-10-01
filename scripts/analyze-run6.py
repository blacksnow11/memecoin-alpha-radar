import json
from collections import Counter, defaultdict

with open('scripts/run6-telemetry.json') as f:
    data = json.load(f)

def analyze_bot(name, bot_data):
    p = bot_data['portfolio']
    trades = p.get('closedTrades', [])
    print(f"\n==========================================")
    print(f"       ANALYSIS: {name.upper()}")
    print(f"==========================================")
    print(f"Starting Cash:      ${p.get('startingCash')}")
    print(f"Current Cash:       ${p.get('currentCash')}")
    print(f"Invested Capital:   ${p.get('investedInPositionsUsd', 0)}")
    print(f"Total Equity:       ${p.get('totalEquityUsd')}")
    print(f"Realized P&L:       ${p.get('totalRealizedPnlUsd')}")
    print(f"Unrealized P&L:     ${p.get('totalUnrealizedPnlUsd', 0)}")
    print(f"Wins / Losses:      {p.get('totalWins')}W / {p.get('totalLosses')}L (Win Rate: {p.get('winRate')}%)")
    print(f"Closed Trades in Log: {len(trades)} trades recorded")
    
    if not trades:
        return

    # Breakdown by exit reason
    by_reason = defaultdict(lambda: {'count': 0, 'wins': 0, 'losses': 0, 'pnl': 0.0, 'gains': []})
    for t in trades:
        reason = t.get('exitReason', 'UNKNOWN')
        pnl = t.get('netPnlUsd', 0)
        pct = t.get('netPnlPercent', 0)
        by_reason[reason]['count'] += 1
        by_reason[reason]['pnl'] += pnl
        by_reason[reason]['gains'].append(pct)
        if pnl >= 0:
            by_reason[reason]['wins'] += 1
        else:
            by_reason[reason]['losses'] += 1

    print("\n--- Breakdown By Exit Reason ---")
    for reason, stats in sorted(by_reason.items(), key=lambda x: x[1]['pnl'], reverse=True):
        avg_pct = sum(stats['gains']) / len(stats['gains']) if stats['gains'] else 0
        print(f"[{reason}]: {stats['count']} trades | {stats['wins']}W / {stats['losses']}L | Total P&L: ${stats['pnl']:+.2f} | Avg Return: {avg_pct:+.1f}%")

    # Tokens traded
    token_counts = Counter(t.get('tokenSymbol') for t in trades)
    print(f"\nUnique Tokens Traded in log sample: {len(token_counts)}")
    print("Tokens traded:")
    for sym, count in token_counts.most_common(15):
        t_pnls = [t.get('netPnlUsd', 0) for t in trades if t.get('tokenSymbol') == sym]
        tot_pnl = sum(t_pnls)
        print(f"  {sym}: {count} trades, Net P&L: ${tot_pnl:+.2f}")

    # Hold duration stats
    durations = [t.get('holdDurationSeconds', 0) for t in trades]
    if durations:
        avg_dur = sum(durations) / len(durations)
        print(f"\nHold Duration: Avg {avg_dur:.0f}s ({avg_dur/60:.1f}m), Min {min(durations)}s, Max {max(durations)}s ({max(durations)/60:.1f}m)")

    # Patterns / Rationale for entries
    patterns = Counter()
    pattern_pnl = defaultdict(float)
    for t in trades:
        rat = t.get('entryRationale', '')
        pat = 'Unknown'
        if '5-Min Volume Velocity Surge' in rat:
            pat = '5-Min Volume Velocity Surge'
        elif 'Ground-Floor Liquidity Depth' in rat:
            pat = 'Ground-Floor Liquidity Depth'
        elif 'Pump.fun Graduated' in rat:
            pat = 'Pump.fun Graduated Pool'
        elif 'Copied verified' in rat:
            pat = 'Whale Copy'
        patterns[pat] += 1
        pattern_pnl[pat] += t.get('netPnlUsd', 0)
    
    print("\n--- Entry Pattern Performance ---")
    for pat, count in patterns.most_common():
        print(f"  {pat}: {count} trades | P&L: ${pattern_pnl[pat]:+.2f}")

if 'copyBot' in data:
    analyze_bot('Copy Bot', data['copyBot'])

if 'gemRadarBot' in data:
    analyze_bot('Gem Radar Bot', data['gemRadarBot'])
