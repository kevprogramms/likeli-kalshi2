use anchor_lang::prelude::*;

use crate::state::{ProtocolConfig, PROTOCOL_CONFIG_SEED};
use crate::errors::FundError;

#[derive(Accounts)]
pub struct InitializeProtocol<'info> {
    #[account(mut)]
    pub admin: Signer<'info>,

    #[account(
        init,
        payer = admin,
        space = ProtocolConfig::LEN,
        seeds = [PROTOCOL_CONFIG_SEED],
        bump
    )]
    pub protocol_config: Account<'info, ProtocolConfig>,

    /// USDC mint
    pub usdc_mint: Account<'info, anchor_spl::token::Mint>,

    pub system_program: Program<'info, System>,
}

pub fn handler(
    ctx: Context<InitializeProtocol>,
    allowed_dflow_program: Pubkey,
) -> Result<()> {
    let config = &mut ctx.accounts.protocol_config;
    
    config.admin = ctx.accounts.admin.key();
    config.max_deposit_fee_bps = 300;  // 3%
    config.max_perf_fee_bps = 3000;    // 30%
    config.allowed_dflow_program = allowed_dflow_program;
    config.usdc_mint = ctx.accounts.usdc_mint.key();
    config.protocol_fee_recipient = ctx.accounts.admin.key(); // Default to admin
    config.bump = ctx.bumps.protocol_config;

    msg!("Protocol config initialized");
    msg!("Admin: {}", config.admin);
    msg!("Allowed DFlow program: {}", config.allowed_dflow_program);
    msg!("USDC mint: {}", config.usdc_mint);

    Ok(())
}
