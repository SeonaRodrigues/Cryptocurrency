import { time, loadFixture } from "@nomicfoundation/hardhat-network-helpers";
import { mine } from "@nomicfoundation/hardhat-network-helpers";
import { expect } from "chai";
import { ethers } from "hardhat";

describe("NFTDutchAuction", function () {
  
  const NUM_BLOCKS_AUCTION_OPEN = 10;
  const RESERVE_PRICE = 100;
  const OFFER_PRICE_DECREMENT = 2;
  const NFT_TOKEN_ID = 0;
  const TOKEN_URI = "https://www.google.com/";

  //Deployed Contract
  async function deployNFTDAFixture() {
     // Contracts are deployed using the first account
     const [owner, account1, account2] = await ethers.getSigners();

     //Deploy and mint NFT contract
     const NFT = await ethers.getContractFactory("NFT");
     const nFT = await NFT.deploy();
     await nFT.mintNFT(owner.address, TOKEN_URI);
 
     //Deploy and mint TMP tokens
     const TempoToken = await ethers.getContractFactory("TempToken");
     const tempoToken = await TempoToken.deploy();
     await tempoToken.mint(account1.address, 1000);
 
     const NFTDutchAuctionERC20Bids = await ethers.getContractFactory("NFTDutchAuctionERC20Bids");
     const nftDutchAuctionERC20Bids = await NFTDutchAuctionERC20Bids.deploy(tempoToken.address,nFT.address,NFT_TOKEN_ID,RESERVE_PRICE,NUM_BLOCKS_AUCTION_OPEN,OFFER_PRICE_DECREMENT);
 
     nFT.approve(nftDutchAuctionERC20Bids.address, NFT_TOKEN_ID);
 
     return {
       nFT,
       tempoToken,
       nftDutchAuctionERC20Bids,
       owner,
       account1,
       account2,
     };
  }

  describe("Deployment", function () {
    it("Must set the right owner", async function () {
      const { nftDutchAuctionERC20Bids, owner } = await loadFixture(
        deployNFTDAFixture
      );

      expect(await nftDutchAuctionERC20Bids.owner()).to.equal(owner.address);
    });

    it("Must have no winner", async function () {
      const { nftDutchAuctionERC20Bids } = await loadFixture(
        deployNFTDAFixture
      );

      expect(await nftDutchAuctionERC20Bids.winner()).to.equal(
        ethers.constants.AddressZero
      );
    });

    it("Must not allow Auction creator to deploy contract if the NFT does not belong to them", async function () {
      const { nFT, tempoToken, account1 } = await loadFixture(
        deployNFTDAFixture
      );

      //Mint NFT with tokenId 1 to account1
      await expect(nFT.mintNFT(account1.address, "Test URI"))
        .to.emit(nFT, "Transfer")
        .withArgs(ethers.constants.AddressZero, account1.address, 1);

      //Deploy NFT contract with account1's tokenId, should fail
      const NFTDutchAuctionERC20Bids = await ethers.getContractFactory(
        "NFTDutchAuctionERC20Bids"
      );
      await expect(
        NFTDutchAuctionERC20Bids.deploy(
          tempoToken.address,
          nFT.address,
          1,
          RESERVE_PRICE,
          NUM_BLOCKS_AUCTION_OPEN,
          OFFER_PRICE_DECREMENT
        )
      ).to.revertedWith(
        "The NFT tokenId does not belong to the Auction's Owner"
      );
    });

    it("Must have the initial price as per Dutch Auction formula", async function () {
      const { nftDutchAuctionERC20Bids } = await loadFixture(
        deployNFTDAFixture
      );

      const initialPrice =
        RESERVE_PRICE + NUM_BLOCKS_AUCTION_OPEN * OFFER_PRICE_DECREMENT;

      expect(await nftDutchAuctionERC20Bids.initialPrice()).to.equal(
        initialPrice
      );
    });
  });

  describe("Bids", function () {
    it("Must have expected current price after 5 blocks as per formula", async function () {
      const { nftDutchAuctionERC20Bids } = await loadFixture(
        deployNFTDAFixture
      );

      const initialPrice =
        RESERVE_PRICE + NUM_BLOCKS_AUCTION_OPEN * OFFER_PRICE_DECREMENT;

      const priceAfter5Blocks = initialPrice - 5 * OFFER_PRICE_DECREMENT;
      //Mine 5 blocks, since 1 block was already mined
      //when we approved the Auction contract for NFT Transfer
      await mine(4);

      expect(await nftDutchAuctionERC20Bids.getCurrentPrice()).to.equal(
        priceAfter5Blocks
      );
    });

    it("Should reject low bids", async function () {
      const { nftDutchAuctionERC20Bids, account1 } = await loadFixture(
        deployNFTDAFixture
      );

      //Mine 1 block, 1 already mined
      //when we approved the Auction contract for NFT Transfer
      await mine(1);

      //This is the Bid price which would be accepted three blocks later
      //But should be rejected now
      const lowBidPrice =RESERVE_PRICE +
        NUM_BLOCKS_AUCTION_OPEN * OFFER_PRICE_DECREMENT -
        OFFER_PRICE_DECREMENT * 5;

      await expect(
        nftDutchAuctionERC20Bids.connect(account1).bid(lowBidPrice)
      ).to.be.revertedWith("The bid amount sent is not acceptable");

      //Test with an arbitrarily low value too
      await expect(nftDutchAuctionERC20Bids.connect(account1).bid(50)).to.be.revertedWith("The bid amount sent is not acceptable");});

    it("Must acknowledge bids higher than currentPrice but still fail if proper allowance is not set to the contract's address", async function () {
      const { nftDutchAuctionERC20Bids, tempoToken, account1 } =
        await loadFixture(deployNFTDAFixture);
      //mine 5 blocks
      await mine(5);

      const initialPrice =
        RESERVE_PRICE + NUM_BLOCKS_AUCTION_OPEN * OFFER_PRICE_DECREMENT;
      //Get price after 4 blocks
      const highBidPrice = initialPrice - OFFER_PRICE_DECREMENT * 4;

      //Bid function should succeed
      await expect(
        nftDutchAuctionERC20Bids.connect(account1).bid(highBidPrice)
      ).to.be.revertedWith(
        "Bid amount was accepted, but bid failed as not enough balance to transfer erc20 token TMP"
      );

      //Approve auction contract to spend less tokens than bid price, should be reverted with same error
      await tempoToken
        .connect(account1)
        .approve(nftDutchAuctionERC20Bids.address, highBidPrice - 10);

      await expect(
        nftDutchAuctionERC20Bids.connect(account1).bid(highBidPrice)
      ).to.be.revertedWith(
        "Bid amount was accepted, but bid failed as not enough balance to transfer erc20 token TMP"
      );
    });

    it("Must accept bids higher than currentPrice and set winner as bidder's address", async function () {
      const { nftDutchAuctionERC20Bids, tempoToken, account1 } =
        await loadFixture(deployNFTDAFixture);
      //mine 5 blocks
      await mine(5);

      const initialPrice =
        RESERVE_PRICE + NUM_BLOCKS_AUCTION_OPEN * OFFER_PRICE_DECREMENT;
      //Get price after 4 blocks
      const highBidPrice = initialPrice - OFFER_PRICE_DECREMENT * 4;

      //Set allowance for auction contract to spend bid amount
      await tempoToken
        .connect(account1)
        .approve(nftDutchAuctionERC20Bids.address, highBidPrice);

      //Bid function should succeed
      expect(await nftDutchAuctionERC20Bids.connect(account1).bid(highBidPrice))
        .to.not.be.reverted;

      //Winner should be account1
      expect(await nftDutchAuctionERC20Bids.winner()).to.equal(
        account1.address
      );
    });

    it("Must reject bids after a winning bid is already accepted", async function () {
      const { nftDutchAuctionERC20Bids, tempoToken, account1, account2 } =
        await loadFixture(deployNFTDAFixture);
      //mine 5 blocks
      await mine(5);

      const initialPrice =
        RESERVE_PRICE + NUM_BLOCKS_AUCTION_OPEN * OFFER_PRICE_DECREMENT;
      //Get price after 4 blocks
      const highBidPrice = initialPrice - OFFER_PRICE_DECREMENT * 4;

      //Set allowance for auction contract to spend bid amount
      await tempoToken
        .connect(account1)
        .approve(nftDutchAuctionERC20Bids.address, highBidPrice);

      //Bid function should succeed
      expect(await nftDutchAuctionERC20Bids.connect(account1).bid(highBidPrice))
        .to.not.be.reverted;

      //Bid should be rejected
      await expect(
        nftDutchAuctionERC20Bids.connect(account2).bid(highBidPrice)
      ).to.be.revertedWith("Auction has already concluded");
    });

    it("Bids should not be accepted after the auction expires", async function () {
      const { nftDutchAuctionERC20Bids, account1, account2 } =
        await loadFixture(deployNFTDAFixture);
      //mine 5 blocks
      await mine(NUM_BLOCKS_AUCTION_OPEN + 1);

      const initialPrice =
        RESERVE_PRICE + NUM_BLOCKS_AUCTION_OPEN * OFFER_PRICE_DECREMENT;
      //Get price after 4 blocks
      const highBidPrice = initialPrice - OFFER_PRICE_DECREMENT * 4;

      //Bid function should fail with auction expired message
      await expect(
        nftDutchAuctionERC20Bids.connect(account2).bid(highBidPrice)
      ).to.be.revertedWith("Auction expired");
    });

    it("Must return reservePrice when max number of auction blocks have elapsed", async function () {
      const { nftDutchAuctionERC20Bids } = await loadFixture(
        deployNFTDAFixture
      );
      //mine 10 blocks
      await mine(NUM_BLOCKS_AUCTION_OPEN);
      //Should return reserve price after 10 blocks are mined
      expect(await nftDutchAuctionERC20Bids.getCurrentPrice()).to.equal(
        RESERVE_PRICE
      );

      //Mine 5 more blocks
      await mine(5);
      //Should return reserve price after 15 blocks are mined
      expect(await nftDutchAuctionERC20Bids.getCurrentPrice()).to.equal(
        RESERVE_PRICE
      );
    });

    it("Must send the accepted bid amount in TMP tokens from bidder's account to owner's account", async function () {
      const { nftDutchAuctionERC20Bids, tempoToken, owner, account1 } =
        await loadFixture(deployNFTDAFixture);
      //mine 5 blocks
      await mine(5);

      //Amount of TMP in owner's account
      const ownerTMP: number = (
        await tempoToken.balanceOf(owner.address)
      ).toNumber();
      //Amount of TMP in bidder's account
      const bidderTMP: number = (
        await tempoToken.balanceOf(account1.address)
      ).toNumber();

      const initialPrice =
        RESERVE_PRICE + NUM_BLOCKS_AUCTION_OPEN * OFFER_PRICE_DECREMENT;
      //Get price after 4 blocks
      const highBidPrice = initialPrice - OFFER_PRICE_DECREMENT * 4;

      //Set allowance for auction contract to spend bid amount
      await tempoToken
        .connect(account1)
        .approve(nftDutchAuctionERC20Bids.address, highBidPrice);

      //Bid function should succeed
      await expect(nftDutchAuctionERC20Bids.connect(account1).bid(highBidPrice))
        .to.not.be.reverted;

      //Owner's TMP balance should be sum of previous balance & bid amount
      expect(await tempoToken.balanceOf(owner.address)).to.equal(
        ownerTMP + highBidPrice
      );

      //Bidder's TMP balance should be difference of previous balance & bid amount
      expect(await tempoToken.balanceOf(account1.address)).to.equal(
        bidderTMP - highBidPrice
      );
    });

    it("Must transfer the NFT from Owner's account to Bidder's account", async function () {
      const {
        nftDutchAuctionERC20Bids,
        tempoToken,
        nFT,
        owner,
        account1,
      } = await loadFixture(deployNFTDAFixture);
      //mine 5 blocks
      await mine(5);

      const initialPrice =
        RESERVE_PRICE + NUM_BLOCKS_AUCTION_OPEN * OFFER_PRICE_DECREMENT;
      //Get price after 4 blocks
      const highBidPrice = initialPrice - OFFER_PRICE_DECREMENT * 4;

      //Set allowance for auction contract to spend bid amount
      await tempoToken
        .connect(account1)
        .approve(nftDutchAuctionERC20Bids.address, highBidPrice);

      //Bid function should succeed and teansfer NFT from account1 to owner
      await expect(nftDutchAuctionERC20Bids.connect(account1).bid(highBidPrice))
        .to.emit(nFT, "Transfer")
        .withArgs(owner.address, account1.address, NFT_TOKEN_ID);

      //NFT contract should reflect the NFT ownership in account1's address

      expect(await nFT.ownerOf(NFT_TOKEN_ID)).to.equal(
        account1.address
      );
    });

    it("Owner should still own the NFT after the auction expires if there is no winning bid", async function () {
      const { nftDutchAuctionERC20Bids, nFT, owner, account2 } =
        await loadFixture(deployNFTDAFixture);
      //mine 5 blocks
      await mine(NUM_BLOCKS_AUCTION_OPEN + 1);

      const initialPrice =
        RESERVE_PRICE + NUM_BLOCKS_AUCTION_OPEN * OFFER_PRICE_DECREMENT;
      //Get price after 4 blocks
      const highBidPrice = initialPrice - OFFER_PRICE_DECREMENT * 4;

      //Bid function should fail with auction expired message
      await expect(
        nftDutchAuctionERC20Bids.connect(account2).bid(highBidPrice)
      ).to.be.revertedWith("Auction expired");

      //NFT should still belong to owner
      expect(await nFT.ownerOf(NFT_TOKEN_ID)).to.equal(
        owner.address
      );
    });
  });
});


