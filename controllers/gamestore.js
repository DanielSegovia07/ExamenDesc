require('dotenv').config();
const { ethers } = require('ethers');
const contract = require('../artifacts/contracts/GameStore.sol/GameStore.json');
const { createTransaction, getContract } = require('../utils/contractHelper');
const { GAMESTORE_CONTRACT_ADDRESS } = process.env;

console.log(' GameStore Controller cargado');
console.log('Contract Address:', GAMESTORE_CONTRACT_ADDRESS);

if (!GAMESTORE_CONTRACT_ADDRESS) {
    console.error(' GAMESTORE_CONTRACT_ADDRESS no está definido en .env');
    throw new Error('GAMESTORE_CONTRACT_ADDRESS no configurado');
}

// ========== FUNCIONES DE CÁLCULO DE COMISIÓN ==========
function calculatePriceWithFee(netPriceETH) {
    const netPrice = ethers.utils.parseEther(netPriceETH.toString());
    // Fórmula: precio_total = net_price / 0.95
    const totalPrice = netPrice.mul(100).div(95); // Invertir el 5%
    return {
        totalPriceWei: totalPrice,
        totalPriceETH: ethers.utils.formatEther(totalPrice),
        netPriceWei: netPrice,
        netPriceETH: netPriceETH,
        feeWei: totalPrice.sub(netPrice),
        feeETH: ethers.utils.formatEther(totalPrice.sub(netPrice)),
        feePercentage: 5
    };
}

function calculateNetFromTotal(totalPriceETH) {
    const totalPrice = ethers.utils.parseEther(totalPriceETH.toString());
    // Fórmula: neto = total * 0.95
    const netPrice = totalPrice.mul(95).div(100);
    return {
        netPriceWei: netPrice,
        netPriceETH: ethers.utils.formatEther(netPrice),
        totalPriceWei: totalPrice,
        totalPriceETH: totalPriceETH,
        feeWei: totalPrice.sub(netPrice),
        feeETH: ethers.utils.formatEther(totalPrice.sub(netPrice))
    };
}

// ========== FUNCIÓN isOwner PARA VERIFICACIÓN ==========
async function isOwner(address) {
    try {
        const gameStore = getContract(GAMESTORE_CONTRACT_ADDRESS, contract.abi);
        
        // Opción 1: Si el contrato tiene función isOwner
        if (contract.abi.find(item => item.name === 'isOwner' && item.type === 'function')) {
            const result = await gameStore.isOwner(address);
            console.log(`[isOwner] ${address} is owner: ${result}`);
            return result;
        }
        
        // Opción 2: Si el contrato usa Ownable de OpenZeppelin
        if (contract.abi.find(item => item.name === 'owner' && item.type === 'function')) {
            const owner = await gameStore.owner();
            const result = owner.toLowerCase() === address.toLowerCase();
            console.log(`[owner check] Contract owner: ${owner}, ${address} is owner: ${result}`);
            return result;
        }
        
        // Opción 3: Si el contrato tiene múltiples owners (como en MultiSig)
        if (contract.abi.find(item => item.name === 'getOwners' && item.type === 'function')) {
            const owners = await gameStore.getOwners();
            const result = owners.some(owner => owner.toLowerCase() === address.toLowerCase());
            console.log(`[multi-owner check] ${address} is in owners list: ${result}`);
            return result;
        }
        
        // Opción 4: Verificar si es una de las cuentas hardcodeadas
        const publicKeys = process.env.PUBLIC_KEYS ? process.env.PUBLIC_KEYS.split(',') : [];
        const result = publicKeys.some(pubKey => pubKey.toLowerCase() === address.toLowerCase());
        console.log(`[env check] ${address} is in public keys: ${result}`);
        
        return result;
        
    } catch (error) {
        console.error('[isOwner ERROR] Error verificando owner status:', error);
        
        // Fallback: Verificar si es una de las cuentas configuradas
        try {
            const publicKeys = process.env.PUBLIC_KEYS ? process.env.PUBLIC_KEYS.split(',') : [];
            return publicKeys.some(pubKey => pubKey.toLowerCase() === address.toLowerCase());
        } catch (fallbackError) {
            console.error('[isOwner FALLBACK ERROR]:', fallbackError);
            return false;
        }
    }
}

