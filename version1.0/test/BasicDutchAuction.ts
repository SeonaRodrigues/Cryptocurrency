import { time, loadFixture } from "@nomicfoundation/hardhat-network-helpers";
import { expect } from "chai";
import { ethers } from "hardhat";

describe("BasicDutchAuction", function () {
  // We define a fixture to reuse the same setup in every test.
  async function deployBasicDutchAuction() {
    // initialPrice will be 250
    const reservePrice = 50;
    const numBlocksAuctionOpen = 100;
    const offerPriceDecrement = 2;
    //contract is deployed
    const [owner, otherAccount] = await ethers.getSigners();
    const BasicDutchAuction = await ethers.getContractFactory("BasicDutchAuction");
    const basicDutchAuction = await BasicDutchAuction.deploy(reservePrice, numBlocksAuctionOpen, offerPriceDecrement);
    return { basicDutchAuction, reservePrice, numBlocksAuctionOpen, offerPriceDecrement, owner, otherAccount };
  }

  describe("Deployment", function () {
    it("Set the appropriate reservePrice", async function () {
      const { basicDutchAuction, reservePrice } = await loadFixture(deployBasicDutchAuction);
      expect(await basicDutchAuction.reservePrice()).to.equal(reservePrice);
    });
    it("Set the appropriate numBlocksAuctionOpen", async function () {
      const { basicDutchAuction, numBlocksAuctionOpen } = await loadFixture(deployBasicDutchAuction);
      expect(await basicDutchAuction.numBlocksAuctionOpen()).to.equal(numBlocksAuctionOpen);
    });
    it("Should have the appropriate initialPrice", async function () {
      const { basicDutchAuction, reservePrice, offerPriceDecrement, numBlocksAuctionOpen } = await loadFixture(deployBasicDutchAuction);
      expect(await basicDutchAuction.initialPrice()).to.equal(reservePrice + (numBlocksAuctionOpen * offerPriceDecrement));
    });

  
   //testing for bidding
    it('must reject a bid that is lower than currentPrice', async function () {
      const { basicDutchAuction, otherAccount } = await loadFixture(deployBasicDutchAuction);
      await time.advanceBlock(10);
      await expect(basicDutchAuction.connect(otherAccount).bid({value: 220})).to.be.revertedWith("bid price is lower than the current price");
    });
    it('must accept bid that is higher than currentPrice', async function () {
        const { basicDutchAuction, otherAccount } = await loadFixture(deployBasicDutchAuction);
        await time.advanceBlock(10);
        const returnedAddress = await basicDutchAuction.connect(otherAccount).callStatic.bid({value: 260});
        expect(returnedAddress).to.equal(otherAccount.address);
    });
    it("must revert bid when the auction is over", async function () {
        const { basicDutchAuction, otherAccount } = await loadFixture(deployBasicDutchAuction);
        await time.advanceBlock(101);
        await expect(basicDutchAuction.connect(otherAccount).bid({value: 10000})).to.be.revertedWith("Auction is Ended");
    });
    it("must bid at the reservePrice when the auction is passing a certain amount of time", async function () {
      const { basicDutchAuction, otherAccount } = await loadFixture(deployBasicDutchAuction);
      await time.advanceBlock(100);
      expect(await basicDutchAuction.connect(otherAccount).callStatic.bid({value: 50})).to.equal(otherAccount.address);
    });
  });

});
