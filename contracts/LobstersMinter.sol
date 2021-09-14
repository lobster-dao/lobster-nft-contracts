pragma solidity 0.6.12;

import "@openzeppelin/contracts/cryptography/MerkleProof.sol";
import "@openzeppelin/contracts/cryptography/ECDSA.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "./interfaces/ILobstersNft.sol";

contract LobstersMinter is Ownable {
  event Claim(address indexed account, uint256 count);
  event UpdateMerkleRoot(bytes32 merkleRoot);

  ILobstersNft public lobstersNft;
  bytes32 public merkleRoot;

  mapping(address => bool) public claimed;

  constructor(address _lobstersNft, bytes32 _merkleRoot) public {
    lobstersNft = ILobstersNft(_lobstersNft);
    merkleRoot = _merkleRoot;
  }

  function updateMerkleRoot(bytes32 _merkleRoot) external onlyOwner {
    merkleRoot = _merkleRoot;
    emit UpdateMerkleRoot(_merkleRoot);
  }

  function encode(address _account, uint256 _count) public view returns (bytes memory) {
    return abi.encodePacked(_account, _count);
  }

  function verifyClaim(
    address _account,
    uint256 _count,
    bytes32[] calldata _merkleProof
  ) public view returns (bool) {
    bytes32 node = keccak256(encode(_account, _count));
    return MerkleProof.verify(_merkleProof, merkleRoot, node);
  }

  function claim(
    address _account,
    uint256 _count,
    bytes32[] calldata _merkleProof
  ) external {
    require(!claimed[_account], "ALREADY_CLAIMED");

    require(verifyClaim(_account, _count, _merkleProof), "INVALID_MERKLE_PROOF");

    claimed[_account] = true;
    lobstersNft.mintMultiple(_account, _count);
    emit Claim(_account, _count);
  }
}
