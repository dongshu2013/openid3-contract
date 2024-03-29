import { AddressLike, BigNumberish, BytesLike, Contract, ethers } from "ethers";
import * as hre from "hardhat";
import { getEntryPointAddress } from "./deployer";
import { getEntryPoint, getOpenId3Account } from "./utils";
import { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";

export type UserOperationStruct = {
  sender: AddressLike;
  nonce: BigNumberish;
  initCode: BytesLike;
  callData: BytesLike;
  callGasLimit: BigNumberish;
  verificationGasLimit: BigNumberish;
  preVerificationGas: BigNumberish;
  maxFeePerGas: BigNumberish;
  maxPriorityFeePerGas: BigNumberish;
  paymasterAndData: BytesLike;
  signature: BytesLike;
};

export const genInitCode = async (
  factory: AddressLike,
  accountInitData: BytesLike
) => {
  const artifact = await hre.artifacts.readArtifact("AccountFactory");
  const iface = new ethers.Interface(artifact.abi);
  const initData = iface.encodeFunctionData("clone", [accountInitData]);
  return ethers.solidityPacked(["address", "bytes"], [factory, initData]);
};

export const buildAccountExecData = async (
  target: string,
  value?: BigNumberish,
  data?: string
) => {
  const artifact = await hre.artifacts.readArtifact("OpenId3Account");
  const iface = new ethers.Interface(artifact.abi);
  return iface.encodeFunctionData("execute", [
    target,
    value ?? 0,
    data ?? "0x",
  ]);
};

export const callWithEntryPoint = async (
  userOp: UserOperationStruct,
  signer: HardhatEthersSigner,
  log: boolean = false
) => {
  const entrypoint = await getEntryPoint(hre);
  try {
    return await entrypoint.handleOps([userOp], signer.address as string);
  } catch (e: any) {
    if (log) {
      const match = e.message.match(/0x[0-9a-z]+/);
      console.log(match);
      if (match) {
        console.log(entrypoint.interface.parseError(match[0]));
      }
    }
    throw e;
  }
};

const getNonce = async (sender: string) => {
  const account = await getOpenId3Account(hre, sender);
  if ((await hre.ethers.provider.getCode(sender)) === "0x") {
    return 0;
  }
  return (await account.getNonce()) as BigNumberish;
};


export const genUserOp = async (
  sender: string,
  initCode: string,
  callData: string,
  paymasterAndData?: string
): Promise<UserOperationStruct> => {
  const fee = await hre.ethers.provider.getFeeData();
  const userOp: UserOperationStruct = {
    sender,
    nonce: await getNonce(sender),
    initCode,
    callData,
    callGasLimit: 500000,
    verificationGasLimit: 2000000,
    preVerificationGas: 0,
    maxFeePerGas: fee.maxFeePerGas ?? 0,
    maxPriorityFeePerGas: fee.maxPriorityFeePerGas ?? 0,
    paymasterAndData: paymasterAndData ?? "0x",
    signature: "0x",
  };
  return await ethers.resolveProperties(userOp);
};

export const genUserOpHash = async (op: UserOperationStruct) => {
  const opHash = ethers.keccak256(
    ethers.AbiCoder.defaultAbiCoder().encode(
      [
        "address",
        "uint256",
        "bytes32",
        "bytes32",
        "uint256",
        "uint256",
        "uint256",
        "uint256",
        "uint256",
        "bytes32",
      ],
      [
        op.sender,
        op.nonce,
        ethers.keccak256(op.initCode),
        ethers.keccak256(op.callData),
        op.callGasLimit,
        op.verificationGasLimit,
        op.preVerificationGas,
        op.maxFeePerGas,
        op.maxPriorityFeePerGas,
        ethers.keccak256(op.paymasterAndData),
      ]
    )
  );
  const chainId = await hre.getChainId();
  return ethers.keccak256(
    ethers.AbiCoder.defaultAbiCoder().encode(
      ["bytes32", "address", "uint256"],
      [opHash, getEntryPointAddress(), chainId]
    )
  );
};

