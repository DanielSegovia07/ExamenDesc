require('dotenv').config({path:require('find-config')('.env')})
require('@nomiclabs/hardhat-ethers')

/** @type import('hardhat/config').HardhatUserConfig */

console.log(process.env.API_URL)
console.log(process.env.PRIVATE_KEY)

module.exports = {
  solidity: {
    version: "0.8.28",
    settings: {
      optimizer: {
        enabled: true,
        runs: 200
      },
      viaIR: true  
    }
  },
  defaultNetwork: 'sepolia',
  networks: {
    sepolia: {
      url: process.env.API_URL,
      accounts: [`0x${process.env.PRIVATE_KEY}`]
    }
  }
};