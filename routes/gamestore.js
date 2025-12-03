const express = require('express');
const router = express.Router();
const gameStoreController = require('../controllers/gamestore');
const { ethers } = require('ethers');
require('dotenv').config();

console.log('GameStore Routes cargadas');


const GAMESTORE_CONTRACT_ADDRESS = process.env.GAMESTORE_CONTRACT_ADDRESS;


if (!GAMESTORE_CONTRACT_ADDRESS) {
    console.error('ERROR: GAMESTORE_CONTRACT_ADDRESS no está en .env');
} else {
    console.log('Contract Address en routes:', GAMESTORE_CONTRACT_ADDRESS);
}

// ========== NFT FUNCTIONS ==========


router.post('/nft/mint', async (req, res) => {
    try {
        const { recipient, tokenURI, price, name, description, image, genre, account } = req.body;
        
        if (!recipient || !tokenURI || !price || !name || !description || !image || !genre || !account) {
            return res.status(400).json({ 
                success: false, 
                message: 'Todos los campos son requeridos: recipient, tokenURI, price, name, description, image, genre, account' 
            });
        }

        const priceInWei = ethers.utils.parseEther(price.toString());
        const receipt = await gameStoreController.mintGame(
            recipient, 
            tokenURI, 
            priceInWei, 
            name, 
            description, 
            image, 
            genre, 
            account
        );
        
        res.json({ 
            success: true, 
            message: 'Juego NFT creado exitosamente',
            receipt: {
                transactionHash: receipt.transactionHash
            }
        });
    } catch (error) {
        console.error('Error creando juego NFT:', error);
        res.status(500).json({ 
            success: false, 
            message: error.message 
        });
    }
});


router.post('/nft/:gameId/buy', async (req, res) => {
    try {
        const { gameId } = req.params;
        const { account } = req.body;

        if (!account) {
            return res.status(400).json({ 
                success: false, 
                message: 'Cuenta es requerida' 
            });
        }

       
        const gameDetails = await gameStoreController.getGameDetails(parseInt(gameId));
        
        if (!gameDetails) {
            return res.status(400).json({ 
                success: false, 
                message: 'Juego no encontrado' 
            });
        }

        if (!gameDetails.forSale) {
            return res.status(400).json({ 
                success: false, 
                message: 'Juego no disponible para la venta' 
            });
        }

        const priceInWei = ethers.utils.parseEther(gameDetails.priceFormatted);
        const receipt = await gameStoreController.buyGame(parseInt(gameId), priceInWei, account);
        
        res.json({ 
            success: true, 
            message: 'Juego comprado exitosamente',
            game: {
                id: gameId,
                name: gameDetails.name,
                price: gameDetails.priceFormatted
            },
            receipt: {
                transactionHash: receipt.transactionHash
            }
        });
    } catch (error) {
        console.error('Error comprando juego:', error);
        res.status(500).json({ 
            success: false, 
            message: error.message 
        });
    }
});

// ========== FONDEAR CONTRATO ==========

