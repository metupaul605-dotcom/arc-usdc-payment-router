// scripts/deploy.js
//
// Deploys PaymentRouter to Arc Testnet via Hardhat.
//
// Usage:
//   npx hardhat run scripts/deploy.js --network arcTestnet
//
// Prerequisites:
//   1. Set PRIVATE_KEY and (optionally) ARC_TESTNET_RPC_URL in .env
//   2. Fund the deployer address with testnet USDC (used as gas on Arc).
//      Get testnet USDC from the Arc Studio "Get test USDC" sidebar button,
//      or from https://faucet.circle.com
//   3. Install Hardhat deps: npm install (or bun add --dev ...)
//      See README.md for the exact packages needed.

const { ethers } = require("hardhat");

// ---------------------------------------------------------------------------
// Arc Testnet USDC contract address
// This is the canonical ERC-20 USDC on Arc Testnet (Chain ID 5042002).
// On Arc, USDC is also the native gas token — both views share one address.
// ---------------------------------------------------------------------------
const ARC_TESTNET_USDC = "0x3600000000000000000000000000000000000000";

async function main() {
  // -------------------------------------------------------------------------
  // 1. Confirm network and deployer
  // -------------------------------------------------------------------------
  const network = await ethers.provider.getNetwork();
  const [deployer] = await ethers.getSigners();

  console.log("=".repeat(60));
  console.log("PaymentRouter — Deployment Script");
  console.log("=".repeat(60));
  console.log(`Network      : ${network.name} (chainId ${network.chainId})`);
  console.log(`Deployer     : ${deployer.address}`);

  const balance = await ethers.provider.getBalance(deployer.address);
  console.log(`Balance      : ${ethers.formatUnits(balance, 18)} USDC (native)`);
  console.log("-".repeat(60));

  // Warn if the deployer has very little gas (< 0.01 USDC in native units).
  // On Arc, 1 native USDC = 1e18 (18-decimal native view).
  const MIN_BALANCE = ethers.parseUnits("0.01", 18);
  if (balance < MIN_BALANCE) {
    console.warn(
      "\n⚠  WARNING: Deployer balance is very low. " +
        "Fund the address with testnet USDC before deploying.\n"
    );
  }

  // -------------------------------------------------------------------------
  // 2. Deploy PaymentRouter
  // -------------------------------------------------------------------------
  console.log(`\nDeploying PaymentRouter...`);
  console.log(`  usdc (constructor arg) : ${ARC_TESTNET_USDC}`);

  const PaymentRouter = await ethers.getContractFactory("PaymentRouter");
  const paymentRouter = await PaymentRouter.deploy(ARC_TESTNET_USDC);

  // Wait for the deployment transaction to be mined.
  await paymentRouter.waitForDeployment();

  const contractAddress = await paymentRouter.getAddress();
  const deployTx = paymentRouter.deploymentTransaction();

  console.log("\n" + "=".repeat(60));
  console.log("Deployment successful!");
  console.log("=".repeat(60));
  console.log(`Contract address : ${contractAddress}`);
  console.log(`Transaction hash : ${deployTx.hash}`);
  console.log(
    `Explorer         : https://explorer.testnet.arc.io/address/${contractAddress}`
  );
  console.log(
    `Tx explorer      : https://explorer.testnet.arc.io/tx/${deployTx.hash}`
  );

  // -------------------------------------------------------------------------
  // 3. Quick sanity check — read back the stored USDC address
  // -------------------------------------------------------------------------
  const storedUsdc = await paymentRouter.usdc();
  if (storedUsdc.toLowerCase() !== ARC_TESTNET_USDC.toLowerCase()) {
    throw new Error(
      `USDC address mismatch: expected ${ARC_TESTNET_USDC}, got ${storedUsdc}`
    );
  }
  console.log(`\nSanity check     : usdc() = ${storedUsdc} ✓`);

  // -------------------------------------------------------------------------
  // 4. Post-deployment verification instructions
  // -------------------------------------------------------------------------
  console.log("\n" + "=".repeat(60));
  console.log("NEXT STEP: Contract Verification on Arc Testnet Explorer");
  console.log("=".repeat(60));
  console.log(`
The Arc Testnet Explorer (https://explorer.testnet.arc.io) is powered
by Blockscout and supports Sourcify-style verification.

Option A — Hardhat Sourcify plugin (recommended)
-------------------------------------------------
1. Install the plugin (if not already):
     npm install --save-dev @nomicfoundation/hardhat-verify

2. Add to hardhat.config.js:
     require("@nomicfoundation/hardhat-verify");
     ...
     sourcify: { enabled: true }

3. Run:
     npx hardhat verify --network arcTestnet ${contractAddress} \\
       "${ARC_TESTNET_USDC}"

   The --network flag tells Hardhat which chain to submit to.
   The trailing argument is the constructor arg (USDC address).

Option B — Manual upload via Blockscout UI
-------------------------------------------
1. Open:
   https://explorer.testnet.arc.io/address/${contractAddress}#code

2. Click "Verify & Publish".

3. Choose "Via flattened source code" or "Via Sourcify".

4. For flattened source, run first:
     npx hardhat flatten contracts/PaymentRouter.sol > PaymentRouter.flat.sol

   Then paste the flattened file into the form and set:
     - Compiler        : v0.8.28+commit...
     - EVM version     : cancun
     - Optimization    : enabled, 200 runs
     - Constructor arg : ${ARC_TESTNET_USDC.slice(2).padStart(64, "0")}
       (ABI-encoded, without the 0x prefix — 64 hex chars total)

Option C — Foundry cast (if you prefer the CLI)
-------------------------------------------------
   forge verify-contract \\
     --chain-id 5042002 \\
     --verifier blockscout \\
     --verifier-url https://explorer.testnet.arc.io/api \\
     --constructor-args $(cast abi-encode "constructor(address)" ${ARC_TESTNET_USDC}) \\
     ${contractAddress} \\
     contracts/PaymentRouter.sol:PaymentRouter
`);
  console.log("=".repeat(60));
}

main().catch((error) => {
  console.error("\nDeployment failed:", error);
  process.exitCode = 1;
});
