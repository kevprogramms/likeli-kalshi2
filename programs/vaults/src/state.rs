use anchor_lang::prelude::*;

/// Fund lifecycle stages
/// Open: Deposits allowed, no trading
/// Trading: Deposits locked, manager can trade
/// Settlement: No new trades, manager closes positions
/// Closed: Investors can redeem shares
#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, PartialEq, Eq, Debug)]
pub enum FundStage {
    Open,
    Trading,
    Settlement,
    Closed,
}

impl Default for FundStage {
    fn default() -> Self {
        FundStage::Open
    }
}

/// Withdrawal request status
#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, PartialEq, Eq, Debug)]
pub enum RequestStatus {
    Pending,
    PartiallyFilled,
    Completed,
    Cancelled,
}

impl Default for RequestStatus {
    fn default() -> Self {
        RequestStatus::Pending
    }
}

/// Protocol-level configuration account
/// Controls global parameters and whitelisted programs
#[account]
pub struct ProtocolConfig {
    /// Admin who can update config
    pub admin: Pubkey,
    /// Maximum deposit fee in basis points (300 = 3%)
    pub max_deposit_fee_bps: u16,
    /// Maximum performance fee in basis points (3000 = 30%)
    pub max_perf_fee_bps: u16,
    /// Maximum early exit fee (500 = 5%)
    pub max_early_exit_fee_bps: u16,
    /// Minimum liquidity buffer (500 = 5%)
    pub min_buffer_bps: u16,
    /// Default epoch interval in seconds (86400 = 24h)
    pub default_epoch_interval_secs: i64,
    /// Whitelisted DFlow swap program ID
    pub allowed_dflow_program: Pubkey,
    /// USDC mint address
    pub usdc_mint: Pubkey,
    /// Protocol fee recipient (optional future use)
    pub protocol_fee_recipient: Pubkey,
    /// PDA bump seed
    pub bump: u8,
}

impl ProtocolConfig {
    pub const LEN: usize = 8 + // discriminator
        32 + // admin
        2 +  // max_deposit_fee_bps
        2 +  // max_perf_fee_bps
        2 +  // max_early_exit_fee_bps
        2 +  // min_buffer_bps
        8 +  // default_epoch_interval_secs
        32 + // allowed_dflow_program
        32 + // usdc_mint
        32 + // protocol_fee_recipient
        1;   // bump
}

/// Fund state account - one per fund
/// Stores all fund configuration, lifecycle, and financial data
#[account]
pub struct FundState {
    /// Unique fund identifier
    pub fund_id: u64,
    /// Manager pubkey (creator of the fund)
    pub manager: Pubkey,
    /// Fund name (max 32 bytes, UTF-8)
    pub name: [u8; 32],
    /// Fund symbol/ticker (max 8 bytes)
    pub symbol: [u8; 8],
    
    // === Fee Configuration ===
    /// Deposit fee in basis points (max 300 = 3%)
    pub deposit_fee_bps: u16,
    /// Performance fee in basis points (max 3000 = 30%)
    pub perf_fee_bps: u16,
    /// Early exit fee in basis points (default 500 = 5%)
    pub early_exit_fee_bps: u16,
    
    // === Liquidity Buffer ===
    /// Liquidity buffer in basis points (default 1000 = 10%)
    pub liquidity_buffer_bps: u16,
    
    // === Lifecycle Timestamps ===
    /// Unix timestamp when trading can start
    pub trading_start_ts: i64,
    /// Unix timestamp when trading must end
    pub trading_end_ts: i64,
    /// Current stage of the fund lifecycle
    pub stage: FundStage,
    
    // === Withdrawal Queue ===
    /// Total shares in pending withdrawal requests
    pub pending_withdrawal_shares: u64,
    /// Last epoch processing timestamp
    pub last_epoch_ts: i64,
    /// Epoch interval in seconds (default 86400 = 24h)
    pub epoch_interval_secs: i64,
    /// Number of pending withdrawal requests
    pub pending_request_count: u32,
    
    // === Financial Tracking ===
    /// Initial AUM in USDC (locked at Trading start)
    pub initial_aum_usdc: u64,
    /// Performance fee due in USDC (calculated at finalize)
    pub perf_fee_due_usdc: u64,
    /// Whether performance fee has been paid
    pub perf_fee_paid: bool,
    /// Total USDC deposited (gross, before fees)
    pub total_deposited: u64,
    
    // === Token Accounts ===
    /// Share token mint (PDA-controlled)
    pub share_mint: Pubkey,
    /// Vault authority PDA pubkey
    pub vault_authority: Pubkey,
    /// Vault's USDC token account
    pub vault_usdc_ata: Pubkey,
    /// Manager's fee receiving USDC account
    pub manager_fee_ata: Pubkey,
    /// USDC mint address
    pub usdc_mint: Pubkey,
    
    // === Share Tracking ===
    /// Total shares outstanding
    pub total_shares: u64,
    
    // === PDA Bumps ===
    /// FundState PDA bump
    pub bump: u8,
    /// Vault authority PDA bump
    pub vault_authority_bump: u8,
    /// Share mint PDA bump
    pub share_mint_bump: u8,
}