router.post('/contract/fund', async (req, res) => {
    try {
        const { amount, account } = req.body;

        if (!GAMESTORE_CONTRACT_ADDRESS) {
            return res.status(500).json({ 
                success: false, 
                message: 'GAMESTORE_CONTRACT_ADDRESS no configurado' 
            });
        }

        if (!amount || !account) {
            return res.status(400).json({ 
                success: false, 
                message: 'Amount y account son requeridos' 
            });
        }

        console.log(`[FUND REQUEST] Intentando fondear con ${amount} ETH usando cuenta ${account}`);

        // ========== VERIFICACIÓN: SOLO OWNERS ==========
        // 1. Obtener la dirección del signer (cuenta que firma la transacción)
        const accountInfo = gameStoreController.getAccountFromIndex(parseInt(account));
        const signerAddress = accountInfo.address;
        
        console.log(`[FUND CHECK] Signer address: ${signerAddress}`);
        
        // 2. Verificar si es owner del contrato
        const isOwner = await gameStoreController.isOwner(signerAddress);
        
        if (!isOwner) {
            console.log(`[FUND DENIED] ${signerAddress} NO es owner del contrato`);
            return res.status(403).json({ 
                success: false, 
                message: 'Solo los owners pueden fondear el contrato',
                details: {
                    signerAddress: signerAddress,
                    isOwner: false
                }
            });
        }
        
        console.log(`[FUND APPROVED] ${signerAddress} ES owner del contrato`);
        // ========== FIN DE VERIFICACIÓN ==========

        console.log(`[OWNER FUNDING] Fondeando contrato con ${amount} ETH desde ${signerAddress}`);

        // Crear provider y wallet para firmar
        const provider = new ethers.providers.JsonRpcProvider(process.env.API_URL);
        const wallet = new ethers.Wallet(accountInfo.privateKey, provider);
        
        // Verificar balance del wallet antes de enviar
        const walletBalance = await wallet.getBalance();
        const amountInWei = ethers.utils.parseEther(amount.toString());
        
        if (walletBalance.lt(amountInWei)) {
            return res.status(400).json({ 
                success: false, 
                message: 'Fondos insuficientes en la wallet del owner',
                details: {
                    walletBalance: ethers.utils.formatEther(walletBalance) + ' ETH',
                    requiredAmount: amount + ' ETH',
                    difference: ethers.utils.formatEther(walletBalance.sub(amountInWei)) + ' ETH'
                }
            });
        }

        console.log(`[TX PREPARED] Enviando ${amount} ETH de ${signerAddress} a ${GAMESTORE_CONTRACT_ADDRESS}`);
        
        // Enviar transacción
        const tx = await wallet.sendTransaction({
            to: GAMESTORE_CONTRACT_ADDRESS,
            value: amountInWei,
            gasLimit: 30000 // Ajuste de gas para transferencia simple
        });
        
        console.log(`[TX SENT] Transacción enviada: ${tx.hash}`);
        
        // Esperar confirmación
        const receipt = await tx.wait();
        
        console.log(`[TX CONFIRMED] Transacción confirmada en bloque ${receipt.blockNumber}`);
        
        // Obtener nuevo balance del contrato
        const provider2 = new ethers.providers.JsonRpcProvider(process.env.API_URL);
        const newContractBalance = await provider2.getBalance(GAMESTORE_CONTRACT_ADDRESS);
        
        res.json({ 
            success: true, 
            message: `Contrato fondeado con ${amount} ETH exitosamente`,
            receipt: {
                transactionHash: receipt.transactionHash,
                from: receipt.from,
                to: receipt.to,
                contractAddress: GAMESTORE_CONTRACT_ADDRESS,
                amountETH: amount,
                amountWei: amountInWei.toString(),
                gasUsed: receipt.gasUsed.toString(),
                blockNumber: receipt.blockNumber,
                timestamp: new Date().toISOString()
            },
            balance: {
                before: ethers.utils.formatEther(walletBalance) + ' ETH',
                after: ethers.utils.formatEther(walletBalance.sub(amountInWei)) + ' ETH'
            },
            contract: {
                address: GAMESTORE_CONTRACT_ADDRESS,
                newBalance: ethers.utils.formatEther(newContractBalance) + ' ETH',
                fundedBy: signerAddress
            }
        });
        
    } catch (error) {
        console.error('[FUND ERROR] Error fondeando contrato:', error);
        
        // Mensaje de error más detallado
        let errorMessage = error.message;
        let errorCode = 500;
        
        if (error.code === 'INSUFFICIENT_FUNDS') {
            errorMessage = 'Fondos insuficientes para completar la transacción';
            errorCode = 400;
        } else if (error.code === 'NETWORK_ERROR') {
            errorMessage = 'Error de conexión con la red blockchain';
            errorCode = 503;
        } else if (error.message.includes('rejected')) {
            errorMessage = 'Transacción rechazada por el usuario';
            errorCode = 400;
        }
        
        res.status(errorCode).json({ 
            success: false, 
            message: errorMessage,
            errorDetails: {
                code: error.code,
                reason: error.reason,
                action: error.action
            }
        });
    }
});


