//SPDX-License-Identifier: Unlicense

pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/Ownable.sol";
import "../interfaces/IOpenId3Account.sol";

contract TestAccount is IOpenId3Account, Ownable {
    uint8 private _mode;

    constructor() {
        _transferOwnership(msg.sender);
    }

    function initialize(
        bytes calldata /** adminData **/
    ) external pure {
        return;
    }

    function execute(address dest, uint256 value, bytes calldata func)
        external
    {
        (bool success, bytes memory result) = dest.call{value : value}(func);
        if (!success) {
            assembly {
                revert(add(result, 32), mload(result))
            }
        }
    }
}