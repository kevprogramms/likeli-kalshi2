// =====================
// STATIC ETF VAULT — REDEMPTION MATH (Production-Final)
// =====================
// - ALL INPUTS: strings with up to 6 decimals ("123.456789")
// - ALL OUTPUTS: strings with 6 decimals
// - ALL INTERNAL: BigInt micro-units
//
// Supports TWO redemption modes settled every epoch:
//   1) CASH   -> user receives USDC (requires vault cash; partial fill FIFO)
//   2) IN_KIND-> user receives pro-rata underlying positions (no liquidity constraint)
//
// IMPORTANT INTEGRATION NOTES:
// - This library does NOT execute trades. For CASH redemptions, you should
//   have an external executor sell positions and increase vault.cashUsdc before processing.
// - Pricing is snapshot-based per epoch. For CASH payouts we default to conservative "BID NAV".
// =====================

const DECIMALS = 6;
const BPS_DIVISOR = 10000n;
const ONE = 1000000n; // 1.000000 in micro units

// ---------------------
// Precision Helpers
// ---------------------
export const parseUnits = (value, decimals = DECIMALS) => {
    if (typeof value === "bigint") return value;
    const str = String(value).trim();

    if (!/^-?\d*\.?\d*$/.test(str) || str === "" || str === "." || str === "-" || str === "-.") {
        throw new Error(`Invalid number format: "${str}"`);
    }

    const isNegative = str.startsWith("-");
    const absStr = isNegative ? str.slice(1) : str;

    const [integerPart = "0", fractionalPart = ""] = absStr.split(".");
    const paddedFraction = fractionalPart.padEnd(decimals, "0").slice(0, decimals);

    const result = BigInt(`${integerPart}${paddedFraction}`);
    return isNegative ? -result : result;
};

export const formatUnits = (value, decimals = DECIMALS) => {
    const isNegative = value < 0n;
    const abs = isNegative ? -value : value;

    const str = abs.toString().padStart(decimals + 1, "0");
    const intPart = str.slice(0, -decimals) || "0";
    const fracPart = str.slice(-decimals);
    return `${isNegative ? "-" : ""}${intPart}.${fracPart}`;
};

export const validatePositiveAmount = (amountStr, name = "amount") => {
    const str = String(amountStr).trim();
    if (!/^\d+(\.\d+)?$/.test(str)) return { success: false, error: `${name} must be a positive number string` };
    const parts = str.split(".");
    if (parts[1] && parts[1].length > DECIMALS) return { success: false, error: `${name} max ${DECIMALS} decimals` };
    const bi = parseUnits(str);
    if (bi <= 0n) return { success: false, error: `${name} must be > 0` };
    return { success: true, value: str };
};

export const parseBps = (input, name) => {
    const str = String(input).trim();
    if (!/^\d+$/.test(str)) return { success: false, error: `${name} must be integer bps (0..9999)` };
    const bps = BigInt(str);
    if (bps >= BPS_DIVISOR) return { success: false, error: `${name} must be < 10000` };
    return { success: true, value: bps };
};

export const requireNonNegativeUnits = (bi, name) => {
    if (bi < 0n) return { success: false, error: `${name} cannot be negative (got ${formatUnits(bi)})` };
    return { success: true };
};

// ---------------------
// Pricing Helpers
// ---------------------
// priceSnapshot[marketId] example:
// {
//   bidYes: "0.430000",
//   askYes: "0.434000",
//   midYes: "0.432000"   // optional
// }
//
// For NO, we derive:
// midNo = 1 - midYes
// bidNo ≈ 1 - askYes
// askNo ≈ 1 - bidYes
const getYesPx = (snap, mode) => {
    const pick =
        mode === "BID" ? snap.bidYes :
            mode === "ASK" ? snap.askYes :
                snap.midYes ?? snap.bidYes ?? snap.askYes;

    if (pick == null) throw new Error("Missing yes price in snapshot");
    const px = parseUnits(pick);
    // clamp to [0, 1]
    if (px < 0n) return 0n;
    if (px > ONE) return ONE;
    return px;
};

const getPrice = (priceSnapshot, marketId, side, mode /* "MID"|"BID"|"ASK" */) => {
    const snap = priceSnapshot?.[marketId];
    if (!snap) throw new Error(`Missing snapshot for marketId=${marketId}`);

    const yes = getYesPx(snap, mode);
    if (side === "YES") return yes;

    // NO derived
    if (mode === "MID") return ONE - yes;

    // BID NO ~ 1 - ASK YES ; ASK NO ~ 1 - BID YES
    if (mode === "BID") {
        const askYes = parseUnits(snap.askYes ?? snap.midYes ?? snap.bidYes);
        return ONE - (askYes > ONE ? ONE : askYes < 0n ? 0n : askYes);
    }
    if (mode === "ASK") {
        const bidYes = parseUnits(snap.bidYes ?? snap.midYes ?? snap.askYes);
        return ONE - (bidYes > ONE ? ONE : bidYes < 0n ? 0n : bidYes);
    }
    throw new Error(`Unknown mode=${mode}`);
};