router.post('/nft/:gameId/list', async (req, res) => {
    try {
        const { gameId } = req.params;
        const { price, account } = req.body; // 'price' ahora es el NETO que quiere el vendedor

        if (!price || !account) {
            return res.status(400).json({ 
                success: false, 
                message: 'Price y account son requeridos' 
            });
        }

        const receipt = await gameStoreController.listGameForSale(
            parseInt(gameId), 
            price, // Precio NETO
            account
        );
        
        // Obtener cálculo para respuesta
        const priceCalc = gameStoreController.calculatePriceWithFee(price);
        
        res.json({ 
            success: true, 
            message: 'Juego listado para venta',
            priceDetails: {
                sellerNetPrice: price + ' ETH',
                buyerTotalPrice: priceCalc.totalPriceETH + ' ETH',
                contractFee: priceCalc.feeETH + ' ETH',
                feePercentage: '5%'
            },
            receipt: {
                transactionHash: receipt.transactionHash
            }
        });
    } catch (error) {
        console.error('Error listando juego:', error);
        res.status(500).json({ 
            success: false, 
            message: error.message 
        });
    }
});

// ========== NUEVAS RUTAS DE GESTIÓN ==========


router.post('/nft/:gameId/remove-from-sale', async (req, res) => {
    try {
        const { gameId } = req.params;
        const { account } = req.body;

        if (!account) {
            return res.status(400).json({ 
                success: false, 
                message: 'Account es requerido' 
            });
        }

        const receipt = await gameStoreController.removeFromSale(parseInt(gameId), account);
        
        res.json({ 
            success: true, 
            message: 'Juego removido de la venta',
            receipt: {
                transactionHash: receipt.transactionHash
            }
        });
    } catch (error) {
        console.error('Error removiendo juego de venta:', error);
        res.status(500).json({ 
            success: false, 
            message: error.message 
        });
    }
});


router.put('/nft/:gameId/price', async (req, res) => {
    try {
        const { gameId } = req.params;
        const { price, account } = req.body; // 'price' es el NETO que quiere el vendedor

        if (!price || !account) {
            return res.status(400).json({ 
                success: false, 
                message: 'Price y account son requeridos' 
            });
        }

        const receipt = await gameStoreController.updateGamePrice(
            parseInt(gameId), 
            price, // Precio NETO
            account
        );
        
        // Obtener cálculo
        const priceCalc = gameStoreController.calculatePriceWithFee(price);
        
        res.json({ 
            success: true, 
            message: 'Precio actualizado exitosamente',
            priceDetails: {
                sellerNetPrice: price + ' ETH',
                buyerTotalPrice: priceCalc.totalPriceETH + ' ETH',
                contractFee: priceCalc.feeETH + ' ETH',
                feePercentage: '5%'
            },
            receipt: {
                transactionHash: receipt.transactionHash
            }
        });
    } catch (error) {
        console.error('Error actualizando precio:', error);
        res.status(500).json({ 
            success: false, 
            message: error.message 
        });
    }
});


router.put('/nft/:gameId/info', async (req, res) => {
    try {
        const { gameId } = req.params;
        const { name, description, image, genre, price, account } = req.body;

        if (!name || !description || !image || !genre || !price || !account) {
            return res.status(400).json({ 
                success: false, 
                message: 'Todos los campos son requeridos' 
            });
        }

        const receipt = await gameStoreController.updateGameInfo(
            parseInt(gameId), 
            name, 
            description, 
            image, 
            genre, 
            price, 
            account
        );
        
        res.json({ 
            success: true, 
            message: 'Información del juego actualizada',
            receipt: {
                transactionHash: receipt.transactionHash
            }
        });
    } catch (error) {
        console.error('Error actualizando información:', error);
        res.status(500).json({ 
            success: false, 
            message: error.message 
        });
    }
});


router.post('/nft/:gameId/disable', async (req, res) => {
    try {
        const { gameId } = req.params;
        const { account } = req.body;

        if (!account) {
            return res.status(400).json({ 
                success: false, 
                message: 'Account es requerido' 
            });
        }

        const receipt = await gameStoreController.disableGame(parseInt(gameId), account);
        
        res.json({ 
            success: true, 
            message: 'Juego desactivado',
            receipt: {
                transactionHash: receipt.transactionHash
            }
        });
    } catch (error) {
        console.error('Error desactivando juego:', error);
        res.status(500).json({ 
            success: false, 
            message: error.message 
        });
    }
});


