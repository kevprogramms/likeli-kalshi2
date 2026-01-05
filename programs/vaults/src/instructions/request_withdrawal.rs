use anchor_lang::prelude::*;
use anchor_spl::token::{Mint, Token, TokenAccount};

use crate::state::{
    FundState, FundStage, WithdrawalRequest, RequestStatus,
    FUND_SEED, WITHDRAWAL_REQUEST_SEED,
};
use crate::errors::FundError;

/// Request a withdrawal during Trading stage
/// Creates a WithdrawalRequest PDA that will be processed at the next epoch
#[derive(Accounts)]
pub struct RequestWithdrawal<'info> {
    #[account(mut)]
    pub investor: Signer<'info>,

    #[account(
        mut,
        seeds = [FUND_SEED, &fund_state.fund_id.to_le_bytes()],
        bump = fund_state.bump,
        constraint = fund_state.stage == FundStage::Trading @ FundError::InvalidStage
    )]
    pub fund_state: Box<Account<'info, FundState>>,

    #[account(
        init,
        payer = investor,
        space = WithdrawalRequest::LEN,
        seeds = [
            WITHDRAWAL_REQUEST_SEED,
            fund_state.key().as_ref(),
            investor.key().as_ref(),
            &fund_state.pending_request_count.to_le_bytes()
        ],
        bump
    )]
    pub withdrawal_request: Box<Account<'info, WithdrawalRequest>>,

    /// Investor's share token account
    #[account(
        constraint = investor_shares.mint == fund_state.share_mint @ FundError::InvalidShareMint,
        constraint = investor_shares.owner == investor.key()
    )]
    pub investor_shares: Account<'info, TokenAccount>,

    /// Vault's USDC token account (for NAV calculation)
    #[account(
        constraint = vault_usdc_ata.key() == fund_state.vault_usdc_ata @ FundError::InvalidUsdcMint
    )]
    pub vault_usdc_ata: Account<'info, TokenAccount>,

    pub system_program: Program<'info, System>,
}

pub fn handler(ctx: Context<RequestWithdrawal>, shares: u64) -> Result<()> {
    let fund = &ctx.accounts.fund_state;
    let vault_usdc = ctx.accounts.vault_usdc_ata.amount;
    let clock = Clock::get()?;
    
    require!(shares > 0, FundError::ZeroWithdrawal);
    require!(
        ctx.accounts.investor_shares.amount >= shares,
        FundError::InsufficientShares
    );

    // Calculate NAV per share at request time (locks in the rate)
    let nav_per_share = if fund.total_shares > 0 {
        ((vault_usdc as u128) * 1_000_000 / (fund.total_shares as u128)) as u64
    } else {
        1_000_000 // 1 USDC per share
    };

    // Initialize withdrawal request
    let request = &mut ctx.accounts.withdrawal_request;
    request.fund = ctx.accounts.fund_state.key();
    request.investor = ctx.accounts.investor.key();
    request.shares_requested = shares;
    request.shares_filled = 0;
    request.usdc_received = 0;
    request.nav_per_share_at_request = nav_per_share;
    request.requested_at = clock.unix_timestamp;
    request.status = RequestStatus::Pending;
    request.bump = ctx.bumps.withdrawal_request;

    // Update fund state
    let fund = &mut ctx.accounts.fund_state;
    fund.pending_withdrawal_shares = fund.pending_withdrawal_shares
        .checked_add(shares)
        .ok_or(FundError::MathOverflow)?;
    fund.pending_request_count = fund.pending_request_count
        .checked_add(1)
        .ok_or(FundError::MathOverflow)?;

    msg!("Withdrawal request created");
    msg!("Shares: {}", shares);
    msg!("NAV per share: {}", nav_per_share);
    msg!("Request ID: {}", fund.pending_request_count - 1);

    Ok(())
}
