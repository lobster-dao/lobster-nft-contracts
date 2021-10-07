require('@nomiclabs/hardhat-truffle5');
require('@nomiclabs/hardhat-etherscan');
require('solidity-coverage');
require('hardhat-contract-sizer');
require('hardhat-gas-reporter');

require('./tasks/deployMinterAndNft');

const fs = require('fs');
const _ = require('lodash');

function getAccounts(network) {
  const path = require('os').homedir() + '/.ethereum/' + network;
  return fs.existsSync(path) ? [_.trim('0x' + fs.readFileSync(path, { encoding: 'utf8' }))] : [];
}

const config = {
  analytics: {
    enabled: false,
  },
  contractSizer: {
    alphaSort: false,
    runOnCompile: true,
  },
  defaultNetwork: 'hardhat',
  gasReporter: {
    currency: 'USD',
    enabled: !!process.env.REPORT_GAS,
  },
  mocha: {
    timeout: 70000,
  },
  networks: {
    hardhat: {
      chainId: 31337,
      allowUnlimitedContractSize: true,
      gas: 30000000,
      blockGasLimit: 30000000
    },
    ganache: {
      url: 'http://127.0.0.1:8945',
      defaultBalanceEther: 1e9,
      hardfork: 'muirGlacier',
    },
    mainnet: {
      url: 'https://mainnet-eth.compound.finance',
      accounts: getAccounts('mainnet'),
      gasPrice: 100 * 1e9,
      gasMultiplier: 1.2,
      timeout: 2000000,
      chainId: 1,
    },
    mainnetfork: {
      url: 'http://127.0.0.1:8545/',
      // accounts: getAccounts('mainnet'),
      gasPrice: 100 * 1e9,
      gasMultiplier: 2,
      timeout: 2000000,
    },
    local: {
      url: 'http://127.0.0.1:8545',
    },
    kovan: {
      url: 'https://kovan-eth.compound.finance',
      accounts: getAccounts('kovan'),
      gasPrice: 1e9,
      gasMultiplier: 2,
    },
    rinkeby: {
      url: 'https://eth-rinkeby.alchemyapi.io/v2/W9wVuXYDjzn70tRBiHtDey4oKOMezvs-',
      accounts: getAccounts('rinkeby'),
      gasPrice: 1e9,
      gasMultiplier: 2,
    },
    coverage: {
      url: 'http://127.0.0.1:8555',
    },
  },
  paths: {
    artifacts: './artifacts',
    cache: './cache',
    coverage: './coverage',
    coverageJson: './coverage.metadata',
    root: './',
    sources: process.env.SOURCES ? './' + process.env.SOURCES : './contracts',
    tests: './test',
  },
  solidity: {
    settings: {
      optimizer: {
        enabled: !!process.env.ETHERSCAN_KEY || process.env.COMPILE_TARGET === 'release',
        runs: 200,
      },
    },
    version: '0.6.12',
  },
  typechain: {
    outDir: 'typechain',
    target: 'ethers-v5',
  },
  etherscan: {
    apiKey: process.env.ETHERSCAN_KEY
  }
};

module.exports = config;
