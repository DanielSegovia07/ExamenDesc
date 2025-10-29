require('dotenv').config({ path: require('find-config')('.env') });
const { ethers } = require('ethers');
const contractABI = require('../artifacts/contracts/Examen.sol/Examen.json');
const { createTransaction, getContract, depositToContract } = require('../utils/contractHelper');
const { EXAMEN_CONTRACT } = process.env;

async function sendTransaction(method, params, account) {
    return await createTransaction(EXAMEN_CONTRACT, contractABI.abi, method, params, account);
}

async function submitTransaction(to, amount, account) {
    const amountWei = ethers.utils.parseEther(amount.toString());
    const receipt = await sendTransaction('SubmitTransaction', [to, amountWei], account);
    return receipt;
}

async function approveTransaction(txid, account) {
    const receipt = await sendTransaction('approveTransaction', [txid], account);
    return receipt;
}

async function executeTransaction(txid, account) {
    const receipt = await sendTransaction('executeTransaction', [txid], account);
    return receipt;
}

async function deposit(amount, account) {
    return await depositToContract(EXAMEN_CONTRACT, contractABI.abi, amount, account);
}

async function releasePayments(account) {
    const receipt = await sendTransaction('releasePayments', [], account);
    return receipt;
}

async function addProduct(name, price, account) {
    const priceWei = ethers.utils.parseEther(price.toString());
    const receipt = await sendTransaction('addProduct', [name, priceWei], account);
    return receipt;
}

async function updateProduct(productId, name, price, active, account) {
    const priceWei = price ? ethers.utils.parseEther(price.toString()) : 0;
    const receipt = await sendTransaction('updateProduct', [productId, name, priceWei, active], account);
    return receipt;
}

async function buyProduct(productId, value, account) {
    const accountInfo = getAccountFromIndex(parseInt(account));
    const provider = new ethers.providers.JsonRpcProvider(process.env.API_URL);
    const wallet = new ethers.Wallet(accountInfo.privateKey, provider);
    const examenContract = new ethers.Contract(EXAMEN_CONTRACT, contractABI.abi, wallet);
    const tx = await examenContract.buyProduct(productId, { value: value });
    const receipt = await tx.wait();
    return receipt;
}

async function disableProduct(productId, account) {
    const receipt = await sendTransaction('disableProduct', [productId], account);
    return receipt;
}

async function getBalance() {
    const examenContract = getContract(EXAMEN_CONTRACT, contractABI.abi);
    const balance = await examenContract.getBalance();
    return {
        ether: ethers.utils.formatEther(balance)
    };
}

async function getTransactions() {
    const examenContract = getContract(EXAMEN_CONTRACT, contractABI.abi);
    const transactions = await examenContract.getTransactions();
    return transactions.map(tx => ({
        txId: tx.txId,
        to: tx.to,
        amount: ethers.utils.formatEther(tx.amount),
        approvalCount: tx.approvalCount.toString(),
        executed: tx.executed
    }));
}

async function getTransactionApprovals(txId) {
    const examenContract = getContract(EXAMEN_CONTRACT, contractABI.abi);
    const approvals = await examenContract.getTransactionApprovals(txId);
    return approvals.map(approval => ({
        approver: approval.approver,
        timestamp: new Date(approval.timestamp * 1000).toISOString(),
        approvalId: approval.approvalId
    }));
}

async function getAllProducts() {
    const examenContract = getContract(EXAMEN_CONTRACT, contractABI.abi);
    const products = await examenContract.getAllProducts();
    return products.map(product => ({
        id: product.id.toString(),
        productId: product.productId,
        name: product.name,
        price: ethers.utils.formatEther(product.price),
        seller: product.seller,
        active: product.active
    }));
}

async function getProductDetails(productId) {
    const examenContract = getContract(EXAMEN_CONTRACT, contractABI.abi);
    const products = await examenContract.getAllProducts();

    if (productId >= products.length) {
        throw new Error('Product ID does not exist');
    }

    const product = products[productId];
    return {
        id: product.id.toString(),
        productId: product.productId,
        name: product.name,
        price: ethers.BigNumber.from(product.price).toString(),
        priceFormatted: ethers.utils.formatEther(product.price),
        seller: product.seller,
        active: product.active
    };
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
    deposit,
    submitTransaction,
    approveTransaction,
    executeTransaction,
    releasePayments,
    getBalance,
    getTransactions,
    getTransactionApprovals,
    addProduct,
    updateProduct,
    buyProduct,
    disableProduct,
    getAllProducts,
    getProductDetails
};