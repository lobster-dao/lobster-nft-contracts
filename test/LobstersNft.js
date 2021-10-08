const { expectRevert } = require('@openzeppelin/test-helpers');
const treeHelper = require('../helpers/tree');
const ethers = require('ethers');
const assert = require('chai').assert;
const MockChainlinkCoordinator = artifacts.require('MockChainlinkCoordinator');
const MockERC20 = artifacts.require('MockERC20');
const MockERC721 = artifacts.require('MockERC721');
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

      treeArr = [{address: alice, count: 1}, {address: bob, count: 2}, {address: dan, count: 3}];
      treeRoot = treeHelper.getTreeRoot(treeArr);

      lobsterMinter = await LobstersMinter.new(lobstersNft.address, treeRoot, [], []);
      await lobstersNft.setMinter(lobsterMinter.address, {from: minter});
    });

    it('claim should work properly', async () => {
      await expectRevert(lobstersNft.setMinter(alice, {from: alice}), 'Ownable');
      await expectRevert(lobstersNft.setMinter(alice, {from: minter}), 'MINTER_ALREADY_SET');

      await expectRevert(lobstersNft.mintMultiple(minter, '10', {from: alice}), 'NOT_THE_MINTER');

      const aliceProof = treeHelper.getTreeLeafProof(treeArr, alice);
      const bobProof = treeHelper.getTreeLeafProof(treeArr, bob);

      assert.equal(treeHelper.encode(treeArr[0]), await lobsterMinter.encode(treeArr[0].address, treeArr[0].count));
      assert.equal(treeRoot, await lobsterMinter.merkleRoot());
      assert.equal(treeHelper.verify(treeArr, treeRoot, treeHelper.getHexNode(treeArr, alice), bobProof), false);
      assert.equal(treeHelper.verify(treeArr, treeRoot, treeHelper.getHexNode(treeArr, bob), aliceProof), false);
      assert.equal(treeHelper.verify(treeArr, treeRoot, treeHelper.getHexNode(treeArr, alice), aliceProof), true);

      await expectRevert(lobsterMinter.claim(alice, '1', '1', bobProof), 'INVALID_MERKLE_PROOF');
      await expectRevert(lobsterMinter.claim(bob, '1', '1', aliceProof), 'INVALID_MERKLE_PROOF');
      await expectRevert(lobsterMinter.claim(alice, '2', '2', aliceProof), 'INVALID_MERKLE_PROOF');
      await expectRevert(lobsterMinter.claim(alice, '11', '11', aliceProof), 'INVALID_MERKLE_PROOF');
      await lobsterMinter.claim(alice, '1', '1', aliceProof);

      assert.equal('1', await lobstersNft.balanceOf(alice));
      assert.equal('1', await lobstersNft.totalSupply());
      assert.equal(alice, await lobstersNft.ownerOf('0'));

      await expectRevert(lobsterMinter.claim(alice, '1', '1', aliceProof), 'MINT_COUNT_REACHED');

      await lobsterMinter.claim(bob, '2', '2', bobProof);

      assert.equal('1', await lobstersNft.balanceOf(alice));
      assert.equal('2', await lobstersNft.balanceOf(bob));
      assert.equal('3', await lobstersNft.totalSupply());
      assert.equal(alice, await lobstersNft.ownerOf('0'));
      assert.equal(bob, await lobstersNft.ownerOf('1'));
      assert.equal(bob, await lobstersNft.ownerOf('2'));

      const danProof = treeHelper.getTreeLeafProof(treeArr, dan);
      await lobsterMinter.claim(dan, '3', '3', danProof);

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

      treeArr = [{address: alice, count: 10}, {address: bob, count: 20}, {address: dan, count: 30}];
      treeRoot = treeHelper.getTreeRoot(treeArr);

      lobsterMinter = await LobstersMinter.new(lobstersNft.address, treeRoot, [], []);
      await lobstersNft.setMinter(lobsterMinter.address, {from: minter});

      const aliceProof = treeHelper.getTreeLeafProof(treeArr, alice);
      const bobProof = treeHelper.getTreeLeafProof(treeArr, bob);
      const danProof = treeHelper.getTreeLeafProof(treeArr, dan);

      await lobsterMinter.claim(alice, '10', '10', aliceProof);
      await lobsterMinter.claim(bob, '20', '20', bobProof);
      await lobsterMinter.claim(dan, '30', '30', danProof);
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

      assert.equal(await lobstersNft.tokenURI('1'), 'default.site');
      await lobstersNft.setBaseURI('', false, {from: minter});
      assert.equal(await lobstersNft.tokenURI('1'), 'default.site');

      await expectRevert(lobstersNft.seedReveal({from: minter}), 'SEED_ALREADY_GENERATED');
      await expectRevert(chainLinkCoordinator.sendRandom(lobstersNft.address, randomId), 'SEED_ALREADY_GENERATED');

      assert.equal(await lobstersNft.metadataOf('0'), '15');
      assert.equal(await lobstersNft.metadataOf('1'), '58');
      assert.equal(await lobstersNft.metadataOf('2'), '30');
      assert.equal(await lobstersNft.metadataOf('3'), '29');
      assert.equal(await lobstersNft.metadataOf('4'), '33');
      assert.equal(await lobstersNft.metadataOf('5'), '5');
      assert.equal(await lobstersNft.metadataOf('6'), '35');
      assert.equal(await lobstersNft.metadataOf('7'), '22');
      assert.equal(await lobstersNft.metadataOf('8'), '39');
      assert.equal(await lobstersNft.metadataOf('9'), '26');
      assert.equal(await lobstersNft.metadataOf('10'), '7');
      assert.equal(await lobstersNft.metadataOf('48'), '47');
      assert.equal(await lobstersNft.metadataOf('49'), '28');
      assert.equal(await lobstersNft.metadataOf('58'), '51');
      assert.equal(await lobstersNft.metadataOf('59'), '52');

      await expectRevert(lobstersNft.setBaseURI('https://site.com/', false, {from: alice}), 'Ownable');
      await lobstersNft.setBaseURI('https://site.com/', false, {from: minter});
      assert.equal(await lobstersNft.finalBaseURI(), false);
      assert.equal(await lobstersNft.tokenURI('0'), 'https://site.com/15');
      assert.equal(await lobstersNft.tokenURI('1'), 'https://site.com/58');
      assert.equal(await lobstersNft.tokenURI('2'), 'https://site.com/30');
      assert.equal(await lobstersNft.tokenURI('3'), 'https://site.com/29');
      assert.equal(await lobstersNft.tokenURI('4'), 'https://site.com/33');
      assert.equal(await lobstersNft.tokenURI('5'), 'https://site.com/5');
      assert.equal(await lobstersNft.tokenURI('6'), 'https://site.com/35');
      assert.equal(await lobstersNft.tokenURI('7'), 'https://site.com/22');
      assert.equal(await lobstersNft.tokenURI('8'), 'https://site.com/39');
      assert.equal(await lobstersNft.tokenURI('9'), 'https://site.com/26');
      assert.equal(await lobstersNft.tokenURI('10'), 'https://site.com/7');
      assert.equal(await lobstersNft.tokenURI('48'), 'https://site.com/47');
      assert.equal(await lobstersNft.tokenURI('49'), 'https://site.com/28');
      assert.equal(await lobstersNft.tokenURI('58'), 'https://site.com/51');
      assert.equal(await lobstersNft.tokenURI('59'), 'https://site.com/52');

      await lobstersNft.setBaseURI('https://site2.com/', true, {from: minter});
      assert.equal(await lobstersNft.finalBaseURI(), true);
      assert.equal(await lobstersNft.tokenURI('0'), 'https://site2.com/15');
      assert.equal(await lobstersNft.tokenURI('59'), 'https://site2.com/52');

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

      assert.equal(await lobstersNft.metadataOf('1'), '49');
      assert.equal(await lobstersNft.metadataOf('2'), '14');
      assert.equal(await lobstersNft.metadataOf('3'), '39');
      assert.equal(await lobstersNft.metadataOf('4'), '56');
      assert.equal(await lobstersNft.metadataOf('5'), '19');
      assert.equal(await lobstersNft.metadataOf('6'), '0');
      assert.equal(await lobstersNft.metadataOf('7'), '41');
      assert.equal(await lobstersNft.metadataOf('8'), '37');
      assert.equal(await lobstersNft.metadataOf('9'), '33');
      assert.equal(await lobstersNft.metadataOf('10'), '59');
      assert.equal(await lobstersNft.metadataOf('58'), '47');
      assert.equal(await lobstersNft.metadataOf('59'), '53');

      await lobstersNft.setBaseURI('https://site.com/', {from: minter});
      assert.equal(await lobstersNft.tokenURI('5'), 'https://site.com/19');
      assert.equal(await lobstersNft.tokenURI('6'), 'https://site.com/0');
      assert.equal(await lobstersNft.tokenURI('58'), 'https://site.com/47');
      assert.equal(await lobstersNft.tokenURI('59'), 'https://site.com/53');
    });
  });

  describe('partial mint', () => {
    let treeArr, treeRoot;
    beforeEach(async () => {
      lobstersNft = await LobstersNft.new(
        'LOBSTERS',
        'LOBSTERS',
        '610',
        linkToken.address,
        chainLinkCoordinator.address,
        linkFeeAmount,
        '0x'
      );

      treeArr = [{address: alice, count: 560}, {address: bob, count: 20}, {address: dan, count: 30}];
      treeRoot = treeHelper.getTreeRoot(treeArr);

      lobsterMinter = await LobstersMinter.new(lobstersNft.address, treeRoot, [], []);
      await lobstersNft.setMinter(lobsterMinter.address, {from: minter});
    });

    it('other seed with metadata should work properly', async () => {
      const aliceProof = treeHelper.getTreeLeafProof(treeArr, alice);
      const bobProof = treeHelper.getTreeLeafProof(treeArr, bob);
      const danProof = treeHelper.getTreeLeafProof(treeArr, dan);

      await lobsterMinter.claim(alice, '560', '100', aliceProof);
      await lobsterMinter.claim(alice, '560', '100', aliceProof);
      await lobsterMinter.claim(alice, '560', '100', aliceProof);
      await lobsterMinter.claim(alice, '560', '100', aliceProof);
      await lobsterMinter.claim(alice, '560', '100', aliceProof);

      await expectRevert(lobsterMinter.claim(alice, '560', '100', aliceProof), 'MINT_COUNT_REACHED');

      await lobsterMinter.claim(alice, '560', '60', aliceProof);
      await expectRevert(lobsterMinter.claim(alice, '560', '60', aliceProof), 'MINT_COUNT_REACHED');
      await expectRevert(lobsterMinter.claim(alice, '560', '1', aliceProof), 'MINT_COUNT_REACHED');
      await expectRevert(lobsterMinter.claim(alice, '560', '560', aliceProof), 'MINT_COUNT_REACHED');

      await expectRevert(lobsterMinter.claim(bob, '20', '30', bobProof), 'MINT_COUNT_REACHED');
      await lobsterMinter.claim(bob, '20', '10', bobProof);
      await expectRevert(lobsterMinter.claim(bob, '20', '20', bobProof), 'MINT_COUNT_REACHED');
      await lobsterMinter.claim(bob, '20', '10', bobProof);
      await lobsterMinter.claim(dan, '30', '30', danProof);

      assert.equal(await lobstersNft.totalSupply(), '610');
    });
  });

  describe('mint by collection allowed', () => {
    let treeArr, treeRoot;

    let allowedCollection, otherCollection;
    beforeEach(async () => {
      allowedCollection = await MockERC721.new('ALLOWED', 'ALLOWED');
      otherCollection = await MockERC721.new('OTHER', 'OTHER');

      lobstersNft = await LobstersNft.new(
        'LOBSTERS',
        'LOBSTERS',
        '610',
        linkToken.address,
        chainLinkCoordinator.address,
        linkFeeAmount,
        '0x'
      );

      treeArr = [{address: alice, count: 10}, {address: bob, count: 10}, {address: dan, count: 10}];
      treeRoot = treeHelper.getTreeRoot(treeArr);

      lobsterMinter = await LobstersMinter.new(lobstersNft.address, treeRoot, [allowedCollection.address], ['4']);
      await lobstersNft.setMinter(lobsterMinter.address, {from: minter});

      await lobsterMinter.claim(dan, '10', '10', treeHelper.getTreeLeafProof(treeArr, dan));

      await allowedCollection.mint(alice, '1');
      await allowedCollection.mint(alice, '2');
      await allowedCollection.mint(bob, '3');
      await allowedCollection.mint(bob, '4');
      await allowedCollection.mint(bob, '5');

      await otherCollection.mint(alice, '1');
      await otherCollection.mint(alice, '2');
    });

    it('other seed with metadata should work properly', async () => {
      assert.equal(await lobsterMinter.maxClaimAllowedByCollection(allowedCollection.address), '4');
      assert.equal(await lobsterMinter.maxClaimAllowedByCollection(otherCollection.address), '0');

      await expectRevert(lobstersNft.ownerOf('10'), 'nonexistent token');
      assert.equal(await lobstersNft.totalSupply(), '10');

      await lobsterMinter.claimByCollection(allowedCollection.address, ['1'], {from: alice});

      assert.equal(await lobsterMinter.maxClaimAllowedByCollection(allowedCollection.address), '3');

      assert.equal(await lobstersNft.ownerOf('10'), alice);
      assert.equal(await lobstersNft.totalSupply(), '11');

      await expectRevert(lobsterMinter.claimByCollection(allowedCollection.address, ['1'], {from: alice}), 'ALREADY_CLAIMED_BY_TOKEN');

      await expectRevert(lobsterMinter.claimByCollection(allowedCollection.address, ['2'], {from: bob}), 'TOKEN_NOT_OWNED_BY_SENDER');
      await expectRevert(lobsterMinter.claimByCollection(allowedCollection.address, ['2', '3'], {from: bob}), 'TOKEN_NOT_OWNED_BY_SENDER');

      await expectRevert(lobstersNft.ownerOf('11'), 'nonexistent token');

      await expectRevert(lobsterMinter.claimByCollection(allowedCollection.address, ['1', '2'], {from: alice}), 'ALREADY_CLAIMED_BY_TOKEN');
      await expectRevert(lobsterMinter.claimByCollection(allowedCollection.address, [], {from: alice}), 'NULL_LENGTH');
      await lobsterMinter.claimByCollection(allowedCollection.address, ['2'], {from: alice});

      assert.equal(await lobsterMinter.maxClaimAllowedByCollection(allowedCollection.address), '2');

      assert.equal(await lobstersNft.ownerOf('11'), alice);
      assert.equal(await lobstersNft.totalSupply(), '12');

      await expectRevert(lobsterMinter.claimByCollection(allowedCollection.address, ['2', '3'], {from: bob}), 'TOKEN_NOT_OWNED_BY_SENDER');

      await expectRevert(lobsterMinter.claimByCollection(allowedCollection.address, ['3', '4', '5'], {from: bob}), 'SafeMath');

      await expectRevert(lobstersNft.ownerOf('12'), 'nonexistent token');
      await expectRevert(lobstersNft.ownerOf('13'), 'nonexistent token');

      await lobsterMinter.claimByCollection(allowedCollection.address, ['3', '4'], {from: bob});

      assert.equal(await lobsterMinter.maxClaimAllowedByCollection(allowedCollection.address), '0');

      assert.equal(await lobstersNft.ownerOf('12'), bob);
      assert.equal(await lobstersNft.ownerOf('13'), bob);
      assert.equal(await lobstersNft.totalSupply(), '14');

      await expectRevert(lobsterMinter.claimByCollection(allowedCollection.address, ['5'], {from: bob}), 'SafeMath');

      await allowedCollection.mint(dan, '6');

      await expectRevert(lobsterMinter.claimByCollection(allowedCollection.address, ['6'], {from: dan}), 'SafeMath');

      await expectRevert(lobsterMinter.claimByCollection(otherCollection.address, ['1'], {from: alice}), 'SafeMath');

      await lobsterMinter.claim(alice, '10', '10', treeHelper.getTreeLeafProof(treeArr, alice));

      assert.equal(await lobstersNft.totalSupply(), '24');
      assert.equal(await lobstersNft.ownerOf('14'), alice);
    });
  });

  describe('random metadataOf', function() {
    this.timeout(1000000);

    const countPerMember = 50;
    const members = 180;

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

      const addresses = [];
      for(let i = 1; i <= members; i++) {
        addresses.push(ethers.Wallet.createRandom().address);
      }

      treeArr = addresses.map(address => ({address, count: countPerMember}));

      treeRoot = treeHelper.getTreeRoot(treeArr);

      lobsterMinter = await LobstersMinter.new(lobstersNft.address, treeRoot, [], []);
      await lobstersNft.setMinter(lobsterMinter.address, {from: minter});

      await lobsterMinter.claim(addresses[0], countPerMember.toString(), countPerMember.toString(), treeHelper.getTreeLeafProof(treeArr, addresses[0]));
    });

    it('seed with metadata should work properly', async function() {
      assert.equal(await lobstersNft.maxTokens(), (countPerMember * members).toString());

      await linkToken.transfer(lobstersNft.address, linkFeeAmount);

      const randomId = '1122334455667788990011223344556677889900';
      await lobstersNft.seedReveal({from: minter});
      await chainLinkCoordinator.sendRandom(lobstersNft.address, randomId);
      assert.equal(await lobstersNft.seed(), randomId);

      const maxMetadaId = countPerMember * members - 1;
      for (let i = 0; i < 5; i++) {
        const metadataId = parseInt(await lobstersNft.metadataOf(i.toString()));
        assert.equal(metadataId <= maxMetadaId, true);
      }
    });
  });

  describe.skip('names claiming', () => {
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

      treeArr = [{address: alice, count: 10}, {address: bob, count: 20}, {address: dan, count: 30}];
      treeRoot = treeHelper.getTreeRoot(treeArr);

      lobsterMinter = await LobstersMinter.new(lobstersNft.address, treeRoot, [], []);
      await lobstersNft.setMinter(lobsterMinter.address, {from: minter});

      const aliceProof = treeHelper.getTreeLeafProof(treeArr, alice);
      const bobProof = treeHelper.getTreeLeafProof(treeArr, bob);
      const danProof = treeHelper.getTreeLeafProof(treeArr, dan);

      await lobsterMinter.claim(alice, '10', '10', aliceProof);
      await lobsterMinter.claim(bob, '20', '20', bobProof);
      await lobsterMinter.claim(dan, '30', '30', danProof);
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
});
