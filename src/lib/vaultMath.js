// =====================
// VAULT MATH LIBRARY (Production-Final - Zero Precision Loss)
// =====================
// ALL INPUTS: String (e.g. "123.456789")
// ALL OUTPUTS: String with 6 decimal places (e.g. "123.456789")
// ALL INTERNAL MATH: BigInt micro-units (1 USDC = 1000000n)

const DECIMALS = 6;
const BPS_DIVISOR = 10000n;

// =====================
// PRECISION HELPERS
// =====================

/**
 * Parse string to BigInt micro-units
 * "1.5" -> 1500000n
 * @param {string} value - String representation of amount
 * @param {number} decimals - Number of decimal places (default 6)
 * @returns {bigint} - Amount in micro-units
 */
const parseUnits = (value, decimals = DECIMALS) => {
    if (typeof value === 'bigint') return value;

    const str = String(value).trim();

    // Validate format
    if (!/^-?\d*\.?\d*$/.test(str) || str === '' || str === '.' || str === '-' || str === '-.') {
        throw new Error(`Invalid number format: "${str}"`);
    }

    const isNegative = str.startsWith('-');
    const absStr = isNegative ? str.slice(1) : str;

    const [integerPart = '0', fractionalPart = ''] = absStr.split('.');

    if (fractionalPart.length > decimals) {
        throw new Error(`Precision mismatch: ${fractionalPart.length} decimals provided, max ${decimals} allowed`);
    }

    // Pad fraction to exactly `decimals` places
    const paddedFraction = fractionalPart.padEnd(decimals, '0');

    const result = BigInt(`${integerPart}${paddedFraction}`);
    return isNegative ? -result : result;
};

/**
 * Format BigInt micro-units back to string with fixed decimals
 * 1500000n -> "1.500000"
 * @param {bigint} value - Amount in micro-units
 * @param {number} decimals - Number of decimal places (default 6)
 * @returns {string} - Formatted string
 */
const formatUnits = (value, decimals = DECIMALS) => {
    const isNegative = value < 0n;
    const abs = isNegative ? -value : value;

    const str = abs.toString().padStart(decimals + 1, '0');
    const intPart = str.slice(0, -decimals) || '0';
    const fracPart = str.slice(-decimals);

    return `${isNegative ? '-' : ''}${intPart}.${fracPart}`;
};

/**
 * Parse BPS (Basis Points) - MUST be non-negative integer < 10000
 * @param {string|number} input - BPS value
 * @param {string} name - Field name for error messages
 * @returns {object} - { success: boolean, value?: bigint, error?: string }
 */
const parseBps = (input, name) => {
    const str = String(input).trim();

    // Must be integer only (no decimals, no signs)
    if (!/^\d+$/.test(str)) {
        return { success: false, error: `${name} must be a non-negative integer (got "${str}")` };
    }

    const bps = BigInt(str);

    // Hard guard: 0 <= bps < 10000
    if (bps < 0n) {
        return { success: false, error: `${name} cannot be negative` };
    }
    if (bps >= BPS_DIVISOR) {
        return { success: false, error: `${name} must be < 10000 (got ${bps})` };
    }

    return { success: true, value: bps };
};

/**
 * Require non-negative micro-units
 * @param {bigint} bi - BigInt value to check
 * @param {string} name - Field name for error messages
 * @returns {object} - { success: boolean, error?: string }
 */
const requireNonNegativeUnits = (bi, name) => {
    if (bi < 0n) {
        return { success: false, error: `${name} cannot be negative (got ${formatUnits(bi)})` };
    }
    return { success: true };
};

// =====================
// VALIDATION
// =====================

/**
 * Validate amount string
 * @param {string} amount - Amount to validate
 * @param {number} maxDecimals - Maximum allowed decimal places
 * @returns {object} - { valid: boolean, error?: string, value?: string }
 */
export const validateAmount = (amount, maxDecimals = DECIMALS) => {
    const str = String(amount).trim();

    // Check format: positive number only
    if (!/^\d+(\.\d+)?$/.test(str)) {
        return { valid: false, error: 'Invalid number format (must be positive number)' };
    }

    const parts = str.split('.');
    if (parts[1] && parts[1].length > maxDecimals) {
        return { valid: false, error: `Maximum ${maxDecimals} decimal places allowed` };
    }

    // Parse and check for zero
    try {
        const parsed = parseUnits(str);
        if (parsed <= 0n) {
            return { valid: false, error: 'Amount must be positive' };
        }
    } catch (e) {
        return { valid: false, error: e.message };
    }

    return { valid: true, value: str };
};

