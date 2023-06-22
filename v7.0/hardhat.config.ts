import * as dotenv from 'dotenv';

import { HardhatUserConfig } from 'hardhat/config';
import '@nomiclabs/hardhat-etherscan';
import '@nomiclabs/hardhat-waffle';
import '@typechain/hardhat';
import 'hardhat-gas-reporter';
import 'solidity-coverage';

//import './scripts/deploy';

dotenv.config();

const config: HardhatUserConfig = {
  solidity: '0.8.9',
  paths: {
    artifacts: './frontend/src/artifacts'
  },
  networks: {
    hardhat: {
      mining: {
        auto: true,
        interval: 10000
      }
    },
    sepolia: {
      url: process.env.SEPOLIA_URL || '',
      accounts:
        process.env.TEST_ETH_ACCOUNT_PRIVATE_KEY !== undefined
          ? [process.env.TEST_ETH_ACCOUNT_PRIVATE_KEY]
          : []
    }
  }
  ,
  gasReporter: {
    enabled: process.env.REPORT_GAS !== undefined,
    currency: 'USD'
  }
};

export default config;