// ---------------------
// NAV / Equity
// ---------------------
// Vault positions format:
// vault.positions = [{ marketId, side: "YES"|"NO", shares: "123.000000" }, ...]
// Vault cash format: vault.cashUsdc = "1000.000000"
export const computeEquityUsdc = (vault, priceSnapshot, markMode = "MID") => {
    const cash = parseUnits(vault.cashUsdc || "0");
    let check = requireNonNegativeUnits(cash, "cashUsdc");
    if (!check.success) return check;

    let posValue = 0n;
    const positions = Array.isArray(vault.positions) ? vault.positions : [];

    for (const p of positions) {
        const shares = parseUnits(p.shares || "0");
        check = requireNonNegativeUnits(shares, `positionShares(${p.marketId})`);
        if (!check.success) return check;

        if (shares === 0n) continue;
        const px = getPrice(priceSnapshot, p.marketId, p.side, markMode); // micro price 0..1
        // value = shares * price (scaled by ONE)
        const val = (shares * px) / ONE;
        posValue += val;
    }

    return { success: true, equityUsdc: formatUnits(cash + posValue) };
};

// ---------------------
// Redemption Request Creation
// ---------------------
// request: { id, kind: "CASH"|"IN_KIND", sharesRequested, sharesFilled, status, createdAtMs }
export const createRedemptionRequest = (kind, sharesRequestedStr) => {
    if (kind !== "CASH" && kind !== "IN_KIND") {
        return { success: false, error: 'kind must be "CASH" or "IN_KIND"' };
    }
    const v = validatePositiveAmount(sharesRequestedStr, "sharesRequested");
    if (!v.success) return v;

    const req = {
        id: `red-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`,
        kind,
        sharesRequested: String(sharesRequestedStr).trim(),
        sharesFilled: "0.000000",
        status: "Pending",
        createdAtMs: Date.now(),
    };
    return { success: true, request: req };
};

export const cancelRedemptionRequest = (request) => {
    const requested = parseUnits(request.sharesRequested || "0");
    const filled = parseUnits(request.sharesFilled || "0");
    if (filled > requested) return { success: false, error: "Corrupt request: filled > requested" };

    const remaining = requested - filled;
    if (remaining <= 0n) return { success: false, error: "Nothing left to cancel" };

    return {
        success: true,
        sharesToReturn: formatUnits(remaining),
        // caller should set request.status = "Cancelled"
    };
};

