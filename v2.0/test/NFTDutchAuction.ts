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

  async function deployNFTDAFixture() {
    // Contracts are deployed using the first signer/account by default
    const [owner, account1, account2] = await ethers.getSigners();

    //Deploy and mint NFT contract
    const NFT = await ethers.getContractFactory("NFT");
    const nFT = await NFT.deploy();
    await (await nFT.mintNFT(owner.address, TOKEN_URI)).to;
    const NFTDutchAuction = await ethers.getContractFactory("NFTDutchAuction");
    const nftDutchAuction = await NFTDutchAuction.deploy(nFT.address,NFT_TOKEN_ID,RESERVE_PRICE,NUM_BLOCKS_AUCTION_OPEN,OFFER_PRICE_DECREMENT);
    nFT.approve(nftDutchAuction.address, NFT_TOKEN_ID);
    return { nFT, nftDutchAuction, owner, account1, account2 };
  }

  describe("Deployment", function () {
    it("Should set the right owner", async function () {
      const { nftDutchAuction, owner } = await loadFixture(deployNFTDAFixture);

      expect(await nftDutchAuction.owner()).to.equal(owner.address);
    });

    it("Should have no winner", async function () {
      const { nftDutchAuction } = await loadFixture(deployNFTDAFixture);
      expect(await nftDutchAuction.winner()).to.equal(ethers.constants.AddressZero);
    });

    it("Should not allow Auction creator to deploy contract if the NFT does not belong to them", async function () {
      const { nFT, account1 } = await loadFixture(deployNFTDAFixture);

      //Mint NFT with tokenId 1 to account1
      await expect(nFT.mintNFT(account1.address, "Test URI"))
        .to.emit(nFT, "Transfer")
        .withArgs(ethers.constants.AddressZero, account1.address, 1);

      //Deploy NFT contract with account1's tokenId, should fail
      const NFTDutchAuction = await ethers.getContractFactory(
        "NFTDutchAuction"
      );
      await expect(NFTDutchAuction.deploy(
          nFT.address,
          1,
          RESERVE_PRICE,
          NUM_BLOCKS_AUCTION_OPEN,
          OFFER_PRICE_DECREMENT
        )
      ).to.revertedWith(
        "The NFT does not belong to the Owner"
      );
    });

    it("Must have the initial price as per Dutch Auction requirement", async function () {
      const { nftDutchAuction } = await loadFixture(deployNFTDAFixture);

      const initialPrice =
        RESERVE_PRICE + NUM_BLOCKS_AUCTION_OPEN * OFFER_PRICE_DECREMENT;

      expect(await nftDutchAuction.initialPrice()).to.equal(initialPrice);
    });
  });

  describe("Bids", function () {
    it("Must reject low bids", async function () {
      const { nftDutchAuction, account1 } = await loadFixture(deployNFTDAFixture);

      //Mine 1 block, 1 already mined
      //when we approved the Auction contract for NFT Transfer
      await mine(1);

      //This is the Bid price which would be accepted three blocks later
      //But should be rejected now
      const lowBidPrice =RESERVE_PRICE +NUM_BLOCKS_AUCTION_OPEN * OFFER_PRICE_DECREMENT -OFFER_PRICE_DECREMENT * 5;

      await expect(nftDutchAuction.connect(account1).bid({value: lowBidPrice,})
      ).to.be.revertedWith("The value sent is not acceptable");

      //Test with an arbitrarily low value too
      await expect(nftDutchAuction.connect(account1).bid({value: 50,})
      ).to.be.revertedWith("The value sent is not acceptable");
    });

    it("Must accept bids higher than currentPrice and set winner as bidder's address", async function () {
      const { nftDutchAuction, account1 } = await loadFixture(deployNFTDAFixture);
      //mine 5 blocks
      await mine(5);

      const initialPrice =RESERVE_PRICE + NUM_BLOCKS_AUCTION_OPEN * OFFER_PRICE_DECREMENT;
      //Get price after 4 blocks
      const highBidPrice = initialPrice - OFFER_PRICE_DECREMENT * 4;

      //Bid function should succeed
      expect(await nftDutchAuction.connect(account1).bid({value: highBidPrice,})
      ).to.not.be.reverted;

      //Winner should be account1
      expect(await nftDutchAuction.winner()).to.equal(account1.address);
    });

    it("Should reject bids after a winning bid is already accepted", async function () {
      const { nftDutchAuction, account1, account2 } = await loadFixture(deployNFTDAFixture);
      //mine 5 blocks
      await mine(5);

      const initialPrice =RESERVE_PRICE + NUM_BLOCKS_AUCTION_OPEN * OFFER_PRICE_DECREMENT;
      //Get price after 4 blocks
      const highBidPrice = initialPrice - OFFER_PRICE_DECREMENT * 4;

      //Bid function should succeed
      expect(await nftDutchAuction.connect(account1).bid({value: highBidPrice,})).to.not.be.reverted;

      //Bid should be rejected
      await expect(nftDutchAuction.connect(account2).bid({value: highBidPrice,})).to.be.revertedWith("Auction has already concluded");
    });

    it("Bids should not be accepted after the auction expires", async function () {
      const { nftDutchAuction, account1, account2 } = await loadFixture(deployNFTDAFixture);
      //mine 5 blocks
      await mine(NUM_BLOCKS_AUCTION_OPEN + 1);

      const initialPrice =RESERVE_PRICE + NUM_BLOCKS_AUCTION_OPEN * OFFER_PRICE_DECREMENT;
      //Get price after 4 blocks
      const highBidPrice = initialPrice - OFFER_PRICE_DECREMENT * 4;

      //Bid function should fail with auction expired message
      await expect(nftDutchAuction.connect(account2).bid({value: highBidPrice,})).to.be.revertedWith("Auction expired");
    });

    it("Should return reservePrice when max number of auction blocks have elapsed", async function () {
      const { nftDutchAuction } = await loadFixture(deployNFTDAFixture);
      //mine 10 blocks
      await mine(NUM_BLOCKS_AUCTION_OPEN);
      //Should return reserve price after 10 blocks are mined
      expect(await nftDutchAuction.getCurrentPrice()).to.equal(RESERVE_PRICE);

      //Mine 5 more blocks
      await mine(5);
      //Should return reserve price after 15 blocks are mined
      expect(await nftDutchAuction.getCurrentPrice()).to.equal(RESERVE_PRICE);
    });

    it("Should send the accepted bid wei value from bidder's account to owner's account", async function () {
      const { nftDutchAuction, owner, account1 } = await loadFixture(
        deployNFTDAFixture
      );
      //mine 5 blocks
      await mine(5);

      const initialPrice =
        RESERVE_PRICE + NUM_BLOCKS_AUCTION_OPEN * OFFER_PRICE_DECREMENT;
      //Get price after 4 blocks
      const highBidPrice = initialPrice - OFFER_PRICE_DECREMENT * 4;

      //Bid function should succeed and teansfer wei value from account1 to owner
      await expect(
        nftDutchAuction.connect(account1).bid({
          value: highBidPrice,
        })
      ).to.changeEtherBalances(
        [account1, owner],
        [-highBidPrice, highBidPrice]
      );
    });

    it("Should transfer the NFT from Owner's account to Bidder's account", async function () {
      const { nftDutchAuction, nFT, owner, account1 } =
        await loadFixture(deployNFTDAFixture);
      //mine 5 blocks
      await mine(5);

      const initialPrice =
        RESERVE_PRICE + NUM_BLOCKS_AUCTION_OPEN * OFFER_PRICE_DECREMENT;
      //Get price after 4 blocks
      const highBidPrice = initialPrice - OFFER_PRICE_DECREMENT * 4;

      //Bid function should succeed and teansfer wei value from account1 to owner
      await expect(
        nftDutchAuction.connect(account1).bid({
          value: highBidPrice,
        })
      )
        .to.emit(nFT, "Transfer")
        .withArgs(owner.address, account1.address, NFT_TOKEN_ID);

      //NFT contract should reflect the NFT ownership in account1's address

      expect(await nFT.ownerOf(NFT_TOKEN_ID)).to.equal(
        account1.address
      );
    });

    it("Owner should still own the NFT after the auction expires if there is no winning bid", async function () {
      const { nftDutchAuction, nFT, owner, account2 } =
        await loadFixture(deployNFTDAFixture);
      //mine 5 blocks
      await mine(NUM_BLOCKS_AUCTION_OPEN + 1);

      const initialPrice =
        RESERVE_PRICE + NUM_BLOCKS_AUCTION_OPEN * OFFER_PRICE_DECREMENT;
      //Get price after 4 blocks
      const highBidPrice = initialPrice - OFFER_PRICE_DECREMENT * 4;

      //Bid function should fail with auction expired message
      await expect(
        nftDutchAuction.connect(account2).bid({
          value: highBidPrice,
        })
      ).to.be.revertedWith("Auction expired");

      //NFT should still belong to owner
      expect(await nFT.ownerOf(NFT_TOKEN_ID)).to.equal(
        owner.address
      );
    });
  });
});

