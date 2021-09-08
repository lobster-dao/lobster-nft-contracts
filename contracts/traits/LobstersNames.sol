pragma solidity 0.6.12;

import "@openzeppelin/contracts/GSN/Context.sol";
import "@openzeppelin/contracts/utils/Address.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "../libs/StringsUtils.sol";

abstract contract LobstersNames is Context, Ownable {
  event TakeNameFee(address indexed sender, uint256 feeAmount);
  event SetName(address indexed tokenOwner, uint256 indexed tokenId, bytes32 indexed nameHash, string name);

  event SetFeeManager(address indexed admin, address indexed oldFeeManager, address indexed newFeeManager);
  event UpdateFee(address indexed manager, address indexed feeDestination, uint256 claimNameFee, uint256 updateNameFee);
  event ClaimFee(address indexed manager, address indexed feeDestination, uint256 feeSum);

  uint256 public claimNameFee;
  uint256 public updateNameFee;
  address public feeManager;
  address public feeDestination;

  mapping(bytes32 => uint256) public tokenIdByNameHash;
  mapping(uint256 => string) public nameByTokenId;

  modifier onlyFeeManager() {
    require(feeManager == _msgSender(), "NOT_THE_FEE_MANAGER");
    _;
  }

  function claimName(uint256 _tokenId, string memory _name) external payable returns (bytes32) {
    string memory oldName = nameByTokenId[_tokenId];
    require(bytes(oldName).length == 0, "TOKEN_ALREADY_HAVE_NAME");
    _takeFee(claimNameFee);
    return _setName(_tokenId, _name);
  }

  function updateName(uint256 _tokenId, string memory _name) external payable returns (bytes32) {
    string memory oldName = nameByTokenId[_tokenId];
    require(bytes(oldName).length != 0, "TOKEN_DOESNT_HAVE_NAME");
    _takeFee(updateNameFee);
    tokenIdByNameHash[processNameHash(nameByTokenId[_tokenId])] = 0;
    return _setName(_tokenId, _name);
  }

  function setFeeManager(address _newFeeManager) external onlyOwner {
    emit SetFeeManager(_msgSender(), feeManager, _newFeeManager);
    feeManager = _newFeeManager;
  }

  function updateFee(
    address _feeDestination,
    uint256 _claimNameFee,
    uint256 _updateNameFee
  ) external onlyFeeManager {
    feeDestination = _feeDestination;
    claimNameFee = _claimNameFee;
    updateNameFee = _updateNameFee;
    emit UpdateFee(_msgSender(), _feeDestination, _claimNameFee, _updateNameFee);
  }

  function claimFee() external onlyFeeManager {
    require(address(this).balance > 0, "BALANCE_IS_NULL");
    Address.sendValue(payable(feeDestination), address(this).balance);
    emit ClaimFee(_msgSender(), feeDestination, address(this).balance);
  }

  function getLobsterOwner(uint256 _tokenId) public view virtual returns (address);

  function processNameHash(string memory _name) public pure returns (bytes32) {
    require(validateName(_name), "INVALID_NAME");
    return keccak256(abi.encode(StringsUtils._toLower(_name)));
  }

  function validateName(string memory _name) public pure returns (bool) {
    return StringsUtils._validateName(_name);
  }

  function getTokenIdByName(string memory _name) public view returns (uint256) {
    return tokenIdByNameHash[processNameHash(_name)];
  }

  function _takeFee(uint256 _feeAmount) internal {
    require(_feeAmount > 0, "FEE_NOT_SET");
    require(msg.value >= _feeAmount, "FEE_REQUIRED");
    emit TakeNameFee(_msgSender(), msg.value);
  }

  function _setName(uint256 _tokenId, string memory _name) internal returns (bytes32) {
    require(bytes(_name).length != 0, "EMPTY_NAME");

    address lobsterOwner = getLobsterOwner(_tokenId);
    require(lobsterOwner == _msgSender(), "NOT_THE_OWNER");

    bytes32 nameHash = processNameHash(_name);
    require(tokenIdByNameHash[nameHash] == 0, "NAME_ALREADY_CLAIMED");
    tokenIdByNameHash[nameHash] = _tokenId;
    nameByTokenId[_tokenId] = _name;

    emit SetName(lobsterOwner, _tokenId, nameHash, _name);

    return nameHash;
  }
}