//NFT
describe("NFT", function () {
  const TOKEN_URI = "https://www.google.com/";

  //Fixture for deploying the NFT
  async function deployNFTFixture() {
    const [owner, account1, account2] = await ethers.getSigners();
    const NFT = await ethers.getContractFactory("NFT");
    const nFT = await NFT.deploy();
    return { nFT, owner, account1, account2 };
  }

  describe("Deployment", function () {
    it("Must allow owner to mint an NFT and emit minting/transfer event", async function () {
      const { nFT, owner } = await loadFixture(deployNFTFixture);

      await expect(nFT.mintNFT(owner.address, TOKEN_URI))
        .to.emit(nFT, "Transfer")
        .withArgs(ethers.constants.AddressZero, owner.address, 0);
    });

    it("Must not allow non-owner addresses to mint an NFT", async function () {
      const { nFT, owner, account1 } = await loadFixture(
        deployNFTFixture
      );

      await expect(
        nFT.connect(account1).mintNFT(owner.address, TOKEN_URI)
      ).to.be.revertedWith("Ownable: caller is not the owner");
    });

  });

  describe("Transfers & Approvals", function () {
    it("Must allow owner to transfer the NFT", async function () {
      const { nFT, owner, account1 } = await loadFixture(
        deployNFTFixture
      );

      //Mint the NFT
      await nFT.mintNFT(owner.address, TOKEN_URI);

      await expect(
        nFT.transferFrom(owner.address, account1.address, 0)
      )
        .to.emit(nFT, "Transfer")
        .withArgs(owner.address, account1.address, 0);
    });

    it("Must allow recipient to transfer the NFT after receiving the token", async function () {
      const { nFT, owner, account1, account2 } = await loadFixture(
        deployNFTFixture
      );

      //Mint the NFT
      await nFT.mintNFT(owner.address, TOKEN_URI);

      //Transfer token to account1
      await nFT.transferFrom(owner.address, account1.address, 0);

      await expect(
        nFT
          .connect(account1)
          .transferFrom(account1.address, account2.address, 0)
      )
        .to.emit(nFT, "Transfer")
        .withArgs(account1.address, account2.address, 0);
    });

    it("Must not allow non-token-owning addresses to transfer the NFT unless approved", async function () {
      const { nFT, owner, account1, account2 } = await loadFixture(
        deployNFTFixture
      );

      //Mint the NFT
      await nFT.mintNFT(owner.address, TOKEN_URI);

      //Transfer token to account1
      await nFT.transferFrom(owner.address, account1.address, 0);

      await expect(
        nFT
          .connect(account2)
          .transferFrom(account1.address, account2.address, 0)
      ).to.be.revertedWith("ERC721: caller is not token owner or approved");

      await expect(
        nFT
          .connect(owner)
          .transferFrom(account1.address, account2.address, 0)
      ).to.be.revertedWith("ERC721: caller is not token owner or approved");
    });

    it("Must allow only token-owner addresses to set ERC721 approvals", async function () {
      const { nFT, owner, account1, account2 } = await loadFixture(
        deployNFTFixture
      );

      //Mint the NFT
      await nFT.mintNFT(owner.address, TOKEN_URI);

      //Transfer token to account1
      await nFT.transferFrom(owner.address, account1.address, 0);

      //Reject approval setting from account2
      await expect(
        nFT.connect(account2).approve(account2.address, 0)
      ).to.be.revertedWith(
        "ERC721: approve caller is not token owner or approved for all"
      );

      //Reject approval setting from contract owner
      await expect(
        nFT.connect(owner).approve(account2.address, 0)
      ).to.be.revertedWith(
        "ERC721: approve caller is not token owner or approved for all"
      );

      //Allow token holder to set approval
      //Reject approval setting from account2
      await expect(
        nFT.connect(account1).approve(account2.address, 0)
      )
        .to.emit(nFT, "Approval")
        .withArgs(account1.address, account2.address, 0);
    });

    it("Must allow approved addresses to transfer the NFT", async function () {
      const { nFT, owner, account1, account2 } = await loadFixture(
        deployNFTFixture
      );

      //Mint the NFT
      await nFT.mintNFT(owner.address, TOKEN_URI);

      //Transfer token to account1
      await nFT.transferFrom(owner.address, account1.address, 0);

      //Approve the contract owner to manage account1's transactions
      nFT.connect(account1).approve(owner.address, 0);

      //Still won't allow account2 to transfer as it is not approved
      await expect(
        nFT
          .connect(account2)
          .transferFrom(account1.address, account2.address, 0)
      ).to.be.revertedWith("ERC721: caller is not token owner or approved");

      //Should allow the approved owner address to transfer the token
      await expect(
        nFT
          .connect(owner)
          .transferFrom(account1.address, account2.address, 0)
      )
        .to.emit(nFT, "Transfer")
        .withArgs(account1.address, account2.address, 0);
    });
  });
});