router.post('/nft/:gameId/enable', async (req, res) => {
    try {
        const { gameId } = req.params;
        const { account } = req.body;

        if (!account) {
            return res.status(400).json({ 
                success: false, 
                message: 'Account es requerido' 
            });
        }

        const receipt = await gameStoreController.enableGame(parseInt(gameId), account);
        
        res.json({ 
            success: true, 
            message: 'Juego reactivado',
            receipt: {
                transactionHash: receipt.transactionHash
            }
        });
    } catch (error) {
        console.error('Error reactivando juego:', error);
        res.status(500).json({ 
            success: false, 
            message: error.message 
        });
    }
});

// ========== RUTAS DE CONSULTA ==========


router.get('/nft/marketplace', async (req, res) => {
    try {
        const games = await gameStoreController.getGamesForSale();
        res.json({ 
            success: true, 
            games,
            count: games.length
        });
    } catch (error) {
        console.error('Error obteniendo juegos:', error);
        res.status(500).json({ 
            success: false, 
            message: error.message 
        });
    }
});


router.get('/nft/games', async (req, res) => {
    try {
        const games = await gameStoreController.getAllGames();
        res.json({ 
            success: true, 
            games,
            count: games.length
        });
    } catch (error) {
        console.error('Error obteniendo todos los juegos:', error);
        res.status(500).json({ 
            success: false, 
            message: error.message 
        });
    }
});


router.get('/nft/:gameId', async (req, res) => {
    try {
        const { gameId } = req.params;
        const gameDetails = await gameStoreController.getGameDetails(parseInt(gameId));
        
        res.json({ 
            success: true, 
            game: gameDetails
        });
    } catch (error) {
        console.error('Error obteniendo detalles del juego:', error);
        res.status(500).json({ 
            success: false, 
            message: error.message 
        });
    }
});


router.get('/nft/user/:userAddress', async (req, res) => {
    try {
        const { userAddress } = req.params;
        const userGames = await gameStoreController.getUserGames(userAddress);
        
        res.json({ 
            success: true, 
            games: userGames,
            count: userGames.length
        });
    } catch (error) {
        console.error('Error obteniendo juegos del usuario:', error);
        res.status(500).json({ 
            success: false, 
            message: error.message 
        });
    }
});

// ========== PAYMENT SPLITTER FUNCTIONS ==========


router.post('/payments/release', async (req, res) => {
    try {
        const { account } = req.body;
        
        if (!account) {
            return res.status(400).json({ 
                success: false, 
                message: 'Account es requerido' 
            });
        }

        const receipt = await gameStoreController.releasePayments(account);
        
        res.json({ 
            success: true, 
            message: 'Pagos liberados exitosamente',
            receipt: {
                transactionHash: receipt.transactionHash
            }
        });
    } catch (error) {
        console.error('Error liberando pagos:', error);
        res.status(500).json({ 
            success: false, 
            message: error.message 
        });
    }
});

// ========== WALLET FUNCTIONS ==========



router.get('/wallet/transactions', async (req, res) => {
    try {
        const transactions = await gameStoreController.getTransactions();
        
        res.json({ 
            success: true, 
            transactions: transactions,
            count: transactions.length
        });
    } catch (error) {
        console.error('Error obteniendo transacciones:', error);
        res.status(500).json({ 
            success: false, 
            message: error.message 
        });
    }
});

router.post('/wallet/transaction/submit', async (req, res) => {
    try {
        const { to, amount, account } = req.body;
        
        if (!to || !amount || !account) {
            return res.status(400).json({ 
                success: false, 
                message: 'To, amount y account son requeridos' 
            });
        }

        const receipt = await gameStoreController.submitTransaction(to, amount, account);
        
        res.json({ 
            success: true, 
            message: 'Transacción enviada exitosamente',
            receipt: {
                transactionHash: receipt.transactionHash
            }
        });
    } catch (error) {
        console.error('Error enviando transacción:', error);
        res.status(500).json({ 
            success: false, 
            message: error.message 
        });
    }
});


