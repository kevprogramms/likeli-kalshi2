use anchor_lang::prelude::*;
use anchor_spl::token::TokenAccount;

use crate::state::{FundState, FundStage, FUND_SEED, VAULT_AUTHORITY_SEED};
use crate::errors::FundError;

#[derive(Accounts)]
pub struct StartTrading<'info> {
    pub caller: Signer<'info>,

    #[account(
        mut,
        seeds = [FUND_SEED, &fund_state.fund_id.to_le_bytes()],
        bump = fund_state.bump,
        constraint = fund_state.stage == FundStage::Open @ FundError::InvalidStage
    )]
    pub fund_state: Account<'info, FundState>,

    /// Vault's USDC token account (to snapshot initial AUM)
    #[account(
        constraint = vault_usdc_ata.key() == fund_state.vault_usdc_ata
    )]
    pub vault_usdc_ata: Account<'info, TokenAccount>,
}

pub fn handler(ctx: Context<StartTrading>) -> Result<()> {
    let fund = &mut ctx.accounts.fund_state;
    let clock = Clock::get()?;

    // Validate trading start time has been reached
    require!(
        clock.unix_timestamp >= fund.trading_start_ts,
        FundError::TradingNotStarted
    );

    // Snapshot initial AUM (vault USDC balance at trading start)
    let initial_aum = ctx.accounts.vault_usdc_ata.amount;
    fund.initial_aum_usdc = initial_aum;

    // Transition to Trading stage
    fund.stage = FundStage::Trading;

    msg!("Trading started");
    msg!("Initial AUM: {} USDC", initial_aum);
    msg!("Trading ends at: {}", fund.trading_end_ts);

    Ok(())
}
