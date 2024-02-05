//SPDX-License-Identifier: Unlicense

pragma solidity ^0.8.20;

import "./AttestationConsumer.sol";

contract SocialVerification is AttestationConsumer {
    error AlreadyVerified();

    event NewVerification(uint256 indexed from, address indexed subject, uint64 iat);

    struct VerificationData {
        address to;
        uint64 iat;
    }

    mapping(uint256 => VerificationData) _verified;

    constructor(address allowed) AttestationConsumer(allowed) { }

    function _onNewAttestation(AttestationEvent calldata e) internal override {
        if (_verified[e.from].to != address(0)) {
            revert AlreadyVerified();
        }
        (address to, uint64 iat) = abi.decode(e.data, (address, uint64));
        _verified[e.from] = VerificationData({to: to, iat: iat});
        emit NewVerification(e.from, to, e.iat);
    }

    function getVerifiedAddress(
        uint256 account
    ) external view returns (VerificationData memory) {
        return _verified[account];
    }
}