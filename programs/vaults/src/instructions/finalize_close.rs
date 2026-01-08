use anchor_lang::prelude::*;
use anchor_spl::token::TokenAccount;

use crate::state::{FundState, FundStage, FUND_SEED};
use crate::errors::FundError;

#[derive(Accounts)]
pub struct FinalizeClose<'info> {
    pub caller: Signer<'info>,

    #[account(
        mut,
        seeds = [FUND_SEED, &fund_state.fund_id.to_le_bytes()],
        bump = fund_state.bump,
        constraint = fund_state.stage == FundStage::Settlement @ FundError::InvalidStage
    )]
    pub fund_state: Account<'info, FundState>,

    /// Vault's USDC token account
    #[account(
        constraint = vault_usdc_ata.key() == fund_state.vault_usdc_ata
    )]
    pub vault_usdc_ata: Account<'info, TokenAccount>,

    // NOTE: In production, we would also verify that no outcome token ATAs
    // have non-zero balances. For MVP, we trust that the manager has closed
    // all positions and the vault only holds USDC.
}

pub fn handler(ctx: Context<FinalizeClose>) -> Result<()> {
    let fund = &mut ctx.accounts.fund_state;
    let vault_balance = ctx.accounts.vault_usdc_ata.amount;

    // In production, verify vault holds only USDC (no outcome tokens)
    // For MVP, we proceed with the assumption that positions are closed

    // Calculate performance fee
    let initial_aum = fund.initial_aum_usdc;
    let final_balance = vault_balance;
    
    let profit = if final_balance > initial_aum {
        final_balance - initial_aum
    } else {
        0
    };

    let perf_fee = fund.calculate_perf_fee(profit);
    fund.perf_fee_due_usdc = perf_fee;
    fund.perf_fee_paid = false;

    // Transition to Closed stage
    fund.stage = FundStage::Closed;

    msg!("=== FUND FINALIZED ===");
    msg!("Initial AUM: {} USDC", initial_aum);
    msg!("Final Balance: {} USDC", final_balance);
    msg!("Profit: {} USDC", profit);
    msg!("Performance Fee Due: {} USDC", perf_fee);
    msg!("Investors can now redeem shares");

    Ok(())
}
