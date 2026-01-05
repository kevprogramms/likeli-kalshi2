use anchor_lang::prelude::*;
use anchor_spl::token::{Mint, Token, TokenAccount, Burn, Transfer, burn, transfer};

use crate::state::{
    FundState, FundStage, WithdrawalRequest, RequestStatus,
    FUND_SEED, VAULT_AUTHORITY_SEED, WITHDRAWAL_REQUEST_SEED,
};
use crate::errors::FundError;

/// Withdraw early during Trading stage using liquidity buffer
/// If buffer insufficient, creates a withdrawal request in the queue
#[derive(Accounts)]
pub struct WithdrawEarly<'info> {
    #[account(mut)]
    pub investor: Signer<'info>,

    #[account(
        mut,
        seeds = [FUND_SEED, &fund_state.fund_id.to_le_bytes()],
        bump = fund_state.bump,
        constraint = fund_state.stage == FundStage::Trading @ FundError::InvalidStage
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

    /// Investor's share token account
    #[account(
        mut,
        constraint = investor_shares.mint == fund_state.share_mint @ FundError::InvalidShareMint,
        constraint = investor_shares.owner == investor.key()
    )]
    pub investor_shares: Account<'info, TokenAccount>,

    /// Investor's USDC token account (receives payout)
    #[account(
        mut,
        constraint = investor_usdc.mint == fund_state.usdc_mint @ FundError::InvalidUsdcMint,
        constraint = investor_usdc.owner == investor.key()
    )]
    pub investor_usdc: Account<'info, TokenAccount>,

    /// Share mint for burning
    #[account(
        mut,
        constraint = share_mint.key() == fund_state.share_mint @ FundError::InvalidShareMint
    )]
    pub share_mint: Account<'info, Mint>,

    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>,
}

pub fn handler(ctx: Context<WithdrawEarly>, shares: u64) -> Result<()> {
    let fund = &ctx.accounts.fund_state;
    let vault_usdc = ctx.accounts.vault_usdc_ata.amount;
    
    require!(shares > 0, FundError::ZeroWithdrawal);
    require!(
        ctx.accounts.investor_shares.amount >= shares,
        FundError::InsufficientShares
    );

    // Calculate share value (NAV per share * shares)
    let share_value = fund.usdc_for_shares(shares, vault_usdc);
    
    // Calculate early exit fee (5% default)
    let exit_fee = fund.calculate_early_exit_fee(share_value);
    let payout = share_value.saturating_sub(exit_fee);
    
    // Check if buffer can cover this withdrawal
    // Buffer check: after withdrawal, vault should still have min_buffer % of remaining NAV
    let post_withdrawal_nav = vault_usdc.saturating_sub(payout);
    let min_buffer_needed = fund.min_buffer_amount(post_withdrawal_nav);
    
    let buffer_sufficient = vault_usdc >= payout + min_buffer_needed;
    
    if buffer_sufficient {
        // === Instant withdrawal from buffer ===
        
        // Burn investor's shares
        let burn_ctx = CpiContext::new(
            ctx.accounts.token_program.to_account_info(),
            Burn {
                mint: ctx.accounts.share_mint.to_account_info(),
                from: ctx.accounts.investor_shares.to_account_info(),
                authority: ctx.accounts.investor.to_account_info(),
            },
        );
        burn(burn_ctx, shares)?;
        
        // Transfer USDC to investor (minus fee)
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
        
        // Update fund state
        let fund = &mut ctx.accounts.fund_state;
        fund.total_shares = fund.total_shares.saturating_sub(shares);

        msg!("Early withdrawal executed");
        msg!("Shares burned: {}", shares);
        msg!("Exit fee: {} USDC", exit_fee);
        msg!("Payout: {} USDC", payout);
    } else {
        // === Fall back to queue ===
        // Return error - must use request_withdrawal instead
        return Err(FundError::InsufficientBuffer.into());
    }

    Ok(())
}
