// SPDX-License-Identifier: MIT

pragma solidity 0.6.12;

library StringsUtils {
  function _toLower(string memory str) internal pure returns (string memory) {
    bytes memory byteStr = bytes(str);
    bytes memory resultStr = new bytes(byteStr.length);

    for (uint256 i = 0; i < byteStr.length; ++i) {
      if ((uint8(byteStr[i]) >= 65) && (uint8(byteStr[i]) <= 90)) {
        resultStr[i] = bytes1(uint8(byteStr[i]) + 32);
      } else {
        resultStr[i] = byteStr[i];
      }
    }

    return string(resultStr);
  }

  function _validateName(string memory str) internal pure returns (bool) {
    bytes memory byteStr = bytes(str);

    if (byteStr.length < 1 || byteStr.length > 30) return false;
    if (byteStr[0] == 0x20) return false;
    if (byteStr[byteStr.length - 1] == 0x20) return false;

    bytes1 lastCh = byteStr[0];

    for (uint256 i = 0; i < byteStr.length; ++i) {
      bytes1 ch = byteStr[i];

      if (ch == 0x20 && lastCh == 0x20) return false; // double space

      if (
        !(ch >= 0x30 && ch <= 0x39) && // 0-9
        !(ch >= 0x41 && ch <= 0x5A) && // A-Z
        !(ch >= 0x61 && ch <= 0x7A) && // a-z
        !(ch == 0x20) // space
      ) return false;

      lastCh = ch;
    }

    return true;
  }
}