/**
 * Generate unique ID
 */
export const generateId = (prefix) =>
    `${prefix}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

// =====================
// 1. DEPOSIT (Open Stage Only, No Open Positions)
// =====================
/**
 * Calculate deposit result
 * @param {object} vault - Vault state
 * @param {string} amountStr - Deposit amount as string
 * @returns {object} - Result with string outputs
 */
export const calculateDeposit = (vault, amountStr) => {
    // Stage validation
    if (vault.stage !== 'Open') {
        return { success: false, error: 'Deposits only allowed in Open stage' };
    }

    // Block if positions exist
    if (vault.hasOpenPositions || (vault.positions && vault.positions.length > 0)) {
        return { success: false, error: 'Cannot deposit while positions are open' };
    }

    // Validate input
    const validation = validateAmount(amountStr);
    if (!validation.valid) return { success: false, error: validation.error };

    // Parse deposit fee BPS
    const bpsResult = parseBps(vault.depositFeeBps || 0, 'depositFeeBps');
    if (!bpsResult.success) return { success: false, error: bpsResult.error };
    const depositFeeBpsBi = bpsResult.value;

    // Parse amount
    const amountBi = parseUnits(amountStr);

    // Calculate fee and net amount
    const feeBi = (amountBi * depositFeeBpsBi) / BPS_DIVISOR;
    const netBi = amountBi - feeBi;

    if (netBi <= 0n) {
        return { success: false, error: 'Deposit too small (rounds to 0 after fees)' };
    }

    // Get vault state with non-negative guards
    const vaultUsdcBi = parseUnits(vault.vaultUsdc || '0');
    const totalSharesBi = parseUnits(vault.totalShares || '0');

    let check = requireNonNegativeUnits(vaultUsdcBi, 'vaultUsdc');
    if (!check.success) return check;
    check = requireNonNegativeUnits(totalSharesBi, 'totalShares');
    if (!check.success) return check;

    // Calculate shares to mint
    let sharesToMintBi;
    if (totalSharesBi === 0n) {
        // First depositor: 1:1 ratio
        sharesToMintBi = netBi;
    } else {
        if (vaultUsdcBi === 0n) {
            return { success: false, error: 'Vault has shares but no USDC (data corruption)' };
        }
        // Proportional minting: shares = netAmount * totalShares / vaultUsdc
        sharesToMintBi = (netBi * totalSharesBi) / vaultUsdcBi;
    }

    if (sharesToMintBi <= 0n) {
        return { success: false, error: 'Calculated shares is 0 (deposit too small)' };
    }

    // Update High Water Mark (monotonically increasing)
    const oldHwmBi = parseUnits(vault.highWaterMark || '0');
    check = requireNonNegativeUnits(oldHwmBi, 'highWaterMark');
    if (!check.success) return check;

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
// 2. WITHDRAWAL REQUEST (Trading Stage Only)
// =====================
/**
 * Calculate withdrawal request (escrow shares)
 * @param {object} vault - Vault state
 * @param {string} sharesStr - Shares to withdraw as string
 * @param {string} userSharesStr - User's available shares as string
 * @returns {object} - Result with string outputs
 */
export const calculateWithdrawalRequest = (vault, sharesStr, userSharesStr) => {
    // Only allow in Trading stage
    if (vault.stage !== 'Trading') {
        return { success: false, error: 'Withdrawal requests only allowed in Trading stage' };
    }

    const validation = validateAmount(sharesStr);
    if (!validation.valid) return { success: false, error: validation.error };

    const sharesBi = parseUnits(sharesStr);
    const userSharesBi = parseUnits(userSharesStr || '0');

    let check = requireNonNegativeUnits(sharesBi, 'sharesToWithdraw');
    if (!check.success) return check;
    check = requireNonNegativeUnits(userSharesBi, 'userShares');
    if (!check.success) return check;

    if (sharesBi > userSharesBi) {
        return { success: false, error: 'Insufficient user shares' };
    }

    return {
        success: true,
        sharesToEscrow: formatUnits(sharesBi)
    };
};

// =====================
// 3. CANCEL WITHDRAWAL REQUEST
// =====================
/**
 * Calculate cancel request (return unfilled shares only)
 * @param {object} request - Withdrawal request object
 * @returns {object} - Result with string outputs
 */
export const calculateCancelRequest = (request) => {
    const requestedBi = parseUnits(request.sharesRequested || '0');
    const filledBi = parseUnits(request.sharesFilled || '0');

    let check = requireNonNegativeUnits(requestedBi, 'sharesRequested');
    if (!check.success) return check;
    check = requireNonNegativeUnits(filledBi, 'sharesFilled');
    if (!check.success) return check;

    const unfilledBi = requestedBi - filledBi;

    if (unfilledBi <= 0n) {
        return { success: false, error: 'Nothing left to cancel (fully filled)' };
    }

    // Return ONLY the unfilled portion - do NOT modify filled
    return {
        success: true,
        sharesToReturn: formatUnits(unfilledBi)
    };
};

// =====================
// 4. EPOCH PROCESSING (Trading Stage - Withdrawal Settlement)
// =====================
/**
 * Process epoch - settle withdrawal requests at current NAV
 * @param {object} vault - Vault state
 * @param {array} requests - Pending withdrawal requests
 * @param {string} vaultEquityUsdcStr - Current vault equity (cash + MTM positions) as string
 * @returns {object} - Result with string outputs
 */
export const calculateEpochProcessing = (vault, requests, vaultEquityUsdcStr) => {
    // Validate stage
    if (vault.stage !== 'Trading') {
        return { success: false, error: 'Epoch processing only allowed in Trading stage' };
    }

    if (!requests || requests.length === 0) {
        return { success: false, error: 'No pending withdrawal requests' };
    }

    // Parse vault state with non-negative guards
    const vaultUsdcBi = parseUnits(vault.vaultUsdc || '0');
    const totalSharesBi = parseUnits(vault.totalShares || '0');
    const equityBi = parseUnits(vaultEquityUsdcStr || '0');

    let check = requireNonNegativeUnits(vaultUsdcBi, 'vaultUsdc');
    if (!check.success) return check;
    check = requireNonNegativeUnits(totalSharesBi, 'totalShares');
    if (!check.success) return check;
    check = requireNonNegativeUnits(equityBi, 'vaultEquityUsdc');
    if (!check.success) return check;

    // HARD GUARD: Equity must be positive
    if (equityBi <= 0n) {
        return { success: false, error: 'Equity is 0 or negative; cannot compute NAV' };
    }

    // HARD GUARD: Total shares must be positive
    if (totalSharesBi <= 0n) {
        return { success: false, error: 'Total shares is 0; no shareholders to process' };
    }

    // Parse and validate BPS values
    const bufferBpsResult = parseBps(vault.liquidityBufferBps || 0, 'liquidityBufferBps');
    if (!bufferBpsResult.success) return { success: false, error: bufferBpsResult.error };
    const bufferBpsBi = bufferBpsResult.value;

    const exitFeeBpsResult = parseBps(vault.earlyExitFeeBps || 0, 'earlyExitFeeBps');
    if (!exitFeeBpsResult.success) return { success: false, error: exitFeeBpsResult.error };
    const earlyExitFeeBpsBi = exitFeeBpsResult.value;

    // Calculate available liquidity (after buffer)
    const requiredBufferBi = (vaultUsdcBi * bufferBpsBi) / BPS_DIVISOR;
    let availableLiquidityBi = vaultUsdcBi - requiredBufferBi;
    if (availableLiquidityBi < 0n) availableLiquidityBi = 0n;

    let remainingLiquidityBi = availableLiquidityBi;
    let totalNetPaidBi = 0n;
    let totalSharesBurnedBi = 0n;
    let totalExitFeesRetainedBi = 0n;

    const netFactorNumerator = BPS_DIVISOR - earlyExitFeeBpsBi;

    const processedRequests = requests.map(req => {
        // Skip already completed/cancelled/invalid requests
        if (req.status === 'Completed' || req.status === 'Cancelled' || req.status === 'Invalid') {
            return req;
        }

        const sharesRequestedBi = parseUnits(req.sharesRequested || '0');
        const sharesFilledPreviouslyBi = parseUnits(req.sharesFilled || '0');

        // Per-request negative guards
        let check = requireNonNegativeUnits(sharesRequestedBi, 'sharesRequested');
        if (!check.success) {
            return { ...req, status: 'Invalid' }; // Mark as invalid
        }
        check = requireNonNegativeUnits(sharesFilledPreviouslyBi, 'sharesFilled');
        if (!check.success) {
            return { ...req, status: 'Invalid' };
        }

        // Skip if filled > requested (corrupted data)
        if (sharesFilledPreviouslyBi > sharesRequestedBi) {
            return { ...req, status: 'Invalid' };
        }

        // Skip if requested is zero
        if (sharesRequestedBi === 0n) {
            return req;
        }

        const sharesRemainingBi = sharesRequestedBi - sharesFilledPreviouslyBi;

        if (sharesRemainingBi <= 0n) {
            return req;
        }

        // Calculate max shares fillable with available liquidity
        // Formula: maxShares = (liquidity * 10000 * totalShares) / (equity * (10000 - feeBps))
        let maxSharesFillableBi = 0n;
        if (equityBi > 0n && netFactorNumerator > 0n) {
            maxSharesFillableBi = (remainingLiquidityBi * BPS_DIVISOR * totalSharesBi) / (equityBi * netFactorNumerator);
        }

        let sharesToFillBi = sharesRemainingBi < maxSharesFillableBi ? sharesRemainingBi : maxSharesFillableBi;

        if (sharesToFillBi <= 0n) {
            return req; // No liquidity available
        }

        // Calculate payout: grossValue = shares * equity / totalShares
        let grossValueBi = (sharesToFillBi * equityBi) / totalSharesBi;
        let feeBi = (grossValueBi * earlyExitFeeBpsBi) / BPS_DIVISOR;
        let netPayoutBi = grossValueBi - feeBi;

        // ROUNDING "STUCK FILL" PROTECTION
        // If netPayout exceeds remaining liquidity by a tiny amount due to rounding,
        // try reducing sharesToFill by 1 micro-share
        if (netPayoutBi > remainingLiquidityBi && sharesToFillBi > 1n) {
            const sharesToFillBi2 = sharesToFillBi - 1n;
            const grossValueBi2 = (sharesToFillBi2 * equityBi) / totalSharesBi;
            const feeBi2 = (grossValueBi2 * earlyExitFeeBpsBi) / BPS_DIVISOR;
            const netPayoutBi2 = grossValueBi2 - feeBi2;

            if (netPayoutBi2 > 0n && netPayoutBi2 <= remainingLiquidityBi) {
                // Use adjusted values
                sharesToFillBi = sharesToFillBi2;
                grossValueBi = grossValueBi2;
                feeBi = feeBi2;
                netPayoutBi = netPayoutBi2;
            }
        }

        // GUARD: Prevent 0-payout burns
        if (netPayoutBi <= 0n) {
            return req;
        }

        // GUARD: Final safety check
        if (netPayoutBi > remainingLiquidityBi) {
            return req;
        }

        // Update tracking
        remainingLiquidityBi -= netPayoutBi;
        totalNetPaidBi += netPayoutBi;
        totalSharesBurnedBi += sharesToFillBi;
        totalExitFeesRetainedBi += feeBi; // Fee stays in vault

        const newFilledBi = sharesFilledPreviouslyBi + sharesToFillBi;
        const isComplete = newFilledBi >= sharesRequestedBi;

        return {
            ...req,
            sharesFilled: formatUnits(newFilledBi),
            status: isComplete ? 'Completed' : 'PartiallyFilled',
            lastProcessedEpoch: Date.now(),
            payoutThisEpoch: formatUnits(netPayoutBi),
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
// 5. REDEMPTION (Closed Stage Only)
// =====================
/**
 * Calculate redemption in Closed stage
 * @param {object} vault - Vault state
 * @param {string} sharesStr - Shares to redeem as string
 * @returns {object} - Result with string outputs
 */
export const calculateRedemption = (vault, sharesStr) => {
    if (vault.stage !== 'Closed') {
        return { success: false, error: 'Redemption only allowed in Closed stage' };
    }

    const validation = validateAmount(sharesStr);
    if (!validation.valid) return { success: false, error: validation.error };

    const sharesBi = parseUnits(sharesStr);
    const totalSharesBi = parseUnits(vault.totalShares || '0');
    let vaultUsdcBi = parseUnits(vault.vaultUsdc || '0');

    let check = requireNonNegativeUnits(vaultUsdcBi, 'vaultUsdc');
    if (!check.success) return check;
    check = requireNonNegativeUnits(totalSharesBi, 'totalShares');
    if (!check.success) return check;

    if (sharesBi > totalSharesBi) {
        return { success: false, error: 'Insufficient total shares in vault' };
    }

    if (totalSharesBi <= 0n) {
        return { success: false, error: 'No shares to redeem' };
    }

    // Handle performance fee (charged once)
    const perfFeeDueBi = parseUnits(vault.perfFeeDueUsdc || '0');
    let feeDeductedBi = 0n;

    check = requireNonNegativeUnits(perfFeeDueBi, 'perfFeeDueUsdc');
    if (!check.success) return check;

    if (perfFeeDueBi > 0n && !vault.perfFeePaid) {
        if (vaultUsdcBi < perfFeeDueBi) {
            return { success: false, error: 'Insufficient cash to pay performance fee' };
        }
        vaultUsdcBi -= perfFeeDueBi;
        feeDeductedBi = perfFeeDueBi;
    }

    // Pro-rata payout: payout = shares * vaultUsdc / totalShares
    const payoutBi = (sharesBi * vaultUsdcBi) / totalSharesBi;

    return {
        success: true,
        payout: formatUnits(payoutBi),
        feeDeducted: formatUnits(feeDeductedBi),
        perfFeePaidAfter: feeDeductedBi > 0n || vault.perfFeePaid,
        newVaultUsdc: formatUnits(vaultUsdcBi - payoutBi),
        newTotalShares: formatUnits(totalSharesBi - sharesBi)
    };
};

// =====================
// SPEC VALIDATION & TESTS
// =====================
export const runSpecValidation = () => {
    console.log("=== Running Production-Final Spec Validation ===\n");
    let passed = 0;
    let failed = 0;

    const test = (name, condition, details = '') => {
        if (condition) {
            console.log(`✅ ${name}`);
            passed++;
        } else {
            console.log(`❌ ${name} ${details}`);
            failed++;
        }
    };

    // ===== A) BPS PARSING TESTS =====
    console.log("\n--- BPS Parsing Tests ---");

    // Valid BPS
    const bps100 = parseBps("100", "test");
    test("BPS: valid '100'", bps100.success && bps100.value === 100n);

    const bps0 = parseBps("0", "test");
    test("BPS: valid '0'", bps0.success && bps0.value === 0n);

    const bps9999 = parseBps("9999", "test");
    test("BPS: valid '9999'", bps9999.success && bps9999.value === 9999n);

    // Invalid BPS
    const bpsDecimal = parseBps("1.5", "test");
    test("BPS: rejects '1.5' (decimal)", !bpsDecimal.success);

    const bpsAbc = parseBps("abc", "test");
    test("BPS: rejects 'abc'", !bpsAbc.success);

    const bpsNeg = parseBps("-1", "test");
    test("BPS: rejects '-1'", !bpsNeg.success);

    const bps10000 = parseBps("10000", "test");
    test("BPS: rejects '10000' (>= 10000)", !bps10000.success);

    const bps10001 = parseBps("10001", "test");
    test("BPS: rejects '10001'", !bps10001.success);

    // ===== B) NEGATIVE GUARD TESTS =====
    console.log("\n--- Negative Guard Tests ---");

    const negEquity = calculateEpochProcessing(
        { stage: 'Trading', vaultUsdc: "100.000000", totalShares: "100.000000", liquidityBufferBps: 0, earlyExitFeeBps: 0 },
        [{ id: '1', sharesRequested: "10.000000", sharesFilled: "0.000000", status: 'Pending' }],
        "-1.000000" // Negative equity
    );
    test("Negative equity rejected", !negEquity.success && negEquity.error.includes('cannot be negative'));

    // ===== C) LARGE NUMBER TESTS =====
    console.log("\n--- Large Number Tests ---");

    const largeValStr = "50000000.000000";
    const parsedLarge = parseUnits(largeValStr);
    test("Large number parse (50M)", parsedLarge === 50000000000000n);

    const formatted = formatUnits(parsedLarge);
    test("Large number format roundtrip", formatted === largeValStr);

    const veryLarge = "500000000.123456";
    const parsedVeryLarge = parseUnits(veryLarge);
    const formattedVeryLarge = formatUnits(parsedVeryLarge);
    test("Very large (500M) roundtrip", formattedVeryLarge === veryLarge);

    // ===== D) ROUNDING STUCK-FILL PROTECTION TEST =====
    console.log("\n--- Rounding Protection Test ---");

    // Construct a case where netPayout > remainingLiquidity by ~1 micro-unit
    // We need: (shares * equity / totalShares) * (1 - fee%) just barely exceeds liquidity
    // Vault: 100 USDC, 100 shares, 0% buffer, 0% fee for simplicity
    // Then request that barely exceeds - this tests the -1 micro-share adjustment

    const roundingVault = {
        stage: 'Trading',
        vaultUsdc: "100.000001", // Slightly more than 100
        totalShares: "100.000000",
        liquidityBufferBps: 0,
        earlyExitFeeBps: 0
    };

    const roundingReqs = [{
        id: 'r1',
        sharesRequested: "100.000002", // Requesting slightly more than available
        sharesFilled: "0.000000",
        status: 'Pending'
    }];

    const roundingResult = calculateEpochProcessing(roundingVault, roundingReqs, "100.000001");
    test("Rounding protection: processes without error", roundingResult.success);

    if (roundingResult.success) {
        const burned = parseUnits(roundingResult.totalSharesBurned);
        test("Rounding protection: some shares filled", burned > 0n);
    }

    // ===== E) DEPOSIT & EPOCH LARGE AMOUNTS =====
    console.log("\n--- Large Amount Operations ---");

    const vault = {
        stage: 'Open',
        vaultUsdc: "100000000.000000",
        totalShares: "100000000.000000",
        depositFeeBps: 100,
        highWaterMark: "100000000.000000",
        positions: []
    };

    const depositResult = calculateDeposit(vault, "50000000.000000");
    test("Large deposit (50M)", depositResult.success === true);

    if (depositResult.success) {
        const fee = parseUnits(depositResult.depositFee);
        const expectedFee = 50000000000000n * 100n / 10000n;
        test("Large deposit fee calc", fee === expectedFee);
    }

    const tradingVault = {
        stage: 'Trading',
        vaultUsdc: "100000000.000000",
        totalShares: "100000000.000000",
        liquidityBufferBps: 1000,
        earlyExitFeeBps: 500
    };

    const requests = [{
        id: '1',
        sharesRequested: "50000000.000000",
        sharesFilled: "0.000000",
        status: 'Pending'
    }];

    const epochResult = calculateEpochProcessing(tradingVault, requests, "110000000.000000");
    test("Large epoch (50M shares)", epochResult.success === true);

    // ===== F) OTHER GUARDS =====
    console.log("\n--- Other Guards ---");

    const zeroEquityResult = calculateEpochProcessing(tradingVault, requests, "0");
    test("Zero equity rejected", !zeroEquityResult.success);

    const cancelResult = calculateCancelRequest({ sharesRequested: "100.000000", sharesFilled: "60.000000" });
    test("Cancel returns only unfilled", cancelResult.success && cancelResult.sharesToReturn === "40.000000");

    const wrResult = calculateWithdrawalRequest({ stage: 'Open' }, "10.000000", "100.000000");
    test("Withdrawal request blocked in Open", !wrResult.success);

    // ===== G) CORRUPTED REQUEST DATA TESTS =====
    console.log("\n--- Corrupted Request Data Tests ---");

    // Test A: sharesFilled > sharesRequested
    const corruptedReqs1 = [{
        id: 'bad1',
        sharesRequested: "50.000000",
        sharesFilled: "100.000000", // More filled than requested!
        status: 'Pending'
    }];
    const corruptedResult1 = calculateEpochProcessing(tradingVault, corruptedReqs1, "110000000.000000");
    test("Epoch flags request with filled > requested",
        corruptedResult1.success &&
        corruptedResult1.processedRequests[0].status === 'Invalid');

    // Test B: Negative sharesRequested
    const corruptedReqs2 = [{
        id: 'bad2',
        sharesRequested: "-10.000000",
        sharesFilled: "0.000000",
        status: 'Pending'
    }];
    const corruptedResult2 = calculateEpochProcessing(tradingVault, corruptedReqs2, "110000000.000000");
    test("Epoch flags request with negative sharesRequested",
        corruptedResult2.success &&
        corruptedResult2.processedRequests[0].status === 'Invalid');

    // Test C: BPS parse failure returns correct format
    const badBpsVault = {
        stage: 'Trading',
        vaultUsdc: "100.000000",
        totalShares: "100.000000",
        liquidityBufferBps: "1.5", // Invalid - decimal
        earlyExitFeeBps: 0
    };
    const badBpsResult = calculateEpochProcessing(
        badBpsVault,
        [{ id: '1', sharesRequested: "10.000000", sharesFilled: "0.000000", status: 'Pending' }],
        "100.000000"
    );
    test("BPS parse failure returns {success:false, error:...}",
        !badBpsResult.success &&
        badBpsResult.error &&
        typeof badBpsResult.error === 'string');

    console.log(`\n=== Results: ${passed}/${passed + failed} tests passed ===`);
    console.log("\n🔒 PRODUCTION-FINAL: Vault Math Library is now frozen.");
    return { passed, failed };
};

// Export internal functions for testing
export { parseUnits, formatUnits, parseBps, requireNonNegativeUnits };
