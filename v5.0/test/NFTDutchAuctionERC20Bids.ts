import { loadFixture } from "@nomicfoundation/hardhat-network-helpers";
import { mine } from "@nomicfoundation/hardhat-network-helpers";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { expect } from "chai";
import { BigNumber } from "ethers";
import { ethers, upgrades } from "hardhat";
import { TempToken } from "../typechain-types";
import { NFTDutchAuctionERC20Bids } from "../typechain-types/contracts/NFTDutchAuctionERC20Bids";

async function getPermitSignature(
  signer: SignerWithAddress,
  token: TempToken,
  spender: string,
  value: string,
  deadline: BigNumber
) {
  const [nonce, name, version, chainId] = await Promise.all([
    token.nonces(signer.address),
    token.name(),
    "1",
    signer.getChainId(),
  ]);

  return ethers.utils.splitSignature(
    await signer._signTypedData(
      {
        name,
        version,
        chainId,
        verifyingContract: token.address,
      },
      {
        Permit: [
          {
            name: "owner",
            type: "address",
          },
          {
            name: "spender",
            type: "address",
          },
          {
            name: "value",
            type: "uint256",
          },
          {
            name: "nonce",
            type: "uint256",
          },
          {
            name: "deadline",
            type: "uint256",
          },
        ],
      },
      {
        owner: signer.address,
        spender,
        value,
        nonce,
        deadline,
      }
    )
  );
}

