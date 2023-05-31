// SPDX-License-Identifier: UNLICENSED
//version 1.0
pragma solidity ^0.8.9;

// Uncomment this line to use console.log
// import "hardhat/console.sol";

 contract BasicDutchAuction {

    //the minimum amount of wei that the seller is willing to accept for the item
    uint256 public reservePrice;

    // the number of blockchain blocks that the auction is open for
    uint256 public numBlocksAuctionOpen;

    //the amount of wei that the auction price should decrease by during each subsequent block.
    uint256 public offerPriceDecrement;

    uint256 public initialPrice;

    //The block number for which auction was deployed
    uint256 public initialBlock;

    //The seller is the owner of the contract
    address payable public owner;

    constructor(uint256 _reservePrice, uint256 _numBlocksAuctionOpen, uint256 _offerPriceDecrement) {
        reservePrice = _reservePrice;
        numBlocksAuctionOpen = _numBlocksAuctionOpen;
        offerPriceDecrement = _offerPriceDecrement;
        owner = payable(msg.sender);
        initialBlock = block.number;
        initialPrice = _reservePrice + (_numBlocksAuctionOpen * _offerPriceDecrement);
    }

    // bid can be called by anyone to place a bid
    function bid() public payable returns(address) {
        // if the auction is over, the bid is reverted
        require(block.number <= initialBlock + numBlocksAuctionOpen, "Auction is Ended");
        // calculate the current price
        uint currentPrice = initialPrice - ((block.number - initialBlock) * offerPriceDecrement);
        //if the bid price is lower than the current price,reject the bid
        require(msg.value >= currentPrice, "bid price is lower than the current price");
        // when bid is accepted, transfer token to owner
        owner.transfer(msg.value);
        return msg.sender;
    }
}
