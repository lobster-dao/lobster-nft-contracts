require('@nomiclabs/hardhat-truffle5');
const fs = require('fs');

// eslint-disable-next-line
task('deploy-minter-and-nft', 'Deploy Minter and NFT').setAction(async (__, {network}) => {
  const LobstersNft = await artifacts.require('LobstersNft');
  const LobstersMinter = await artifacts.require('LobstersMinter');
  const ERC20 = await artifacts.require('IERC20');

  const { web3 } = LobstersNft;

  const [deployer] = await web3.eth.getAccounts();
  console.log('deployer', deployer);
  const sendOptions = { from: deployer };

  // kovan:
  // const linkAddress = '0xa36085F69e2889c224210F603D836748e7dC0088';
  // const vrfCoordinatorAddress = '0xdD3782915140c8f3b190B5D67eAc6dc5760C46E9';
  // const chainlinkKeyhash = '0x6c3699283bda56ad74f6b855546325b68d482e983852a7a82979cc4807b641f4';

  // rinkeby:
  const linkAddress = '0x01BE23585060835E02B77ef475b0Cc51aA1e0709';
  const vrfCoordinatorAddress = '0xb3dccb4cf7a26f6cf6b120cf5a73875b7bbc655b';
  const chainlinkKeyhash = '0x2ed0feb3e7fd2022120aa84fab1945545a9f2ffc9076fd6156fa96eaff4c1311';

  const linkFee = web3.utils.toWei('0.1', 'ether');
  const maxTokens = '6751';

  const linkToken = await ERC20.at(linkAddress);

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

  await linkToken.transfer(lobstersNft.address, linkFee, sendOptions);

  await lobstersNft.seedReveal(sendOptions);
  await lobstersNft.setBaseURI('ipfs://bafybeigktkztk4iovkljhxk74rucfwitajnwleebzbvk34hdeqhsppnnty/', false);

  console.log('seed:', await lobstersNft.contract.methods.seed().call());

  for(let i = 0; i < 2; i++) {
    await new Promise((resolve) => {
      setTimeout(resolve, 1000 * 60);
    });
    console.log('seed after', i + 1, 'minutes:', await lobstersNft.contract.methods.seed().call());
  }

  const treeData = JSON.parse(fs.readFileSync('./data/export.json', {encoding: 'utf8'}));

  const lobsterMinter = await LobstersMinter.new(lobstersNft.address, treeData.treeRoot, [], []);
  await lobstersNft.setMinter(lobsterMinter.address, {from: deployer});
  console.log('lobstersNft.address', lobstersNft.address);
  console.log('lobsterMinter.address', lobsterMinter.address);

  if (network.name === 'mainnet') {
    return;
  }

  let totalCount = 0;
  for (let i = 0; i < 2; i++) {
    const {address, count, proof} = treeData.treeLeaves[i];
    totalCount += count;
    console.log('address', address);
    console.log('verifyClaim', await lobsterMinter.verifyClaim(address, count.toString(), proof));
    await lobsterMinter.claim(address, count.toString(), proof);
  }
  console.log('mintedCount', totalCount);
});
