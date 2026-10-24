// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {Ownable2Step} from "@openzeppelin/contracts/access/Ownable2Step.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

contract PaymentRouter is Ownable2Step, ReentrancyGuard {
    using SafeERC20 for IERC20;

    error ZeroAddress();
    error ZeroAmount();

    IERC20 public immutable usdc;

    /// @notice Emitted when a USDC invoice payment is sent.
    /// @param sender The payer that initiated the transfer.
    /// @param recipient The destination account receiving USDC.
    /// @param amount The USDC amount transferred.
    /// @param memo Optional invoice memo attached to the payment.
    /// @param timestamp The block timestamp when the payment was executed.
    event PaymentSent(
        address indexed sender,
        address indexed recipient,
        uint256 amount,
        string memo,
        uint256 timestamp
    );

    constructor(address usdcAddress) Ownable(msg.sender) {
        if (usdcAddress == address(0)) revert ZeroAddress();
        usdc = IERC20(usdcAddress);
    }

    /// @notice Pays an invoice by transferring USDC from the caller to a recipient.
    /// @param recipient The account that should receive the USDC payment.
    /// @param amount The amount of USDC to transfer.
    /// @param memo Optional invoice memo for off-chain indexing.
    function payInvoice(address recipient, uint256 amount, string memory memo) external nonReentrant {
        if (recipient == address(0)) revert ZeroAddress();
        if (amount == 0) revert ZeroAmount();

        usdc.safeTransferFrom(msg.sender, recipient, amount);

        emit PaymentSent(msg.sender, recipient, amount, memo, block.timestamp);
    }

    /// @notice Recovers ERC-20 tokens held by this contract to the current owner.
    /// @param tokenAddress The ERC-20 token contract address to recover.
    /// @param amount The token amount to transfer to the owner.
    function recoverTokens(address tokenAddress, uint256 amount) external onlyOwner {
        if (tokenAddress == address(0)) revert ZeroAddress();
        if (amount == 0) revert ZeroAmount();

        IERC20(tokenAddress).safeTransfer(owner(), amount);
    }

    /// @notice Returns the current USDC balance held by this contract.
    /// @return The USDC token balance of this contract.
    function getContractUSDCBalance() external view returns (uint256) {
        return usdc.balanceOf(address(this));
    }
}
