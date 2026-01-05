// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/token/ERC20/extensions/ERC4626.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC1155/IERC1155.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "./PolymarketAdapter.sol";

interface IConditionalTokens {
    function balanceOf(address owner, uint256 id) external view returns (uint256);
}

/**
 * @title LikeliVault
 * @notice ERC4626-compliant Vault for Polymarket trading
 * @dev Allows users to deposit USDC and receive shares.
 *      Manager can use deposited funds to trade on Polymarket via the Adapter.
 */
contract LikeliVault is ERC4626, Ownable, ReentrancyGuard {
    using SafeERC20 for IERC20;

    // The Polymarket Adapter used for execution
    PolymarketAdapter public adapter;
    
    // Conditional Tokens contract for position valuation
    IConditionalTokens public conditionalTokens;

    // Track open positions for NAV calculation
    struct Position {
        uint256 tokenId;
        uint256 shares;
        uint256 costBasis; // in USDC
    }
    Position[] public positions;
    mapping(uint256 => uint256) public positionIndex; // tokenId => index

    // Events
    event AdapterUpdated(address indexed newAdapter);
    event TradeExecuted(bytes32 indexed conditionId, uint256 amount, bool isBuy);
    event PositionOpened(uint256 indexed tokenId, uint256 shares, uint256 cost);
    event PositionClosed(uint256 indexed tokenId, uint256 shares, uint256 proceeds);

    constructor(
        IERC20 _asset, 
        string memory _name, 
        string memory _symbol,
        address _adapter,
        address _conditionalTokens
    ) ERC4626(_asset) ERC20(_name, _symbol) Ownable(msg.sender) {
        adapter = PolymarketAdapter(_adapter);
        conditionalTokens = IConditionalTokens(_conditionalTokens);
        
        // Approve adapter to spend Vault's USDC (for trading)
        _asset.approve(_adapter, type(uint256).max);
    }

    /**
     * @notice Updates the trading adapter
     * @param _newAdapter Address of the new PolymarketAdapter
     */
    function setAdapter(address _newAdapter) external onlyOwner {
        require(_newAdapter != address(0), "Invalid adapter");
        
        // Revoke old approval
        SafeERC20.forceApprove(IERC20(asset()), address(adapter), 0);
        
        adapter = PolymarketAdapter(_newAdapter);
        emit AdapterUpdated(_newAdapter);
        
        // Approve new adapter
        SafeERC20.forceApprove(IERC20(asset()), address(adapter), type(uint256).max);
    }

    /**
     * @notice Execute a trade on Polymarket
     * @dev Only the owner (manager) can call this
     * @param params Trade parameters struct defined in Adapter
     */
    function executeTrade(PolymarketAdapter.TradeParams calldata params) external onlyOwner nonReentrant {
        // Delegate execution to the adapter
        adapter.executeTrade(params);
        
        // Track position (simplified - real impl would track cost basis properly)
        if (params.isBuy) {
            _trackBuy(params.tokenId, params.amount);
        } else {
            _trackSell(params.tokenId, params.amount);
        }
        
        emit TradeExecuted(params.conditionId, params.amount, params.isBuy);
    }

    function _trackBuy(uint256 tokenId, uint256 cost) internal {
        uint256 idx = positionIndex[tokenId];
        if (idx == 0 && (positions.length == 0 || positions[0].tokenId != tokenId)) {
            // New position
            positions.push(Position({
                tokenId: tokenId,
                shares: conditionalTokens.balanceOf(address(this), tokenId),
                costBasis: cost
            }));
            positionIndex[tokenId] = positions.length - 1;
        } else {
            // Add to existing
            positions[idx].shares = conditionalTokens.balanceOf(address(this), tokenId);
            positions[idx].costBasis += cost;
        }
    }

    function _trackSell(uint256 tokenId, uint256 proceeds) internal {
        uint256 idx = positionIndex[tokenId];
        if (idx < positions.length && positions[idx].tokenId == tokenId) {
            positions[idx].shares = conditionalTokens.balanceOf(address(this), tokenId);
            if (positions[idx].shares == 0) {
                positions[idx].costBasis = 0;
            }
        }
    }

    /**
     * @notice Total Assets calculation including open positions
     * @dev Includes idle USDC + estimated value of conditional tokens
     */
    function totalAssets() public view override returns (uint256) {
        uint256 idleUsdc = IERC20(asset()).balanceOf(address(this));
        uint256 positionValue = 0;

        // Calculate value of open positions
        // Note: In production, this would use an oracle or mark-to-market pricing
        // For now, we use cost basis as a conservative estimate
        for (uint256 i = 0; i < positions.length; i++) {
            if (positions[i].shares > 0) {
                // Conservative: use cost basis (could use oracle for market value)
                positionValue += positions[i].costBasis;
            }
        }

        return idleUsdc + positionValue;
    }

    /**
     * @notice Get all open positions
     */
    function getPositions() external view returns (Position[] memory) {
        return positions;
    }

    /**
     * @notice Get position count
     */
    function positionCount() external view returns (uint256) {
        return positions.length;
    }
}
