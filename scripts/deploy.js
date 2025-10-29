const { ethers } = require("hardhat")

async function deployExamen(){
    const [deployer] = await ethers.getSigners();
    
    const owners = [
        "0x2bc6e60CD93EeF266469273BDE09203f6565eFB3",
        "0x757739075784B053788Da250440400f03Bc5FC4C"
    ]
    const partes = ["60","40"]
    const requiredApprovals = 2;
    
    console.log("Deployer:", deployer.address)
    console.log("Owners:", owners)
    
    const Examen = await ethers.getContractFactory("Examen");
    const examen = await Examen.deploy(owners, requiredApprovals, owners, partes);
    
    const receipt = await examen.deployTransaction.wait();
    console.log("Contract:", examen.address)
    console.log("Gas used:", receipt.gasUsed.toString())
}

deployExamen().then(()=>process.exit(0)).catch((error)=>{
    console.error(error)
    process.exit(1)
})