router.post('/wallet/transaction/:txId/approve', async (req, res) => {
    try {
        const { txId } = req.params;
        const { account } = req.body;

        if (!account) {
            return res.status(400).json({ 
                success: false, 
                message: 'Account es requerido' 
            });
        }

        const receipt = await gameStoreController.approveTransaction(parseInt(txId), account);
        
        res.json({ 
            success: true, 
            message: 'Transacción aprobada exitosamente',
            receipt: {
                transactionHash: receipt.transactionHash
            }
        });
    } catch (error) {
        console.error('Error aprobando transacción:', error);
        res.status(500).json({ 
            success: false, 
            message: error.message 
        });
    }
});


router.get('/contract/balance', async (req, res) => {
    try {
       
        if (!GAMESTORE_CONTRACT_ADDRESS) {
            return res.status(500).json({ 
                success: false, 
                message: 'GAMESTORE_CONTRACT_ADDRESS no configurado en .env' 
            });
        }

        console.log(' Consultando balance del contrato:', GAMESTORE_CONTRACT_ADDRESS);
        
        const provider = new ethers.providers.JsonRpcProvider(process.env.API_URL);
        const balance = await provider.getBalance(GAMESTORE_CONTRACT_ADDRESS);
        const balanceETH = ethers.utils.formatEther(balance);
        
        console.log(' Balance del contrato:', balanceETH, 'ETH');
        
        res.json({ 
            success: true, 
            balanceWei: balance.toString(),
            balanceETH: balanceETH,
            contractAddress: GAMESTORE_CONTRACT_ADDRESS
        });
    } catch (error) {
        console.error('Error obteniendo balance:', error);
        res.status(500).json({ 
            success: false, 
            message: error.message,
            contractAddress: GAMESTORE_CONTRACT_ADDRESS 
        });
    }
});


router.post('/wallet/transaction/:txId/execute', async (req, res) => {
    try {
        const { txId } = req.params;
        const { account } = req.body;

        if (!account) {
            return res.status(400).json({ 
                success: false, 
                message: 'Account es requerido' 
            });
        }

        const receipt = await gameStoreController.executeTransaction(parseInt(txId), account);
        
        res.json({ 
            success: true, 
            message: 'Transacción ejecutada exitosamente',
            receipt: {
                transactionHash: receipt.transactionHash
            }
        });
    } catch (error) {
        console.error('Error ejecutando transacción:', error);
        res.status(500).json({ 
            success: false, 
            message: error.message 
        });
    }
});

// ========== UTILITY FUNCTIONS ==========


router.get('/balance', async (req, res) => {
    try {
        const balance = await gameStoreController.getBalance();
        
        res.json({ 
            success: true, 
            balance: balance.toString(),
            balanceETH: ethers.utils.formatEther(balance)
        });
    } catch (error) {
        console.error('Error obteniendo balance:', error);
        res.status(500).json({ 
            success: false, 
            message: error.message 
        });
    }
});


router.get('/info', async (req, res) => {
    try {
        const contractInfo = await gameStoreController.getContractInfo();
        
        res.json({ 
            success: true, 
            ...contractInfo
        });
    } catch (error) {
        console.error('Error obteniendo información del contrato:', error);
        res.status(500).json({ 
            success: false, 
            message: error.message 
        });
    }
});


router.get('/nft/owned/:userAddress', async (req, res) => {
    try {
        const { userAddress } = req.params;
        const ownedGames = await gameStoreController.getOwnedGames(userAddress);
        
        res.json({ 
            success: true, 
            games: ownedGames,
            count: ownedGames.length
        });
    } catch (error) {
        console.error('Error obteniendo juegos poseídos:', error);
        res.status(500).json({ 
            success: false, 
            message: error.message 
        });
    }
});

router.get('/health', async (req, res) => {
    try {
        const balance = await gameStoreController.getBalance();
        
        res.json({ 
            success: true, 
            status: 'Contract is live and connected',
            balance: ethers.utils.formatEther(balance) + ' ETH',
            contractAddress: process.env.GAMESTORE_CONTRACT_ADDRESS,
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        res.status(500).json({ 
            success: false, 
            message: 'Contract connection error: ' + error.message 
        });
    }
});

module.exports = router;