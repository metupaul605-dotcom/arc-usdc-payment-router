# [App Name]

> Built with Arc Studio - money-powered apps in minutes

This is the **project memory** - what Arc Studio remembers about building this app. It helps future agents (or humans) understand and extend the project.

---

## What This App Does

PaymentRouter: a USDC payment-routing contract deployed on Arc Testnet. It lets any sender pay an invoice directly to a recipient using their pre-approved USDC balance, with an on-chain memo and event log. The owner can recover any accidentally-sent ERC-20 tokens.

## Deployed Contracts

| Contract | Network | Address |
|---|---|---|
| PaymentRouter | Arc Testnet | 0xabfe34db072e29a7dbff1d239581629756dae714 |

Explorer: https://explorer.testnet.arc.io/address/0xabfe34db072e29a7dbff1d239581629756dae714

Constructor arg: USDC = 0x3600000000000000000000000000000000000000 (Arc Testnet)
Deployment tx: 0xda1997b27ab12ebcec71a105520cc0efbfeede496ebc2dd5d0a9746db7276510
Deployment block: 68904105 (use as `fromBlock` when querying PaymentSent events)

## Tech Stack

- Frontend: React 18, Vite, TypeScript, Tailwind CSS
- Web3: wagmi v2, viem v2, ConnectKit
- Contracts: Solidity 0.8.28 + Foundry. Sources in `contracts/`, unit tests in `contracts/test/*.t.sol`. Build with `bun run contracts:build` (`forge build`), test with `bun run contracts:test` (`forge test`).
- Wallet: injected (MetaMask, etc.)
- Chain: Arc Testnet (Chain ID: 5042002, imported from `viem/chains`)
- Token: USDC (6 decimals) (Address: 0x3600000000000000000000000000000000000000, Chain: Arc Testnet)
- Toasts: Sonner

## Key Files

- `src/App.tsx` - Main application logic
- `src/components/` - UI components
- `src/config.ts` - wagmi config (chains, connectors, transports)

## To Run

```bash
bun install
bun run dev
```
