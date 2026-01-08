use anchor_lang::prelude::*;

use crate::state::{FundState, FundStage, FUND_SEED};
use crate::errors::FundError;

#[derive(Accounts)]
pub struct EndTrading<'info> {
    pub caller: Signer<'info>,

    #[account(
        mut,
        seeds = [FUND_SEED, &fund_state.fund_id.to_le_bytes()],
        bump = fund_state.bump,
        constraint = fund_state.stage == FundStage::Trading @ FundError::InvalidStage
    )]
    pub fund_state: Account<'info, FundState>,
}

pub fn handler(ctx: Context<EndTrading>) -> Result<()> {
    let fund = &mut ctx.accounts.fund_state;
    let clock = Clock::get()?;

    // Validate trading end time has been reached
    require!(
        clock.unix_timestamp >= fund.trading_end_ts,
        FundError::TradingNotEnded
    );

    // Transition to Settlement stage
    fund.stage = FundStage::Settlement;

    msg!("Trading ended - Settlement stage begins");
    msg!("Manager must close all positions before finalization");
    msg!("Initial AUM was: {} USDC", fund.initial_aum_usdc);

    Ok(())
}
