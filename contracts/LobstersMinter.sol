pragma solidity 0.6.12;

import "@openzeppelin/contracts/math/SafeMath.sol";
import "@openzeppelin/contracts/cryptography/MerkleProof.sol";
import "@openzeppelin/contracts/cryptography/ECDSA.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import "@openzeppelin/contracts/utils/Context.sol";
import "./interfaces/ILobstersNft.sol";
import "./interfaces/ICryptoPunks.sol";

contract LobstersMinter is Ownable {
  using SafeMath for uint256;

  event SetMaxClaimAllowedByCollection(address collection, uint256 count);
  event Claim(address indexed account, uint256 count, uint256 mintCount);
  event ClaimByCollection(address indexed account, address indexed collection, uint256[] tokenIds, uint256 count);

  ILobstersNft public lobstersNft;
  bytes32 public merkleRoot;

  mapping(address => uint256) public claimedCount;

  mapping(address => uint256) public maxClaimAllowedByCollection;
  mapping(address => mapping(uint256 => bool)) public claimedByCollection;

  address public constant PUNK_COLLECTION = 0xb47e3cd837dDF8e4c57F05d70Ab865de6e193BBB;

  constructor(
    address _lobstersNft,
    bytes32 _merkleRoot,
    address[] memory _allowedCollections,
    uint256[] memory _allowedCollectionCounts
  ) public {
    lobstersNft = ILobstersNft(_lobstersNft);
    merkleRoot = _merkleRoot;

    uint256 len = _allowedCollections.length;
    require(len == _allowedCollectionCounts.length, "LENGTHS_NOT_MATCH");
    for (uint256 i = 0; i < len; i++) {
      maxClaimAllowedByCollection[_allowedCollections[i]] = _allowedCollectionCounts[i];
      emit SetMaxClaimAllowedByCollection(_allowedCollections[i], _allowedCollectionCounts[i]);
    }
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
    uint256 _mintCount,
    bytes32[] calldata _merkleProof
  ) external {
    require(verifyClaim(_account, _count, _merkleProof), "INVALID_MERKLE_PROOF");

    claimedCount[_account] = claimedCount[_account].add(_mintCount);

    require(claimedCount[_account] <= _count, "MINT_COUNT_REACHED");

    lobstersNft.mintMultiple(_account, _mintCount);
    emit Claim(_account, _count, _mintCount);
  }

  function claimByCollection(address _collection, uint256[] memory _tokenIds) external {
    uint256 len = _tokenIds.length;
    require(len > 0, "NULL_LENGTH");

    address sender = _msgSender();
    uint256 mintCount = 0;
    for (uint256 i = 0; i < len; i++) {
      if (_collection == PUNK_COLLECTION) {
        require(ICryptoPunks(_collection).punkIndexToAddress(_tokenIds[i]) == sender, "TOKEN_NOT_OWNED_BY_SENDER");
      } else {
        require(IERC721(_collection).ownerOf(_tokenIds[i]) == sender, "TOKEN_NOT_OWNED_BY_SENDER");
      }
      require(!claimedByCollection[_collection][_tokenIds[i]], "ALREADY_CLAIMED_BY_TOKEN");

      claimedByCollection[_collection][_tokenIds[i]] = true;

      maxClaimAllowedByCollection[_collection] = maxClaimAllowedByCollection[_collection].sub(1);

      mintCount = mintCount.add(1);
    }

    lobstersNft.mintMultiple(sender, mintCount);

    emit ClaimByCollection(sender, _collection, _tokenIds, len);
  }
}
