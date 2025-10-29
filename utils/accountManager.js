require('dotenv').config({ path: require('find-config')('.env') })
const {ethers} = require('ethers')
const {API_URL,PUBLIC_KEYS,PRIVATE_KEYS} = process.env

const publickeys = PUBLIC_KEYS.split(',')
const privatekeys = PRIVATE_KEYS.split(',')
const provider = new ethers.providers.JsonRpcProvider(API_URL)

function getWallet(account){
    if(account>= privatekeys.length){
        throw new Error(`Account ${account} no existe`)
    }
    return new ethers.Wallet(privatekeys[account],provider)
}
function getPublicKey(account){
    if(account>=publickeys.length){
        throw new Error(`Account ${account} no existe`)
    }
    return publickeys[account]
}

function getAllAcounts(){
    return publickeys.map((key,index)=>({index:index,address:key}))
}
module.exports ={
    provider,
    getWallet,
    getPublicKey,
    getAllAcounts,
    publickeys,
    privatekeys
}