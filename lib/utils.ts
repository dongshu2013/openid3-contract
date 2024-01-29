import { HardhatRuntimeEnvironment } from "hardhat/types";
import { Contract, ethers } from "ethers";
import {
  getDeterministicDeployer,
  getEntryPointAddress,
  genBytecode,
} from "./deployer";
import { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";

export async function getAbi(hre: HardhatRuntimeEnvironment, contract: string) {
  const artifact = await hre.artifacts.readArtifact(contract);
  return artifact.abi;
}

export async function getArtifact(
  hre: HardhatRuntimeEnvironment,
  contract: string
) {
  return await hre.artifacts.readArtifact(contract);
}

export async function getInterface(
  hre: HardhatRuntimeEnvironment,
  contract: string
) {
  const artifact = await getArtifact(hre, contract);
  return new hre.ethers.Interface(artifact.abi);
}

export async function getDeployedContract(
  hre: HardhatRuntimeEnvironment,
  contract: string,
  args?: string
) {
  const bytecode = genBytecode(await getArtifact(hre, contract), args ?? "0x");
  const admin = hre.ethers.getCreate2Address(
    getDeterministicDeployer(),
    hre.ethers.ZeroHash,
    hre.ethers.keccak256(hre.ethers.getBytes(bytecode))
  );
  const { deployer } = await hre.ethers.getNamedSigners();
  return new Contract(admin, await getAbi(hre, contract), deployer);
}

export async function getPasskeyAdmin(hre: HardhatRuntimeEnvironment) {
  return await getDeployedContract(hre, "PasskeyAdmin");
}

export async function getPlonkVerifier(hre: HardhatRuntimeEnvironment) {
  return await getDeployedContract(hre, "PlonkVerifier");
}

export async function getVeraxModule(hre: HardhatRuntimeEnvironment) {
  return await getDeployedContract(hre, "OpenId3TeeModule");
}

export async function getAccountMetadata(hre: HardhatRuntimeEnvironment) {
  return await getDeployedContract(hre, "AccountMetadata");
}

export async function getAccountProxy(hre: HardhatRuntimeEnvironment) {
  return await getDeployedContract(hre, "AccountProxy");
}

export async function getAccountImpl(hre: HardhatRuntimeEnvironment) {
  const admin = await getPasskeyAdmin(hre);
  const adminAddr = await admin.getAddress();
  const metadata = await getAccountMetadata(hre);
  const metadataAddr = await metadata.getAddress();
  const args = hre.ethers.AbiCoder.defaultAbiCoder().encode(
    ["address", "address", "address"],
    [getEntryPointAddress(), adminAddr, metadataAddr]
  );
  return await getDeployedContract(hre, "OpenId3Account", args);
}

export async function getAccountFactory(hre: HardhatRuntimeEnvironment) {
  const proxy = await getAccountProxy(hre);
  const impl = await getAccountImpl(hre);
  const args = hre.ethers.AbiCoder.defaultAbiCoder().encode(
    ["address", "address"],
    [await proxy.getAddress(), await impl.getAddress()]
  );
  return await getDeployedContract(hre, "AccountFactory", args);
}

export async function getEntryPoint(hre: HardhatRuntimeEnvironment) {
  const { deployer } = await hre.ethers.getNamedSigners();
  return new Contract(
    getEntryPointAddress(),
    await getAbi(hre, "EntryPoint"),
    deployer
  );
}

export const getOpenId3Account = async (
  hre: HardhatRuntimeEnvironment,
  account: string,
  deployer?: HardhatEthersSigner
) => {
  const artifact = await hre.artifacts.readArtifact("OpenId3Account");
  return new Contract(account, artifact.abi, deployer ?? hre.ethers.provider);
};

export const genOperatorHash = (ops: string[]) => {
  return ethers.solidityPackedKeccak256(
    ops.map(() => "address"),
    ops
  );
}
