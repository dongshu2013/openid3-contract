//SPDX-License-Identifier: Unlicense

pragma solidity ^0.8.20;

import "../account/OpenId3Account.sol";

contract OpenId3AccountV2ForTest is OpenId3Account {
    constructor(
        address entryPoint_,
        address admin
    ) OpenId3Account(entryPoint_, admin) {}

    function version() external pure returns (uint256) {
        return 2;
    }
}
