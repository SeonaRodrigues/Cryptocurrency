import { ethers } from "hardhat";

async function main() {

  const [deployer] = await ethers.getSigners();

  console.log("Deploying contracts with the account:", deployer.address);

  console.log("Account balance:", (await deployer.getBalance()).toString());

  const BasicDutchAuctionFactory = await ethers.getContractFactory("BasicDutchAuction");
  const basicDutchAuction = await BasicDutchAuctionFactory.deploy(100,10,10);

  await basicDutchAuction.deployed();

  console.log(`Basic Dutch Auction Contract deployed at address ${basicDutchAuction.address}`);
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});