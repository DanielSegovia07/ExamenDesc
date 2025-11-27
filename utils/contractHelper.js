const {ethers} = require('ethers')


const provider = new ethers.providers.JsonRpcProvider(process.env.API_URL)


function getWallet(accountIndex) {
    const privateKeys = process.env.PRIVATE_KEYS.split(',')
    if (accountIndex >= 0 && accountIndex < privateKeys.length) {
        return new ethers.Wallet(privateKeys[accountIndex], provider)
    }
    throw new Error(`Índice de cuenta inválido: ${accountIndex}`)
}


function getPublicKey(accountIndex) {
    const publicKeys = process.env.PUBLIC_KEYS.split(',')
    if (accountIndex >= 0 && accountIndex < publicKeys.length) {
        return publicKeys[accountIndex]
    }
    throw new Error(`Índice de cuenta inválido: ${accountIndex}`)
}

async function createTransaction(contractAddress, abi, method, params, account) {
    try {
        const wallet = getWallet(parseInt(account))
        const contract = new ethers.Contract(contractAddress, abi, wallet)
        
        const tx = await contract[method](...params)
        const receipt = await tx.wait()
        
        console.log(`Tx ${method} ejecutada:`, receipt.transactionHash)
        return receipt
    } catch (error) {
        console.error(`Error en transacción ${method}:`, error)
        throw error
    }
}

function getContract(contractAddress, abi) {
    return new ethers.Contract(contractAddress, abi, provider)
}

module.exports = {
    createTransaction,
    getContract,
    provider,
    getWallet,
    getPublicKey
}