# USDC Payment Router

A full-stack USDC payment DApp for Arc Testnet. Connect a wallet, enter a recipient, amount, and optional memo, then approve USDC and send the payment in two clicks. Every payment is logged on-chain via the `PaymentRouter` smart contract. A live transaction history table below the form shows all past `PaymentSent` events, updates in real time, and links each row to the Arc Testnet Explorer.

Built with [Arc Studio](https://studio.arc.io)

## Tech Stack

- Solidity ^0.8.20 + Foundry (forge build / forge test)
- OpenZeppelin Contracts 5.6.1 (IERC20, SafeERC20, Ownable2Step, ReentrancyGuard)
- Chain: Arc Testnet (Chain ID 5042002)
- Token: USDC at `0x3600000000000000000000000000000000000000`

## Contracts

| Contract | Network | Address |
|---|---|---|
| PaymentRouter | Arc Testnet | `0xabfe34db072e29a7dbff1d239581629756dae714` |

## Development

### Prerequisites

- [Bun](https://bun.sh) >= 1.0
- [Foundry](https://getfoundry.sh) (forge)
- Node.js + npm (for Hardhat deployment)

### Install (Bun / Foundry workflow)

```bash
bun install
```

### Install Hardhat deployment dependencies

These are needed only for the Hardhat deploy script and are not part of the Foundry test/build pipeline:

```bash
npm install --save-dev hardhat @nomicfoundation/hardhat-toolbox @nomicfoundation/hardhat-verify dotenv
```

### Environment Variables

| Variable | Required for | Description |
|---|---|---|
| `PRIVATE_KEY` | Hardhat deploy | Deployer wallet private key (with `0x` prefix) |
| `ARC_TESTNET_RPC_URL` | Hardhat deploy (optional) | Arc Testnet RPC URL. Defaults to `https://rpc.testnet.arc.io` |

Add them to `.env` (never commit this file):

```
PRIVATE_KEY=0xYOUR_PRIVATE_KEY_HERE
ARC_TESTNET_RPC_URL=https://rpc.testnet.arc.io
```

The deployer wallet needs testnet USDC for gas (Arc uses USDC as its native gas token). Use the Arc Studio **Get test USDC** sidebar button to fund it.

### Build contracts (Foundry)

```bash
bun run contracts:build
```

### Run unit tests (Foundry)

```bash
bun run contracts:test
```

### Deploy with Hardhat

```bash
npx hardhat run scripts/deploy.js --network arcTestnet
```

The script prints the deployed address, explorer links, and step-by-step verification instructions automatically.

### Verify on Arc Testnet Explorer (Foundry)

```bash
forge verify-contract \
  --chain-id 5042002 \
  --verifier blockscout \
  --verifier-url https://explorer.testnet.arc.io/api \
  --constructor-args $(cast abi-encode "constructor(address)" 0x3600000000000000000000000000000000000000) \
  <DEPLOYED_ADDRESS> \
  contracts/PaymentRouter.sol:PaymentRouter
```

### Run the dev server

```bash
bun run dev
```

## Contract Interface

**`payInvoice(address recipient, uint256 amount, string memo)`**
Transfers `amount` of USDC from the caller to `recipient`. Caller must have approved the contract beforehand. Emits `PaymentSent`.

**`recoverTokens(address tokenAddress, uint256 amount)`**
Owner-only. Sends `amount` of any ERC-20 held by the contract to the owner address.

**`getContractUSDCBalance()`**
Returns the USDC balance currently held by this contract.
