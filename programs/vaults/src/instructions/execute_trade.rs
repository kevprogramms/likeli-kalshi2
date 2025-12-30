use anchor_lang::prelude::*;
use anchor_spl::token::TokenAccount;

use crate::state::{FundState, FundStage, ProtocolConfig, FUND_SEED, VAULT_AUTHORITY_SEED, PROTOCOL_CONFIG_SEED};
use crate::errors::FundError;

/// Execute trade instruction
/// 
/// This instruction validates and executes DFlow swap transactions.
/// In MVP, we validate the manager and stage, then accept mock trade data.
/// 
/// In production, this would:
/// 1. Validate the DFlow instruction bundle
/// 2. Verify all token accounts belong to vault authority
/// 3. Execute via invoke_signed
#[derive(Accounts)]
pub struct ExecuteTrade<'info> {
    #[account(
        constraint = manager.key() == fund_state.manager @ FundError::UnauthorizedManager
    )]
    pub manager: Signer<'info>,

    #[account(
        seeds = [PROTOCOL_CONFIG_SEED],
        bump = protocol_config.bump
    )]
    pub protocol_config: Account<'info, ProtocolConfig>,

    #[account(
        mut,
        seeds = [FUND_SEED, &fund_state.fund_id.to_le_bytes()],
        bump = fund_state.bump,
        constraint = fund_state.stage == FundStage::Trading @ FundError::TradingNotAllowed
    )]
    pub fund_state: Account<'info, FundState>,

    /// CHECK: PDA for vault authority
    #[account(
        seeds = [VAULT_AUTHORITY_SEED, fund_state.key().as_ref()],
        bump = fund_state.vault_authority_bump
    )]
    pub vault_authority: UncheckedAccount<'info>,

    /// Vault's USDC token account
    #[account(
        mut,
        constraint = vault_usdc_ata.key() == fund_state.vault_usdc_ata
    )]
    pub vault_usdc_ata: Account<'info, TokenAccount>,

    // NOTE: In production, additional accounts would be passed for:
    // - DFlow program
    // - Outcome token mints
    // - Outcome token ATAs
    // - Any other required accounts from DFlow instruction bundle
}

/// Trade parameters - for MVP, we log and validate but don't execute real trades
#[derive(AnchorSerialize, AnchorDeserialize, Clone, Debug)]
pub struct TradeParams {
    /// Market identifier
    pub market_id: String,
    /// YES or NO
    pub side: String,
    /// BUY or SELL
    pub direction: String,
    /// Amount in USDC (scaled)
    pub amount: u64,
    /// Slippage tolerance in basis points
    pub slippage_bps: u16,
}

pub fn handler(ctx: Context<ExecuteTrade>, params: TradeParams) -> Result<()> {
    let fund = &ctx.accounts.fund_state;
    let _protocol_config = &ctx.accounts.protocol_config;

    // Validate amount
    require!(params.amount > 0, FundError::ZeroDeposit);

    // In MVP mode with mock data, we just log the trade intent
    // In production, we would:
    // 1. Deserialize the DFlow instruction bundle
    // 2. Validate each instruction's program_id against allowed_dflow_program
    // 3. Validate each token account is owned by vault_authority
    // 4. Execute each instruction via invoke_signed

    msg!("=== TRADE EXECUTION (MVP MODE) ===");
    msg!("Fund: {}", fund.fund_id);
    msg!("Market: {}", params.market_id);
    msg!("Side: {}", params.side);
    msg!("Direction: {}", params.direction);
    msg!("Amount: {}", params.amount);
    msg!("Slippage: {} bps", params.slippage_bps);
    msg!("NOTE: Real DFlow execution pending API integration");

    // In production, this is where we would call:
    // validate_and_execute_dflow_bundle(ctx, dflow_instructions)?;

    Ok(())
}

// Production implementation would include:
// 
// fn validate_and_execute_dflow_bundle<'info>(
//     ctx: Context<ExecuteTrade>,
//     instructions: Vec<DFlowInstruction>,
// ) -> Result<()> {
//     let protocol_config = &ctx.accounts.protocol_config;
//     let fund = &ctx.accounts.fund_state;
//     let vault_authority = &ctx.accounts.vault_authority;
//     
//     for ix in instructions {
//         // Validate program ID is whitelisted
//         require!(
//             ix.program_id == protocol_config.allowed_dflow_program,
//             FundError::InvalidDFlowProgram
//         );
//         
//         // Validate all SPL token accounts are vault-owned
//         for account in &ix.accounts {
//             if is_token_account(account) {
//                 require!(
//                     account.owner == vault_authority.key(),
//                     FundError::InvalidTokenAccountOwner
//                 );
//             }
//         }
//         
//         // Execute via CPI
//         let seeds = &[
//             VAULT_AUTHORITY_SEED,
//             fund.key().as_ref(),
//             &[fund.vault_authority_bump],
//         ];
//         invoke_signed(&ix.to_instruction(), accounts, &[seeds])?;
//     }
//     
//     Ok(())
// }
