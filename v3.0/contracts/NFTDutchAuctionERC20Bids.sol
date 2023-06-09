// SPDX-License-Identifier: MIT
pragma solidity ^0.8.9;

import "@openzeppelin/contracts/interfaces/IERC721.sol";
import "@openzeppelin/contracts/interfaces/IERC20.sol";

contract NFTDutchAuctionERC20Bids {

    address public  erc721TokenAddress;
    address public  erc20TokenAddress;
    uint256 public  nftTokenId;
    uint256 public  reservePrice;
    uint256 public  numBlocksAuctionOpen;
    uint256 public  offerPriceDecrement;
    IERC721 internal nft;
    IERC20 internal tmpToken;
    uint256 public startBlock;
    uint256 public initialPrice;
    address public winner;
    address payable public owner;


    constructor(address _erc20TokenAddress,address _erc721TokenAddress,uint256 _nftTokenId,uint256 _reservePrice,uint256 _numBlocksAuctionOpen,uint256 _offerPriceDecrement) {
        owner = payable(msg.sender);

        erc721TokenAddress = _erc721TokenAddress;
        erc20TokenAddress = _erc20TokenAddress;
        nftTokenId = _nftTokenId;
        reservePrice = _reservePrice;
        numBlocksAuctionOpen = _numBlocksAuctionOpen;
        offerPriceDecrement = _offerPriceDecrement;
        nft = IERC721(_erc721TokenAddress);
        tmpToken = IERC20(erc20TokenAddress);

        require(nft.ownerOf(_nftTokenId) == owner,"The NFT tokenId does not belong to the Auction's Owner");

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

     function bid(uint256 bidAmount) external returns (address) {
        //if auction has already been won
        require(winner == address(0), "Auction has already concluded");

        //if auction has expired already
        require((block.number - startBlock) <= numBlocksAuctionOpen,"Auction expired");

        //Get the current accepted price as per dutch auction rules
        uint256 currentPrice = getCurrentPrice();
        //if the bidamount value sent is less than the current accepted price
        require(bidAmount >= currentPrice,"The bid amount sent is not acceptable");
        //Check if the bidder has money in their account
        require(bidAmount <= tmpToken.allowance(msg.sender, address(this)),
            "Bid amount was accepted, but bid failed as not enough balance to transfer erc20 token TMP"
        );         
        //Setting the bidder as winner and transfer the NFT to bidder and transfer the bid amount erc20 to owner
        winner = msg.sender;
        tmpToken.transferFrom(winner, owner, bidAmount);
        nft.transferFrom(owner, winner, nftTokenId);

        return winner;
    }
}