impl FundState {
    pub const LEN: usize = 8 +  // discriminator
        8 +   // fund_id
        32 +  // manager
        32 +  // name
        8 +   // symbol
        2 +   // deposit_fee_bps
        2 +   // perf_fee_bps
        2 +   // early_exit_fee_bps
        2 +   // liquidity_buffer_bps
        8 +   // trading_start_ts
        8 +   // trading_end_ts
        1 +   // stage (enum)
        8 +   // pending_withdrawal_shares
        8 +   // last_epoch_ts
        8 +   // epoch_interval_secs
        4 +   // pending_request_count
        8 +   // initial_aum_usdc
        8 +   // perf_fee_due_usdc
        1 +   // perf_fee_paid
        8 +   // total_deposited
        32 +  // share_mint
        32 +  // vault_authority
        32 +  // vault_usdc_ata
        32 +  // manager_fee_ata
        32 +  // usdc_mint
        8 +   // total_shares
        1 +   // bump
        1 +   // vault_authority_bump
        1;    // share_mint_bump

    /// Calculate shares to mint for a deposit (after fees)
    pub fn shares_for_deposit(&self, net_amount: u64, vault_balance: u64) -> u64 {
        if self.total_shares == 0 {
            net_amount
        } else {
            ((net_amount as u128) * (self.total_shares as u128) / (vault_balance as u128)) as u64
        }
    }

    /// Calculate USDC to return for shares burned
    pub fn usdc_for_shares(&self, shares: u64, vault_balance: u64) -> u64 {
        if self.total_shares == 0 {
            0
        } else {
            ((shares as u128) * (vault_balance as u128) / (self.total_shares as u128)) as u64
        }
    }

    /// Calculate deposit fee for a given amount
    pub fn calculate_deposit_fee(&self, amount: u64) -> u64 {
        ((amount as u128) * (self.deposit_fee_bps as u128) / 10_000) as u64
    }

    /// Calculate performance fee for a given profit
    pub fn calculate_perf_fee(&self, profit: u64) -> u64 {
        ((profit as u128) * (self.perf_fee_bps as u128) / 10_000) as u64
    }

    /// Calculate early exit fee
    pub fn calculate_early_exit_fee(&self, amount: u64) -> u64 {
        ((amount as u128) * (self.early_exit_fee_bps as u128) / 10_000) as u64
    }

    /// Get minimum buffer amount based on NAV
    pub fn min_buffer_amount(&self, nav: u64) -> u64 {
        ((nav as u128) * (self.liquidity_buffer_bps as u128) / 10_000) as u64
    }

    /// Check if buffer is sufficient for a withdrawal
    pub fn buffer_sufficient(&self, vault_usdc: u64, nav: u64, withdrawal_amount: u64) -> bool {
        let min_buffer = self.min_buffer_amount(nav);
        vault_usdc >= withdrawal_amount + min_buffer
    }
}

/// Withdrawal request account - one per pending withdrawal
#[account]
pub struct WithdrawalRequest {
    /// Fund this request belongs to
    pub fund: Pubkey,
    /// Investor who requested withdrawal
    pub investor: Pubkey,
    /// Total shares requested to withdraw
    pub shares_requested: u64,
    /// Shares already filled
    pub shares_filled: u64,
    /// USDC already received
    pub usdc_received: u64,
    /// NAV per share locked at request time
    pub nav_per_share_at_request: u64,
    /// Unix timestamp when requested
    pub requested_at: i64,
    /// Current status
    pub status: RequestStatus,
    /// PDA bump
    pub bump: u8,
}

impl WithdrawalRequest {
    pub const LEN: usize = 8 +  // discriminator
        32 +  // fund
        32 +  // investor
        8 +   // shares_requested
        8 +   // shares_filled
        8 +   // usdc_received
        8 +   // nav_per_share_at_request
        8 +   // requested_at
        1 +   // status
        1;    // bump

    /// Calculate shares remaining to be filled
    pub fn shares_remaining(&self) -> u64 {
        self.shares_requested.saturating_sub(self.shares_filled)
    }
}

/// Seeds for protocol config PDA
pub const PROTOCOL_CONFIG_SEED: &[u8] = b"protocol_config";

/// Seeds for fund state PDA
pub const FUND_SEED: &[u8] = b"fund";

/// Seeds for vault authority PDA
pub const VAULT_AUTHORITY_SEED: &[u8] = b"vault_authority";

/// Seeds for share mint PDA
pub const SHARE_MINT_SEED: &[u8] = b"share_mint";

/// Seeds for withdrawal request PDA
pub const WITHDRAWAL_REQUEST_SEED: &[u8] = b"withdrawal_request";

/// Default values
pub const DEFAULT_BUFFER_BPS: u16 = 1000;      // 10%
pub const DEFAULT_EARLY_EXIT_FEE_BPS: u16 = 500; // 5%
pub const DEFAULT_EPOCH_INTERVAL_SECS: i64 = 86400; // 24 hours
