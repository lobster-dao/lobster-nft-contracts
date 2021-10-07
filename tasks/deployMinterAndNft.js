require('@nomiclabs/hardhat-truffle5');
const fs = require('fs');

// eslint-disable-next-line
task('deploy-minter-and-nft', 'Deploy Minter and NFT').setAction(async (__, {ethers, network}) => {
  const LobstersNft = await artifacts.require('LobstersNft');
  const LobstersMinter = await artifacts.require('LobstersMinter');
  const ERC20 = await artifacts.require('IERC20');

  const { web3 } = LobstersNft;

  const [deployer] = await web3.eth.getAccounts();
  console.log('deployer', deployer);
  const sendOptions = {
    from: deployer,
    maxFeePerGas: '0x' + web3.utils.toBN(150e9.toString()).toString('hex'),
    maxPriorityFeePerGas: '0x' + web3.utils.toBN(1e9.toString()).toString('hex')
  };

  const {impersonateAccount, callContract} = require('../helpers')(web3, ethers);

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

  let linkFee;
  if (network.name === 'mainnet' || network.name === 'mainnet-fork') {
    linkFee = web3.utils.toWei('2', 'ether');
  } else {
    linkFee = web3.utils.toWei('0.1', 'ether');
  }
  const maxTokens = '6751';

  const linkToken = await ERC20.at(linkAddress);
  console.log('linkToken.address', linkToken.address);

  const lobstersNft = await LobstersNft.new(
    'LOBSTERS',
    'LOBSTERS',
    maxTokens,
    linkAddress,
    vrfCoordinatorAddress,
    linkFee,
    chainlinkKeyhash,
    sendOptions
  );
  console.log('lobstersNft.address', lobstersNft.address);

  await linkToken.transfer(lobstersNft.address, linkFee, sendOptions);

  await lobstersNft.seedReveal(sendOptions);
  await lobstersNft.setBaseURI('ipfs://bafybeigktkztk4iovkljhxk74rucfwitajnwleebzbvk34hdeqhsppnnty/', false);

  console.log('seed:', await callContract(lobstersNft, 'seed'));

  for(let i = 0; i < 2; i++) {
    await new Promise((resolve) => {
      setTimeout(resolve, 1000 * 60);
    });
    console.log('seed after', i + 1, 'minutes:', await callContract(lobstersNft, 'seed'));
  }

  const treeData = JSON.parse(fs.readFileSync('./data/export.json', {encoding: 'utf8'}));

  const lobsterMinter = await LobstersMinter.new(lobstersNft.address, treeData.treeRoot, [], []);
  await lobstersNft.setMinter(lobsterMinter.address, {from: deployer});
  console.log('lobstersNft.address', lobstersNft.address);
  console.log('lobsterMinter.address', lobsterMinter.address);

  if (network.name === 'mainnet') {
    return;
  }

  const testAcc = '0x69021ae8769586d56791d29615959997c2012b99';
  const cryptoPunksCollection = '0xb47e3cd837ddf8e4c57f05d70ab865de6e193bbb';
  await impersonateAccount(testAcc);

  console.log('lobstersNft.totalSupply() before', await callContract(lobstersNft, 'totalSupply'))
  await lobsterMinter.claimByCollection(cryptoPunksCollection, ['2859', '5900'], {from: testAcc});
  console.log('lobstersNft.totalSupply() after', await callContract(lobstersNft, 'totalSupply'))
  console.log('lobstersNft.balanceOf(testAcc) after', await callContract(lobstersNft, 'balanceOf', [testAcc]))

  let totalCount = 0;
  for (let i = 0; i < 2; i++) {
    const {address, count, proof} = treeData.treeLeaves[i];
    totalCount += count;
    console.log('address', address);
    console.log('verifyClaim', await lobsterMinter.verifyClaim(address, count.toString(), proof));
    await lobsterMinter.claim(address, count.toString(), proof);
  }
  await lobsterMinter.claimByCollection(cryptoPunksCollection, ['2859', '5900']);
  console.log('lobstersNft.totalSupply() after', await callContract(lobstersNft, 'totalSupply'))

  console.log('mintedCount', totalCount);
});
