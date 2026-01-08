use anchor_lang::prelude::*;

use crate::state::{
    FundState, FundStage, WithdrawalRequest, RequestStatus,
    FUND_SEED, WITHDRAWAL_REQUEST_SEED,
};
use crate::errors::FundError;

/// Cancel a pending withdrawal request
/// Only allowed if not partially filled
#[derive(Accounts)]
#[instruction(request_index: u32)]
pub struct CancelWithdrawal<'info> {
    #[account(mut)]
    pub investor: Signer<'info>,

    #[account(
        mut,
        seeds = [FUND_SEED, &fund_state.fund_id.to_le_bytes()],
        bump = fund_state.bump
    )]
    pub fund_state: Box<Account<'info, FundState>>,

    #[account(
        mut,
        seeds = [
            WITHDRAWAL_REQUEST_SEED,
            fund_state.key().as_ref(),
            investor.key().as_ref(),
            &request_index.to_le_bytes()
        ],
        bump = withdrawal_request.bump,
        constraint = withdrawal_request.investor == investor.key() @ FundError::UnauthorizedManager,
        constraint = withdrawal_request.status == RequestStatus::Pending @ FundError::WithdrawalRequestInactive,
        close = investor
    )]
    pub withdrawal_request: Box<Account<'info, WithdrawalRequest>>,

    pub system_program: Program<'info, System>,
}

pub fn handler(ctx: Context<CancelWithdrawal>, request_index: u32) -> Result<()> {
    let request = &ctx.accounts.withdrawal_request;
    
    // Can't cancel if partially filled
    require!(
        request.shares_filled == 0,
        FundError::CannotCancelPartialWithdrawal
    );

    let shares_to_return = request.shares_requested;

    // Update fund state
    let fund = &mut ctx.accounts.fund_state;
    fund.pending_withdrawal_shares = fund.pending_withdrawal_shares
        .saturating_sub(shares_to_return);

    msg!("Withdrawal request cancelled");
    msg!("Shares returned to pool: {}", shares_to_return);

    Ok(())
}
