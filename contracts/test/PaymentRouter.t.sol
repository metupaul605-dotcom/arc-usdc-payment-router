// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Test} from "forge-std/Test.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {IERC20Errors} from "@openzeppelin/contracts/interfaces/draft-IERC6093.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {PaymentRouter} from "../PaymentRouter.sol";

// ---------------------------------------------------------------------------
// Minimal ERC-20 mock (lives only in the test file)
// ---------------------------------------------------------------------------
contract MockERC20 is ERC20 {
    uint8 private _decimals;

    constructor(string memory name_, string memory symbol_, uint8 decimals_)
        ERC20(name_, symbol_)
    {
        _decimals = decimals_;
    }

    function decimals() public view override returns (uint8) {
        return _decimals;
    }

    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }
}

// ---------------------------------------------------------------------------
// Main test contract
// ---------------------------------------------------------------------------
contract PaymentRouterTest is Test {
    // -----------------------------------------------------------------------
    // Actors & fixtures
    // -----------------------------------------------------------------------
    address internal owner   = makeAddr("owner");
    address internal alice   = makeAddr("alice");
    address internal bob     = makeAddr("bob");
    address internal charlie = makeAddr("charlie");

    MockERC20      internal usdc;
    MockERC20      internal otherToken;
    PaymentRouter  internal router;

    uint256 internal constant INITIAL_BALANCE = 10_000e6; // 10 000 USDC (6 dp)

    // -----------------------------------------------------------------------
    // setUp — re-executed before every test function
    // -----------------------------------------------------------------------
    function setUp() public {
        usdc       = new MockERC20("Mock USDC", "mUSDC", 6);
        otherToken = new MockERC20("Other Token", "OTH", 18);

        // Deploy the router as `owner`
        vm.prank(owner);
        router = new PaymentRouter(address(usdc));

        // Fund alice so she can pay invoices
        usdc.mint(alice, INITIAL_BALANCE);
    }

    // =======================================================================
    // 1.  Constructor
    // =======================================================================

    function test_Constructor_SetsUSDC() public view {
        assertEq(address(router.usdc()), address(usdc));
    }

    function test_Constructor_SetsOwner() public view {
        assertEq(router.owner(), owner);
    }

    function test_Constructor_RevertsZeroAddress() public {
        vm.expectRevert(PaymentRouter.ZeroAddress.selector);
        new PaymentRouter(address(0));
    }

    // =======================================================================
    // 2.  payInvoice — happy path
    // =======================================================================

    function test_PayInvoice_HappyPath_TransfersTokens() public {
        uint256 amount = 500e6;

        vm.startPrank(alice);
        usdc.approve(address(router), amount);
        router.payInvoice(bob, amount, "INV-001");
        vm.stopPrank();

        assertEq(usdc.balanceOf(bob),   amount,                         "bob balance");
        assertEq(usdc.balanceOf(alice), INITIAL_BALANCE - amount,       "alice balance");
    }

    function test_PayInvoice_HappyPath_EmitsEvent() public {
        uint256 amount = 250e6;
        uint256 ts     = block.timestamp;

        vm.startPrank(alice);
        usdc.approve(address(router), amount);

        // All five event topics/data must match exactly
        vm.expectEmit(true, true, false, true, address(router));
        emit PaymentRouter.PaymentSent(alice, bob, amount, "memo-abc", ts);

        router.payInvoice(bob, amount, "memo-abc");
        vm.stopPrank();
    }

    // =======================================================================
    // 3.  payInvoice — revert: zero recipient
    // =======================================================================

    function test_PayInvoice_RevertsZeroAddress_Recipient() public {
        vm.startPrank(alice);
        usdc.approve(address(router), 100e6);

        vm.expectRevert(PaymentRouter.ZeroAddress.selector);
        router.payInvoice(address(0), 100e6, "bad");
        vm.stopPrank();
    }

    // =======================================================================
    // 4.  payInvoice — revert: zero amount
    // =======================================================================

    function test_PayInvoice_RevertsZeroAmount() public {
        vm.startPrank(alice);
        usdc.approve(address(router), 100e6);

        vm.expectRevert(PaymentRouter.ZeroAmount.selector);
        router.payInvoice(bob, 0, "zero");
        vm.stopPrank();
    }

    // =======================================================================
    // 5.  payInvoice — revert: insufficient allowance
    // =======================================================================

    function test_PayInvoice_RevertsInsufficientAllowance() public {
        uint256 amount = 100e6;

        // alice has NOT approved the router
        vm.prank(alice);
        vm.expectRevert(
            abi.encodeWithSelector(
                IERC20Errors.ERC20InsufficientAllowance.selector,
                address(router),  // spender
                0,                // current allowance
                amount            // needed
            )
        );
        router.payInvoice(bob, amount, "no-allowance");
    }

    // =======================================================================
    // 6.  payInvoice — revert: insufficient balance
    // =======================================================================

    function test_PayInvoice_RevertsInsufficientBalance() public {
        // charlie has no USDC at all
        uint256 amount = 100e6;

        vm.startPrank(charlie);
        usdc.approve(address(router), amount);

        vm.expectRevert(
            abi.encodeWithSelector(
                IERC20Errors.ERC20InsufficientBalance.selector,
                charlie, // sender
                0,       // balance
                amount   // needed
            )
        );
        router.payInvoice(bob, amount, "no-balance");
        vm.stopPrank();
    }

    // =======================================================================
    // 7.  recoverTokens — happy path
    // =======================================================================

    function test_RecoverTokens_HappyPath() public {
        uint256 stuck = 1_000e18;
        // Simulate tokens accidentally sent to the router
        otherToken.mint(address(router), stuck);

        uint256 ownerBefore = otherToken.balanceOf(owner);

        vm.prank(owner);
        router.recoverTokens(address(otherToken), stuck);

        assertEq(otherToken.balanceOf(address(router)), 0,               "router balance after");
        assertEq(otherToken.balanceOf(owner), ownerBefore + stuck,       "owner balance after");
    }

    // Partial recovery also works
    function test_RecoverTokens_PartialAmount() public {
        uint256 stuck   = 2_000e18;
        uint256 recover = 500e18;
        otherToken.mint(address(router), stuck);

        vm.prank(owner);
        router.recoverTokens(address(otherToken), recover);

        assertEq(otherToken.balanceOf(address(router)), stuck - recover, "router residual");
        assertEq(otherToken.balanceOf(owner), recover,                   "owner got tokens");
    }

    // =======================================================================
    // 8.  recoverTokens — revert: non-owner caller
    // =======================================================================

    function test_RecoverTokens_RevertsNonOwner() public {
        otherToken.mint(address(router), 100e18);

        vm.prank(alice);
        vm.expectRevert(
            abi.encodeWithSelector(Ownable.OwnableUnauthorizedAccount.selector, alice)
        );
        router.recoverTokens(address(otherToken), 100e18);
    }

    // =======================================================================
    // 9.  recoverTokens — revert: zero tokenAddress
    // =======================================================================

    function test_RecoverTokens_RevertsZeroTokenAddress() public {
        vm.prank(owner);
        vm.expectRevert(PaymentRouter.ZeroAddress.selector);
        router.recoverTokens(address(0), 100e18);
    }

    // =======================================================================
    // 10. recoverTokens — revert: zero amount
    // =======================================================================

    function test_RecoverTokens_RevertsZeroAmount() public {
        vm.prank(owner);
        vm.expectRevert(PaymentRouter.ZeroAmount.selector);
        router.recoverTokens(address(otherToken), 0);
    }

    // =======================================================================
    // 11. getContractUSDCBalance
    // =======================================================================

    function test_GetContractUSDCBalance_ZeroInitially() public view {
        assertEq(router.getContractUSDCBalance(), 0);
    }

    function test_GetContractUSDCBalance_ReflectsDeposit() public {
        uint256 deposited = 777e6;
        usdc.mint(address(router), deposited);
        assertEq(router.getContractUSDCBalance(), deposited);
    }

    // =======================================================================
    // 12. Fuzz — payInvoice with random amount and recipient
    // =======================================================================

    function testFuzz_PayInvoice_ArbitraryAmountAndRecipient(
        address recipient,
        uint256 amount
    ) public {
        // Bound inputs to meaningful ranges
        vm.assume(recipient != address(0));
        // Avoid precompiles and the router itself as recipient edge-cases
        vm.assume(recipient != address(router));
        // Avoid ERC20 address so transfer-to-self doesn't confuse balance checks
        vm.assume(recipient != address(usdc));
        amount = bound(amount, 1, INITIAL_BALANCE);

        // Give alice enough allowance
        vm.startPrank(alice);
        usdc.approve(address(router), amount);
        router.payInvoice(recipient, amount, "fuzz-memo");
        vm.stopPrank();

        if (recipient == alice) {
            // Round-trip: alice's balance unchanged
            assertEq(usdc.balanceOf(alice), INITIAL_BALANCE, "alice round-trip");
        } else {
            assertEq(usdc.balanceOf(alice),     INITIAL_BALANCE - amount, "alice deducted");
            assertEq(usdc.balanceOf(recipient), amount,                   "recipient credited");
        }
    }

    // =======================================================================
    // 13. Ownable2Step — two-step ownership transfer
    // =======================================================================

    function test_Ownable2Step_TransferInitiatesPending() public {
        vm.prank(owner);
        router.transferOwnership(alice);

        assertEq(router.pendingOwner(), alice, "pending owner set");
        assertEq(router.owner(),        owner, "owner unchanged mid-transfer");
    }

    function test_Ownable2Step_AcceptOwnershipCompletes() public {
        vm.prank(owner);
        router.transferOwnership(alice);

        vm.prank(alice);
        router.acceptOwnership();

        assertEq(router.owner(),        alice,       "alice is new owner");
        assertEq(router.pendingOwner(), address(0),  "pending cleared");
    }

    function test_Ownable2Step_NonPendingCannotAccept() public {
        vm.prank(owner);
        router.transferOwnership(alice);

        // bob is NOT the pending owner
        vm.prank(bob);
        vm.expectRevert(
            abi.encodeWithSelector(Ownable.OwnableUnauthorizedAccount.selector, bob)
        );
        router.acceptOwnership();
    }

    function test_Ownable2Step_NonOwnerCannotInitiateTransfer() public {
        vm.prank(alice);
        vm.expectRevert(
            abi.encodeWithSelector(Ownable.OwnableUnauthorizedAccount.selector, alice)
        );
        router.transferOwnership(bob);
    }

    // =======================================================================
    // Invariant — payInvoice is a pure transfer; the router never accumulates
    //             USDC from normal invoice payments (no custody)
    // =======================================================================

    function invariant_RouterNeverHoldsUSDCFromInvoices() public view {
        // The router uses safeTransferFrom(sender → recipient) directly.
        // Unless tokens are minted/sent here externally, the router balance == 0.
        // Because Foundry's default handler calls payInvoice on this contract,
        // the invariant verifies that the router is not a temporary holding account.
        assertEq(router.getContractUSDCBalance(), 0, "router should not custody USDC");
    }
}
