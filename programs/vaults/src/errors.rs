use anchor_lang::prelude::*;

#[error_code]
pub enum FundError {
    // === Stage Errors ===
    #[msg("Invalid stage for this operation")]
    InvalidStage,
    
    #[msg("Deposits only allowed during Open stage")]
    DepositsNotAllowed,
    
    #[msg("Withdrawals only allowed during Open or Closed stage")]
    WithdrawalsNotAllowed,
    
    #[msg("Trading only allowed during Trading stage")]
    TradingNotAllowed,
    
    // === Fee Errors ===
    #[msg("Deposit fee exceeds maximum (3%)")]
    DepositFeeExceedsMax,
    
    #[msg("Performance fee exceeds maximum (30%)")]
    PerfFeeExceedsMax,
    
    // === Timing Errors ===
    #[msg("Trading period has not started yet")]
    TradingNotStarted,
    
    #[msg("Trading period has not ended yet")]
    TradingNotEnded,
    
    #[msg("Trading end time must be after start time")]
    InvalidTradingPeriod,
    
    #[msg("Trading start time must be in the future")]
    TradingStartInPast,
    
    // === Authorization Errors ===
    #[msg("Only the fund manager can perform this action")]
    UnauthorizedManager,
    
    #[msg("Only the protocol admin can perform this action")]
    UnauthorizedAdmin,
    
    // === Position Errors ===
    #[msg("Vault must hold only USDC to finalize (close all positions first)")]
    PositionsNotClosed,
    
    // === DFlow Errors ===
    #[msg("Invalid DFlow program - not whitelisted")]
    InvalidDFlowProgram,
    
    #[msg("Token account owner must be vault authority")]
    InvalidTokenAccountOwner,
    
    #[msg("Invalid instruction in trade bundle")]
    InvalidTradeInstruction,
    
    // === Amount Errors ===
    #[msg("Deposit amount must be greater than zero")]
    ZeroDeposit,
    
    #[msg("Withdrawal amount must be greater than zero")]
    ZeroWithdrawal,
    
    #[msg("Insufficient shares for withdrawal")]
    InsufficientShares,
    
    #[msg("Insufficient vault balance")]
    InsufficientVaultBalance,
    
    // === Math Errors ===
    #[msg("Math operation overflow")]
    MathOverflow,
    
    #[msg("Math operation underflow")]
    MathUnderflow,
    
    // === Token Errors ===
    #[msg("Invalid USDC mint")]
    InvalidUsdcMint,
    
    #[msg("Invalid share mint")]
    InvalidShareMint,
    
    // === Name/Symbol Errors ===
    #[msg("Fund name too long (max 32 bytes)")]
    NameTooLong,
    
    #[msg("Fund symbol too long (max 8 bytes)")]
    SymbolTooLong,
    
    #[msg("Fund name cannot be empty")]
    NameEmpty,
    
    #[msg("Fund symbol cannot be empty")]
    SymbolEmpty,
    
    // === Buffer Errors ===
    #[msg("Insufficient liquidity buffer for instant withdrawal")]
    InsufficientBuffer,
    
    #[msg("Trade would violate liquidity buffer requirement")]
    BufferViolation,
    
    #[msg("Early exit fee exceeds maximum (5%)")]
    EarlyExitFeeExceedsMax,
    
    // === Withdrawal Queue Errors ===
    #[msg("Withdrawal request not found")]
    WithdrawalRequestNotFound,
    
    #[msg("Withdrawal request already completed or cancelled")]
    WithdrawalRequestInactive,
    
    #[msg("Cannot cancel a partially filled withdrawal")]
    CannotCancelPartialWithdrawal,
    
    #[msg("Epoch not yet ready for processing")]
    EpochNotReady,
    
    #[msg("No pending withdrawals to process")]
    NoPendingWithdrawals,
}
