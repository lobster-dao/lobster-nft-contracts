# Lobster NFT smart contracts

## Install and test
```
yarn # or npm i
npm run compile
npm t
```

## Deploy
1. Put private key without 0x to ~/.ethereum/{networkName}
2. Run hardhat task in desired network:
```
npx hardhat deploy-minter-and-nft --network {networkName}
```