describe("NFTDutchAuctionERC20Bids", function () {
  // We define a fixture to reuse the same setup in every test.
  // We use loadFixture to run this setup once, snapshot that state,
  // and reset Hardhat Network to that snapshot in every test.

  const NUM_BLOCKS_AUCTION_OPEN: number = 10;
  const RESERVE_PRICE: number = 500;
  const OFFER_PRICE_DECREMENT: number = 50;
  const NFT_TOKEN_ID: number = 0;
  const TOKEN_URI = "https://www.google.com/";
  const DEADLINE = ethers.constants.MaxUint256;
  const PERMIT_ALLOWANCE = "1000";
  async function deployNFTDAFixture() {
    // Contracts are deployed using the first signer/account by default
    const [owner, account1, account2] = await ethers.getSigners();

    //Deploy and mint NFT contract
    const RandomMusicNFT = await ethers.getContractFactory("NFT");
    const randomMusicNFT = await RandomMusicNFT.deploy();
    await randomMusicNFT.mintNFT(owner.address, TOKEN_URI);

    //Deploy and mint TMP tokens
    const TempoToken = await ethers.getContractFactory("TempToken");
    const tempoToken = await TempoToken.deploy();
    await tempoToken.mint(account1.address, 1000);

    const NFTDutchAuctionERC20Bids = await ethers.getContractFactory(
      "NFTDutchAuctionERC20Bids"
    );

    const nftDutchAuctionERC20Bids = await upgrades.deployProxy(
      NFTDutchAuctionERC20Bids,
      [
        tempoToken.address,
        randomMusicNFT.address,
        NFT_TOKEN_ID,
        RESERVE_PRICE,
        NUM_BLOCKS_AUCTION_OPEN,
        OFFER_PRICE_DECREMENT,
      ]
    );
    const { v, r, s } = await getPermitSignature(
      account1,
      tempoToken,
      nftDutchAuctionERC20Bids.address,
      PERMIT_ALLOWANCE,
      DEADLINE
    );

    tempoToken.permit(
      account1.address,
      nftDutchAuctionERC20Bids.address,
      PERMIT_ALLOWANCE,
      DEADLINE,
      v,
      r,
      s
    );
    randomMusicNFT.approve(nftDutchAuctionERC20Bids.address, NFT_TOKEN_ID);

    return {
      randomMusicNFT,
      tempoToken,
      nftDutchAuctionERC20Bids,
      owner,
      account1,
      account2,
    };
  }



  describe("Deployment", function () {
    it("Should set the right owner", async function () {
      const { nftDutchAuctionERC20Bids, owner } = await loadFixture(
        deployNFTDAFixture
      );

      expect(await nftDutchAuctionERC20Bids.owner()).to.equal(owner.address);
    });

    it("Should not allow initialize to be called more than once", async function () {
      const { nftDutchAuctionERC20Bids, randomMusicNFT, tempoToken, owner } =
        await loadFixture(deployNFTDAFixture);

      await expect(
        nftDutchAuctionERC20Bids.initialize(
          tempoToken.address,
          randomMusicNFT.address,
          NFT_TOKEN_ID,
          RESERVE_PRICE,
          NUM_BLOCKS_AUCTION_OPEN,
          OFFER_PRICE_DECREMENT
        )
      ).to.be.revertedWith("Initializable: contract is already initialized");
    });

    it("Should have no winner", async function () {
      const { nftDutchAuctionERC20Bids } = await loadFixture(
        deployNFTDAFixture
      );

      expect(await nftDutchAuctionERC20Bids.winner()).to.equal(
        ethers.constants.AddressZero
      );
    });

    it("Should not allow Auction creator to deploy contract if the NFT does not belong to them", async function () {
      const { randomMusicNFT, tempoToken, account1 } = await loadFixture(
        deployNFTDAFixture
      );

      //Mint NFT with tokenId 1 to account1
      await expect(randomMusicNFT.mintNFT(account1.address, "Test URI"))
        .to.emit(randomMusicNFT, "Transfer")
        .withArgs(ethers.constants.AddressZero, account1.address, 1);

      //Deploy NFT contract with account1's tokenId, should fail
      const NFTDutchAuctionERC20Bids = await ethers.getContractFactory(
        "NFTDutchAuctionERC20Bids"
      );
      await expect(
        upgrades.deployProxy(NFTDutchAuctionERC20Bids, [
          tempoToken.address,
          randomMusicNFT.address,
          1,
          RESERVE_PRICE,
          NUM_BLOCKS_AUCTION_OPEN,
          OFFER_PRICE_DECREMENT,
        ])
      ).to.revertedWith(
        "The NFT tokenId does not belong to the Auction's Owner"
      );
    });

    it("Should have the initial price as per Dutch Auction formula", async function () {
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
    it("Should have expected current price after 5 blocks as per formula", async function () {
      const { nftDutchAuctionERC20Bids } = await loadFixture(
        deployNFTDAFixture
      );

      const initialPrice =
        RESERVE_PRICE + NUM_BLOCKS_AUCTION_OPEN * OFFER_PRICE_DECREMENT;

      const priceAfter5Blocks = initialPrice - 5 * OFFER_PRICE_DECREMENT;
      //Mine 5 blocks, since 2 blocks were already mined
      //when we approved the Auction contract for NFT Transfer and permitted ERC20
      await mine(3);

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
      const lowBidPrice =
        RESERVE_PRICE +
        NUM_BLOCKS_AUCTION_OPEN * OFFER_PRICE_DECREMENT -
        OFFER_PRICE_DECREMENT * 5;

      await expect(
        nftDutchAuctionERC20Bids.connect(account1).bid(lowBidPrice)
      ).to.be.revertedWith("The bid amount sent is not acceptable");

      //Test with an arbitrarily low value too
      await expect(
        nftDutchAuctionERC20Bids.connect(account1).bid(50)
      ).to.be.revertedWith("The bid amount sent is not acceptable");
    });

    it("Should not allow unauthorized tokens to bid", async function () {
      const { nftDutchAuctionERC20Bids, tempoToken, account1, account2 } =
        await loadFixture(deployNFTDAFixture);
      //mine 5 blocks
      await mine(5);

      const initialPrice =
        RESERVE_PRICE + NUM_BLOCKS_AUCTION_OPEN * OFFER_PRICE_DECREMENT;
      //Get price after 4 blocks
      const highBidPrice = initialPrice - OFFER_PRICE_DECREMENT * 4;

      //Bid function should succeed
      await expect(
        nftDutchAuctionERC20Bids.connect(account2).bid(highBidPrice)
      ).to.be.revertedWith(
        "Bid amount was accepted, but bid failed as not enough balance/allowance to transfer erc20 token TMP"
      );

      await expect(
        nftDutchAuctionERC20Bids.connect(account2).bid(highBidPrice)
      ).to.be.revertedWith(
        "Bid amount was accepted, but bid failed as not enough balance/allowance to transfer erc20 token TMP"
      );
    });

    it("Should accept bids higher than currentPrice and set winner as bidder's address", async function () {
      const { nftDutchAuctionERC20Bids, tempoToken, account1 } =
        await loadFixture(deployNFTDAFixture);
      //mine 5 blocks
      await mine(5);

      const initialPrice =
        RESERVE_PRICE + NUM_BLOCKS_AUCTION_OPEN * OFFER_PRICE_DECREMENT;
      //Get price after 4 blocks
      const highBidPrice = initialPrice - OFFER_PRICE_DECREMENT * 4;

      //Bid function should succeed
      expect(await nftDutchAuctionERC20Bids.connect(account1).bid(highBidPrice))
        .to.not.be.reverted;

      //Winner should be account1
      expect(await nftDutchAuctionERC20Bids.winner()).to.equal(
        account1.address
      );
    });

    it("Should reject bids after a winning bid is already accepted", async function () {
      const { nftDutchAuctionERC20Bids, tempoToken, account1, account2 } =
        await loadFixture(deployNFTDAFixture);
      //mine 5 blocks
      await mine(5);

      const initialPrice =
        RESERVE_PRICE + NUM_BLOCKS_AUCTION_OPEN * OFFER_PRICE_DECREMENT;
      //Get price after 4 blocks
      const highBidPrice = initialPrice - OFFER_PRICE_DECREMENT * 4;

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

    it("Should return reservePrice when max number of auction blocks have elapsed", async function () {
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

    it("Should send the accepted bid amount in TMP tokens from bidder's account to owner's account", async function () {
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

    it("Should transfer the NFT from Owner's account to Bidder's account", async function () {
      const {
        nftDutchAuctionERC20Bids,
        tempoToken,
        randomMusicNFT,
        owner,
        account1,
      } = await loadFixture(deployNFTDAFixture);
      //mine 5 blocks
      await mine(5);

      const initialPrice =
        RESERVE_PRICE + NUM_BLOCKS_AUCTION_OPEN * OFFER_PRICE_DECREMENT;
      //Get price after 4 blocks
      const highBidPrice = initialPrice - OFFER_PRICE_DECREMENT * 4;

      //Bid function should succeed and teansfer NFT from account1 to owner
      await expect(nftDutchAuctionERC20Bids.connect(account1).bid(highBidPrice))
        .to.emit(randomMusicNFT, "Transfer")
        .withArgs(owner.address, account1.address, NFT_TOKEN_ID);

      //NFT contract should reflect the NFT ownership in account1's address

      expect(await randomMusicNFT.ownerOf(NFT_TOKEN_ID)).to.equal(
        account1.address
      );
    });

    it("Owner should still own the NFT after the auction expires if there is no winning bid", async function () {
      const { nftDutchAuctionERC20Bids, randomMusicNFT, owner, account2 } =
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
      expect(await randomMusicNFT.ownerOf(NFT_TOKEN_ID)).to.equal(
        owner.address
      );
    });
  });

  //upgrades
  describe("Upgradable", () => 
  {
    it("Checking contract is successfully getting upgraded", async () => 
    {
      const { nftDutchAuctionERC20Bids } = await loadFixture(deployNFTDAFixture);
      const auctionContractUpgrade = await ethers.getContractFactory("NFTDutchAuction_ERC20Upgraded");
      const auctionContractUpgradeDeploy = await upgrades.upgradeProxy(nftDutchAuctionERC20Bids.address, auctionContractUpgrade);

      expect(await auctionContractUpgradeDeploy.currentVersion()).to.equal(ethers.BigNumber.from("2"))
    });

  });

  // ERC20 Permit
  describe("UniqNFT & Dutch Auction Deployment with ERC20 Permit functionality ", function () {

    it("checking token Balance", async function () {
      //const {tempoToken, account1} = await loadFixture(deployNFTDAFixture);
      const { nftDutchAuctionERC20Bids, tempoToken, owner, account1 } =
        await loadFixture(deployNFTDAFixture);

      expect(await tempoToken.balanceOf(account1.address)).to.equal(1000);
    });


    it("checking token Allowance", async function () {
      const { nftDutchAuctionERC20Bids, tempoToken, owner, account1 } = await loadFixture(deployNFTDAFixture);

      const deadline = ethers.constants.MaxUint256

      const { v, r, s } = await getPermitSignature(
        account1,
        tempoToken,
        nftDutchAuctionERC20Bids.address,
        PERMIT_ALLOWANCE,
        DEADLINE
      );

      tempoToken.permit(
        account1.address,
        nftDutchAuctionERC20Bids.address,
        PERMIT_ALLOWANCE,
        DEADLINE,
        v,
        r,
        s
      );

      expect(await tempoToken.allowance(account1.address, nftDutchAuctionERC20Bids.address)).to.equal(await tempoToken.balanceOf(account1.address));

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





