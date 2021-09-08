const BigNumber = require('bignumber.js')

module.exports = (web3, ethers) => {
  const {toBN, toWei, fromWei} = web3.utils;

  function nToBN(num) {
    return toBN(num.toString(10));
  }

  function ether(num) {
    return toWei(num.toString(10), 'ether');
  }

  const h = {
    maxUint: '0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff',
    zeroAddress: '0x0000000000000000000000000000000000000000',
    ether,
    fromEther(wei) {
      return parseFloat(fromWei(wei.toString(10), 'ether'));
    },
    addBN(bn1, bn2) {
      return nToBN(bn1).add(nToBN(bn2)).toString();
    },
    subBN(bn1, bn2) {
      return nToBN(bn1).sub(nToBN(bn2));
    },
    mulBN(bn1, bn2) {
      return nToBN(bn1).mul(nToBN(bn2)).toString();
    },
    divBN(bn1, bn2) {
      return nToBN(bn1).div(nToBN(bn2)).toString();
    },
    async impersonateAccount(adminAddress) {
      await ethers.provider.getSigner().sendTransaction({
        to: adminAddress,
        value: '0x' + new BigNumber(ether('1')).toString(16)
      })

      await ethers.provider.send('hardhat_impersonateAccount', [adminAddress]);
    },

    async getTimestamp(shift = 0) {
      const currentTimestamp = (await web3.eth.getBlock(await web3.eth.getBlockNumber())).timestamp;
      return currentTimestamp + shift;
    },
    isBNHigher(bn1, bn2) {
      return toBN(bn1.toString(10)).gt(toBN(bn2.toString(10)));
    },
  };

  return h;
};
