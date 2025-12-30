use anchor_lang::prelude::*;
use anchor_spl::token::{self, Mint, Token, TokenAccount, Burn, Transfer};

use crate::state::{FundState, FundStage, FUND_SEED, VAULT_AUTHORITY_SEED, SHARE_MINT_SEED};
use crate::errors::FundError;

#[derive(Accounts)]
pub struct Redeem<'info> {
    #[account(mut)]
    pub investor: Signer<'info>,

    #[account(
        mut,
        seeds = [FUND_SEED, &fund_state.fund_id.to_le_bytes()],
        bump = fund_state.bump,
        constraint = fund_state.stage == FundStage::Closed @ FundError::WithdrawalsNotAllowed
    )]
    pub fund_state: Account<'info, FundState>,

    /// CHECK: PDA for vault authority
    #[account(
        seeds = [VAULT_AUTHORITY_SEED, fund_state.key().as_ref()],
        bump = fund_state.vault_authority_bump
    )]
    pub vault_authority: UncheckedAccount<'info>,

    /// Share mint
    #[account(
        mut,
        seeds = [SHARE_MINT_SEED, fund_state.key().as_ref()],
        bump = fund_state.share_mint_bump
    )]
    pub share_mint: Account<'info, Mint>,

    /// Investor's USDC token account
    #[account(
        mut,
        constraint = investor_usdc_ata.mint == fund_state.usdc_mint @ FundError::InvalidUsdcMint
    )]
    pub investor_usdc_ata: Account<'info, TokenAccount>,

    /// Vault's USDC token account
    #[account(
        mut,
        constraint = vault_usdc_ata.key() == fund_state.vault_usdc_ata
    )]
    pub vault_usdc_ata: Account<'info, TokenAccount>,

    /// Manager's fee receiving USDC account
    #[account(
        mut,
        constraint = manager_fee_ata.key() == fund_state.manager_fee_ata
    )]
    pub manager_fee_ata: Account<'info, TokenAccount>,

    /// Investor's share token account
    #[account(
        mut,
        constraint = investor_share_ata.mint == fund_state.share_mint @ FundError::InvalidShareMint
    )]
    pub investor_share_ata: Account<'info, TokenAccount>,

    pub token_program: Program<'info, Token>,
}

pub fn handler(ctx: Context<Redeem>, shares: u64) -> Result<()> {
    require!(shares > 0, FundError::ZeroWithdrawal);
    require!(
        ctx.accounts.investor_share_ata.amount >= shares,
        FundError::InsufficientShares
    );

    let fund = &mut ctx.accounts.fund_state;
    let fund_key = fund.key();
    let vault_authority_bump = fund.vault_authority_bump;

    // Seeds for signing
    let seeds = &[
        VAULT_AUTHORITY_SEED,
        fund_key.as_ref(),
        &[vault_authority_bump],
    ];
    let signer_seeds = &[&seeds[..]];

    // Pay performance fee on first redemption (if due and unpaid)
    if fund.perf_fee_due_usdc > 0 && !fund.perf_fee_paid {
        let perf_fee = fund.perf_fee_due_usdc;
        
        // Transfer performance fee to manager
        let transfer_fee_ctx = CpiContext::new_with_signer(
            ctx.accounts.token_program.to_account_info(),
            Transfer {
                from: ctx.accounts.vault_usdc_ata.to_account_info(),
                to: ctx.accounts.manager_fee_ata.to_account_info(),
                authority: ctx.accounts.vault_authority.to_account_info(),
            },
            signer_seeds,
        );
        token::transfer(transfer_fee_ctx, perf_fee)?;
        
        fund.perf_fee_paid = true;
        msg!("Performance fee paid to manager: {} USDC", perf_fee);
    }

    // Reload vault balance after potential fee payment
    ctx.accounts.vault_usdc_ata.reload()?;
    let vault_balance = ctx.accounts.vault_usdc_ata.amount;

    // Calculate USDC to return for shares
    let usdc_amount = fund.usdc_for_shares(shares, vault_balance);
    
    require!(
        vault_balance >= usdc_amount,
        FundError::InsufficientVaultBalance
    );

    // 1. Burn shares from investor
    let burn_ctx = CpiContext::new(
        ctx.accounts.token_program.to_account_info(),
        Burn {
            mint: ctx.accounts.share_mint.to_account_info(),
            from: ctx.accounts.investor_share_ata.to_account_info(),
            authority: ctx.accounts.investor.to_account_info(),
        },
    );
    token::burn(burn_ctx, shares)?;

    // 2. Transfer USDC from vault to investor
    let transfer_ctx = CpiContext::new_with_signer(
        ctx.accounts.token_program.to_account_info(),
        Transfer {
            from: ctx.accounts.vault_usdc_ata.to_account_info(),
            to: ctx.accounts.investor_usdc_ata.to_account_info(),
            authority: ctx.accounts.vault_authority.to_account_info(),
        },
        signer_seeds,
    );
    token::transfer(transfer_ctx, usdc_amount)?;

    // Update fund state
    fund.total_shares = fund.total_shares.checked_sub(shares)
        .ok_or(FundError::MathUnderflow)?;

    msg!("Redeemed {} shares for {} USDC", shares, usdc_amount);
    msg!("Total shares remaining: {}", fund.total_shares);

    Ok(())
}