describe("NFT", function () {
  const TOKEN_URI = "https://www.google.com/";

  //Fixture for deploying the NFT contract
  async function deployNFTFixture() {
    const [owner, account1, account2] = await ethers.getSigners();
    const NFT = await ethers.getContractFactory("NFT");
    const nFT = await NFT.deploy();
    return { nFT, owner, account1, account2 };
  }

  describe("Deployment", function () {

    it("Should allow owner to mint an NFT event", async function () {
      const { nFT, owner } = await loadFixture(deployNFTFixture);
      await expect(nFT.mintNFT(owner.address, TOKEN_URI))
        .to.emit(nFT, "Transfer")
        .withArgs(ethers.constants.AddressZero, owner.address, 0);
    });

    it("Should not allow non-owner to mint an NFT", async function () {
      const { nFT, owner, account1 } = await loadFixture(deployNFTFixture);
      await expect(nFT.connect(account1).mintNFT(owner.address, TOKEN_URI)).to.be.revertedWith("Ownable: caller is not the owner");
    });
  });

  describe("Transfers and Approvals", function () {
    it("Should allow owner to transfer the NFT", async function () {
      const { nFT, owner, account1 } = await loadFixture(deployNFTFixture);
      //Mint the NFT
      await nFT.mintNFT(owner.address, TOKEN_URI);

      await expect(nFT.transferFrom(owner.address, account1.address, 0))
        .to.emit(nFT, "Transfer")
        .withArgs(owner.address, account1.address, 0);
    });

    it("Should allow recipient to transfer the NFT after receiving the token", async function () {
      const { nFT, owner, account1, account2 } = await loadFixture(deployNFTFixture);

      //Mint the NFT
      await nFT.mintNFT(owner.address, TOKEN_URI);

      //Transfer token to account1
      await nFT.transferFrom(owner.address, account1.address, 0);

      await expect(nFT.connect(account1).transferFrom(account1.address, account2.address, 0))
        .to.emit(nFT, "Transfer")
        .withArgs(account1.address, account2.address, 0);
    });

    it("Should not allow non-token-owning addresses to transfer the NFT unless approved", async function () {
      const { nFT, owner, account1, account2 } = await loadFixture(deployNFTFixture);

      //Mint the NFT
      await nFT.mintNFT(owner.address, TOKEN_URI);

      //Transfer token to account1
      await nFT.transferFrom(owner.address, account1.address, 0);

      await expect(nFT.connect(account2).transferFrom(account1.address, account2.address, 0)
      ).to.be.revertedWith("ERC721: caller is not token owner or approved");

      await expect(nFT.connect(owner).transferFrom(account1.address, account2.address, 0)
      ).to.be.revertedWith("ERC721: caller is not token owner or approved");
    });

    it("Should allow only token-owner addresses to set ERC721 approvals", async function () {
      const { nFT, owner, account1, account2 } = await loadFixture(deployNFTFixture);

      //Mint the NFT
      await nFT.mintNFT(owner.address, TOKEN_URI);

      //Transfer token to account1
      await nFT.transferFrom(owner.address, account1.address, 0);

      //Reject approval setting from account2
      await expect(nFT.connect(account2).approve(account2.address, 0)).to.be.revertedWith("ERC721: approve caller is not token owner or approved for all");

      //Reject approval setting from contract owner
      await expect(nFT.connect(owner).approve(account2.address, 0)).to.be.revertedWith(
        "ERC721: approve caller is not token owner or approved for all"
      );

      //Allow token holder to set approval
      //Reject approval setting from account2
      await expect(nFT.connect(account1).approve(account2.address, 0))
        .to.emit(nFT, "Approval")
        .withArgs(account1.address, account2.address, 0);
    });

    it("Should allow approved addresses to transfer the NFT", async function () {
      const { nFT, owner, account1, account2 } = await loadFixture(deployNFTFixture);

      //Mint the NFT
      await nFT.mintNFT(owner.address, TOKEN_URI);

      //Transfer token to account1
      await nFT.transferFrom(owner.address, account1.address, 0);

      //Approve the contract owner to manage account1's transactions
      nFT.connect(account1).approve(owner.address, 0);

      //Still won't allow account2 to transfer as it is not approved
      await expect(nFT.connect(account2).transferFrom(account1.address, account2.address, 0)
      ).to.be.revertedWith("ERC721: caller is not token owner or approved");

      //Should allow the approved owner address to transfer the token
      await expect(nFT.connect(owner).transferFrom(account1.address, account2.address, 0)
      ).to.emit(nFT, "Transfer")
        .withArgs(account1.address, account2.address, 0);
    });
  });

});

