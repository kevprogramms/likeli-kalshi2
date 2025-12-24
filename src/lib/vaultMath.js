// =====================
// VAULT MATH LIBRARY (Final Spec - Zero Precision Loss)
// =====================

const DECIMALS = 6;
const MICRO = 1000000n; // 10^6
const BPS_DIVISOR = 10000n;

// =====================
// PRECISION HELPERS
// =====================

// Strictly parse string/number to BigInt micro-units
// "1.5" -> 1500000n
const parseUnits = (value, decimals = DECIMALS) => {
    if (typeof value === 'bigint') return value;

    // Valid input check
    const str = String(value);
    if (!/^-?\d*(\.\d+)?$/.test(str)) {
        throw new Error(`Invalid number format: ${str}`);
    }

    const [integerPart, fractionalPart = ''] = str.split('.');

    // Pad or truncate fraction
    const paddedFraction = fractionalPart.padEnd(decimals, '0').slice(0, decimals);

    return BigInt(`${integerPart}${paddedFraction}`);
}

// Format BigInt micro-units back to string
// 1500000n -> "1.500000"
const formatUnits = (value, decimals = DECIMALS) => {
    const s = value.toString();
    const sign = value < 0n ? "-" : "";
    const abs = value < 0n ? -value : value;

    const str = abs.toString().padStart(decimals + 1, '0');
    const intPart = str.slice(0, -decimals);
    const fracPart = str.slice(-decimals);

    // Return fixed 6 decimals string
    // e.g. "500000" (from 500000n with 6 dec) -> "0.500000"
    // Wait, 50 chars? Logic check:
    // If value is 100 (epsilon), str is "100".
    // padStart(7, '0') -> "0000100"
    // intPart = slice(0, -6) -> "0"
    // fracPart = slice(-6) -> "000100"
    // Result: "0.000100". Correct.

    // What if value < decimals length?
    // 500000n -> str "500000". padStart(7) -> "0500000". int="0", frac="500000". -> "0.500000". Correct.

    return `${sign}${intPart || '0'}.${fracPart}`;
}

// Validation Helper
export const validateAmount = (amount, maxDecimals = DECIMALS) => {
    const str = String(amount);
    if (!/^\d+(\.\d+)?$/.test(str)) return { valid: false, error: 'Invalid number format' };

    const parts = str.split('.');
    if (parts[1] && parts[1].length > maxDecimals) {
        return { valid: false, error: `Maximum ${maxDecimals} decimal places allowed` };
    }

    // Check for zero
    try {
        if (parseUnits(str) <= 0n) return { valid: false, error: 'Amount must be positive' };
    } catch (e) {
        return { valid: false, error: e.message };
    }

    return { valid: true, value: str }; // Return valid string
};

