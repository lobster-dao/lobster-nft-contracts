pragma solidity 0.6.12;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

contract MockERC20 is ERC20 {
  constructor(string memory _name, string memory _symbol, uint256 _totalSupply) public ERC20(_name, _symbol) {
    _mint(msg.sender, _totalSupply);
  }

  function transferAndCall(address to, uint256 value, bytes calldata data) external returns (bool success) {
    return transfer(to, value);
  }
}
