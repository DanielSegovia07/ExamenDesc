const { ethers } = require("hardhat");

async function main() {
    console.log("Desplegando GameStore (Versión Simplificada)...");


    const [deployer] = await ethers.getSigners();
    console.log("Desplegando con la cuenta:", deployer.address);
    console.log("Balance del deployer:", ethers.utils.formatEther(await deployer.getBalance()));

    const GameStore = await ethers.getContractFactory("GameStore");
    console.log("Desplegando contrato...");
    
    
    const gameStore = await GameStore.deploy();
    console.log("Transacción enviada:", gameStore.deployTransaction.hash);
    
    await gameStore.deployed();
    console.log("GameStore desplegado en:", gameStore.address);

   
    console.log("Esperando confirmaciones...");
    await gameStore.deployTransaction.wait(3);
    console.log("Confirmaciones recibidas");

    
    console.log("Configurando multi-sign y payment splitter...");
    
    const owners = [
        "0x2bc6e60CD93EeF266469273BDE09203f6565eFB3",
        "0x757739075784B053788Da250440400f03Bc5FC4C"
    ];
    
    const requiredApprovals = 2;
    
    const payees = [
        "0x2bc6e60CD93EeF266469273BDE09203f6565eFB3", 
        "0x757739075784B053788Da250440400f03Bc5FC4C"
    ];
    
    const shares = [80, 20];

    
    const setupMultiSigTx = await gameStore.setupMultiSig(owners, requiredApprovals);
    await setupMultiSigTx.wait();
    console.log("Multi-sign configurado");

  
    const setupPaymentTx = await gameStore.setupPaymentSplitter(payees, shares);
    await setupPaymentTx.wait();
    console.log("Payment splitter configurado");

    
    const fs = require('fs');
    const envPath = require('find-config')('.env');
    
    let envContent = fs.existsSync(envPath) ? fs.readFileSync(envPath, 'utf8') : '';
    
    
    if (envContent.includes('GAMESTORE_CONTRACT_ADDRESS=')) {
        envContent = envContent.replace(
            /GAMESTORE_CONTRACT_ADDRESS=.*/,
            `GAMESTORE_CONTRACT_ADDRESS="${gameStore.address}"`
        );
    } else {
        envContent += `\nGAMESTORE_CONTRACT_ADDRESS="${gameStore.address}"`;
    }
    
    fs.writeFileSync(envPath, envContent);
    console.log("Dirección guardada en .env");

    
    const addresses = {
        GameStore: gameStore.address,
        network: "sepolia",
        timestamp: new Date().toISOString(),
        deployer: deployer.address,
        owners: owners,
        payees: payees,
        shares: shares,
        requiredApprovals: requiredApprovals,
        transactionHash: gameStore.deployTransaction.hash
    };
    
    fs.writeFileSync('deployed-gamestore-simple.json', JSON.stringify(addresses, null, 2));
    console.log("Detalles guardados en 'deployed-gamestore-simple.json'");

    console.log("\n¡Despliegue completado!");
    console.log("Contrato:", gameStore.address);
    console.log("Transaction:", gameStore.deployTransaction.hash);
    console.log(" Deployer:", deployer.address);
    
    console.log("\nURLs útiles:");
    console.log("   Sepolia Etherscan: https://sepolia.etherscan.io/address/" + gameStore.address);
}

main().catch((error) => {
    console.error("Error en el despliegue:", error);
    process.exitCode = 1;
});