// ---------------------
// Epoch Settlement Core
// ---------------------
// vault fields required:
// - vault.totalShares (string)
// - vault.cashUsdc (string)
// - vault.liquidityBufferBps (int/string)  (buffer applies to CASH payouts only)
// - vault.exitFeeBps (int/string)          (optional; applies to CASH payouts only)
// - vault.positions (array)               (for in-kind transfers)
// - vault.stage === "Trading"             (recommended guard)
//
// processEpochRedemptions:
// - Settles BOTH CASH and IN_KIND requests in ONE epoch.
// - CASH: FIFO limited by available cash (cash - buffer). Partial fills allowed.
// - IN_KIND: Always fill fully (unless request invalid), pro-rata transfer.
// - Burns shares ONLY for filled portion.
// - Returns "transferInstructions" for IN_KIND requests (pro-rata positions + cash share).
//
// CASH payout pricing:
// - Uses equity computed at "BID" NAV by default (conservative, avoids midpoint extraction).
export const processEpochRedemptions = (
    vault,
    requests,
    priceSnapshot,
    {
        epochNowMs = Date.now(),
        cashNavMode = "BID",     // "BID" (recommended) or "MID"
        inKindIncludeCash = true // include pro-rata cash in in-kind transfers
    } = {}
) => {
    // Basic guards
    if (!vault || typeof vault !== "object") return { success: false, error: "vault required" };
    if (!Array.isArray(requests) || requests.length === 0) return { success: false, error: "no requests" };
    if (vault.stage && vault.stage !== "Trading") return { success: false, error: "epoch processing only in Trading stage" };

    const totalShares = parseUnits(vault.totalShares || "0");
    let check = requireNonNegativeUnits(totalShares, "totalShares");
    if (!check.success) return check;
    if (totalShares <= 0n) return { success: false, error: "totalShares must be > 0" };

    let cash = parseUnits(vault.cashUsdc || "0");
    check = requireNonNegativeUnits(cash, "cashUsdc");
    if (!check.success) return check;

    const bufferBpsR = parseBps(vault.liquidityBufferBps || 0, "liquidityBufferBps");
    if (!bufferBpsR.success) return { success: false, error: bufferBpsR.error };
    const bufferBps = bufferBpsR.value;

    const exitFeeBpsR = parseBps(vault.exitFeeBps || 0, "exitFeeBps");
    if (!exitFeeBpsR.success) return { success: false, error: exitFeeBpsR.error };
    const exitFeeBps = exitFeeBpsR.value;

    // Compute CASH equity (NAV) using conservative pricing by default
    const eqR = computeEquityUsdc(vault, priceSnapshot, cashNavMode);
    if (!eqR.success) return eqR;
    const equity = parseUnits(eqR.equityUsdc);
    if (equity <= 0n) return { success: false, error: "equity <= 0; cannot compute NAV for CASH redemptions" };

    // CASH liquidity available after buffer
    const requiredBuffer = (cash * bufferBps) / BPS_DIVISOR;
    let availableCash = cash - requiredBuffer;
    if (availableCash < 0n) availableCash = 0n;

    // For IN_KIND fairness, use epoch-start denominator + holdings snapshot
    const epochStartTotalShares = totalShares;
    const epochStartCash = cash;

    // Snapshot positions at epoch start
    const epochStartPositions = (Array.isArray(vault.positions) ? vault.positions : []).map(p => ({
        marketId: p.marketId,
        side: p.side,
        shares: parseUnits(p.shares || "0"),
    }));

    // Tracking totals
    let totalSharesBurned = 0n;
    let totalCashPaid = 0n;
    let totalExitFeesRetained = 0n;

    const processed = [];
    const transferInstructions = []; // for in-kind: per request list of transfers

    // Helper: adjust shares down by a couple micros if rounding causes net > available
    const computeCashForShares = (sharesToFill) => {
        const gross = (sharesToFill * equity) / totalShares; // gross USDC value
        const fee = (gross * exitFeeBps) / BPS_DIVISOR;
        const net = gross - fee;
        return { gross, fee, net };
    };

    // FIFO over requests (keep your request ordering already sorted by createdAt)
    for (const req of requests) {
        // passthrough completed/cancelled
        if (req.status === "Completed" || req.status === "Cancelled") {
            processed.push(req);
            continue;
        }

        // Validate request fields
        let requested, filled;
        try {
            requested = parseUnits(req.sharesRequested || "0");
            filled = parseUnits(req.sharesFilled || "0");
        } catch (e) {
            processed.push({ ...req, status: "Invalid", invalidReason: "Bad numeric format" });
            continue;
        }
        if (requested <= 0n) {
            processed.push({ ...req, status: "Invalid", invalidReason: "requested<=0" });
            continue;
        }
        if (filled < 0n || filled > requested) {
            processed.push({ ...req, status: "Invalid", invalidReason: "filled out of range" });
            continue;
        }

        const remaining = requested - filled;
        if (remaining <= 0n) {
            processed.push({ ...req, status: "Completed" });
            continue;
        }

        // ------------------
        // IN_KIND Redemption
        // ------------------
        if (req.kind === "IN_KIND") {
            // We fill IN_KIND fully each epoch (no liquidity constraint).
            const sharesToFill = remaining;

            // Pro-rata ratio against epoch-start total shares:
            // transfer = floor(holding * sharesToFill / epochStartTotalShares)
            const transfers = [];

            // Optional: include pro-rata cash in-kind
            if (inKindIncludeCash && epochStartCash > 0n) {
                const cashTransfer = (epochStartCash * sharesToFill) / epochStartTotalShares;
                if (cashTransfer > 0n) transfers.push({ type: "USDC", amount: formatUnits(cashTransfer) });
                // Update vault cash
                cash -= cashTransfer;
            }

            // Positions transfers
            for (const p of epochStartPositions) {
                if (p.shares <= 0n) continue;
                const move = (p.shares * sharesToFill) / epochStartTotalShares;
                if (move <= 0n) continue;

                transfers.push({
                    type: "POSITION",
                    marketId: p.marketId,
                    side: p.side,
                    shares: formatUnits(move),
                });

                // Update vault position balances (subtract)
                // We mutate a live map below after loop for safety.
            }

            // Apply the position subtractions to live vault positions
            // Build map for current live positions
            const live = new Map();
            for (const vp of Array.isArray(vault.positions) ? vault.positions : []) {
                const key = `${vp.marketId}::${vp.side}`;
                live.set(key, parseUnits(vp.shares || "0"));
            }
            for (const t of transfers) {
                if (t.type !== "POSITION") continue;
                const key = `${t.marketId}::${t.side}`;
                const cur = live.get(key) ?? 0n;
                const sub = parseUnits(t.shares);
                // Safe clamp: don't underflow
                const next = cur > sub ? (cur - sub) : 0n;
                live.set(key, next);
            }
            // Write back to vault.positions
            vault.positions = Array.from(live.entries()).map(([key, amt]) => {
                const [marketId, side] = key.split("::");
                return { marketId, side, shares: formatUnits(amt) };
            });

            // Burn shares
            totalSharesBurned += sharesToFill;
            vault.totalShares = formatUnits(parseUnits(vault.totalShares || "0") - sharesToFill);

            // Update request
            const newFilled = filled + sharesToFill;
            processed.push({
                ...req,
                sharesFilled: formatUnits(newFilled),
                status: "Completed",
                lastProcessedEpoch: epochNowMs,
                transfersThisEpoch: transfers, // optional embed for app UI
            });
            transferInstructions.push({ requestId: req.id, transfers });

            continue;
        }

        // ------------------
        // CASH Redemption
        // ------------------
        if (req.kind === "CASH") {
            // If no cash left, leave as pending/partial
            if (availableCash <= 0n) {
                processed.push(req);
                continue;
            }

            // Compute max shares fillable from availableCash:
            // net = shares * (equity/totalShares) * (1 - fee)
            // => shares <= availableCash * 10000 * totalShares / (equity * (10000 - feeBps))
            const netFactor = BPS_DIVISOR - exitFeeBps;
            let maxShares = 0n;
            if (equity > 0n && netFactor > 0n) {
                maxShares = (availableCash * BPS_DIVISOR * totalShares) / (equity * netFactor);
            }

            let sharesToFill = remaining < maxShares ? remaining : maxShares;
            if (sharesToFill <= 0n) {
                processed.push(req);
                continue;
            }

            // Compute net payout; adjust down a couple micro-shares if rounding overshoots
            let { gross, fee, net } = computeCashForShares(sharesToFill);

            // Rounding protection (small bounded)
            for (let i = 0; i < 3 && net > availableCash && sharesToFill > 0n; i++) {
                sharesToFill -= 1n;
                ({ gross, fee, net } = computeCashForShares(sharesToFill));
            }

            if (sharesToFill <= 0n || net <= 0n || net > availableCash) {
                processed.push(req);
                continue;
            }

            // Pay out net (fee stays in vault cash effectively)
            availableCash -= net;
            cash -= net; // vault cash decreases by what is paid to user

            totalCashPaid += net;
            totalExitFeesRetained += fee;

            // Burn shares filled
            totalSharesBurned += sharesToFill;
            vault.totalShares = formatUnits(parseUnits(vault.totalShares || "0") - sharesToFill);

            const newFilled = filled + sharesToFill;
            const completed = newFilled >= requested;

            processed.push({
                ...req,
                sharesFilled: formatUnits(newFilled),
                status: completed ? "Completed" : "PartiallyFilled",
                lastProcessedEpoch: epochNowMs,
                payoutUsdcThisEpoch: formatUnits(net),
                exitFeeUsdcThisEpoch: formatUnits(fee),
                // informative
                navEquityUsed: eqR.equityUsdc,
                navModeUsed: cashNavMode,
            });

            continue;
        }

        // Unknown kind
        processed.push({ ...req, status: "Invalid", invalidReason: "Unknown kind" });
    }

    // Write back vault cash
    vault.cashUsdc = formatUnits(cash);

    return {
        success: true,
        result: {
            processedRequests: processed,
            transferInstructions, // for IN_KIND settlements
            totals: {
                totalSharesBurned: formatUnits(totalSharesBurned),
                totalCashPaidOut: formatUnits(totalCashPaid),
                totalExitFeesRetainedUsdc: formatUnits(totalExitFeesRetained),
                // post-epoch vault state (caller can persist vault object)
                newCashUsdc: vault.cashUsdc,
                newTotalShares: vault.totalShares,
                cashBufferReservedUsdc: formatUnits(requiredBuffer),
            },
            updatedVault: vault,
        },
    };
};

// ---------------------
// Optional Helper: Build Inverse Basket (Static)
// ---------------------
// If your "inverse vault" is literally the opposite outcomes,
// you can construct positions by flipping YES<->NO.
export const buildInversePositions = (positions) => {
    const list = Array.isArray(positions) ? positions : [];
    return list.map(p => ({
        marketId: p.marketId,
        side: p.side === "YES" ? "NO" : "YES",
        shares: String(p.shares ?? "0.000000"),
    }));
};
