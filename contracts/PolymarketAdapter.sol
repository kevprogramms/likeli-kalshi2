// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/token/ERC1155/IERC1155.sol";
import "@openzeppelin/contracts/token/ERC1155/utils/ERC1155Holder.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

interface ICTFExchange {
    struct Order {
        uint256 salt;
        address maker;
        address signer;
        address taker;
        uint256 tokenId;
        uint256 makerAmount;
        uint256 takerAmount;
        uint256 expiration;
        uint256 nonce;
        uint256 feeRateBps;
        uint8 side; // 0 = BUY, 1 = SELL
        uint8 signatureType;
    }

    function fillOrder(
        Order calldata order,
        bytes calldata signature,
        uint256 fillAmount
    ) external;

    function matchOrders(
        Order calldata takerOrder,
        Order[] calldata makerOrders,
        uint256 takerFillAmount,
        uint256[] calldata makerFillAmounts,
        bytes calldata takerSignature,
        bytes[] calldata makerSignatures
    ) external;
}

interface IConditionalTokens {
    function safeTransferFrom(address from, address to, uint256 id, uint256 value, bytes calldata data) external;
    function balanceOf(address owner, uint256 id) external view returns (uint256);
}

/**
 * @title PolymarketAdapter
 * @notice Handles interaction with Polymarket's CTF Exchange
 * @dev Implements ERC1155Holder to receive conditional tokens
 */
contract PolymarketAdapter is Ownable, ERC1155Holder, ReentrancyGuard {
    using SafeERC20 for IERC20;

    IERC20 public immutable usdc;
    ICTFExchange public immutable ctfExchange;
    IConditionalTokens public immutable conditionalTokens;

    // Mapping of authorized vaults
    mapping(address => bool) public authorizedVaults;

    struct TradeParams {
        bytes32 conditionId;    // The market condition ID
        uint256 tokenId;        // The specific outcome token ID
        uint256 amount;         // Amount of USDC to spend (buy) or Tokens to sell
        bool isBuy;             // True for Buy, False for Sell
        bytes orderData;        // Encoded order + signature for CTF Exchange
    }

    event VaultAuthorized(address indexed vault, bool authorized);
    event TradeExecuted(address indexed vault, uint256 tokenId, uint256 amount, bool isBuy);
    event TokensReceived(address indexed from, uint256 tokenId, uint256 amount);

    constructor(
        address _usdc,
        address _ctfExchange,
        address _conditionalTokens
    ) Ownable(msg.sender) {
        usdc = IERC20(_usdc);
        ctfExchange = ICTFExchange(_ctfExchange);
        conditionalTokens = IConditionalTokens(_conditionalTokens);
    }

    modifier onlyAuthorizedVault() {
        require(authorizedVaults[msg.sender], "Not authorized vault");
        _;
    }

    function setVaultAuthorization(address vault, bool authorized) external onlyOwner {
        authorizedVaults[vault] = authorized;
        emit VaultAuthorized(vault, authorized);
    }

    /**
     * @notice Executes a trade on behalf of the calling Vault
     * @dev The Vault must be authorized and have approved this Adapter
     */
    function executeTrade(TradeParams calldata params) external onlyAuthorizedVault nonReentrant {
        if (params.isBuy) {
            _executeBuy(params);
        } else {
            _executeSell(params);
        }
        emit TradeExecuted(msg.sender, params.tokenId, params.amount, params.isBuy);
    }

    function _executeBuy(TradeParams calldata params) internal {
        // 1. Pull USDC from Vault
        usdc.safeTransferFrom(msg.sender, address(this), params.amount);

        // 2. Approve CTF Exchange to spend USDC
        usdc.forceApprove(address(ctfExchange), params.amount);

        // 3. Decode and execute order (simplified - real impl decodes orderData)
        // In production: decode params.orderData into Order struct and signature
        // ICTFExchange.Order memory order = abi.decode(params.orderData, (ICTFExchange.Order));
        // ctfExchange.fillOrder(order, signature, params.amount);

        // 4. Transfer resulting tokens back to vault
        uint256 tokenBalance = conditionalTokens.balanceOf(address(this), params.tokenId);
        if (tokenBalance > 0) {
            conditionalTokens.safeTransferFrom(
                address(this),
                msg.sender,
                params.tokenId,
                tokenBalance,
                ""
            );
        }
    }

    function _executeSell(TradeParams calldata params) internal {
        // 1. Pull tokens from Vault (vault must approve this adapter for ERC1155)
        conditionalTokens.safeTransferFrom(
            msg.sender,
            address(this),
            params.tokenId,
            params.amount,
            ""
        );

        // 2. Approve CTF Exchange (ERC1155 doesn't need amount approval, just setApprovalForAll)
        // Vault should have set this up during initialization

        // 3. Execute sell order
        // In production: decode params.orderData and call ctfExchange.fillOrder

        // 4. Transfer USDC back to vault
        uint256 usdcBalance = usdc.balanceOf(address(this));
        if (usdcBalance > 0) {
            usdc.safeTransfer(msg.sender, usdcBalance);
        }
    }

    /**
     * @notice Get token balance held by this adapter
     */
    function getTokenBalance(uint256 tokenId) external view returns (uint256) {
        return conditionalTokens.balanceOf(address(this), tokenId);
    }

    /**
     * @notice Emergency withdraw stuck tokens
     */
    function emergencyWithdraw(address token, uint256 amount) external onlyOwner {
        IERC20(token).safeTransfer(owner(), amount);
    }

    function emergencyWithdrawERC1155(uint256 tokenId, uint256 amount) external onlyOwner {
        conditionalTokens.safeTransferFrom(address(this), owner(), tokenId, amount, "");
    }
}
