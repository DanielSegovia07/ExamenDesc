const { ethers } = require("hardhat");

async function main() {
    console.log("⚙️ Configurando contrato GameStore...");

    const contractAddress = "0xf0656Dd0886389E7cd4327413582823dcDD3b4a4";
    const [deployer] = await ethers.getSigners();

    console.log("👤 Usando cuenta:", deployer.address);
    console.log("📍 Contrato:", contractAddress);

    const GameStore = await ethers.getContractFactory("GameStore");
    const gameStore = GameStore.attach(contractAddress);

    // Configuración
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

    try {
        console.log("🔄 Configurando multi-sign...");
        const setupMultiSigTx = await gameStore.setupMultiSig(owners, requiredApprovals);
        await setupMultiSigTx.wait();
        console.log("✅ Multi-sign configurado");

        console.log("🔄 Configurando payment splitter...");
        const setupPaymentTx = await gameStore.setupPaymentSplitter(payees, shares);
        await setupPaymentTx.wait();
        console.log("✅ Payment splitter configurado");

        console.log("🎉 ¡Configuración completada!");
        
        // Verificar configuración
        const currentOwners = await gameStore.getOwners();
        const currentPayees = await gameStore.getPayees();
        
        console.log("📋 Owners configurados:", currentOwners);
        console.log("💰 Payees configurados:", currentPayees);

    } catch (error) {
        console.error("❌ Error en configuración:", error.message);
        
        if (error.message.includes("OnlyOwner")) {
            console.log("🔒 Error: No eres el owner del contrato");
            console.log("💡 Solución: Usa la cuenta que desplegó el contrato");
        }
    }
}

main();