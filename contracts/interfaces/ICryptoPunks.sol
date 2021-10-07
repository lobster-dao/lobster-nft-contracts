pragma solidity 0.6.12;

interface ICryptoPunks {
  function punkIndexToAddress(uint256 _index) external view returns (address);
}
