const express = require('express');
const router = express.Router();
const examenController = require('../controllers/examenController');
const { ethers } = require('ethers');

router.post('/deposit', async (req, res) => {
    try {
        const { amount, account } = req.body;
        const receipt = await examenController.deposit(amount, account);
        res.json({ success: true, receipt });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

router.post('/transaction', async (req, res) => {
    try {
        const { to, amount, account } = req.body;
        const receipt = await examenController.submitTransaction(to, amount, account);
        res.json({ success: true, receipt });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

router.post('/transaction/:txId/approve', async (req, res) => {
    try {
        const { txId } = req.params;
        const { account } = req.body;
        const receipt = await examenController.approveTransaction(parseInt(txId), account);
        res.json({ success: true, receipt });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

router.post('/transaction/:txId/execute', async (req, res) => {
    try {
        const { txId } = req.params;
        const { account } = req.body;
        const receipt = await examenController.executeTransaction(parseInt(txId), account);
        res.json({ success: true, receipt });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

router.post('/product', async (req, res) => {
    try {
        const { name, price, account } = req.body;
        const receipt = await examenController.addProduct(name, price, account);
        res.json({ success: true, receipt });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

router.put('/product/:productId', async (req, res) => {
    try {
        const { productId } = req.params;
        const { name, price, active, account } = req.body;
        const receipt = await examenController.updateProduct(parseInt(productId), name, price, active, account);
        res.json({ success: true, receipt });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

router.post('/product/:productId/buy', async (req, res) => {
    try {
        const { productId } = req.params;
        const { account } = req.body;

        if (!account) {
            return res.status(400).json({ 
                success: false, 
                message: 'Cuenta es requerida' 
            });
        }

        const product = await examenController.getProductDetails(parseInt(productId));
        
        if (!product.active) {
            return res.status(400).json({ 
                success: false, 
                message: 'Producto no disponible' 
            });
        }

        const priceInWei = ethers.BigNumber.from(product.price);
        const receipt = await examenController.buyProduct(parseInt(productId), priceInWei, account);
        
        res.json({ 
            success: true, 
            message: 'Producto comprado exitosamente',
            product: {
                id: productId,
                name: product.name,
                price: product.priceFormatted
            },
            receipt
        });
    } catch (error) {
        console.error('Error comprando producto:', error);
        res.status(500).json({ 
            success: false, 
            message: error.message 
        });
    }
});

router.post('/product/:productId/disable', async (req, res) => {
    try {
        const { productId } = req.params;
        const { account } = req.body;
        const receipt = await examenController.disableProduct(parseInt(productId), account);
        res.json({ success: true, receipt });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

router.post('/release-payments', async (req, res) => {
    try {
        const { account } = req.body;
        const receipt = await examenController.releasePayments(account);
        res.json({ success: true, receipt });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

router.get('/balance', async (req, res) => {
    try {
        const balance = await examenController.getBalance();
        res.json({ success: true, balance });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

router.get('/transactions', async (req, res) => {
    try {
        const transactions = await examenController.getTransactions();
        res.json({ success: true, transactions });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

router.get('/transaction/:txId/approvals', async (req, res) => {
    try {
        const { txId } = req.params;
        const approvals = await examenController.getTransactionApprovals(parseInt(txId));
        res.json({ success: true, approvals });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

router.get('/products', async (req, res) => {
    try {
        const products = await examenController.getAllProducts();
        res.json({ success: true, products });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

router.get('/product/:productId', async (req, res) => {
    try {
        const { productId } = req.params;
        const product = await examenController.getProductDetails(parseInt(productId));
        res.json({ success: true, product });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

module.exports = router;