// ========== FUNCIONES NFT MEJORADAS ==========
async function mintGame(recipient, tokenURI, price, name, description, image, genre, account) {
    console.log(`Minting game: ${name}, Price: ${ethers.utils.formatEther(price)} ETH`);
    return await createTransaction(
        GAMESTORE_CONTRACT_ADDRESS, 
        contract.abi, 
        'mintGame', 
        [recipient, tokenURI, price, name, description, image, genre], 
        account
    );
}

async function buyGame(gameId, value, account) {
    try {
        console.log(` Buying game ${gameId} for ${ethers.utils.formatEther(value)} ETH`);
        const accountInfo = getAccountFromIndex(parseInt(account));
        const provider = new ethers.providers.JsonRpcProvider(process.env.API_URL);
        const wallet = new ethers.Wallet(accountInfo.privateKey, provider);

        const gameStoreContract = new ethers.Contract(GAMESTORE_CONTRACT_ADDRESS, contract.abi, wallet);
        const tx = await gameStoreContract.buyGame(gameId, { value: value });
        const receipt = await tx.wait();
        return receipt;
    } catch (error) {
        console.error('Error en buyGame:', error);
        throw error;
    }
}

async function listGameForSale(gameId, sellerNetPriceETH, account) {
    try {
        // Calcular precio total que pagará el comprador
        const priceCalc = calculatePriceWithFee(sellerNetPriceETH);
        
        console.log(`[LIST WITH FEE] Game ${gameId}`);
        console.log(`[LIST WITH FEE] Seller wants net: ${sellerNetPriceETH} ETH`);
        console.log(`[LIST WITH FEE] Buyer pays total: ${priceCalc.totalPriceETH} ETH`);
        console.log(`[LIST WITH FEE] Fee to contract: ${priceCalc.feeETH} ETH (5%)`);
        
        // Listar el juego con el precio TOTAL (lo que paga el comprador)
        return await createTransaction(
            GAMESTORE_CONTRACT_ADDRESS,
            contract.abi,
            'listGameForSale',
            [gameId, priceCalc.totalPriceWei],
            account
        );
    } catch (error) {
        console.error('Error listing game with fee:', error);
        throw error;
    }
}

// ========== NUEVAS FUNCIONES DE GESTIÓN ==========
async function removeFromSale(gameId, account) {
    console.log(`Removing game ${gameId} from sale`);
    return await createTransaction(
        GAMESTORE_CONTRACT_ADDRESS,
        contract.abi,
        'removeFromSale',
        [gameId],
        account
    );
}

async function updateGamePrice(gameId, sellerNetPriceETH, account) {
    try {
        // Calcular precio total con comisión
        const priceCalc = calculatePriceWithFee(sellerNetPriceETH);
        
        console.log(`[UPDATE PRICE WITH FEE] Game ${gameId}`);
        console.log(`[UPDATE PRICE WITH FEE] New net price: ${sellerNetPriceETH} ETH`);
        console.log(`[UPDATE PRICE WITH FEE] New total price: ${priceCalc.totalPriceETH} ETH`);
        
        return await createTransaction(
            GAMESTORE_CONTRACT_ADDRESS,
            contract.abi,
            'updateGamePrice',
            [gameId, priceCalc.totalPriceWei],
            account
        );
    } catch (error) {
        console.error('Error updating price with fee:', error);
        throw error;
    }
}

async function updateGameInfo(gameId, name, description, image, genre, price, account) {
    console.log(`Updating game ${gameId} info`);
    const priceInWei = ethers.utils.parseEther(price.toString());
    return await createTransaction(
        GAMESTORE_CONTRACT_ADDRESS,
        contract.abi,
        'updateGameInfo',
        [gameId, name, description, image, genre, priceInWei],
        account
    );
}

