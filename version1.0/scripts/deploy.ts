import { ethers } from "hardhat";

async function main() {
  // const currentTimestampInSeconds = Math.round(Date.now() / 1000);
  // const unlockTime = currentTimestampInSeconds + 60;

  // const lockedAmount = ethers.utils.parseEther("0.001");

  // const Lock = await ethers.getContractFactory("Lock");
  // const lock = await Lock.deploy(unlockTime, { value: lockedAmount });

  // await lock.deployed();

  // console.log(
  //   `Lock with ${ethers.utils.formatEther(lockedAmount)}ETH and unlock timestamp ${unlockTime} deployed to ${lock.address}`
  // );
  const RESERVE_PRICE = 50;
    const BLOCKS_TO_AUCTION = 100;
    const PRICE_DECREASE = 2;

    const BasicDutchAuction = await ethers.getContractFactory("BasicDutchAuction"); 
    const basicDutchAuction = await BasicDutchAuction.deploy(RESERVE_PRICE, BLOCKS_TO_AUCTION, PRICE_DECREASE);

    await basicDutchAuction.deployed();

    console.log(`BasicDutchAuction deployed to: ${basicDutchAuction.address} with reserve price: ${RESERVE_PRICE} and blocks to auction: ${BLOCKS_TO_AUCTION} and price decrease: ${PRICE_DECREASE}`);

}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
