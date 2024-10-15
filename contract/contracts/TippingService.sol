// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

contract TippingService is Ownable {
    struct TipStruct {
        address tipper;
        uint256 amount;
        string message;
        uint256 timestamp;
    }

    IERC20 public capyFanToken;
    TipStruct[] public tips;
    uint256 private totalEarnings;

    event TipReceived(address indexed tipper, uint256 amount, string message, uint256 timestamp);
    event TipsWithdrawn(address indexed owner, uint256 amount);

    constructor(address _capyFanTokenAddress) Ownable(msg.sender) {
        capyFanToken = IERC20(_capyFanTokenAddress);
    }

    function Tip(uint256 _amount, string memory _message) external {
        require(_amount > 0, "Tip amount must be greater than 0");
        require(capyFanToken.transferFrom(msg.sender, address(this), _amount), "Token transfer failed");

        tips.push(TipStruct({
            tipper: msg.sender,
            amount: _amount,
            message: _message,
            timestamp: block.timestamp
        }));

        totalEarnings += _amount;

        emit TipReceived(msg.sender, _amount, _message, block.timestamp);
    }

    function getTipCount() external view returns (uint256) {
        return tips.length;
    }

    function getTip(uint256 _index) external view returns (address, uint256, string memory, uint256) {
        require(_index < tips.length, "Invalid tip index");
        TipStruct memory tip = tips[_index];
        return (tip.tipper, tip.amount, tip.message, tip.timestamp);
    }

    function withdrawTips() external onlyOwner {
        uint256 balance = capyFanToken.balanceOf(address(this));
        require(balance > 0, "No tips to withdraw");
        require(capyFanToken.transfer(owner(), balance), "Token transfer failed");
        emit TipsWithdrawn(owner(), balance);
    }

    function getTotalEarnings() external view onlyOwner returns (uint256) {
        return totalEarnings;
    }
}