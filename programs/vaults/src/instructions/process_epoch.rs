use anchor_lang::prelude::*;
use anchor_spl::token::{Mint, Token, TokenAccount, Burn, Transfer, burn, transfer};

use crate::state::{
    FundState, FundStage, WithdrawalRequest, RequestStatus,
    FUND_SEED, VAULT_AUTHORITY_SEED, WITHDRAWAL_REQUEST_SEED,
};
use crate::errors::FundError;

/// Process pending withdrawal requests at epoch boundary
/// Anyone can crank this instruction
#[derive(Accounts)]
pub struct ProcessEpoch<'info> {
    /// Cranker (anyone can call)
    #[account(mut)]
    pub payer: Signer<'info>,

    #[account(
        mut,
        seeds = [FUND_SEED, &fund_state.fund_id.to_le_bytes()],
        bump = fund_state.bump,
        constraint = fund_state.stage == FundStage::Trading || fund_state.stage == FundStage::Settlement @ FundError::InvalidStage
    )]
    pub fund_state: Box<Account<'info, FundState>>,

    /// CHECK: Vault authority PDA
    #[account(
        seeds = [VAULT_AUTHORITY_SEED, fund_state.key().as_ref()],
        bump = fund_state.vault_authority_bump
    )]
    pub vault_authority: UncheckedAccount<'info>,

    /// Vault's USDC token account
    #[account(
        mut,
        constraint = vault_usdc_ata.key() == fund_state.vault_usdc_ata @ FundError::InvalidUsdcMint
    )]
    pub vault_usdc_ata: Account<'info, TokenAccount>,

    /// Share mint for burning
    #[account(
        mut,
        constraint = share_mint.key() == fund_state.share_mint @ FundError::InvalidShareMint
    )]
    pub share_mint: Account<'info, Mint>,

    // Note: In production, this would use remaining_accounts to pass:
    // - Multiple WithdrawalRequest accounts
    // - Corresponding investor share accounts
    // - Corresponding investor USDC accounts
    // For MVP, we process one request at a time

    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>,
}

/// Process a single withdrawal request (for MVP - production would batch)
#[derive(Accounts)]
#[instruction(request_index: u32)]
pub struct ProcessSingleWithdrawal<'info> {
    #[account(mut)]
    pub payer: Signer<'info>,

    #[account(
        mut,
        seeds = [FUND_SEED, &fund_state.fund_id.to_le_bytes()],
        bump = fund_state.bump,
        constraint = fund_state.stage == FundStage::Trading || fund_state.stage == FundStage::Settlement @ FundError::InvalidStage
    )]
    pub fund_state: Box<Account<'info, FundState>>,

    /// CHECK: Vault authority PDA
    #[account(
        seeds = [VAULT_AUTHORITY_SEED, fund_state.key().as_ref()],
        bump = fund_state.vault_authority_bump
    )]
    pub vault_authority: UncheckedAccount<'info>,

    /// Vault's USDC token account
    #[account(
        mut,
        constraint = vault_usdc_ata.key() == fund_state.vault_usdc_ata @ FundError::InvalidUsdcMint
    )]
    pub vault_usdc_ata: Account<'info, TokenAccount>,

    /// The withdrawal request to process
    #[account(
        mut,
        seeds = [
            WITHDRAWAL_REQUEST_SEED,
            fund_state.key().as_ref(),
            withdrawal_request.investor.as_ref(),
            &request_index.to_le_bytes()
        ],
        bump = withdrawal_request.bump,
        constraint = withdrawal_request.status == RequestStatus::Pending || 
                     withdrawal_request.status == RequestStatus::PartiallyFilled @ FundError::WithdrawalRequestInactive
    )]
    pub withdrawal_request: Box<Account<'info, WithdrawalRequest>>,

    /// Investor's share token account
    #[account(
        mut,
        constraint = investor_shares.mint == fund_state.share_mint @ FundError::InvalidShareMint,
        constraint = investor_shares.owner == withdrawal_request.investor
    )]
    pub investor_shares: Account<'info, TokenAccount>,

    /// Investor's USDC token account
    #[account(
        mut,
        constraint = investor_usdc.mint == fund_state.usdc_mint @ FundError::InvalidUsdcMint,
        constraint = investor_usdc.owner == withdrawal_request.investor
    )]
    pub investor_usdc: Account<'info, TokenAccount>,

    /// Share mint for burning
    #[account(
        mut,
        constraint = share_mint.key() == fund_state.share_mint @ FundError::InvalidShareMint
    )]
    pub share_mint: Account<'info, Mint>,

    /// CHECK: Investor account for signing burn (delegated authority)
    pub investor: UncheckedAccount<'info>,

    pub token_program: Program<'info, Token>,
}

