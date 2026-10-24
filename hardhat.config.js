require("@nomicfoundation/hardhat-toolbox");
require("dotenv").config();

// ---------------------------------------------------------------------------
// Environment variables (set these in .env before deploying)
// ---------------------------------------------------------------------------
// PRIVATE_KEY         — deployer wallet private key (with 0x prefix)
// ARC_TESTNET_RPC_URL — Arc Testnet RPC endpoint
//                       Default: https://rpc.testnet.arc.io
// ---------------------------------------------------------------------------

const PRIVATE_KEY = process.env.PRIVATE_KEY;
const ARC_TESTNET_RPC_URL =
  process.env.ARC_TESTNET_RPC_URL || "https://rpc.testnet.arc.io";

if (!PRIVATE_KEY) {
  console.warn(
    "\n[hardhat] WARNING: PRIVATE_KEY is not set in .env. " +
      "Deployment will fail until it is provided.\n"
  );
}

/** @type {import('hardhat/config').HardhatUserConfig} */
module.exports = {
  solidity: {
    version: "0.8.28",
    settings: {
      optimizer: {
        enabled: true,
        runs: 200,
      },
      evmVersion: "cancun",
    },
  },

  networks: {
    // -----------------------------------------------------------------------
    // Arc Testnet  (Chain ID: 5042002)
    // -----------------------------------------------------------------------
    arcTestnet: {
      url: ARC_TESTNET_RPC_URL,
      chainId: 5042002,
      accounts: PRIVATE_KEY ? [PRIVATE_KEY] : [],
      // Arc uses USDC as its native gas token — fees are denominated in USDC.
      // No ETH faucet is needed; fund the deployer with testnet USDC instead.
    },

    // -----------------------------------------------------------------------
    // Local Hardhat network (default — used for tests)
    // -----------------------------------------------------------------------
    hardhat: {
      chainId: 31337,
    },
  },

  // ---------------------------------------------------------------------------
  // Paths — Hardhat reads contracts from "contracts/" to match the
  // existing Foundry layout so both toolchains share the same source tree.
  // ---------------------------------------------------------------------------
  paths: {
    sources: "./contracts",
    tests: "./test",
    cache: "./hardhat-cache",
    artifacts: "./hardhat-artifacts",
  },

  // ---------------------------------------------------------------------------
  // Source remappings — mirrors remappings.txt so Hardhat resolves
  // @openzeppelin/contracts the same way Foundry does.
  // ---------------------------------------------------------------------------
  // NOTE: Hardhat resolves @openzeppelin/* via node_modules automatically
  // when the package is installed, so no extra remapping config is needed.
  // ---------------------------------------------------------------------------
};
