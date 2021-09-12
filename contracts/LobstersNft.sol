// SPDX-License-Identifier: MIT

pragma solidity 0.6.12;

import "@openzeppelin/contracts/math/SafeMath.sol";
import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@chainlink/contracts/src/v0.6/VRFConsumerBase.sol";

import "./traits/LobstersNames.sol";
import "./interfaces/ILobstersNft.sol";

contract LobstersNft is ILobstersNft, LobstersNames, ERC721, VRFConsumerBase {
  using SafeMath for uint256;
  /// bytes4(keccak256("royaltyInfo(uint256,uint256)")) == 0x2a55205a
  bytes4 private constant _INTERFACE_ID_ERC2981 = 0x2a55205a;

  event SetBaseURI(string indexed baseURI);
  event SetDefaultURI(string indexed defaultURI);
  event SetMinter(address minter);
  event SetChainlinkConfig(uint256 chainlinkFee, bytes32 chainlinkHash);
  event SetRandomSeed(uint256 seed, bytes32 requestId);
  event SetRoyalties(uint256 indexed newRoyaltyRate, uint256 newScalingFactor);

  string public defaultURI;

  address public minter;
  uint256 public maxTokens;
  // royalty rate is the percent of each secondary market trade sent to the DAO
  uint256 public royaltyRate;
  // scale factor is how much the royalty rate should be divided by when calculating
  // royalty fees (eg 75 would need to be scaled by 1e3 to become 7.5%)
  uint256 public scaleFactor;
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
    _registerInterface(_INTERFACE_ID_ERC2981);
    royaltyRate = 75;
    scaleFactor = 1000;
  }

  function mint(address _to) external override onlyMinter returns (uint256 id) {
    require(totalSupply() < maxTokens, "MAX_TOKENS");
    id = totalSupply();
    _mint(_to, id);
  }

  function setBaseURI(string memory baseURI_) external onlyOwner {
    _setBaseURI(baseURI_);
    emit SetBaseURI(baseURI_);
  }

  function setDefaultURI(string memory _defaultURI) external onlyOwner {
    defaultURI = _defaultURI;
    emit SetDefaultURI(_defaultURI);
  }

  function setMinter(address _minter) external onlyOwner {
    minter = _minter;
    emit SetMinter(_minter);
  }

  function setChainlinkConfig(uint256 _chainlinkFee, bytes32 _chainlinkHash) external onlyOwner {
    chainlinkFee = _chainlinkFee;
    chainlinkHash = _chainlinkHash;
    emit SetChainlinkConfig(_chainlinkFee, _chainlinkHash);
  }
  /// @notice Allows the setting of a new royalty rate and scaling factor
  /// @dev Scaling factor should be implemented with a target token in mind, since the 
  /// decimals of the token will affect how big the scaling factor should be
  /// @param _newRate the new percentage of royalties (contract defaults to 75)
  /// @param _newScale the new scaling factor (default: 1e3 to make 75 equal to 7.5%)
  function setRoyaltyRate(uint256 _newRate, uint256 _newScale) external onlyOwner {
    royaltyRate = _newRate;
    scaleFactor = _newScale;
    emit SetRoyalties(_newRate, _newScale);
  }

  function seedReveal() public onlyOwner {
    require(seed == 0, "SEED_ALREADY_GENERATED");
    require(LINK.balanceOf(address(this)) >= chainlinkFee, "LINK_BALANCE_NOT_ENOUGH");
    requestRandomness(chainlinkHash, chainlinkFee);
  }

  function getLobsterOwner(uint256 _tokenId) public view override returns (address) {
    return ownerOf(_tokenId);
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

    for (uint256 i = 0; i < maxTokens; i++) {
      uint256 j = (uint256(keccak256(abi.encode(seed_, i))) % (maxTokens - 5)) + 5;
      (randomIds[i], randomIds[j]) = (randomIds[j], randomIds[i]);
    }

    return randomIds[_tokenId].toString();
  }

  /// @notice Given a tokenId and sale amount, returns the amount to be paid in royalties
  /// @dev The returned figure is a raw uint256 and needs to be scaled by the amount of token decimals
  /// @param _tokenId the token id of the NFT the query is being made for
  /// @param _salePrice the token amount being offered for the NFT
  /// @return the address for the royalties to be sent to and the amount to be paid in royalties
  function royaltyInfo(uint256 _tokenId, uint256 _salePrice) public view returns(address, uint256) {
    require(_exists(_tokenId), "tokenId does not exist");

    uint256 royaltyAmount = _salePrice.mul(royaltyRate).div(scaleFactor);
    return (owner(), royaltyAmount);
  }

  function fulfillRandomness(bytes32 _requestId, uint256 _randomNumber) internal override {
    require(seed == 0, "SEED_ALREADY_GENERATED");
    seed = _randomNumber;
    emit SetRandomSeed(_randomNumber, _requestId);
  }
}