pub fn handler_process_single(
    ctx: Context<ProcessSingleWithdrawal>,
    request_index: u32,
) -> Result<()> {
    let fund = &ctx.accounts.fund_state;
    let request = &ctx.accounts.withdrawal_request;
    let vault_usdc = ctx.accounts.vault_usdc_ata.amount;
    let clock = Clock::get()?;

    // Check epoch is ready
    let epoch_ready = clock.unix_timestamp >= fund.last_epoch_ts + fund.epoch_interval_secs;
    // For MVP, allow anytime processing during Settlement
    let is_settlement = fund.stage == FundStage::Settlement;
    
    if !epoch_ready && !is_settlement {
        return Err(FundError::EpochNotReady.into());
    }

    let shares_remaining = request.shares_remaining();
    require!(shares_remaining > 0, FundError::WithdrawalRequestInactive);

    // Calculate how much we can pay from available USDC
    // Use the NAV per share locked at request time
    let usdc_per_share = request.nav_per_share_at_request;
    let max_usdc_owed = ((shares_remaining as u128) * (usdc_per_share as u128) / 1_000_000) as u64;
    
    // Pay out as much as possible from available USDC
    let payout = std::cmp::min(max_usdc_owed, vault_usdc);
    let shares_to_process = if usdc_per_share > 0 {
        ((payout as u128) * 1_000_000 / (usdc_per_share as u128)) as u64
    } else {
        0
    };
    
    if payout == 0 || shares_to_process == 0 {
        msg!("No liquidity available for this request");
        return Ok(());
    }

    // Transfer USDC to investor
    let fund_key = ctx.accounts.fund_state.key();
    let vault_seeds = &[
        VAULT_AUTHORITY_SEED,
        fund_key.as_ref(),
        &[fund.vault_authority_bump],
    ];
    let signer_seeds = &[&vault_seeds[..]];

    let transfer_ctx = CpiContext::new_with_signer(
        ctx.accounts.token_program.to_account_info(),
        Transfer {
            from: ctx.accounts.vault_usdc_ata.to_account_info(),
            to: ctx.accounts.investor_usdc.to_account_info(),
            authority: ctx.accounts.vault_authority.to_account_info(),
        },
        signer_seeds,
    );
    transfer(transfer_ctx, payout)?;

    // Update withdrawal request
    let request = &mut ctx.accounts.withdrawal_request;
    request.shares_filled = request.shares_filled.checked_add(shares_to_process)
        .ok_or(FundError::MathOverflow)?;
    request.usdc_received = request.usdc_received.checked_add(payout)
        .ok_or(FundError::MathOverflow)?;
    
    if request.shares_filled >= request.shares_requested {
        request.status = RequestStatus::Completed;
    } else {
        request.status = RequestStatus::PartiallyFilled;
    }

    // Update fund state
    let fund = &mut ctx.accounts.fund_state;
    fund.total_shares = fund.total_shares.saturating_sub(shares_to_process);
    fund.pending_withdrawal_shares = fund.pending_withdrawal_shares.saturating_sub(shares_to_process);
    fund.last_epoch_ts = clock.unix_timestamp;

    msg!("Withdrawal processed");
    msg!("Shares processed: {}", shares_to_process);
    msg!("USDC paid: {}", payout);
    msg!("Status: {:?}", request.status);

    Ok(())
}

/// Simple epoch trigger (updates last_epoch_ts)
pub fn handler(ctx: Context<ProcessEpoch>) -> Result<()> {
    let clock = Clock::get()?;
    let fund = &mut ctx.accounts.fund_state;

    // Check epoch is ready
    require!(
        clock.unix_timestamp >= fund.last_epoch_ts + fund.epoch_interval_secs,
        FundError::EpochNotReady
    );

    // Update epoch timestamp
    fund.last_epoch_ts = clock.unix_timestamp;

    msg!("Epoch triggered at {}", clock.unix_timestamp);
    msg!("Pending shares: {}", fund.pending_withdrawal_shares);

    Ok(())
}
