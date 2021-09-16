pragma solidity 0.6.12;

interface ILobstersNft {
  function mint(address _to) external;

  function mintMultiple(address _to, uint256 _count) external;
}
