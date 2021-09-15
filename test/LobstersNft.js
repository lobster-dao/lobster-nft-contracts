const { expectRevert } = require('@openzeppelin/test-helpers');
const treeHelper = require('../helpers/tree');
const ethers = require('ethers');
const pIteration = require('p-iteration');
const assert = require('chai').assert;
const MockChainlinkCoordinator = artifacts.require('MockChainlinkCoordinator');
const MockERC20 = artifacts.require('MockERC20');
const LobstersNft = artifacts.require('LobstersNft');
const LobstersMinter = artifacts.require('LobstersMinter');

MockChainlinkCoordinator.numberFormat = 'String';
LobstersNft.numberFormat = 'String';
MockERC20.numberFormat = 'String';
LobstersMinter.numberFormat = 'String';

const { web3 } = LobstersNft;

const { ether, zeroAddress, addBN } = require('../helpers')(web3);

describe('LobstersNft', () => {
  const linkFeeAmount = ether(2);

  let chainLinkCoordinator, linkToken, lobstersNft, lobsterMinter;

  let minter, alice, bob, dan, feeManager, feeReceiver;
  before(async function () {
    [minter, alice, bob, dan, feeManager, feeReceiver] = await web3.eth.getAccounts();
  });

  beforeEach(async () => {
    chainLinkCoordinator = await MockChainlinkCoordinator.new();
    linkToken = await MockERC20.new('LINK', 'LINK', ether(1e6));
  });

  describe('Mint and Claim', () => {
    let treeArr, treeRoot;
    beforeEach(async () => {
      lobstersNft = await LobstersNft.new(
        'LOBSTERS',
        'LOBSTERS',
        '6',
        linkToken.address,
        chainLinkCoordinator.address,
        linkFeeAmount,
        '0x'
      );
      lobsterMinter = await LobstersMinter.new(lobstersNft.address, '0x');
      await lobstersNft.setMinter(lobsterMinter.address, {from: minter});

      treeArr = [{address: alice, count: 1}, {address: bob, count: 2}, {address: dan, count: 3}];
      treeRoot = treeHelper.getTreeRoot(treeArr);
      await lobsterMinter.updateMerkleRoot(treeRoot, {from: minter});
    });

    it('claim should work properly', async () => {
      await expectRevert(lobstersNft.setMinter(alice, {from: alice}), 'Ownable');
      await expectRevert(lobsterMinter.updateMerkleRoot(treeRoot, {from: alice}), 'Ownable');

      await expectRevert(lobstersNft.mint(minter, {from: alice}), 'NOT_THE_MINTER');
      await expectRevert(lobstersNft.mintMultiple(minter, '10', {from: alice}), 'NOT_THE_MINTER');

      const aliceProof = treeHelper.getTreeLeafProof(treeArr, alice);
      const bobProof = treeHelper.getTreeLeafProof(treeArr, bob);

      assert.equal(treeHelper.encode(treeArr[0]), await lobsterMinter.encode(treeArr[0].address, treeArr[0].count));
      assert.equal(treeRoot, await lobsterMinter.merkleRoot());
      assert.equal(treeHelper.verify(treeArr, treeRoot, treeHelper.getHexNode(treeArr, alice), bobProof), false);
      assert.equal(treeHelper.verify(treeArr, treeRoot, treeHelper.getHexNode(treeArr, bob), aliceProof), false);
      assert.equal(treeHelper.verify(treeArr, treeRoot, treeHelper.getHexNode(treeArr, alice), aliceProof), true);

      await expectRevert(lobsterMinter.claim(alice, '1', bobProof), 'INVALID_MERKLE_PROOF');
      await expectRevert(lobsterMinter.claim(bob, '1', aliceProof), 'INVALID_MERKLE_PROOF');
      await expectRevert(lobsterMinter.claim(alice, '2', aliceProof), 'INVALID_MERKLE_PROOF');
      await expectRevert(lobsterMinter.claim(alice, '11', aliceProof), 'INVALID_MERKLE_PROOF');
      await lobsterMinter.claim(alice, '1', aliceProof);

      assert.equal('1', await lobstersNft.balanceOf(alice));
      assert.equal('1', await lobstersNft.totalSupply());
      assert.equal(alice, await lobstersNft.ownerOf('0'));

      await expectRevert(lobsterMinter.claim(alice, '1', aliceProof), 'ALREADY_CLAIMED');

      await lobsterMinter.claim(bob, '2', bobProof);

      assert.equal('1', await lobstersNft.balanceOf(alice));
      assert.equal('2', await lobstersNft.balanceOf(bob));
      assert.equal('3', await lobstersNft.totalSupply());
      assert.equal(alice, await lobstersNft.ownerOf('0'));
      assert.equal(bob, await lobstersNft.ownerOf('1'));
      assert.equal(bob, await lobstersNft.ownerOf('2'));

      const danProof = treeHelper.getTreeLeafProof(treeArr, dan);
      await lobsterMinter.claim(dan, '3', danProof);

      assert.equal('1', await lobstersNft.balanceOf(alice));
      assert.equal('2', await lobstersNft.balanceOf(bob));
      assert.equal('3', await lobstersNft.balanceOf(dan));
      assert.equal('6', await lobstersNft.totalSupply());
      assert.equal(alice, await lobstersNft.ownerOf('0'));
      assert.equal(bob, await lobstersNft.ownerOf('1'));
      assert.equal(bob, await lobstersNft.ownerOf('2'));
      assert.equal(dan, await lobstersNft.ownerOf('3'));
      assert.equal(dan, await lobstersNft.ownerOf('4'));
      assert.equal(dan, await lobstersNft.ownerOf('5'));

      assert.equal(await lobstersNft.totalSupply(), '6');
      assert.equal(await lobstersNft.maxTokens(), '6');

      await lobstersNft.setMinter(minter, {from: minter});
      await expectRevert(lobstersNft.mint(minter, {from: minter}), 'MAX_TOKENS');
    });
  });

  describe('tokenURI generating', () => {
    let treeArr, treeRoot;
    beforeEach(async () => {
      lobstersNft = await LobstersNft.new(
        'LOBSTERS',
        'LOBSTERS',
        '60',
        linkToken.address,
        chainLinkCoordinator.address,
        linkFeeAmount,
        '0x'
      );
      lobsterMinter = await LobstersMinter.new(lobstersNft.address, '0x');
      await lobstersNft.setMinter(lobsterMinter.address, {from: minter});

      treeArr = [{address: alice, count: 10}, {address: bob, count: 20}, {address: dan, count: 30}];
      treeRoot = treeHelper.getTreeRoot(treeArr);
      await lobsterMinter.updateMerkleRoot(treeRoot, {from: minter});

      const aliceProof = treeHelper.getTreeLeafProof(treeArr, alice);
      const bobProof = treeHelper.getTreeLeafProof(treeArr, bob);
      const danProof = treeHelper.getTreeLeafProof(treeArr, dan);

      await lobsterMinter.claim(alice, '10', aliceProof);
      await lobsterMinter.claim(bob, '20', bobProof);
      await lobsterMinter.claim(dan, '30', danProof);
    });

    it('seed with metadata should work properly', async () => {
      assert.equal(await lobstersNft.defaultURI(), '');

      await expectRevert(lobstersNft.setDefaultURI('default.site', {from: alice}), 'Ownable');
      await lobstersNft.setDefaultURI('default.site', {from: minter});

      assert.equal(await lobstersNft.defaultURI(), 'default.site');

      assert.equal(await lobstersNft.tokenURI('1'), 'default.site');

      await expectRevert(lobstersNft.seedReveal({from: alice}), 'Ownable');
      await expectRevert(lobstersNft.seedReveal({from: minter}), 'LINK_BALANCE_NOT_ENOUGH');

      await linkToken.transfer(lobstersNft.address, linkFeeAmount);

      assert.equal(await lobstersNft.seed(), '0');

      const randomId = '1122334455667788990011223344556677889900';
      await lobstersNft.seedReveal({from: minter});
      await chainLinkCoordinator.sendRandom(lobstersNft.address, randomId);
      assert.equal(await lobstersNft.seed(), randomId);

      await expectRevert(lobstersNft.seedReveal({from: minter}), 'SEED_ALREADY_GENERATED');
      await expectRevert(chainLinkCoordinator.sendRandom(lobstersNft.address, randomId), 'SEED_ALREADY_GENERATED');

      assert.equal(await lobstersNft.metadataOf('0'), '40');
      assert.equal(await lobstersNft.metadataOf('1'), '31');
      assert.equal(await lobstersNft.metadataOf('2'), '56');
      assert.equal(await lobstersNft.metadataOf('3'), '35');
      assert.equal(await lobstersNft.metadataOf('4'), '53');
      assert.equal(await lobstersNft.metadataOf('5'), '16');
      assert.equal(await lobstersNft.metadataOf('6'), '19');
      assert.equal(await lobstersNft.metadataOf('48'), '9');
      assert.equal(await lobstersNft.metadataOf('49'), '50');
      assert.equal(await lobstersNft.metadataOf('58'), '2');
      assert.equal(await lobstersNft.metadataOf('59'), '11');

      await expectRevert(lobstersNft.setBaseURI('https://site.com/', false, {from: alice}), 'Ownable');
      await lobstersNft.setBaseURI('https://site.com/', false, {from: minter});
      assert.equal(await lobstersNft.finalBaseURI(), false);
      assert.equal(await lobstersNft.tokenURI('0'), 'https://site.com/40');
      assert.equal(await lobstersNft.tokenURI('1'), 'https://site.com/31');
      assert.equal(await lobstersNft.tokenURI('2'), 'https://site.com/56');
      assert.equal(await lobstersNft.tokenURI('3'), 'https://site.com/35');
      assert.equal(await lobstersNft.tokenURI('4'), 'https://site.com/53');
      assert.equal(await lobstersNft.tokenURI('5'), 'https://site.com/16');
      assert.equal(await lobstersNft.tokenURI('6'), 'https://site.com/19');
      assert.equal(await lobstersNft.tokenURI('48'), 'https://site.com/9');
      assert.equal(await lobstersNft.tokenURI('49'), 'https://site.com/50');
      assert.equal(await lobstersNft.tokenURI('58'), 'https://site.com/2');
      assert.equal(await lobstersNft.tokenURI('59'), 'https://site.com/11');

      await lobstersNft.setBaseURI('https://site2.com/', true, {from: minter});
      assert.equal(await lobstersNft.finalBaseURI(), true);
      assert.equal(await lobstersNft.tokenURI('0'), 'https://site2.com/40');
      assert.equal(await lobstersNft.tokenURI('1'), 'https://site2.com/31');
      assert.equal(await lobstersNft.tokenURI('2'), 'https://site2.com/56');
      assert.equal(await lobstersNft.tokenURI('3'), 'https://site2.com/35');
      assert.equal(await lobstersNft.tokenURI('4'), 'https://site2.com/53');
      assert.equal(await lobstersNft.tokenURI('5'), 'https://site2.com/16');
      assert.equal(await lobstersNft.tokenURI('6'), 'https://site2.com/19');
      assert.equal(await lobstersNft.tokenURI('48'), 'https://site2.com/9');
      assert.equal(await lobstersNft.tokenURI('49'), 'https://site2.com/50');
      assert.equal(await lobstersNft.tokenURI('58'), 'https://site2.com/2');
      assert.equal(await lobstersNft.tokenURI('59'), 'https://site2.com/11');

      await expectRevert(lobstersNft.setBaseURI('https://site2.com/', false), 'BASE_URI_ALREADY_FINAL');
      await expectRevert(lobstersNft.setBaseURI('https://site2.com/', true), 'BASE_URI_ALREADY_FINAL');
    });

    it('other seed with metadata should work properly', async () => {
      assert.equal(await lobstersNft.chainlinkHash(), '0x0000000000000000000000000000000000000000000000000000000000000000');
      assert.equal(await lobstersNft.chainlinkFee(), linkFeeAmount);

      await expectRevert(lobstersNft.setChainlinkConfig('0', '0x', {from: alice}), 'Ownable');
      const newChainlinkFee = ether(5);
      await lobstersNft.setChainlinkConfig(newChainlinkFee, '0x1', {from: minter});
      assert.equal(await lobstersNft.chainlinkFee(), newChainlinkFee);
      assert.equal(await lobstersNft.chainlinkHash(), '0x1000000000000000000000000000000000000000000000000000000000000000');

      await linkToken.transfer(lobstersNft.address, newChainlinkFee);

      const randomId = '991122334455667788990011223344556677889900';
      await lobstersNft.seedReveal({from: minter});
      await chainLinkCoordinator.sendRandom(lobstersNft.address, randomId);
      assert.equal(await lobstersNft.seed(), randomId);

      assert.equal(await lobstersNft.metadataOf('1'), '6');
      assert.equal(await lobstersNft.metadataOf('2'), '18');
      assert.equal(await lobstersNft.metadataOf('3'), '7');
      assert.equal(await lobstersNft.metadataOf('4'), '51');
      assert.equal(await lobstersNft.metadataOf('5'), '9');
      assert.equal(await lobstersNft.metadataOf('6'), '3');
      assert.equal(await lobstersNft.metadataOf('58'), '1');
      assert.equal(await lobstersNft.metadataOf('59'), '8');

      await lobstersNft.setBaseURI('https://site.com/', {from: minter});
      assert.equal(await lobstersNft.tokenURI('5'), 'https://site.com/9');
      assert.equal(await lobstersNft.tokenURI('6'), 'https://site.com/3');
      assert.equal(await lobstersNft.tokenURI('58'), 'https://site.com/1');
      assert.equal(await lobstersNft.tokenURI('59'), 'https://site.com/8');
    });
  });

  describe('random metadataOf', () => {
    const countPerMember = 50;
    const members = 10;

    let treeArr, treeRoot;

    beforeEach(async () => {
      lobstersNft = await LobstersNft.new(
        'LOBSTERS',
        'LOBSTERS',
        (countPerMember * members).toString(),
        linkToken.address,
        chainLinkCoordinator.address,
        linkFeeAmount,
        '0x'
      );
      lobsterMinter = await LobstersMinter.new(lobstersNft.address, '0x');
      await lobstersNft.setMinter(lobsterMinter.address, {from: minter});

      const addresses = [];
      for(let i = 1; i <= members; i++) {
        addresses.push(ethers.Wallet.createRandom().address);
      }

      treeArr = addresses.map(address => ({address, count: countPerMember}));

      treeRoot = treeHelper.getTreeRoot(treeArr);
      await lobsterMinter.updateMerkleRoot(treeRoot, {from: minter});

      await pIteration.forEach(addresses, address => {
        return lobsterMinter.claim(address, countPerMember.toString(), treeHelper.getTreeLeafProof(treeArr, address));
      });
    });

    it('seed with metadata should work properly', async function() {
      this.timeout(1000000)

      assert.equal(await lobstersNft.totalSupply(), (countPerMember * members).toString());

      await linkToken.transfer(lobstersNft.address, linkFeeAmount);

      const randomId = '1122334455667788990011223344556677889900';
      await lobstersNft.seedReveal({from: minter});
      await chainLinkCoordinator.sendRandom(lobstersNft.address, randomId);
      assert.equal(await lobstersNft.seed(), randomId);

      const metadataId = {};
      const maxMetadaId = countPerMember * members - 1;
      let maxResultMetadataId = null;
      for (let i = 0; i < countPerMember; i++) {
        const idPromises = [];
        for (let j = 0; j < members; j++) {
          const tokenId = j + 10 * i;
          idPromises.push(lobstersNft.metadataOf(tokenId.toString()))
        }
        const ids = await Promise.all(idPromises).then(arr => arr.map(id => parseInt(id)));
        ids.forEach(id => {
          assert.equal(metadataId[id], undefined);
          metadataId[id] = true;
          if (id > maxResultMetadataId) {
            maxResultMetadataId = id;
          }
        })
      }
      assert.equal(maxResultMetadataId, maxMetadaId);
    });
  });

  describe('names claiming', () => {
    let treeArr, treeRoot;
    beforeEach(async () => {
      lobstersNft = await LobstersNft.new(
        'LOBSTERS',
        'LOBSTERS',
        '60',
        linkToken.address,
        chainLinkCoordinator.address,
        linkFeeAmount,
        '0x'
      );
      lobsterMinter = await LobstersMinter.new(lobstersNft.address, '0x');
      await lobstersNft.setMinter(lobsterMinter.address, {from: minter});

      treeArr = [{address: alice, count: 10}, {address: bob, count: 20}, {address: dan, count: 30}];
      treeRoot = treeHelper.getTreeRoot(treeArr);
      await lobsterMinter.updateMerkleRoot(treeRoot, {from: minter});

      const aliceProof = treeHelper.getTreeLeafProof(treeArr, alice);
      const bobProof = treeHelper.getTreeLeafProof(treeArr, bob);
      const danProof = treeHelper.getTreeLeafProof(treeArr, dan);

      await lobsterMinter.claim(alice, '10', aliceProof);
      await lobsterMinter.claim(bob, '20', bobProof);
      await lobsterMinter.claim(dan, '30', danProof);
    });

    it('token name claim and update should work properly', async () => {
      const claimNameFee = ether('2');
      const updateNameFee = ether('1');

      assert.equal(await lobstersNft.feeManager(), zeroAddress);
      await expectRevert(lobstersNft.setFeeManager(feeManager, {from: alice}), 'Ownable');
      await lobstersNft.setFeeManager(feeManager, {from: minter});
      assert.equal(await lobstersNft.feeManager(), feeManager);

      await expectRevert(lobstersNft.claimName('1', 'first', {from: alice}), 'FEE_NOT_SET');

      assert.equal(await lobstersNft.feeDestination(), zeroAddress);
      assert.equal(await lobstersNft.claimNameFee(), '0');
      assert.equal(await lobstersNft.updateNameFee(), '0');
      await expectRevert(lobstersNft.updateFee(feeReceiver, claimNameFee, updateNameFee, {from: alice}), 'NOT_THE_FEE_MANAGER');
      await lobstersNft.updateFee(feeReceiver, claimNameFee, updateNameFee, {from: feeManager});
      assert.equal(await lobstersNft.feeDestination(), feeReceiver);
      assert.equal(await lobstersNft.claimNameFee(), claimNameFee);
      assert.equal(await lobstersNft.updateNameFee(), updateNameFee);

      const firstName = 'first name';
      const firstNameHash = await lobstersNft.processNameHash(firstName);
      assert.equal(await lobstersNft.nameByTokenId('1'), '');
      assert.equal(await lobstersNft.tokenIdByNameHash(firstNameHash), '0');
      await expectRevert(lobstersNft.claimName('1', firstName, {from: bob}), 'FEE_REQUIRED');
      await expectRevert(lobstersNft.claimName('1', firstName, {from: bob, value: claimNameFee}), 'NOT_THE_OWNER');
      await expectRevert(lobstersNft.claimName('1', firstName, {from: alice}), 'FEE_REQUIRED');
      await expectRevert(lobstersNft.updateName('1', firstName, {from: alice, value: updateNameFee}), 'TOKEN_DOESNT_HAVE_NAME');
      await expectRevert(lobstersNft.claimName('1', firstName, {from: alice, value: updateNameFee}), 'FEE_REQUIRED');
      await expectRevert(lobstersNft.claimName('1', firstName + '*', {from: alice, value: claimNameFee}), 'INVALID_NAME');
      await expectRevert(lobstersNft.claimName('1', '', {from: alice, value: claimNameFee}), 'EMPTY_NAME');
      await lobstersNft.claimName('1', firstName, {from: alice, value: claimNameFee});

      assert.equal(await lobstersNft.nameByTokenId('1'), firstName);
      assert.equal(await lobstersNft.tokenIdByNameHash(firstNameHash), '1');

      const secondName = 'second name';
      const secondNameHash = await lobstersNft.processNameHash(secondName);
      assert.equal(await lobstersNft.nameByTokenId('11'), '');
      assert.equal(await lobstersNft.tokenIdByNameHash(secondNameHash), '0');
      await expectRevert(lobstersNft.claimName('11', firstName, {from: bob, value: claimNameFee}), 'NAME_ALREADY_CLAIMED')
      await lobstersNft.claimName('11', secondName, {from: bob, value: claimNameFee});

      assert.equal(await lobstersNft.nameByTokenId('1'), firstName);
      assert.equal(await lobstersNft.tokenIdByNameHash(firstNameHash), '1');
      assert.equal(await lobstersNft.getTokenIdByName(firstName), '1');
      assert.equal(await lobstersNft.nameByTokenId('11'), secondName);
      assert.equal(await lobstersNft.tokenIdByNameHash(secondNameHash), '11');
      assert.equal(await lobstersNft.getTokenIdByName(secondName), '11');

      await expectRevert(lobstersNft.claimName('11', secondName, {from: bob, value: claimNameFee}), 'TOKEN_ALREADY_HAVE_NAME')
      await expectRevert(lobstersNft.updateName('11', secondName + '2', {from: bob}), 'FEE_REQUIRED');
      await expectRevert(lobstersNft.updateName('11', secondName + '2', {from: alice, value: updateNameFee}), 'NOT_THE_OWNER');
      await expectRevert(lobstersNft.updateName('11', secondName + '2*', {from: bob, value: updateNameFee}), 'INVALID_NAME');
      await expectRevert(lobstersNft.updateName('11', '', {from: bob, value: updateNameFee}), 'EMPTY_NAME');
      await lobstersNft.updateName('11', secondName + '2', {from: bob, value: updateNameFee});

      const newSecondNameHash = await lobstersNft.processNameHash(secondName + '2');
      assert.equal(await lobstersNft.nameByTokenId('1'), firstName);
      assert.equal(await lobstersNft.tokenIdByNameHash(firstNameHash), '1');
      assert.equal(await lobstersNft.getTokenIdByName(firstName), '1');
      assert.equal(await lobstersNft.nameByTokenId('11'), secondName + '2');
      assert.equal(await lobstersNft.tokenIdByNameHash(secondNameHash), '0');
      assert.equal(await lobstersNft.getTokenIdByName(secondName), '0');
      assert.equal(await lobstersNft.tokenIdByNameHash(newSecondNameHash), '11');
      assert.equal(await lobstersNft.getTokenIdByName(secondName + '2'), '11');

      await expectRevert(lobstersNft.claimName('12', secondName + '2', {from: bob, value: claimNameFee}), 'NAME_ALREADY_CLAIMED')
      await lobstersNft.claimName('12', secondName, {from: bob, value: claimNameFee});
      assert.equal(await lobstersNft.nameByTokenId('1'), firstName);
      assert.equal(await lobstersNft.tokenIdByNameHash(firstNameHash), '1');
      assert.equal(await lobstersNft.getTokenIdByName(firstName), '1');
      assert.equal(await lobstersNft.nameByTokenId('11'), secondName + '2');
      assert.equal(await lobstersNft.tokenIdByNameHash(secondNameHash), '12');
      assert.equal(await lobstersNft.getTokenIdByName(secondName), '12');
      assert.equal(await lobstersNft.tokenIdByNameHash(newSecondNameHash), '11');
      assert.equal(await lobstersNft.getTokenIdByName(secondName + '2'), '11');
      assert.equal(await lobstersNft.nameByTokenId('12'), secondName);

      const feeReceiverBalance = await web3.eth.getBalance(feeReceiver).then(b => b.toString(10));
      const feeBalance = await web3.eth.getBalance(lobstersNft.address).then(b => b.toString(10));
      await expectRevert(lobstersNft.claimFee({from: bob}), 'NOT_THE_FEE_MANAGER');
      await lobstersNft.claimFee({from: feeManager})
      await expectRevert(lobstersNft.claimFee({from: feeManager}), 'BALANCE_IS_NULL');
      assert.equal(addBN(feeReceiverBalance, feeBalance), await web3.eth.getBalance(feeReceiver).then(b => b.toString(10)));
    });
  });

  describe.only("royalties", () => {
    let treeArr, treeRoot;
    beforeEach(async () => {
      lobstersNft = await LobstersNft.new(
        'LOBSTERS',
        'LOBSTERS',
        '6',
        linkToken.address,
        chainLinkCoordinator.address,
        linkFeeAmount,
        '0x'
      );
      lobsterMinter = await LobstersMinter.new(lobstersNft.address, '0x');
      await lobstersNft.setMinter(lobsterMinter.address, {from: minter});

      treeArr = [{address: alice, count: 1}];
      treeRoot = treeHelper.getTreeRoot(treeArr);
      await lobsterMinter.updateMerkleRoot(treeRoot, {from: minter});
      const aliceProof = treeHelper.getTreeLeafProof(treeArr, alice);
      await lobsterMinter.claim(alice, '1', aliceProof);
    });

    it("royalties calculate properly", async () => {
      const salePrice = ethers.utils.parseEther("1");
      const owner = await lobstersNft.owner();
      const royaltyInfo = await lobstersNft.royaltyInfo(0, salePrice);
      const expectedRoyalties = ethers.utils.parseUnits("75", 15);
      assert.equal(ethers.BigNumber.from(royaltyInfo[1]), expectedRoyalties);
      assert.equal(royaltyInfo[0], owner);

      await expectRevert(lobstersNft.royaltyInfo(1, salePrice), "tokenId does not exist");
    });

    it("royalties and scale factor can be set by owner");
  })
});
