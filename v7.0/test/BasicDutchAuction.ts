import { time, loadFixture } from "@nomicfoundation/hardhat-network-helpers";
import { anyValue } from "@nomicfoundation/hardhat-chai-matchers/withArgs";
import { mine } from "@nomicfoundation/hardhat-network-helpers";
import { expect } from "chai";
import { ethers } from "hardhat";
import { BasicDutchAuction } from "../typechain-types/BasicDutchAuction";

describe("BasicDutchAuction", function () {
  // We define a fixture to reuse the same setup in every test.
  // We use loadFixture to run this setup once, snapshot that state,
  // and reset Hardhat Network to that snapshot in every test.

  const NUM_BLOCKS_AUCTION_OPEN = 10;
  const RESERVE_PRICE = 500;
  const OFFER_PRICE_DECREMENT = 50;

  async function deployBasicDAFixture() {
    // Contracts are deployed using the first signer/account by default
    const [owner, account1, account2] = await ethers.getSigners();

    const BasicDutchAuction = await ethers.getContractFactory(
      "BasicDutchAuction"
    );

    const basicDutchAuction = await BasicDutchAuction.deploy(
      RESERVE_PRICE,
      NUM_BLOCKS_AUCTION_OPEN,
      OFFER_PRICE_DECREMENT
    );

    return { basicDutchAuction, owner, account1, account2 };
  }

  describe("Deployment", function () {
    it("Should set the right owner", async function () {
      const { basicDutchAuction, owner, account1 } = await loadFixture(
        deployBasicDAFixture
      );

      expect(await basicDutchAuction.owner()).to.equal(owner.address);
    });

    it("Should have no winner", async function () {
      const { basicDutchAuction, owner, account1 } = await loadFixture(
        deployBasicDAFixture
      );

      expect(await basicDutchAuction.winner()).to.equal(
        ethers.constants.AddressZero
      );
    });

    it("Should have initial price as per formula", async function () {
      const { basicDutchAuction, account1 } = await loadFixture(
        deployBasicDAFixture
      );

      const initialPrice =
        RESERVE_PRICE + NUM_BLOCKS_AUCTION_OPEN * OFFER_PRICE_DECREMENT;

      expect(await basicDutchAuction.getCurrentPrice()).to.equal(initialPrice);
    });
  });

  describe("Bids", function () {
    it("Should have expected current price after 5 blocks as per formula", async function () {
      const { basicDutchAuction, account1 } = await loadFixture(
        deployBasicDAFixture
      );

      const initialPrice =
        RESERVE_PRICE + NUM_BLOCKS_AUCTION_OPEN * OFFER_PRICE_DECREMENT;

      const priceAfter5Blocks = initialPrice - 5 * OFFER_PRICE_DECREMENT;
      //Mine 5 blocks
      await mine(5);

      expect(await basicDutchAuction.getCurrentPrice()).to.equal(
        priceAfter5Blocks
      );
    });

    it("Should reject low bids", async function () {
      const { basicDutchAuction, account1 } = await loadFixture(
        deployBasicDAFixture
      );

      //Mine 1 block
      await mine(1);

      //This is the Bid price which would be accepted two blocks later
      //But should be rejected now
      const lowBidPrice =
        RESERVE_PRICE +
        NUM_BLOCKS_AUCTION_OPEN * OFFER_PRICE_DECREMENT -
        OFFER_PRICE_DECREMENT * 3;

      await expect(
        basicDutchAuction.connect(account1).bid({
          value: lowBidPrice,
        })
      ).to.be.revertedWith("The wei value sent is not acceptable");

      //Test with an arbitrarily low value too
      await expect(
        basicDutchAuction.connect(account1).bid({
          value: 50,
        })
      ).to.be.revertedWith("The wei value sent is not acceptable");
    });

    it("Should accept bids higher than currentPrice and set winner as bidder's address", async function () {
      const { basicDutchAuction, account1 } = await loadFixture(
        deployBasicDAFixture
      );
      //mine 5 blocks
      await mine(5);

      const initialPrice =
        RESERVE_PRICE + NUM_BLOCKS_AUCTION_OPEN * OFFER_PRICE_DECREMENT;
      //Get price after 4 blocks
      const highBidPrice = initialPrice - OFFER_PRICE_DECREMENT * 4;

      //Bid function should succeed
      expect(
        await basicDutchAuction.connect(account1).bid({
          value: highBidPrice,
        })
      ).to.not.be.reverted;

      //Winner should be account1
      expect(await basicDutchAuction.winner()).to.equal(account1.address);
    });

    it("Should reject bids after a winning bid is already accepted", async function () {
      const { basicDutchAuction, account1, account2 } = await loadFixture(
        deployBasicDAFixture
      );
      //mine 5 blocks
      await mine(5);

      const initialPrice =
        RESERVE_PRICE + NUM_BLOCKS_AUCTION_OPEN * OFFER_PRICE_DECREMENT;
      //Get price after 4 blocks
      const highBidPrice = initialPrice - OFFER_PRICE_DECREMENT * 4;

      //Bid function should succeed
      expect(
        await basicDutchAuction.connect(account1).bid({
          value: highBidPrice,
        })
      ).to.not.be.reverted;

      //Bid should be rejected
      await expect(
        basicDutchAuction.connect(account2).bid({
          value: highBidPrice,
        })
      ).to.be.revertedWith("Auction has already concluded");
    });

    it("Bids should not be accepted after the auction expires", async function () {
      const { basicDutchAuction, account1, account2 } = await loadFixture(
        deployBasicDAFixture
      );
      //mine 5 blocks
      await mine(NUM_BLOCKS_AUCTION_OPEN + 1);

      const initialPrice =
        RESERVE_PRICE + NUM_BLOCKS_AUCTION_OPEN * OFFER_PRICE_DECREMENT;
      //Get price after 4 blocks
      const highBidPrice = initialPrice - OFFER_PRICE_DECREMENT * 4;

      //Bid function should fail with auction expired message
      await expect(
        basicDutchAuction.connect(account2).bid({
          value: highBidPrice,
        })
      ).to.be.revertedWith("Auction expired");
    });

    it("Should return reservePrice when max number of auction blocks have elapsed", async function () {
      const { basicDutchAuction, account1, account2 } = await loadFixture(
        deployBasicDAFixture
      );
      //mine 10 blocks
      await mine(NUM_BLOCKS_AUCTION_OPEN);
      //Should return reserve price after 10 blocks are mined
      expect(await basicDutchAuction.getCurrentPrice()).to.equal(RESERVE_PRICE);

      //Mine 5 more blocks
      await mine(5);
      //Should return reserve price after 15 blocks are mined
      expect(await basicDutchAuction.getCurrentPrice()).to.equal(RESERVE_PRICE);
    });

    it("Should send the accepted bid wei value from bidder's account to owner's account", async function () {
      const { basicDutchAuction, owner, account1 } = await loadFixture(
        deployBasicDAFixture
      );
      //mine 5 blocks
      await mine(5);

      const initialPrice =
        RESERVE_PRICE + NUM_BLOCKS_AUCTION_OPEN * OFFER_PRICE_DECREMENT;
      //Get price after 4 blocks
      const highBidPrice = initialPrice - OFFER_PRICE_DECREMENT * 4;

      //Bid function should succeed and teansfer wei value from account1 to owner
      await expect(
        basicDutchAuction.connect(account1).bid({
          value: highBidPrice,
        })
      ).to.changeEtherBalances(
        [account1, owner],
        [-highBidPrice, highBidPrice]
      );
    });
  });
});
