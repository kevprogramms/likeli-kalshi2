import {
    calculateDeposit,
    calculateWithdrawalRequest,
    calculateCancelRequest,
    calculateRedemption,
    calculateEpochProcessing,
    validateAmount
} from './vaultMath.js'; // Ensure extension for Node ESM if needed, or bundler handles it.

export const runVaultTests = () => {
    const logs = [];
    let passed = 0;
    let failed = 0;

    const log = (msg, type = 'info') => {
        logs.push({ msg, type });
        if (typeof window === 'undefined') console.log(`[${type.toUpperCase()}] ${msg}`);
    };

    const assert = (desc, condition) => {
        if (condition) {
            log(`✅ PASS: ${desc}`, 'success');
            passed++;
        } else {
            log(`❌ FAIL: ${desc}`, 'error');
            failed++;
        }
    };

    log('🛡️ VAULT LOGIC DEEP AUDIT (String Precision) 🛡️', 'title');

    // ==========================================
    // TEST 1: Deposit Logic
    // ==========================================
    log('--- 1. Deposit Logic (Open Stage) ---', 'header');

    // Scenario: First depositor
    const emptyVault = {
        stage: 'Open',
        vaultUsdc: "0.000000",
        totalShares: "0.000000",
        depositFeeBps: 100, // 1%
        highWaterMark: "0.000000"
    };
    const res1 = calculateDeposit(emptyVault, "100");

    assert('Deposit success', res1.success);
    assert('Deposit fee 1%', res1.depositFee === "1.000000");
    assert('Net amount correct', res1.netAmount === "99.000000");
    // Shares minting: First user gets net amount 1:1 if empty
    assert('Shares minted 1:1 for empty vault', res1.sharesToMint === "99.000000");
    assert('Vault USDC updated', res1.newVaultUsdc === "99.000000");
    assert('Total shares updated', res1.newTotalShares === "99.000000");

    // Scenario: Second depositor (Standard)
    const activeVault = {
        stage: 'Open',
        vaultUsdc: "100.000000",
        totalShares: "100.000000", // 1.0 NAV
        depositFeeBps: 0,
        highWaterMark: "100.000000"
    };
    const res2 = calculateDeposit(activeVault, "50");
    assert('Shares calculation standard (1.0 NAV)', res2.sharesToMint === "50.000000");

    // Scenario: Profit Scenario (NAV > 1) - ONLY possible if manually set in Open stage (unlikely but logic holds)
    const profitVault = {
        stage: 'Open',
        vaultUsdc: "200.000000", // 2x profit? (Simulated re-val or previous epochs?)
        // In "Open" stage, typically NAV is 1. But logic supports NAV.
        totalShares: "100.000000", // NAV = 2.0
        depositFeeBps: 0
    };
    const res3 = calculateDeposit(profitVault, "100");
    // Investing 100 should get 50 shares (since each share is worth 2)
    assert('Shares minted at NAV 2.0 (100 -> 50 shares)', res3.sharesToMint === "50.000000");

    // ==========================================
    // TEST 2: Withdrawal Request Logic
    // ==========================================
    log('--- 2. Withdrawal Request Logic ---', 'header');

    const tradeVault = {
        stage: 'Trading',
        vaultUsdc: "1000.000000",
        totalShares: "1000.000000"
    };

    // User has 100 shares. Requests 50.
    const resReq = calculateWithdrawalRequest(tradeVault, "50", "100");
    assert('Request authorized', resReq.success);
    assert('Escrow amount matches request', resReq.sharesToEscrow === "50.000000");

    // Insufficient shares
    const resFail = calculateWithdrawalRequest(tradeVault, "150", "100");
    assert('Over-withdrawal blocked', !resFail.success);

    // ==========================================
    // TEST 3: Performance Fee (Redemption)
    // ==========================================
    log('--- 3. Performance Fee Logic (Closed Stage) ---', 'header');

    const perfVault = {
        stage: 'Closed',
        vaultUsdc: "1500.000000", // Balance
        totalShares: "1000.000000",
        perfFeeDueUsdc: "100.000000", // Fee pending
        perfFeePaid: false
    };

    // First redeemer pays the fee for the pool
    const r1 = calculateRedemption(perfVault, "100");

    // Fee of 100 deducted from 1500 -> 1400.
    // NAV = 1400 / 1000 = 1.4.
    // User Redeems 100 shares -> 140 USDC.
    assert('Performance fee deducted', r1.feeDeducted === "100.000000");
    assert('Payout based on post-fee NAV (1.4)', r1.payout === "140.000000");

    // Remaining Vault: 1500 - 100(fee) - 140(payout) = 1260
    assert('Vault remaining correct', r1.newVaultUsdc === "1260.000000");

    // ==========================================
    // TEST 4: Epoch Processing
    // ==========================================
    log('--- 4. Epoch Processing (Trading Stage) ---', 'header');

    const epochVault = {
        stage: 'Trading',
        vaultUsdc: "1000.000000",
        totalShares: "1000.000000",
        liquidityBufferBps: 1000, // 10% -> 100 buffer. 900 available.
        earlyExitFeeBps: 500 // 5%
    };

    const equityStr = "1100.000000"; // NAV 1.1

    // Request 1: 50 shares. (Gross value: 50 * 1.1 = 55).
    // Fee: 5% of 55 = 2.75. Net: 52.25.
    const req1 = {
        id: 'r1',
        sharesRequested: "50.000000",
        sharesFilled: "0.000000",
        status: 'Pending'
    };

    const resEpoch = calculateEpochProcessing(epochVault, [req1], equityStr);

    assert('Processing success', resEpoch.success);
    const p1 = resEpoch.processedRequests[0];

    assert('Request 1 Completed', p1.status === 'Completed');
    assert('Shares Filled fully', p1.sharesFilled === "50.000000");

    // 50 * 1.1 = 55. Fee 5% = 2.75.
    // 2.75 -> "2.750000".
    // Net = 52.25 -> "52.250000".
    assert('Exit Fee Correct (5% of 55)', p1.exitFeeThisEpoch === "2.750000");
    assert('Payout Correct (52.25)', p1.payoutThisEpoch === "52.250000");

    assert('Total Burned matches', resEpoch.totalSharesBurned === "50.000000");
    assert('Total Paid matches', resEpoch.totalNetPaid === "52.250000");

    // ==========================================
    // TEST 5: LARGE NUMBERS (Precision)
    // ==========================================
    log('--- 5. Large Number Precision ---', 'header');

    // 50M USDC deposit
    const largeVault = {
        stage: 'Open',
        vaultUsdc: "0.000000",
        totalShares: "0.000000",
        depositFeeBps: 0
    };
    const resLarge = calculateDeposit(largeVault, "50000000.000000");

    assert('Large Deposit (50M) Shares', resLarge.sharesToMint === "50000000.000000");

    // Verify internally it handled BigInt
    // 50M * 1e6 = 50,000,000,000,000. Safe in BigInt.

    log(`🏁 FINISHED: ${passed} Passed, ${failed} Failed`, failed === 0 ? 'success-summary' : 'error-summary');

    return logs;
};
