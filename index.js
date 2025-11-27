const express = require('express');
const app = express();
const bodyParser = require('body-parser');


const gameStoreRoutes = require('./routes/gamestore');


app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());
app.use(express.static('public'));


app.use('/api/gamestore', gameStoreRoutes);


app.get('/health', (req, res) => {
    res.json({ 
        status: 'OK', 
        message: 'GameStore Web3 Backend running',
        timestamp: new Date().toISOString(),
        version: '2.0.0',
        contract: process.env.GAMESTORE_CONTRACT_ADDRESS || 'Not deployed',
        routes: {
            gamestore: '/api/gamestore'
        }
    });
});


app.get('/', (req, res) => {
    res.json({
        message: 'Bienvenido a GameStore Web3 API',
        description: 'Marketplace descentralizado de videojuegos NFT - Contrato Único',
        contract: process.env.GAMESTORE_CONTRACT_ADDRESS || 'Not deployed',
        endpoints: {
            health: '/health',
            contractInfo: '/api/gamestore/info',
            nftMarketplace: '/api/gamestore/nft/marketplace',
            mintGame: 'POST /api/gamestore/nft/mint',
            buyGame: 'POST /api/gamestore/nft/:id/buy'
        }
    });
});

app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).json({ 
        success: false, 
        message: 'Something went wrong!',
        error: err.message 
    });
});


app.use('*', (req, res) => {
    res.status(404).json({
        success: false,
        message: 'Route not found',
        availableRoutes: [
            'GET /health',
            'GET /api/gamestore/info',
            'GET /api/gamestore/nft/marketplace',
            'POST /api/gamestore/nft/mint',
            'POST /api/gamestore/nft/:gameId/buy'
        ]
    });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`GameStore Web3 Backend running on port ${PORT}`);
    console.log(`Health check: http://localhost:${PORT}/health`);
    console.log(`Contract info: http://localhost:${PORT}/api/gamestore/info`);
    console.log(`Marketplace: http://localhost:${PORT}/api/gamestore/nft/marketplace`);
    console.log(`Frontend: http://localhost:${PORT}`);
});