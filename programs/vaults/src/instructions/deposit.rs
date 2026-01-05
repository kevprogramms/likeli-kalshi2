use anchor_lang::prelude::*;
use anchor_spl::token::{self, Mint, Token, TokenAccount, MintTo, Transfer};

use crate::state::{FundState, FundStage, FUND_SEED, VAULT_AUTHORITY_SEED, SHARE_MINT_SEED};
use crate::errors::FundError;

#[derive(Accounts)]
pub struct Deposit<'info> {
    #[account(mut)]
    pub investor: Signer<'info>,

    #[account(
        mut,
        seeds = [FUND_SEED, &fund_state.fund_id.to_le_bytes()],
        bump = fund_state.bump,
        constraint = fund_state.stage == FundStage::Open @ FundError::DepositsNotAllowed
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

pub fn handler(ctx: Context<Deposit>, amount: u64) -> Result<()> {
    require!(amount > 0, FundError::ZeroDeposit);

    let fund = &mut ctx.accounts.fund_state;
    
    // Calculate deposit fee
    let deposit_fee = fund.calculate_deposit_fee(amount);
    let net_amount = amount.checked_sub(deposit_fee)
        .ok_or(FundError::MathUnderflow)?;

    // Get current vault balance for share calculation
    let vault_balance = ctx.accounts.vault_usdc_ata.amount;
    
    // Calculate shares to mint
    let shares_to_mint = fund.shares_for_deposit(net_amount, vault_balance);

    // 1. Transfer deposit fee to manager (if fee > 0)
    if deposit_fee > 0 {
        let transfer_fee_ctx = CpiContext::new(
            ctx.accounts.token_program.to_account_info(),
            Transfer {
                from: ctx.accounts.investor_usdc_ata.to_account_info(),
                to: ctx.accounts.manager_fee_ata.to_account_info(),
                authority: ctx.accounts.investor.to_account_info(),
            },
        );
        token::transfer(transfer_fee_ctx, deposit_fee)?;
    }

    // 2. Transfer net amount to vault
    let transfer_vault_ctx = CpiContext::new(
        ctx.accounts.token_program.to_account_info(),
        Transfer {
            from: ctx.accounts.investor_usdc_ata.to_account_info(),
            to: ctx.accounts.vault_usdc_ata.to_account_info(),
            authority: ctx.accounts.investor.to_account_info(),
        },
    );
    token::transfer(transfer_vault_ctx, net_amount)?;

    // 3. Mint shares to investor
    let fund_key = fund.key();
    let seeds = &[
        VAULT_AUTHORITY_SEED,
        fund_key.as_ref(),
        &[fund.vault_authority_bump],
    ];
    let signer_seeds = &[&seeds[..]];

    let mint_ctx = CpiContext::new_with_signer(
        ctx.accounts.token_program.to_account_info(),
        MintTo {
            mint: ctx.accounts.share_mint.to_account_info(),
            to: ctx.accounts.investor_share_ata.to_account_info(),
            authority: ctx.accounts.vault_authority.to_account_info(),
        },
        signer_seeds,
    );
    token::mint_to(mint_ctx, shares_to_mint)?;

    // Update fund state
    fund.total_shares = fund.total_shares.checked_add(shares_to_mint)
        .ok_or(FundError::MathOverflow)?;
    fund.total_deposited = fund.total_deposited.checked_add(amount)
        .ok_or(FundError::MathOverflow)?;

    msg!("Deposit: {} USDC (fee: {}, net: {})", amount, deposit_fee, net_amount);
    msg!("Shares minted: {}", shares_to_mint);
    msg!("Total shares: {}", fund.total_shares);

    Ok(())
}
