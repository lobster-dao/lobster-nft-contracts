// SPDX-License-Identifier: MIT

pragma solidity 0.6.12;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@chainlink/contracts/src/v0.6/VRFConsumerBase.sol";

import "./interfaces/ILobstersNft.sol";

contract LobstersNft is ILobstersNft, Ownable, ERC721, VRFConsumerBase {
  event SetBaseURI(string indexed baseURI);
  event SetDefaultURI(string indexed defaultURI);
  event SetMinter(address indexed minter);
  event SetChainlinkConfig(uint256 chainlinkFee, bytes32 chainlinkHash);
  event SetRandomSeed(uint256 seed, bytes32 requestId);

  string public defaultURI;
  bool public finalBaseURI;

  address public minter;
  uint256 public maxTokens;
  uint256 public seed;

  uint256 public chainlinkFee;
  bytes32 public chainlinkHash;

  modifier onlyMinter() {
    require(minter == _msgSender(), "NOT_THE_MINTER");
    _;
  }

  constructor(
    string memory _name,
    string memory _symbol,
    uint256 _maxTokens,
    address _linkToken,
    address _chainlinkCoordinator,
    uint256 _chainlinkFee,
    bytes32 _chainlinkHash
  ) public ERC721(_name, _symbol) VRFConsumerBase(_chainlinkCoordinator, _linkToken) {
    maxTokens = _maxTokens;
    chainlinkFee = _chainlinkFee;
    chainlinkHash = _chainlinkHash;
  }

  function mintMultiple(address _to, uint256 _count) external override onlyMinter {
    for (uint256 i = 0; i < _count; i++) {
      uint256 id = totalSupply();
      require(id < maxTokens, "MAX_TOKENS");
      _mint(_to, id);
    }
  }

  function setBaseURI(string memory baseURI_, bool finalBaseUri_) external onlyOwner {
    require(!finalBaseURI, "BASE_URI_ALREADY_FINAL");
    _setBaseURI(baseURI_);
    finalBaseURI = finalBaseUri_;
    emit SetBaseURI(baseURI_);
  }

  function setDefaultURI(string memory _defaultURI) external onlyOwner {
    defaultURI = _defaultURI;
    emit SetDefaultURI(_defaultURI);
  }

  function setMinter(address _minter) external onlyOwner {
    require(minter == address(0), "MINTER_ALREADY_SET");
    minter = _minter;
    emit SetMinter(_minter);
  }

  function setChainlinkConfig(uint256 _chainlinkFee, bytes32 _chainlinkHash) external onlyOwner {
    chainlinkFee = _chainlinkFee;
    chainlinkHash = _chainlinkHash;
    emit SetChainlinkConfig(_chainlinkFee, _chainlinkHash);
  }

  function seedReveal() public onlyOwner {
    require(seed == 0, "SEED_ALREADY_GENERATED");
    require(LINK.balanceOf(address(this)) >= chainlinkFee, "LINK_BALANCE_NOT_ENOUGH");
    requestRandomness(chainlinkHash, chainlinkFee);
  }

  function tokenURI(uint256 tokenId) public view override returns (string memory) {
    require(_exists(tokenId), "ERC721Metadata: URI query for nonexistent token");

    string memory tokenURI_ = metadataOf(tokenId);
    string memory base_ = baseURI();

    // If there is no base URI, return the token URI.
    if (bytes(base_).length == 0 || seed == 0) {
      return defaultURI;
    }
    return string(abi.encodePacked(base_, tokenURI_));
  }

  function metadataOf(uint256 _tokenId) public view returns (string memory) {
    require(_tokenId < totalSupply(), "INVALID_TOKEN_ID");

    uint256 seed_ = seed;
    if (seed_ == 0) {
      return "";
    }

    uint256[] memory randomIds = new uint256[](maxTokens);
    for (uint256 i = 0; i < maxTokens; i++) {
      randomIds[i] = i;
    }

    for (uint256 i = 0; i < maxTokens - 1; i++) {
      uint256 j = i + (uint256(keccak256(abi.encode(seed_, i))) % (maxTokens - i));
      (randomIds[i], randomIds[j]) = (randomIds[j], randomIds[i]);
    }

    return randomIds[_tokenId].toString();
  }

  function fulfillRandomness(bytes32 _requestId, uint256 _randomNumber) internal override {
    require(seed == 0, "SEED_ALREADY_GENERATED");
    seed = _randomNumber;
    emit SetRandomSeed(_randomNumber, _requestId);
  }
}
