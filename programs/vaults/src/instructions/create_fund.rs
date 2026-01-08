use anchor_lang::prelude::*;
use anchor_spl::token::{Mint, Token, TokenAccount};
use anchor_spl::associated_token::AssociatedToken;

use crate::state::{
    FundState, FundStage, ProtocolConfig,
    PROTOCOL_CONFIG_SEED, FUND_SEED, VAULT_AUTHORITY_SEED, SHARE_MINT_SEED,
};
use crate::errors::FundError;

#[derive(Accounts)]
#[instruction(fund_id: u64)]
pub struct CreateFund<'info> {
    #[account(mut)]
    pub manager: Signer<'info>,

    #[account(
        seeds = [PROTOCOL_CONFIG_SEED],
        bump = protocol_config.bump
    )]
    pub protocol_config: Account<'info, ProtocolConfig>,

    #[account(
        init,
        payer = manager,
        space = FundState::LEN,
        seeds = [FUND_SEED, &fund_id.to_le_bytes()],
        bump
    )]
    pub fund_state: Box<Account<'info, FundState>>,

    /// USDC mint
    #[account(
        constraint = usdc_mint.key() == protocol_config.usdc_mint @ FundError::InvalidUsdcMint
    )]
    pub usdc_mint: Account<'info, Mint>,

    pub token_program: Program<'info, Token>,
    pub associated_token_program: Program<'info, AssociatedToken>,
    pub system_program: Program<'info, System>,
}

pub fn handler(
    ctx: Context<CreateFund>,
    fund_id: u64,
    name: String,
    symbol: String,
    deposit_fee_bps: u16,
    perf_fee_bps: u16,
    trading_start_ts: i64,
    trading_end_ts: i64,
) -> Result<()> {
    let protocol_config = &ctx.accounts.protocol_config;
    let clock = Clock::get()?;
    
    // Validate name and symbol lengths
    require!(!name.is_empty(), FundError::NameEmpty);
    require!(name.len() <= 32, FundError::NameTooLong);
    require!(!symbol.is_empty(), FundError::SymbolEmpty);
    require!(symbol.len() <= 8, FundError::SymbolTooLong);
    
    // Validate fee caps
    require!(
        deposit_fee_bps <= protocol_config.max_deposit_fee_bps,
        FundError::DepositFeeExceedsMax
    );
    require!(
        perf_fee_bps <= protocol_config.max_perf_fee_bps,
        FundError::PerfFeeExceedsMax
    );
    
    // Validate trading period
    require!(
        trading_start_ts > clock.unix_timestamp,
        FundError::TradingStartInPast
    );
    require!(
        trading_end_ts > trading_start_ts,
        FundError::InvalidTradingPeriod
    );

    // Initialize fund state
    let fund = &mut ctx.accounts.fund_state;
    
    fund.fund_id = fund_id;
    fund.manager = ctx.accounts.manager.key();
    
    // Copy name bytes
    let mut name_bytes = [0u8; 32];
    let name_slice = name.as_bytes();
    name_bytes[..name_slice.len()].copy_from_slice(name_slice);
    fund.name = name_bytes;
    
    // Copy symbol bytes
    let mut symbol_bytes = [0u8; 8];
    let symbol_slice = symbol.as_bytes();
    symbol_bytes[..symbol_slice.len()].copy_from_slice(symbol_slice);
    fund.symbol = symbol_bytes;
    
    fund.deposit_fee_bps = deposit_fee_bps;
    fund.perf_fee_bps = perf_fee_bps;
    fund.early_exit_fee_bps = 500;  // 5% default
    fund.liquidity_buffer_bps = 1000;  // 10% default
    fund.trading_start_ts = trading_start_ts;
    fund.trading_end_ts = trading_end_ts;
    fund.stage = FundStage::Open;
    
    // Withdrawal queue initialization
    fund.pending_withdrawal_shares = 0;
    fund.last_epoch_ts = 0;
    fund.epoch_interval_secs = 86400; // 24 hours default
    fund.pending_request_count = 0;
    
    fund.initial_aum_usdc = 0;
    fund.perf_fee_due_usdc = 0;
    fund.perf_fee_paid = false;
    fund.total_deposited = 0;
    
    // Store pubkeys that will be derived later
    fund.usdc_mint = ctx.accounts.usdc_mint.key();
    fund.total_shares = 0;
    fund.bump = ctx.bumps.fund_state;
    
    // These will be set when InitializeVaultAccounts is called
    fund.share_mint = Pubkey::default();
    fund.vault_authority = Pubkey::default();
    fund.vault_usdc_ata = Pubkey::default();
    fund.manager_fee_ata = Pubkey::default();
    fund.vault_authority_bump = 0;
    fund.share_mint_bump = 0;

    msg!("Fund created: {}", fund_id);
    msg!("Manager: {}", fund.manager);
    msg!("Deposit fee: {} bps", deposit_fee_bps);
    msg!("Performance fee: {} bps", perf_fee_bps);
    msg!("Trading window: {} to {}", trading_start_ts, trading_end_ts);

    Ok(())
}

