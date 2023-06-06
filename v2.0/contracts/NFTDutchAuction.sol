// SPDX-License-Identifier: MIT
pragma solidity ^0.8.9;

import "@openzeppelin/contracts/interfaces/IERC721.sol";

contract NFTDutchAuction {

    address public  erc721TokenAddress;
    uint256 public  nftTokenId;
    uint256 public  reservePrice;
    uint256 public  numBlocksAuctionOpen;
    uint256 public  offerPriceDecrement;
    IERC721 internal nft;
    uint256 public startBlock;
    uint256 public initialPrice;
    address public winner;
    address payable public owner;


    constructor(address _erc721TokenAddress,uint256 _nftTokenId,uint256 _reservePrice,uint256 _numBlocksAuctionOpen,uint256 _offerPriceDecrement) {
        owner = payable(msg.sender);

        erc721TokenAddress = _erc721TokenAddress;
        nftTokenId = _nftTokenId;
        reservePrice = _reservePrice;
        numBlocksAuctionOpen = _numBlocksAuctionOpen;
        offerPriceDecrement = _offerPriceDecrement;
        nft = IERC721(_erc721TokenAddress);
        require(nft.ownerOf(_nftTokenId) == owner,"The NFT does not belong to the Owner");

        startBlock = block.number;
        initialPrice =reservePrice +(numBlocksAuctionOpen * offerPriceDecrement);
    }

    //Calculate the current accepted price as per dutch auction formula
    function getCurrentPrice() public view returns (uint256) {
        uint256 blocksElapsed = block.number - startBlock;
        if (blocksElapsed >= numBlocksAuctionOpen) {
            return reservePrice;
        } else {
            return initialPrice - (blocksElapsed * offerPriceDecrement);
        }
    }

    function bid() external payable returns (address) {
        //if auction has already been won
        require(winner == address(0), "Auction has already concluded");

        //if auction has expired already
        require((block.number - startBlock) <= numBlocksAuctionOpen,"Auction expired");
        //Get the current accepted price
        uint256 currentPrice = getCurrentPrice();
        
        //if the value sent is less than the current accepted price
        require(msg.value >= currentPrice,"The value sent is not acceptable");

        //Setting the bidder as winner and transfer the NFT to bidder and transfer the bid amount to owner
        winner = msg.sender;
        owner.transfer(msg.value);
        nft.transferFrom(owner, winner, nftTokenId);

        return winner;
    }
}