export const generateId = (prefix) => `${prefix}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

// =====================
// 1. DEPOSIT (Open Stage Only)
// =====================
export const calculateDeposit = (vault, amountStr) => {
    // strict string input
    if (vault.stage !== 'Open') return { success: false, error: 'Deposits only allowed in Open stage' };
    if (vault.hasOpenPositions) return { success: false, error: 'Cannot deposit while positions are open' };

    const validation = validateAmount(amountStr);
    if (!validation.valid) return { success: false, error: validation.error };

    const amountBi = parseUnits(amountStr);
    const depositFeeBpsBi = BigInt(Math.floor(Number(vault.depositFeeBps || 0))); // BPS is integer

    const feeBi = (amountBi * depositFeeBpsBi) / BPS_DIVISOR;
    const netBi = amountBi - feeBi;

    if (netBi === 0n) return { success: false, error: 'Deposit too small (rounds to 0)' };

    const vaultUsdcBi = parseUnits(vault.vaultUsdc || 0);
    const totalSharesBi = parseUnits(vault.totalShares || 0);

    let sharesToMintBi = 0n;
    if (totalSharesBi === 0n) {
        sharesToMintBi = netBi;
    } else {
        if (vaultUsdcBi === 0n) return { success: false, error: 'Vault has shares but no USDC (corruption)' };
        sharesToMintBi = (netBi * totalSharesBi) / vaultUsdcBi;
    }

    // Monotonic HWM Logic
    const oldHwmBi = parseUnits(vault.highWaterMark || 0);
    const newVaultBi = vaultUsdcBi + netBi;
    const newHwmBi = newVaultBi > oldHwmBi ? newVaultBi : oldHwmBi;

    return {
        success: true,
        depositFee: formatUnits(feeBi),
        netAmount: formatUnits(netBi),
        sharesToMint: formatUnits(sharesToMintBi),
        newVaultUsdc: formatUnits(newVaultBi),
        newTotalShares: formatUnits(totalSharesBi + sharesToMintBi),
        newHighWaterMark: formatUnits(newHwmBi)
    };
};

// =====================
// 2. WITHDRAWAL REQUEST
// =====================
export const calculateWithdrawalRequest = (vault, sharesStr, userSharesStr) => {
    if (vault.stage !== 'Trading' && vault.stage !== 'Settlement') {
        return { success: false, error: 'Requests only allowed in Trading/Settlement stage' };
    }

    const validation = validateAmount(sharesStr);
    if (!validation.valid) return { success: false, error: validation.error };

    const sharesBi = parseUnits(sharesStr);
    const userSharesBi = parseUnits(userSharesStr || 0);

    if (sharesBi > userSharesBi) return { success: false, error: 'Insufficient user shares' };

    return {
        success: true,
        sharesToEscrow: formatUnits(sharesBi)
    };
};

// =====================
// 3. CANCEL WITHDRAWAL
// =====================
export const calculateCancelRequest = (request) => {
    const requested = parseUnits(request.sharesRequested);
    const filled = parseUnits(request.sharesFilled || 0);
    const unfilled = requested - filled;

    if (unfilled <= 0n) return { success: false, error: 'Nothing left to cancel' };

    // Return ONLY the unfilled portion
    return {
        success: true,
        sharesToReturn: formatUnits(unfilled)
    };
};

// =====================
// 4. PROCESS EPOCH
// =====================
export const calculateEpochProcessing = (vault, requests, vaultEquityUsdcStr) => {
    if (!requests || requests.length === 0) return { success: false, error: 'No requests' };

    const vaultUsdcBi = parseUnits(vault.vaultUsdc || 0);
    const totalSharesBi = parseUnits(vault.totalShares || 0);
    const equityBi = parseUnits(vaultEquityUsdcStr || 0);

    // Guard: Equity 0
    if (equityBi <= 0n) return { success: false, error: 'Equity is 0 or negative; cannot compute NAV' };

    // Validate BPS ranges
    const bufferBps = Number(vault.liquidityBufferBps || 0);
    const earlyExitFeeBps = Number(vault.earlyExitFeeBps || 0);

    if (bufferBps < 0 || bufferBps >= 10000) return { success: false, error: 'Invalid liquidityBufferBps' };
    if (earlyExitFeeBps < 0 || earlyExitFeeBps >= 10000) return { success: false, error: 'Invalid earlyExitFeeBps' };

    const bufferBpsBi = BigInt(bufferBps);
    const earlyExitFeeBpsBi = BigInt(earlyExitFeeBps);

    if (totalSharesBi === 0n) return { success: false, error: 'Total shares is 0' };
    if (vault.stage !== 'Trading') return { success: false, error: 'Epoch processing only in Trading stage' };

    const requiredBufferBi = (vaultUsdcBi * bufferBpsBi) / BPS_DIVISOR;
    let availableNetUsdcBi = vaultUsdcBi - requiredBufferBi;
    if (availableNetUsdcBi < 0n) availableNetUsdcBi = 0n;

    let remainingLiquidityBi = availableNetUsdcBi;
    let totalNetPaidBi = 0n;
    let totalSharesBurnedBi = 0n;
    let totalExitFeesRetainedBi = 0n;

    const netFactorNumerator = BPS_DIVISOR - earlyExitFeeBpsBi;

    const processedRequests = requests.map(req => {
        if (req.status === 'Completed' || req.status === 'Cancelled') return req;

        const sharesRequestedBi = parseUnits(req.sharesRequested);
        const sharesFilledPreviouslyBi = parseUnits(req.sharesFilled || 0);
        const sharesRemainingBi = sharesRequestedBi - sharesFilledPreviouslyBi;

        if (sharesRemainingBi <= 0n) return req;

        // MaxShares = (Liquidity * 10000 * TotalShares) / (Equity * (10000 - Fee))
        let maxSharesFillableBi = 0n;
        if (equityBi > 0n && netFactorNumerator > 0n) {
            maxSharesFillableBi = (remainingLiquidityBi * BPS_DIVISOR * totalSharesBi) / (equityBi * netFactorNumerator);
        }

        const sharesToFillBi = (sharesRemainingBi < maxSharesFillableBi) ? sharesRemainingBi : maxSharesFillableBi;

        if (sharesToFillBi === 0n) return req;

        // Gross = (shares * equity) / totalShares
        const grossValBi = (sharesToFillBi * equityBi) / totalSharesBi;
        const feeBi = (grossValBi * earlyExitFeeBpsBi) / BPS_DIVISOR;
        const netBi = grossValBi - feeBi;

        if (netBi === 0n) return req; // Anti-burn guard
        if (netBi > remainingLiquidityBi) return req; // Safety guard

        remainingLiquidityBi -= netBi;
        totalNetPaidBi += netBi;
        totalSharesBurnedBi += sharesToFillBi;
        totalExitFeesRetainedBi += feeBi;

        const newFilledBi = sharesFilledPreviouslyBi + sharesToFillBi;
        const isComplete = (newFilledBi >= sharesRequestedBi);

        return {
            ...req,
            sharesFilled: formatUnits(newFilledBi),
            status: isComplete ? 'Completed' : 'PartiallyFilled',
            lastProcessedEpoch: Date.now(),
            payoutThisEpoch: formatUnits(netBi),
            exitFeeThisEpoch: formatUnits(feeBi)
        };
    });

    return {
        success: true,
        processedRequests,
        totalSharesBurned: formatUnits(totalSharesBurnedBi),
        totalNetPaid: formatUnits(totalNetPaidBi),
        totalExitFeesRetained: formatUnits(totalExitFeesRetainedBi),
        newVaultUsdc: formatUnits(vaultUsdcBi - totalNetPaidBi),
        newTotalShares: formatUnits(totalSharesBi - totalSharesBurnedBi)
    };
};

// =====================
// 5. REDEEM (Closed Stage)
// =====================
export const calculateRedemption = (vault, sharesStr) => {
    if (vault.stage !== 'Closed') return { success: false, error: 'Redemption only in Closed stage' };

    const sharesBi = parseUnits(sharesStr);
    const totalSharesBi = parseUnits(vault.totalShares || 0);
    let vaultUsdcBi = parseUnits(vault.vaultUsdc || 0);

    if (sharesBi > totalSharesBi) return { success: false, error: 'Insufficient total shares' };

    const perfFeeDueBi = parseUnits(vault.perfFeeDueUsdc || 0);
    let feeDeductedBi = 0n;

    if (perfFeeDueBi > 0n && !vault.perfFeePaid) {
        if (vaultUsdcBi < perfFeeDueBi) {
            return { success: false, error: 'Insufficient USDC to pay performance fee' };
        }
        vaultUsdcBi -= perfFeeDueBi;
        feeDeductedBi = perfFeeDueBi;
    }

    const payoutBi = (sharesBi * vaultUsdcBi) / totalSharesBi;

    return {
        success: true,
        payout: formatUnits(payoutBi),
        feeDeducted: formatUnits(feeDeductedBi),
        perfFeePaidAfter: (feeDeductedBi > 0n) || vault.perfFeePaid,
        newVaultUsdc: formatUnits(vaultUsdcBi - payoutBi),
        newTotalShares: formatUnits(totalSharesBi - sharesBi)
    };
};

// =====================
// VALIDATION HELPER (Updated)
// =====================
export const runSpecValidation = () => {
    console.log("Running Final Spec Validation (String Precision)...");

    // Large number test: 50M USDC input
    const largeValStr = "50000000.000000";
    const parsed = parseUnits(largeValStr);
    console.log(`Parsed 50M: ${parsed} (Expected 50000000000000)`);
    if (parsed !== 50000000000000n) console.error("FATAL: Large number parse failed");

    // Mock Vault
    const vault = {
        vaultUsdc: "1000000.000000",
        totalShares: "1000000.000000",
        liquidityBufferBps: 1000,
        earlyExitFeeBps: 500,
        stage: 'Trading'
    };
    const equityStr = "1100000.000000";

    const reqs = [
        { id: '1', sharesRequested: "50000.000000", sharesFilled: "0.000000", status: 'Pending' }
    ];

    const result = calculateEpochProcessing(vault, reqs, equityStr);
    console.log("Result:", JSON.stringify(result, null, 2));

    return result;
};
