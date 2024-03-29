import { expect } from "chai";
import {
  getPasskeyAdmin,
  getAccountFactory,
  getOpenId3Account,
} from "../lib/utils";
import * as hre from "hardhat";
import { AddressLike, Contract, Interface } from "ethers";
import { getInterface } from "../lib/utils";
import {
  genPasskey,
  buildPasskeyAdminCallData,
  type Passkey,
  callFromPasskey,
} from "../lib/passkey";
import { genInitCode } from "../lib/userop";
import { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";

describe("OpenId3Account", function () {
  let admin: Contract;
  let factory: Contract;
  let accountIface: Interface;
  let passkey: Passkey;

  const deployErc20 = async (supply: number) => {
    const { deployer } = await hre.ethers.getNamedSigners();
    const deployed = await hre.deployments.deploy("ERC20ForTest", {
      from: deployer.address,
      args: ["TestERC20", "TST", supply],
    });
    const artifact = await hre.artifacts.readArtifact("ERC20ForTest");
    return new Contract(deployed.address, artifact.abi, deployer);
  };

  const deployErc721 = async () => {
    const { deployer } = await hre.ethers.getNamedSigners();
    const deployed = await hre.deployments.deploy("ERC721ForTest", {
      from: deployer.address,
      args: ["TestErc721", "TST"],
    });
    const artifact = await hre.artifacts.readArtifact("ERC721ForTest");
    return new Contract(deployed.address, artifact.abi, deployer);
  };

  const deployErc1155 = async () => {
    const { deployer } = await hre.ethers.getNamedSigners();
    const deployed = await hre.deployments.deploy("ERC1155ForTest", {
      from: deployer.address,
      log: true,
      autoMine: true,
    });
    const artifact = await hre.artifacts.readArtifact("ERC1155ForTest");
    return new Contract(deployed.address, artifact.abi, deployer);
  };

  const getAccountAddr = async (
    admin: Contract,
    passkey: Passkey,
  ) => {
    const adminData = buildPasskeyAdminCallData(admin, passkey);
    const accountInitData = accountIface.encodeFunctionData("initialize", [
      adminData,
    ]);
    const salt = hre.ethers.keccak256(accountInitData);
    return await factory.predictClonedAddress(salt);
  };

  const deployAccount = async (
    admin: Contract,
    passkey: Passkey,
  ) => {
    const { deployer } = await hre.ethers.getNamedSigners();
    const accountInitData = accountIface.encodeFunctionData("initialize", [
      buildPasskeyAdminCallData(admin, passkey),
    ]);
    const salt = hre.ethers.keccak256(accountInitData);
    const cloned = await factory.predictClonedAddress(salt);
    await deposit(deployer, cloned);
    await factory.clone(accountInitData);
    return getOpenId3Account(hre, cloned, deployer);
  };

  const deposit = async (from: HardhatEthersSigner, to: AddressLike) => {
    const tx1 = await from.sendTransaction({
      to,
      value: hre.ethers.parseEther("1.0"),
    });
    await tx1.wait();
  };

  beforeEach(async function () {
    await hre.deployments.fixture(["ACCOUNT"]);
    admin = await getPasskeyAdmin(hre);
    factory = await getAccountFactory(hre);
    accountIface = await getInterface(hre, "OpenId3Account");
    passkey = genPasskey();
  });

  it("should deploy account", async function () {
    const { deployer } = await hre.ethers.getNamedSigners();
    const adminData = buildPasskeyAdminCallData(admin, passkey);
    const accountInitData = accountIface.encodeFunctionData("initialize", [
      adminData,
    ]);

    const deployed = await factory.predictDeployedAddress(accountInitData);
    await expect(factory.deploy(accountInitData))
      .to.emit(factory, "AccountDeployed")
      .withArgs(deployed);

    const account = await getOpenId3Account(hre, deployed, deployer);
    expect(await account.admin()).to.eq(await admin.getAddress());

    const keyId = hre.ethers.solidityPackedKeccak256(
      ["uint256", "uint256"],
      [passkey.pubKeyX, passkey.pubKeyY]
    );
    expect(await admin.getPasskeyId(deployed)).to.eq(keyId);
  });

  it("should clone account with admin only", async function () {
    const { deployer } = await hre.ethers.getNamedSigners();
    const adminData = buildPasskeyAdminCallData(admin, passkey);

    const salt = hre.ethers.keccak256(adminData);
    const cloned = await factory.predictClonedAddress(salt);
    await expect(factory.cloneWithAdminOnly(adminData))
      .to.emit(factory, "AccountDeployed")
      .withArgs(cloned);

    const account = await getOpenId3Account(hre, cloned, deployer);
    expect(await account.admin()).to.eq(await admin.getAddress());

    const keyId = hre.ethers.solidityPackedKeccak256(
      ["uint256", "uint256"],
      [passkey.pubKeyX, passkey.pubKeyY]
    );
    expect(await admin.getPasskeyId(cloned)).to.eq(keyId);
  });

  it("should clone account", async function () {
    const { deployer } = await hre.ethers.getNamedSigners();
    const adminData = buildPasskeyAdminCallData(admin, passkey);
    const accountInitData = accountIface.encodeFunctionData("initialize", [
      adminData,
    ]);

    const salt = hre.ethers.keccak256(accountInitData);
    const cloned = await factory.predictClonedAddress(salt);
    await expect(factory.clone(accountInitData))
      .to.emit(factory, "AccountDeployed")
      .withArgs(cloned);

    const account = await getOpenId3Account(hre, cloned, deployer);
    expect(await account.admin()).to.eq(await admin.getAddress());
  
    const keyId = hre.ethers.solidityPackedKeccak256(
      ["uint256", "uint256"],
      [passkey.pubKeyX, passkey.pubKeyY]
    );
    expect(await admin.getPasskeyId(cloned)).to.eq(keyId);
  });

  it("should clone via eip4337 with eth transfer", async function () {
    const { deployer, tester1 } = await hre.ethers.getNamedSigners();
    const adminData = buildPasskeyAdminCallData(admin, passkey);
    const accountInitData = accountIface.encodeFunctionData("initialize", [
      adminData,
    ]);
    const salt = hre.ethers.keccak256(accountInitData);
    const account = await factory.predictClonedAddress(salt);
    await deposit(deployer, account);

    const initCode = await genInitCode(
      await factory.getAddress(),
      accountInitData
    );

    // transfer eth
    const transferCalldata = accountIface.encodeFunctionData("execute", [
      tester1.address,
      0,
      "0x",
    ]);
    await expect(
      callFromPasskey(account, passkey, initCode, transferCalldata, tester1)
    )
      .to.emit(factory, "AccountDeployed")
      .withArgs(account);
  });

  it("should upgrade contract properly", async function () {
    const { deployer } = await hre.ethers.getNamedSigners();
    const account = await deployAccount(admin, passkey);
    const accountAddr = await account.getAddress();
    const oldImpl = await account.implementation();
    const newImpl = (
      await hre.deployments.deploy("OpenId3AccountV2ForTest", {
        from: deployer.address,
        args: [
          await account.entryPoint(),
          await admin.getAddress(),
        ],
      })
    ).address;

    // cannot reinitalize the proxy
    const accountProxy = await hre.ethers.getContractAt(
      "AccountProxy",
      accountAddr
    );
    await expect(
      accountProxy.initProxy(newImpl, "0x")
    ).to.be.revertedWithCustomError(accountProxy, "AlreadyInitiated");

    // cannot upgrade without EIP-4337
    await expect(account.upgradeTo(newImpl)).to.be.revertedWithCustomError(
      account,
      "NotAuthorized"
    );

    // admin can upgrade
    const upgradeData = account.interface.encodeFunctionData("upgradeTo", [
      newImpl,
    ]);
    const executeData = account.interface.encodeFunctionData("execute", [
      accountAddr,
      0,
      upgradeData,
    ]);
    expect(
      await callFromPasskey(accountAddr, passkey, "0x", executeData, deployer)
    )
      .to.emit(account, "Upgraded")
      .withArgs(newImpl);
    expect(await account.implementation()).to.eq(newImpl); // upgraded
  });

  it("should hold and transfer ERC20 and eth properly", async function () {
    const { deployer, tester1, tester2 } = await hre.ethers.getNamedSigners();
    const accountAddr = await getAccountAddr(admin, passkey);

    // receive erc20 before account created
    const erc20 = await deployErc20(10000);
    const erc20Addr = await erc20.getAddress();
    await erc20.transfer(accountAddr, 1000);
    expect(await erc20.balanceOf(accountAddr)).to.eq(1000);

    // receive eth before account created
    await deposit(deployer, accountAddr);
    expect(await hre.ethers.provider.getBalance(accountAddr)).to.eq(
      hre.ethers.parseEther("1.0")
    );

    // deploy account
    const account = await deployAccount(admin, passkey);

    // transfer erc20 token
    const erc20Data = erc20.interface.encodeFunctionData("transfer", [
      tester1.address,
      100,
    ]);
    const executeData = account.interface.encodeFunctionData("execute", [
      erc20Addr,
      0,
      erc20Data,
    ]);
    await expect(
      callFromPasskey(accountAddr, passkey, "0x", executeData, tester1)
    )
      .to.emit(erc20, "Transfer")
      .withArgs(accountAddr, tester1.address, 100);
    expect(await erc20.balanceOf(accountAddr)).to.eq(900);
    expect(await erc20.balanceOf(tester1.address)).to.eq(100);

    // batch erc20 transfer with eth transfer
    const erc20Data2 = erc20.interface.encodeFunctionData("transfer", [
      tester2.address,
      100,
    ]);
    const ethAmount = hre.ethers.parseEther("0.1");
    const executeBatchData = account.interface.encodeFunctionData(
      "executeBatch",
      [
        [erc20Addr, erc20Addr, hre.ethers.ZeroAddress],
        [0, 0, ethAmount],
        [erc20Data, erc20Data2, "0x"],
      ]
    );
    await expect(
      callFromPasskey(accountAddr, passkey, "0x", executeBatchData, tester1)
    )
      .to.emit(erc20, "Transfer")
      .withArgs(accountAddr, tester1.address, 100);
    expect(await erc20.balanceOf(accountAddr)).to.eq(700);
    expect(await erc20.balanceOf(tester1.address)).to.eq(200);
    expect(await erc20.balanceOf(tester2.address)).to.eq(100);
    expect(await hre.ethers.provider.getBalance(hre.ethers.ZeroAddress)).to.eq(
      ethAmount
    );
  });

  it("should hold and transfer ERC20 and eth properly with two operators", async function () {
    const { deployer, tester1, tester2 } = await hre.ethers.getNamedSigners();
    const accountAddr = await getAccountAddr(admin, passkey);

    // receive erc20 before account created
    const erc20 = await deployErc20(10000);
    const erc20Addr = await erc20.getAddress();
    await erc20.transfer(accountAddr, 1000);
    expect(await erc20.balanceOf(accountAddr)).to.eq(1000);

    // receive eth before account created
    await deposit(deployer, accountAddr);
    expect(await hre.ethers.provider.getBalance(accountAddr)).to.eq(
      hre.ethers.parseEther("1.0")
    );

    // deploy account
    const account = await deployAccount(admin, passkey);

    // transfer erc20 token
    const erc20Data = erc20.interface.encodeFunctionData("transfer", [
      tester1.address,
      100,
    ]);
    const executeData = account.interface.encodeFunctionData("execute", [
      erc20Addr,
      0,
      erc20Data,
    ]);
    await expect(
      callFromPasskey(accountAddr, passkey, "0x", executeData, tester1)
    )
      .to.emit(erc20, "Transfer")
      .withArgs(accountAddr, tester1.address, 100);
    expect(await erc20.balanceOf(accountAddr)).to.eq(900);
    expect(await erc20.balanceOf(tester1.address)).to.eq(100);

    // batch erc20 transfer with eth transfer
    const erc20Data2 = erc20.interface.encodeFunctionData("transfer", [
      tester2.address,
      100,
    ]);
    const ethAmount = hre.ethers.parseEther("0.1");
    const executeBatchData = account.interface.encodeFunctionData(
      "executeBatch",
      [
        [erc20Addr, erc20Addr, hre.ethers.ZeroAddress],
        [0, 0, ethAmount],
        [erc20Data, erc20Data2, "0x"],
      ]
    );
    await expect(
      callFromPasskey(accountAddr, passkey, "0x", executeBatchData, tester1)
    )
      .to.emit(erc20, "Transfer")
      .withArgs(accountAddr, tester1.address, 100);
    expect(await erc20.balanceOf(accountAddr)).to.eq(700);
    expect(await erc20.balanceOf(tester1.address)).to.eq(200);
    expect(await erc20.balanceOf(tester2.address)).to.eq(100);
    expect(await hre.ethers.provider.getBalance(hre.ethers.ZeroAddress)).to.eq(
      ethAmount
    );
  });

  it("Should hold and transfer ERC721 successfully", async function () {
    const { deployer, tester1 } = await hre.ethers.getNamedSigners();
    const accountAddr = await getAccountAddr(admin, passkey);

    // receive erc721 before account created
    const erc721 = await deployErc721();
    await expect(erc721.transferFrom(deployer.address, accountAddr, 0))
      .to.emit(erc721, "Transfer")
      .withArgs(deployer.address, accountAddr, 0);
    expect(await erc721.ownerOf(0)).to.eq(accountAddr);

    // deploy account
    const account = await deployAccount(admin, passkey);

    // receive erc721 after account created
    await expect(erc721.transferFrom(deployer.address, accountAddr, 1))
      .to.emit(erc721, "Transfer")
      .withArgs(deployer.address, accountAddr, 1);
    expect(await erc721.ownerOf(1)).to.eq(accountAddr);

    // send erc721
    const erc721Data = erc721.interface.encodeFunctionData("transferFrom", [
      accountAddr,
      tester1.address,
      0,
    ]);
    const executeData = account.interface.encodeFunctionData("execute", [
      await erc721.getAddress(),
      0,
      erc721Data,
    ]);
    await expect(
      callFromPasskey(accountAddr, passkey, "0x", executeData, tester1)
    )
      .to.emit(erc721, "Transfer")
      .withArgs(accountAddr, tester1.address, 0);
    expect(await erc721.ownerOf(0)).to.eq(tester1.address);
  });

  it("Should hold and transfer ERC1155 successfully", async function () {
    const { deployer, tester1 } = await hre.ethers.getNamedSigners();
    const accountAddr = await getAccountAddr(admin, passkey);

    // receive erc1155 before account created
    const erc1155 = await deployErc1155();
    await expect(
      erc1155.safeTransferFrom(deployer.address, accountAddr, 1, 10, "0x")
    )
      .to.emit(erc1155, "TransferSingle")
      .withArgs(deployer.address, deployer.address, accountAddr, 1, 10);
    expect(await erc1155.balanceOf(accountAddr, 1)).to.eq(10);

    // deploy account
    const account = await deployAccount(admin, passkey);

    // receive erc1155 after account created
    await expect(
      erc1155.safeTransferFrom(deployer.address, accountAddr, 1, 10, "0x")
    )
      .to.emit(erc1155, "TransferSingle")
      .withArgs(deployer.address, deployer.address, accountAddr, 1, 10);
    expect(await erc1155.balanceOf(accountAddr, 1)).to.eq(20);

    // send erc1155
    const erc1155Data = erc1155.interface.encodeFunctionData(
      "safeTransferFrom",
      [accountAddr, tester1.address, 1, 10, "0x"]
    );
    const executeData = account.interface.encodeFunctionData("execute", [
      await erc1155.getAddress(),
      0,
      erc1155Data,
    ]);
    await expect(
      callFromPasskey(accountAddr, passkey, "0x", executeData, tester1)
    )
      .to.emit(erc1155, "TransferSingle")
      .withArgs(accountAddr, accountAddr, tester1.address, 1, 10);
    expect(await erc1155.balanceOf(accountAddr, 1)).to.eq(10);
    expect(await erc1155.balanceOf(tester1.address, 1)).to.eq(10);
  });
});
