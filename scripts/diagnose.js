const { ethers } = require("hardhat");

async function main() {
    const contractAddress = "0xf0656Dd0886389E7cd4327413582823dcDD3b4a4";
    const GameStore = await ethers.getContractFactory("GameStore");
    const gameStore = GameStore.attach(contractAddress);

    console.log("Diagnóstico del contrato...");
    
    try {
        // 1. Verificar owner
        const owner = await gameStore.owner();
        console.log("Owner:", owner);

        // 2. Verificar balance
        const balance = await gameStore.getBalance();
        console.log("Balance:", ethers.utils.formatEther(balance), "ETH");

        // 3. Verificar funciones básicas
        const totalSupply = await gameStore.totalSupply();
        console.log("Total Supply:", totalSupply.toString());

        // 4. Verificar owners del multi-sig
        const owners = await gameStore.getOwners();
        console.log("Owners:", owners);

        // 5. Verificar payees
        const payees = await gameStore.getPayees();
        console.log("Payees:", payees);

        console.log("Contrato funciona correctamente");

    } catch (error) {
        console.error("Error en diagnóstico:", error.message);
        
        if (error.message.includes("execution reverted")) {
            console.log("El contrato necesita ser configurado...");
        }
    }
}

main();