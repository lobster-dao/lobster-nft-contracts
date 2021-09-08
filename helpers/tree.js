const { MerkleTree } = require('merkletreejs');
const Web3 = require('web3');
const web3 = new Web3(new Web3.providers.HttpProvider('http://127.0.0.1'));
const { keccak256 } = require('ethereumjs-util');

const tree = {
  getLeaves(arr, addressToLeaveDict = {}) {
    return arr.map(item => {
      addressToLeaveDict[item.address] = keccak256(tree.nodeToBuffer(tree.encode(item)));
      return addressToLeaveDict[item.address]
    }).sort(Buffer.compare);
  },
  makeTree(leaves) {
    return new MerkleTree(leaves, keccak256, { sort: true });
  },
  getTreeRoot(arr) {
    const leaves = tree.getLeaves(arr);
    const t = tree.makeTree(leaves);
    return t.getHexRoot();
  },
  nodeToBuffer(node) {
    return Buffer.from(node.replace('0x', ''), 'hex');
  },
  getHexNode(arr, address) {
    return '0x' + tree.getNode(arr, address).toString('hex');
  },
  encode(item) {
    const result = web3.eth.abi.encodeParameters(['address','uint256'], [item.address, item.count]);
    return result.replace(result.slice(0, 26), '0x');
  },
  getNode(arr, address) {
    const dict = {};
    tree.getLeaves(arr, dict);
    return dict[address];
  },
  getTreeLeafProof(arr, address) {
    const dict = {};
    const leaves = tree.getLeaves(arr, dict);
    const t = tree.makeTree(leaves);
    return t.getHexProof(dict[address], leaves.indexOf(dict[address]));
  },
  verify(arr, root, node, proof) {
    const leaves = tree.getLeaves(arr);
    const t = tree.makeTree(leaves);
    return t.verify(proof, tree.nodeToBuffer(node), tree.nodeToBuffer(root));
  }
};

module.exports = tree;
