//SPDX-License-Identifier: Unlicense

pragma solidity ^0.8.20;

import "./IAttestationConsumer.sol";

contract SocialVoting is IAttestationConsumer {
    error UnauthorizedCaller();

    event NewVote(address indexed attestation, uint256 from, address to, uint256 day);

    mapping(address => mapping(uint256 => mapping(uint256 => bool))) _voted;
    mapping(address => mapping(address => mapping(uint256 => uint256))) _history;
    address immutable allowed;

    constructor(address _allowed) {
        allowed = _allowed;
    }

    function onNewAttestation(AttestationEvent calldata e) external override {
        if (msg.sender != allowed) {
            revert UnauthorizedCaller();
        }
        uint256 day = e.iat / 86400;
        if (_voted[msg.sender][e.from][day]) {
            return;
        }
        address to = address(bytes20(e.data));
        _history[msg.sender][to][day] = _history[msg.sender][to][day] + 1;
        _voted[msg.sender][e.from][day] = true;
        emit NewVote(msg.sender, e.from, to, day);
    }

    function isVoted(
        address attestation,
        uint256 from,
        uint256 day
    ) external view returns (bool) {
        return _voted[attestation][from][day];
    }

    function totalVoted(
        address attestation,
        uint256 from,
        uint256 start,
        uint256 numOfDays
    ) external view returns (uint256) {
        uint256 total = 0;
        for (uint i = start; i < start + numOfDays; i++) {
            if (_voted[attestation][from][i]) {
                total = total + 1;
            }
        }
        return total;
    }

    function totalConsecutiveVoted(
        address attestation,
        uint256 from,
        uint256 start,
        uint256 numOfDays
    ) external view returns (uint256) {
        uint256 total = 0;
        for (uint i = start; i < start + numOfDays; i++) {
            if (_voted[attestation][from][i]) {
                total = total + 1;
            } else if (total > 0) {
                total = total - 1;
            }
        }
        return total;
    }

    function totalVotes(
        address attestation,
        address to,
        uint256 start,
        uint256 numOfDays
    ) external view returns (uint256[] memory) {
        uint256[] memory votes = new uint256[](numOfDays);
        for (uint256 i = start; start < start + numOfDays; start++) {
            votes[i - start] = _history[attestation][to][i];
        }
        return votes;
    }
}
