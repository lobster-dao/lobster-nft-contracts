require('@nomiclabs/hardhat-ethers');

const fs = require('fs');

// eslint-disable-next-line
task('deploy-minter-and-nft', 'Deploy Minter and NFT').setAction(async (__, {ethers, network}) => {
  const LobstersNft = await ethers.getContractFactory('LobstersNft');
  const LobstersMinter = await ethers.getContractFactory('LobstersMinter');

  const [deployer] = await ethers.getSigners().then(signers => signers.map(s => s.address));

  console.log('deployer', deployer);
  const sendOptions = {};

  const {impersonateAccount} = require('../helpers')(ethers);

  // kovan:
  // const linkAddress = '0xa36085F69e2889c224210F603D836748e7dC0088';
  // const vrfCoordinatorAddress = '0xdD3782915140c8f3b190B5D67eAc6dc5760C46E9';
  // const chainlinkKeyhash = '0x6c3699283bda56ad74f6b855546325b68d482e983852a7a82979cc4807b641f4';

  // rinkeby:
  // const linkAddress = '0x01BE23585060835E02B77ef475b0Cc51aA1e0709';
  // const vrfCoordinatorAddress = '0xb3dccb4cf7a26f6cf6b120cf5a73875b7bbc655b';
  // const chainlinkKeyhash = '0x2ed0feb3e7fd2022120aa84fab1945545a9f2ffc9076fd6156fa96eaff4c1311';

  // mainnet:
  const linkAddress = '0x514910771AF9Ca656af840dff83E8264EcF986CA';
  const vrfCoordinatorAddress = '0xf0d54349aDdcf704F77AE15b96510dEA15cb7952';
  const chainlinkKeyhash = '0xAA77729D3466CA35AE8D28B3BBAC7CC36A5031EFDC430821C02BC31A238AF445';

  // return console.log('getBalance', ethers.utils.formatEther(await ethers.provider.getBalance(deployer)));

  let linkFee;
  if (network.name === 'rinkeby') {
    linkFee = ethers.utils.parseEther('0.1');
  } else {
    linkFee = ethers.utils.parseEther('2');
  }
  const maxTokens = '6751';

  const linkToken = await ethers.getContractAt('IERC20', linkAddress);
  console.log('linkToken.address', linkToken.address, 'linkFee', linkFee);

  const lobstersNft = await LobstersNft.deploy(
    'lobsterdao',
    'LOBS',
    maxTokens,
    linkAddress,
    vrfCoordinatorAddress,
    linkFee,
    chainlinkKeyhash,
    sendOptions
  );
  console.log('lobstersNft.address', lobstersNft.address);

  await lobstersNft.setDefaultURI('ipfs://bafkreig3rvuwgsci7qkj32asqr6m2kumtvzx5w4cvhxl2riz3cl2hqfrgm');
  await lobstersNft.setBaseURI('ipfs://bafybeihg7s73hxgihfzz6ok5y7ybcx4lvhub43qc5grk4iyk4kptys63d4/', false);

  const treeData = JSON.parse(fs.readFileSync('./data/export.json', {encoding: 'utf8'}));

  const boredYachtClubCollection = '0xBC4CA0EdA7647A8aB7C2061c2E118A18a936f13D';
  const lootCollection = '0xFF9C1b15B16263C61d017ee9F65C50e4AE0113D7';
  const cryptoPunksCollection = '0xb47e3cd837ddf8e4c57f05d70ab865de6e193bbb';

  const lobsterMinter = await LobstersMinter.deploy(lobstersNft.address, treeData.treeRoot, [
    boredYachtClubCollection,
    lootCollection,
    cryptoPunksCollection
  ], [
    75,
    50,
    125
  ], sendOptions);
  console.log('lobsterMinter.maxClaimAllowedByCollection(boredYachtClubCollection)', await lobsterMinter.maxClaimAllowedByCollection(boredYachtClubCollection).then(r => r.toString(10)));
  console.log('lobsterMinter.maxClaimAllowedByCollection(lootCollection)', await lobsterMinter.maxClaimAllowedByCollection(lootCollection).then(r => r.toString(10)));
  console.log('lobsterMinter.maxClaimAllowedByCollection(cryptoPunksCollection)', await lobsterMinter.maxClaimAllowedByCollection(cryptoPunksCollection).then(r => r.toString(10)));

  await lobstersNft.setMinter(lobsterMinter.address, {from: deployer});
  console.log('lobstersNft.address', lobstersNft.address);
  console.log('lobsterMinter.address', lobsterMinter.address);

  if (network.name === 'mainnet') {
    await lobstersNft.transferOwnership('0x7BAFC0D5c5892f2041FD9F2415A7611042218e22');
    return;
  }

  if (network.name === 'mainnetfork') {
    const linkHolder = '0xbe6977e08d4479c0a6777539ae0e8fa27be4e9d6';
    await impersonateAccount(linkHolder);
    await linkToken.connect(await ethers.provider.getSigner(linkHolder)).transfer(deployer, linkFee, {from: linkHolder});
  }

  await linkToken.transfer(lobstersNft.address, linkFee, sendOptions);
  await new Promise((r) => setTimeout(r, 1000 * 120));
  console.log('linkToken.transfer success');
  await lobstersNft.seedReveal(sendOptions);

  const testAcc = '0x69021ae8769586d56791d29615959997c2012b99';
  await impersonateAccount(testAcc);

  console.log('lobstersNft.totalSupply() before', await lobstersNft.totalSupply().then(r => r.toString(10)));
  await lobsterMinter.connect(await ethers.provider.getSigner(testAcc)).claimByCollection(cryptoPunksCollection, ['2859', '5900']);
  console.log('lobstersNft.totalSupply() after', await lobstersNft.totalSupply().then(r => r.toString(10)));
  console.log('lobstersNft.balanceOf(testAcc) after', await lobstersNft.balanceOf(testAcc).then(r => r.toString(10)));

  console.log('lobsterMinter.maxClaimAllowedByCollection(boredYachtClubCollection)', await lobsterMinter.maxClaimAllowedByCollection(boredYachtClubCollection).then(r => r.toString(10)));
  console.log('lobsterMinter.maxClaimAllowedByCollection(lootCollection)', await lobsterMinter.maxClaimAllowedByCollection(lootCollection).then(r => r.toString(10)));
  console.log('lobsterMinter.maxClaimAllowedByCollection(cryptoPunksCollection)', await lobsterMinter.maxClaimAllowedByCollection(cryptoPunksCollection).then(r => r.toString(10)));

  for (let i = 0; i < 2; i++) {
    const {address, count, proof} = treeData.treeLeaves[i];
    console.log('address', address, 'count', count);
    console.log('verifyClaim', await lobsterMinter.verifyClaim(address, count.toString(), proof));
    await lobsterMinter.claim(address, count.toString(), count.toString(), proof);
  }
  await lobsterMinter.connect(await ethers.provider.getSigner(testAcc)).claimByCollection(cryptoPunksCollection, ['9584']);
  console.log('lobstersNft.totalSupply() after', await lobstersNft.totalSupply().then(r => r.toString(10)))
});
