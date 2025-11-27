const { ethers } = require("hardhat");
const fs = require('fs');

async function main() {
    console.log("Desplegando NUEVO contrato GameStore...");

    const [deployer] = await ethers.getSigners();
    console.log("Desplegando con:", deployer.address);

    const GameStore = await ethers.getContractFactory("GameStore");
    
    // 1. DEPLOY
    console.log("Desplegando contrato...");
    const gameStore = await GameStore.deploy();
    await gameStore.deployed();
    console.log("Contrato desplegado en:", gameStore.address);

    // 2. CONFIGURACIÓN INMEDIATA
    console.log("Configurando contrato...");
    
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

    // 3. ACTUALIZAR .env
    console.log("Actualizando .env...");
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
    console.log(".env actualizado");

    // 4. GUARDAR DETALLES
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
    
    fs.writeFileSync('deployed-fresh.json', JSON.stringify(addresses, null, 2));
    console.log("Detalles guardados en 'deployed-fresh.json'");

    console.log("\n¡NUEVO CONTRATO LISTO!");
    console.log("Dirección:", gameStore.address);
    console.log("Etherscan: https://sepolia.etherscan.io/address/" + gameStore.address);
    console.log("Reinicia el servidor para usar la nueva dirección");
}

main().catch(console.error);