async function disableGame(gameId, account) {
    console.log(`Disabling game ${gameId}`);
    return await createTransaction(
        GAMESTORE_CONTRACT_ADDRESS,
        contract.abi,
        'disableGame',
        [gameId],
        account
    );
}

async function enableGame(gameId, account) {
    console.log(` Enabling game ${gameId}`);
    return await createTransaction(
        GAMESTORE_CONTRACT_ADDRESS,
        contract.abi,
        'enableGame',
        [gameId],
        account
    );
}

// ========== FUNCIONES DE CONSULTA MEJORADAS ==========
async function getGamesForSale() {
    const gameStore = getContract(GAMESTORE_CONTRACT_ADDRESS, contract.abi);
    
    try {
        const gameIds = await gameStore.getGamesForSale();
        console.log(`Found ${gameIds.length} games for sale`);
        
        const games = [];
        for (let id of gameIds) {
            try {
                const gameDetails = await getGameDetails(id);
                games.push(gameDetails);
            } catch (error) {
                console.error(`Error fetching game ${id}:`, error);
            }
        }
        
        return games;
    } catch (error) {
        console.error('Error getting games for sale:', error);
        return [];
    }
}

async function getGameDetails(gameId) {
    const gameStore = getContract(GAMESTORE_CONTRACT_ADDRESS, contract.abi);
    
    try {
        const details = await gameStore.getGameDetails(gameId);
        
        return {
            id: gameId.toString(),
            name: details.name,
            description: details.description,
            image: details.image,
            genre: details.genre,
            price: details.price.toString(),
            priceFormatted: ethers.utils.formatEther(details.price),
            seller: details.seller,
            forSale: details.isForSale,
            active: details.active,
            createdAt: new Date(details.createdAt * 1000).toISOString(),
            tokenURI: await gameStore.tokenURI(gameId).catch(() => 'No metadata')
        };
    } catch (error) {
        console.error(`Error getting details for game ${gameId}:`, error);
        throw error;
    }
}

async function getAllGames() {
    const gameStore = getContract(GAMESTORE_CONTRACT_ADDRESS, contract.abi);
    
    try {
        const gameIds = await gameStore.getAllGames();
        console.log(`Found ${gameIds.length} total games`);
        
        const games = [];
        for (let id of gameIds) {
            try {
                const gameDetails = await getGameDetails(id);
                games.push(gameDetails);
            } catch (error) {
                console.error(`Error fetching game ${id}:`, error);
            }
        }
        
        return games;
    } catch (error) {
        console.error('Error getting all games:', error);
        return [];
    }
}

async function getUserGames(userAddress) {
    try {
        const allGames = await getAllGames();
        const userGames = allGames.filter(game => 
            game.seller.toLowerCase() === userAddress.toLowerCase()
        );
        
        console.log(` Found ${userGames.length} games for user ${userAddress}`);
        return userGames;
    } catch (error) {
        console.error('Error getting user games:', error);
        return [];
    }
}

// ========== FUNCIONES PAYMENT==========
async function releasePayments(account) {
    console.log(`Releasing payments from account ${account}`);
    return await createTransaction(
        GAMESTORE_CONTRACT_ADDRESS,
        contract.abi,
        'release',
        [],
        account
    );
}

// ========== FUNCIONES WALLET ==========

async function getTransactions() {
    const gameStore = getContract(GAMESTORE_CONTRACT_ADDRESS, contract.abi);
    
    try {
        const transactions = await gameStore.getTransactions();
        console.log(`Found ${transactions.length} transactions`);
        
        const formattedTransactions = transactions.map((tx, index) => ({
            id: index,
            to: tx.to,
            amount: tx.amount.toString(),
            amountETH: ethers.utils.formatEther(tx.amount),
            approvalCount: tx.approvalCount.toString(),
            executed: tx.executed,
            approvals: tx.approvals 
        }));
        
        return formattedTransactions;
    } catch (error) {
        console.error('Error getting transactions:', error);
        return [];
    }
}

