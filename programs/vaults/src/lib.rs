use anchor_lang::prelude::*;

declare_id!("LkLi5oLN8TG7EW95N4fMGxmHv6R9HyHGUqvQrHDoFWH");

pub mod state;
pub mod instructions;
pub mod errors;

use instructions::*;

#[program]
pub mod vaults {
    use super::*;

    /// Initialize protocol configuration
    /// Admin only - sets global parameters and whitelisted programs
    pub fn initialize_protocol(
        ctx: Context<InitializeProtocol>,
        allowed_dflow_program: Pubkey,
    ) -> Result<()> {
        instructions::initialize_protocol::handler(ctx, allowed_dflow_program)
    }

    /// Create a new prediction fund (step 1)
    /// Manager specifies fees, name, symbol, and trading window
    pub fn create_fund(
        ctx: Context<CreateFund>,
        fund_id: u64,
        name: String,
        symbol: String,
        deposit_fee_bps: u16,
        perf_fee_bps: u16,
        trading_start_ts: i64,
        trading_end_ts: i64,
    ) -> Result<()> {
        instructions::create_fund::handler(
            ctx,
            fund_id,
            name,
            symbol,
            deposit_fee_bps,
            perf_fee_bps,
            trading_start_ts,
            trading_end_ts,
        )
    }

    /// Initialize share mint (step 2a)
    /// Creates share mint and vault authority PDA
    pub fn initialize_share_mint(ctx: Context<InitializeShareMint>) -> Result<()> {
        instructions::create_fund::handler_init_share_mint(ctx)
    }

    /// Initialize vault accounts (step 2b)
    /// Creates vault USDC ATA, manager fee ATA
    pub fn initialize_vault_accounts(ctx: Context<InitializeVaultAccounts>) -> Result<()> {
        instructions::create_fund::handler_init_vault_accounts(ctx)
    }

    /// Deposit USDC into a fund during Open stage
    /// Deposit fee is charged immediately and sent to manager
    pub fn deposit(ctx: Context<Deposit>, amount: u64) -> Result<()> {
        instructions::deposit::handler(ctx, amount)
    }

    /// Withdraw USDC from a fund during Open stage
    /// Burns shares and returns proportional USDC
    pub fn withdraw_open(ctx: Context<WithdrawOpen>, shares: u64) -> Result<()> {
        instructions::withdraw_open::handler(ctx, shares)
    }

    /// Withdraw early during Trading stage using liquidity buffer
    /// Instant if buffer covers, otherwise returns InsufficientBuffer error
    /// 5% early exit fee applies
    pub fn withdraw_early(ctx: Context<WithdrawEarly>, shares: u64) -> Result<()> {
        instructions::withdraw_early::handler(ctx, shares)
    }

    /// Request a withdrawal during Trading stage (queue-based)
    /// Creates a withdrawal request PDA processed at next epoch
    pub fn request_withdrawal(ctx: Context<RequestWithdrawal>, shares: u64) -> Result<()> {
        instructions::request_withdrawal::handler(ctx, shares)
    }

    /// Cancel a pending withdrawal request
    /// Only allowed if not partially filled
    pub fn cancel_withdrawal(ctx: Context<CancelWithdrawal>, request_index: u32) -> Result<()> {
        instructions::cancel_withdrawal::handler(ctx, request_index)
    }

    /// Process a single withdrawal request from the queue
    /// Can be called after epoch interval (24h default)
    pub fn process_single_withdrawal(
        ctx: Context<ProcessSingleWithdrawal>,
        request_index: u32,
    ) -> Result<()> {
        instructions::process_epoch::handler_process_single(ctx, request_index)
    }

    /// Trigger epoch processing (updates last_epoch_ts)
    pub fn process_epoch(ctx: Context<ProcessEpoch>) -> Result<()> {
        instructions::process_epoch::handler(ctx)
    }

    /// Transition fund from Open to Trading stage
    /// Locks initial AUM for performance fee calculation
    pub fn start_trading(ctx: Context<StartTrading>) -> Result<()> {
        instructions::start_trading::handler(ctx)
    }

    /// Execute a trade on DFlow prediction markets
    /// Manager only - validates and executes trade instructions
    pub fn execute_trade(
        ctx: Context<ExecuteTrade>,
        params: TradeParams,
    ) -> Result<()> {
        instructions::execute_trade::handler(ctx, params)
    }

    /// Transition fund from Trading to Settlement stage
    /// No new trades allowed, manager must close positions
    pub fn end_trading(ctx: Context<EndTrading>) -> Result<()> {
        instructions::end_trading::handler(ctx)
    }

    /// Finalize fund and transition to Closed stage
    /// Calculates performance fee based on profit
    /// Requires vault to hold only USDC (all positions closed)
    pub fn finalize_close(ctx: Context<FinalizeClose>) -> Result<()> {
        instructions::finalize_close::handler(ctx)
    }

    /// Redeem shares for USDC during Closed stage
    /// First redemption pays performance fee to manager
    pub fn redeem(ctx: Context<Redeem>, shares: u64) -> Result<()> {
        instructions::redeem::handler(ctx, shares)
    }
}
