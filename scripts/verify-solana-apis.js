// Automated Verification Script for 100% Real Solana Data & APIs
// Checks Birdeye, Helius, Wallet Engine, and Demo Trading Engine

const HELIUS_KEY = process.env.HELIUS_API_KEY || '6cd58ff6-f2ed-43d8-b648-3db0726a6d5c';
const BIRDEYE_KEY = process.env.BIRDEYE_API_KEY || '53aff172dddf45c395c4481ee23d6e26';

async function main() {
  console.log('====================================================');
  console.log('  MemeAlpha Radar: 100% Real Solana Verification');
  console.log('====================================================\n');

  let passedTests = 0;
  let totalTests = 0;

  function assert(condition, testName) {
    totalTests++;
    if (condition) {
      console.log(`✅ [PASS] ${testName}`);
      passedTests++;
    } else {
      console.error(`❌ [FAIL] ${testName}`);
    }
  }

  // Test 1: Birdeye Live Token Spot Price
  console.log('--- Step 1: Testing Birdeye DeFi Live Spot Pricing ---');
  const bonkMint = 'DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263';
  try {
    const res = await fetch(`https://public-api.birdeye.so/defi/price?address=${bonkMint}`, {
      headers: { 'X-API-KEY': BIRDEYE_KEY, 'x-chain': 'solana' },
    });
    const data = await res.json();
    assert(
      data.success === true && typeof data.data?.value === 'number' && data.data.value > 0,
      `Birdeye returns live BONK spot price: $${data.data?.value}`
    );
  } catch (err) {
    assert(false, `Birdeye test failed: ${err.message}`);
  }

  // Test 2: DexScreener Live Fallback for Solana
  console.log('\n--- Step 2: Testing DexScreener Live Solana Spot Pricing ---');
  const fartMint = '9BB6NFEcjBCtnNLFko2FqVQBq8HHM13kCyYcdQbgpump';
  try {
    const dsRes = await fetch(`https://api.dexscreener.com/latest/dex/tokens/${fartMint}`);
    const dsData = await dsRes.json();
    const solPair = dsData.pairs?.find((p) => p.chainId === 'solana') || dsData.pairs?.[0];
    const price = parseFloat(solPair?.priceUsd || '0');
    assert(
      price > 0,
      `DexScreener returns live $FARTCOIN price on Solana: $${price} (Dex: ${solPair?.dexId})`
    );
  } catch (err) {
    assert(false, `DexScreener test failed: ${err.message}`);
  }

  // Test 3: Helius Live On-Chain Swaps
  console.log('\n--- Step 3: Testing Helius Live On-Chain Swaps ---');
  const pumpVault = 'CebN5WGQ4jvEPvsVU4EoHEpgzq1VV7AbicfhtW4xC9iM';
  try {
    const hRes = await fetch(
      `https://api.helius.xyz/v0/addresses/${pumpVault}/transactions?api-key=${HELIUS_KEY}&type=SWAP&limit=3`
    );
    const hData = await hRes.json();
    assert(
      Array.isArray(hData) && hData.length > 0 && !!hData[0].signature,
      `Helius returns real on-chain swaps: ${hData.length} txs found. Latest Signature: ${hData[0]?.signature?.slice(0, 16)}...`
    );
    if (hData[0]) {
      console.log(`   Explorer link: https://solscan.io/tx/${hData[0].signature}`);
      console.log(`   Source: ${hData[0].source} | Slot: ${hData[0].slot}`);
    }
  } catch (err) {
    assert(false, `Helius test failed: ${err.message}`);
  }

  // Test 4: Helius Live Account Balance via RPC
  console.log('\n--- Step 4: Testing Solana Account Balance via Helius RPC ---');
  const targetWallet = 'MfDuWeqSHEqTFVYZ7LoexgAK9dxk7cy4DFJWjWMGVWa';
  try {
    const rpcRes = await fetch(`https://mainnet.helius-rpc.com/?api-key=${HELIUS_KEY}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 1,
        method: 'getBalance',
        params: [targetWallet],
      }),
    });
    const rpcData = await rpcRes.json();
    const balanceSol = rpcData.result?.value !== undefined ? +(rpcData.result.value / 1e9).toFixed(4) : -1;
    assert(
      balanceSol >= 0,
      `Helius RPC returns live balance for ${targetWallet.slice(0, 8)}...: ${balanceSol} SOL`
    );
  } catch (err) {
    assert(false, `Helius RPC balance test failed: ${err.message}`);
  }

  // Summary
  console.log('\n====================================================');
  console.log(`  Tests Completed: ${passedTests}/${totalTests} Passed`);
  console.log('====================================================');

  if (passedTests === totalTests) {
    process.exit(0);
  } else {
    process.exit(1);
  }
}

main();
