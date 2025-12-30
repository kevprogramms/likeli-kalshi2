import hre from "hardhat";

async function main() {
    const [deployer] = await hre.ethers.getSigners();
    console.log("Deploying contracts with:", deployer.address);
    console.log("Account balance:", (await deployer.provider.getBalance(deployer.address)).toString());

    // Polygon Mainnet addresses
    const USDC_POLYGON = "0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174"; // USDC on Polygon
    const CTF_EXCHANGE = "0x4D97DCd97eC945f40cF65F87097ACe5EA0476045"; // Polymarket CTF Exchange
    const CONDITIONAL_TOKENS = "0x4D97DCd97eC945f40cF65F87097ACe5EA0476045"; // Same address on Polygon

    // Deploy PolymarketAdapter
    console.log("\n1. Deploying PolymarketAdapter...");
    const Adapter = await hre.ethers.getContractFactory("PolymarketAdapter");
    const adapter = await Adapter.deploy(USDC_POLYGON, CTF_EXCHANGE, CONDITIONAL_TOKENS);
    await adapter.waitForDeployment();
    const adapterAddress = await adapter.getAddress();
    console.log("PolymarketAdapter deployed to:", adapterAddress);

    // Deploy LikeliVault
    console.log("\n2. Deploying LikeliVault...");
    const Vault = await hre.ethers.getContractFactory("LikeliVault");
    const vault = await Vault.deploy(
        USDC_POLYGON,
        "Likeli Vault Shares",
        "lvUSDC",
        adapterAddress,
        CONDITIONAL_TOKENS
    );
    await vault.waitForDeployment();
    const vaultAddress = await vault.getAddress();
    console.log("LikeliVault deployed to:", vaultAddress);

    // Authorize vault in adapter
    console.log("\n3. Authorizing vault in adapter...");
    await adapter.setVaultAuthorization(vaultAddress, true);
    console.log("Vault authorized!");

    console.log("\n=== Deployment Complete ===");
    console.log("PolymarketAdapter:", adapterAddress);
    console.log("LikeliVault:", vaultAddress);
    console.log("\nNext steps:");
    console.log("1. Verify contracts on PolygonScan");
    console.log("2. Update frontend with contract addresses");
    console.log("3. Transfer ownership to multisig");
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