//temporary Token
describe("TempToken", function () {
  //Fixture for deploying the NFT
  async function deployTokenFixture() {
    const [owner, account1, account2] = await ethers.getSigners();
    const TempoToken = await ethers.getContractFactory("TempToken");
    const tempoToken = await TempoToken.deploy();
    return { tempoToken, owner, account1, account2 };
  }

  describe("Deployment", function () {
    it("Must allow owner to mint tokens and emit minting/transfer event", async function () {
      const { tempoToken, owner } = await loadFixture(deployTokenFixture);

      await expect(tempoToken.mint(owner.address, 1000))
        .to.emit(tempoToken, "Transfer")
        .withArgs(ethers.constants.AddressZero, owner.address, 1000);
    });

    it("Must not allow non-owner addresses to mint Tokens", async function () {
      const { tempoToken, owner, account1 } = await loadFixture(
        deployTokenFixture
      );

      await expect(
        tempoToken.connect(account1).mint(owner.address, 1000)
      ).to.be.revertedWith("Ownable: caller is not the owner");
    });
  });

  describe("Transfers & Approvals", function () {
    it("Must allow owner to transfer the NFT", async function () {
      const { tempoToken, owner, account1 } = await loadFixture(
        deployTokenFixture
      );

      //Mint the NFT
      await tempoToken.mint(account1.address, 1000);

      await expect(tempoToken.transfer(account1.address, 50))
        .to.emit(tempoToken, "Transfer")
        .withArgs(owner.address, account1.address, 50);
    });

    it("Must not allow non-token-owning addresses to transfer the NFT unless approved", async function () {
      const { tempoToken, owner, account1, account2 } = await loadFixture(
        deployTokenFixture
      );

      //Mint the NFT
      await tempoToken.mint(account1.address, 100);

      //Transfer token to account2
      await tempoToken.connect(account1).transfer(account2.address, 50);

      await expect(
        tempoToken
          .connect(account2)
          .transferFrom(account1.address, account2.address, 25)
      ).to.be.revertedWith("ERC20: insufficient allowance");
    });

    it("Must allow approved addresses to transfer tokens", async function () {
      const { tempoToken, owner, account1, account2 } = await loadFixture(
        deployTokenFixture
      );

      //Mint the NFT
      await tempoToken.mint(account1.address, 1000);

      //Approve the contract owner to manage account1's transactions
      tempoToken.connect(account1).approve(account2.address, 500);

      //Should allow the approved owner address to transfer the token
      await expect(
        tempoToken
          .connect(account2)
          .transferFrom(account1.address, account2.address, 500)
      )
        .to.emit(tempoToken, "Transfer")
        .withArgs(account1.address, account2.address, 500);
    });
  });
});