/// Second step: Initialize share mint only (first part of vault setup)
/// Separated to reduce stack usage
#[derive(Accounts)]
pub struct InitializeShareMint<'info> {
    #[account(mut)]
    pub manager: Signer<'info>,

    #[account(
        mut,
        seeds = [FUND_SEED, &fund_state.fund_id.to_le_bytes()],
        bump = fund_state.bump,
        constraint = fund_state.manager == manager.key() @ FundError::UnauthorizedManager,
        constraint = fund_state.stage == FundStage::Open @ FundError::InvalidStage,
        constraint = fund_state.share_mint == Pubkey::default() @ FundError::InvalidStage
    )]
    pub fund_state: Box<Account<'info, FundState>>,

    /// CHECK: PDA for vault authority
    #[account(
        seeds = [VAULT_AUTHORITY_SEED, fund_state.key().as_ref()],
        bump
    )]
    pub vault_authority: UncheckedAccount<'info>,

    #[account(
        init,
        payer = manager,
        mint::decimals = 6,
        mint::authority = vault_authority,
        seeds = [SHARE_MINT_SEED, fund_state.key().as_ref()],
        bump
    )]
    pub share_mint: Account<'info, Mint>,

    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>,
}

pub fn handler_init_share_mint(ctx: Context<InitializeShareMint>) -> Result<()> {
    let fund = &mut ctx.accounts.fund_state;
    
    fund.share_mint = ctx.accounts.share_mint.key();
    fund.vault_authority = ctx.accounts.vault_authority.key();
    fund.vault_authority_bump = ctx.bumps.vault_authority;
    fund.share_mint_bump = ctx.bumps.share_mint;

    msg!("Share mint initialized: {}", fund.share_mint);
    msg!("Vault authority: {}", fund.vault_authority);

    Ok(())
}

/// Third step: Initialize vault token accounts (second part of vault setup)
#[derive(Accounts)]
pub struct InitializeVaultAccounts<'info> {
    #[account(mut)]
    pub manager: Signer<'info>,

    #[account(
        mut,
        seeds = [FUND_SEED, &fund_state.fund_id.to_le_bytes()],
        bump = fund_state.bump,
        constraint = fund_state.manager == manager.key() @ FundError::UnauthorizedManager,
        constraint = fund_state.stage == FundStage::Open @ FundError::InvalidStage,
        constraint = fund_state.share_mint != Pubkey::default() @ FundError::InvalidStage,
        constraint = fund_state.vault_usdc_ata == Pubkey::default() @ FundError::InvalidStage
    )]
    pub fund_state: Box<Account<'info, FundState>>,

    /// CHECK: PDA for vault authority (already initialized)
    #[account(
        seeds = [VAULT_AUTHORITY_SEED, fund_state.key().as_ref()],
        bump = fund_state.vault_authority_bump
    )]
    pub vault_authority: UncheckedAccount<'info>,

    #[account(
        constraint = usdc_mint.key() == fund_state.usdc_mint @ FundError::InvalidUsdcMint
    )]
    pub usdc_mint: Account<'info, Mint>,

    /// Vault's USDC token account (owned by vault_authority)
    #[account(
        init,
        payer = manager,
        associated_token::mint = usdc_mint,
        associated_token::authority = vault_authority,
    )]
    pub vault_usdc_ata: Account<'info, TokenAccount>,

    /// Manager's fee receiving USDC account
    #[account(
        init_if_needed,
        payer = manager,
        associated_token::mint = usdc_mint,
        associated_token::authority = manager,
    )]
    pub manager_fee_ata: Account<'info, TokenAccount>,

    pub token_program: Program<'info, Token>,
    pub associated_token_program: Program<'info, AssociatedToken>,
    pub system_program: Program<'info, System>,
}

pub fn handler_init_vault_accounts(ctx: Context<InitializeVaultAccounts>) -> Result<()> {
    let fund = &mut ctx.accounts.fund_state;
    
    fund.vault_usdc_ata = ctx.accounts.vault_usdc_ata.key();
    fund.manager_fee_ata = ctx.accounts.manager_fee_ata.key();

    msg!("Vault accounts initialized");
    msg!("Vault USDC ATA: {}", fund.vault_usdc_ata);
    msg!("Manager fee ATA: {}", fund.manager_fee_ata);

    Ok(())
}
