import { HardhatUserConfig } from "hardhat/config";
import "@nomicfoundation/hardhat-verify";
import "@nomicfoundation/hardhat-chai-matchers";
import "@nomicfoundation/hardhat-ethers";
import "@typechain/hardhat";
import "hardhat-contract-sizer";
import "hardhat-gas-reporter";
import "hardhat-deploy";
import "hardhat-deploy-ethers";

import * as dotenv from "dotenv";
dotenv.config({ path: __dirname + "/.env" });

const deployer =
  process.env.HARDHAT_LOCAL_DEPLOYER ?? process.env.HARDHAT_DEPLOYER;
const accounts = deployer
  ? [deployer]
  : [
      "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80",
      "0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d",
      "0x5de4111afa1a4b94908f83103eb1f1706367c2e68ca870fc3fb9a804cdab365a",
    ];

const config: HardhatUserConfig = {
  solidity: {
    compilers: [
      {
        version: "0.8.21",
        settings: {
          viaIR: true,
          optimizer: {
            enabled: true,
            runs: 1,
          },
        },
      },
    ],
  },
  networks: {
    hardhat: {
      live: false,
      saveDeployments: false,
    },
    sepolia: {
      chainId: 11155111,
      url: "https://ethereum-sepolia.publicnode.com",
      accounts,
    },
    mumbai: {
      chainId: 80001,
      url: "https://polygon-mumbai-bor.publicnode.com",
      accounts,
    },
    polygon: {
      chainId: 137,
      url: "https://polygon-bor-rpc.publicnode.com",
      accounts,
    },
    scroll: {
      chainId: 534352,
      url: "https://rpc.scroll.io",
      accounts,
    },
    scroll_sepolia: {
      chainId: 534351,
      url: "https://sepolia-rpc.scroll.io",
      accounts,
    },
    linea: {
      chainId: 59144,
      url: "https://linea-mainnet.infura.io/v3/" + process.env.INFURA_API_KEY!,
      accounts,
    },
    linea_test: {
      chainId: 59140,
      url: "https://rpc.goerli.linea.build",
      accounts,
    },
  },
  gasReporter: {
    enabled: true,
    currency: "USD",
  },
  namedAccounts: {
    deployer: {
      default: 0,
    },
    tester1: {
      default: 1,
    },
    tester2: {
      default: 2,
    },
  },
  etherscan: {
    apiKey: {
      sepolia: process.env.ETHERSCAN_API_KEY!,
      linea: process.env.LINEASCAN_API_KEY!,
      linea_test: process.env.LINEASCAN_API_KEY!,
      scroll_sepolia: process.env.SCROLLSCAN_API_KEY!,
      scroll: process.env.SCROLLSCAN_API_KEY!,
      polygon: process.env.POLYGONSCAN_API_KEY!,
      mumbai: process.env.POLYGONSCAN_API_KEY!,
    },
    customChains: [
      {
        network: "sepolia",
        chainId: 11155111,
        urls: {
          apiURL: "https://api-sepolia.etherscan.io/api",
          browserURL: "https://sepolia.etherscan.io",
        },
      },
      {
        network: "linea",
        chainId: 59144,
        urls: {
          apiURL: "https://api.lineascan.build/api",
          browserURL: "https://lineascan.build/",
        },
      },
      {
        network: "linea_test",
        chainId: 59140,
        urls: {
          apiURL: "https://api-testnet.lineascan.build/api",
          browserURL: "https://goerli.lineascan.build/",
        },
      },
      {
        network: "scroll_sepolia",
        chainId: 534351,
        urls: {
          apiURL: "https://api-sepolia.scrollscan.com/api",
          browserURL: "https://sepolia.scrollscan.com/",
        },
      },
      {
        network: "scroll",
        chainId: 534352,
        urls: {
          apiURL: "https://api.scrollscan.com/api",
          browserURL: "https://scrollscan.com/",
        },
      },
      {
        network: "mumbai",
        chainId: 80001,
        urls: {
          apiURL: "https://api-testnet.polygonscan.com/api",
          browserURL: "https://mumbai.polygonscan.com/",
        },
      },
      {
        network: "polygon",
        chainId: 137,
        urls: {
          apiURL: "https://api.polygonscan.com/api",
          browserURL: "https://polygonscan.com/",
        },
      },
    ],
  },
  paths: {
    deploy: "deploy",
    deployments: "deployments",
  },
  typechain: {
    outDir: "types",
    target: "ethers-v6",
    alwaysGenerateOverloads: false,
    dontOverrideCompile: false,
  },
};

export default config;