async function submitTransaction(to, amount, account) {
    const parsedAmount = ethers.utils.parseEther(amount.toString());
    console.log(`Submitting transaction to ${to} for ${amount} ETH`);
    return await createTransaction(
        GAMESTORE_CONTRACT_ADDRESS,
        contract.abi,
        'submitTransaction',
        [to, parsedAmount],
        account
    );
}

async function approveTransaction(txId, account) {
    console.log(` Approving transaction ${txId} from account ${account}`);
    return await createTransaction(
        GAMESTORE_CONTRACT_ADDRESS,
        contract.abi,
        'approveTransaction',
        [txId],
        account
    );
}

async function executeTransaction(txId, account) {
    console.log(`Executing transaction ${txId} from account ${account}`);
    return await createTransaction(
        GAMESTORE_CONTRACT_ADDRESS,
        contract.abi,
        'executeTransaction',
        [txId],
        account
    );
}

// ========== FUNCIONES UTILITARIAS ==========
async function getBalance() {
    const gameStore = getContract(GAMESTORE_CONTRACT_ADDRESS, contract.abi);
    const balance = await gameStore.getBalance();
    console.log(` Contract balance: ${ethers.utils.formatEther(balance)} ETH`);
    return balance;
}

async function getOwnedGames(userAddress) {
    try {
        const allGames = await getAllGames();
        const gameStore = getContract(GAMESTORE_CONTRACT_ADDRESS, contract.abi);
        
        const ownedGames = [];
        
        for (let game of allGames) {
            try {
                const owner = await gameStore.ownerOf(game.id);
                if (owner.toLowerCase() === userAddress.toLowerCase()) {
                    ownedGames.push(game);
                }
            } catch (error) {
                console.error(`Error verificando propietario del juego ${game.id}:`, error);
            }
        }
        
        console.log(` Found ${ownedGames.length} owned games for user ${userAddress}`);
        return ownedGames;
    } catch (error) {
        console.error('Error getting owned games:', error);
        return [];
    }
}

async function getContractInfo() {
    const gameStore = getContract(GAMESTORE_CONTRACT_ADDRESS, contract.abi);
    
    try {
        const [balance, owners, payees, totalGames, transactions, activeGamesCount] = await Promise.all([
            gameStore.getBalance(),
            gameStore.getOwners(),
            gameStore.getPayees(),
            gameStore.totalSupply(),
            gameStore.getTransactions(),
            gameStore.getActiveGamesCount()
        ]);

        const info = {
            balance: balance.toString(),
            balanceETH: ethers.utils.formatEther(balance),
            owners: owners,
            payees: payees,
            totalGames: totalGames.toString(),
            activeGames: activeGamesCount.toString(),
            transactionCount: transactions.length,
            contractAddress: GAMESTORE_CONTRACT_ADDRESS,
            requiredApprovals: 2
        };

        console.log('Contract info retrieved:', info);
        return info;
    } catch (error) {
        console.error('Error getting contract info:', error);
        throw error;
    }
}

function getAccountFromIndex(accountIndex) {
    const publicKeys = process.env.PUBLIC_KEYS.split(',');
    const privateKeys = process.env.PRIVATE_KEYS.split(',');

    if (accountIndex >= 0 && accountIndex < publicKeys.length) {
        return {
            address: publicKeys[accountIndex],
            privateKey: privateKeys[accountIndex]
        };
    }
    throw new Error(`Índice de cuenta inválido: ${accountIndex}`);
}

module.exports = {
    // Nueva función
    isOwner,
    
    // NFT
    mintGame,
    buyGame,
    listGameForSale,
    getGamesForSale,
    calculatePriceWithFee,   
    calculateNetFromTotal, 
    
    // Gestión
    removeFromSale,
    updateGamePrice,
    updateGameInfo,
    disableGame,
    enableGame,
    
    // Consultas
    getGameDetails,
    getAllGames,
    getUserGames,
    getOwnedGames,
    
    // Payment
    releasePayments,
    
    // Wallet 
    submitTransaction,
    approveTransaction,
    executeTransaction,
    getTransactions,
    getAccountFromIndex,
    
    // Utilitarias
    getBalance,
    getContractInfo
};