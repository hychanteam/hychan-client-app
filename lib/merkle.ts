import { ethers } from "ethers"
import { MerkleTree } from "merkletreejs"
import keccak256 from "keccak256"

// Function to generate a merkle tree from a list of addresses and their allowed mints
export const generateMerkleTree = (addressAllowances: { address: string; allowedMints: number }[]): MerkleTree => {
  // Create leaf nodes by hashing address and allowed mints together
  const leaves = addressAllowances.map((item) =>
    keccak256(ethers.solidityPacked(["address", "uint256"], [item.address, item.allowedMints])),
  )

  // Create merkle tree
  return new MerkleTree(leaves, keccak256, { sortPairs: true })
}

// Function to generate a merkle proof for a specific address and allowed mints
export const generateMerkleProof = (
  address: string,
  allowedMints: number,
  addressAllowances: { address: string; allowedMints: number }[],
): string[] => {
  // Create merkle tree
  const merkleTree = generateMerkleTree(addressAllowances)

  // Create leaf for the specific address and allowed mints
  const leaf = keccak256(ethers.solidityPacked(["address", "uint256"], [address, allowedMints]))

  // Generate proof
  return merkleTree.getHexProof(leaf)
}

// For testing purposes, we can use this function to verify a proof
export const verifyProof = (
  address: string,
  allowedMints: number,
  proof: string[],
  root: string,
  addressAllowances: { address: string; allowedMints: number }[],
): boolean => {
  // Create merkle tree
  const merkleTree = generateMerkleTree(addressAllowances)

  // Create leaf for the specific address and allowed mints
  const leaf = keccak256(ethers.solidityPacked(["address", "uint256"], [address, allowedMints]))

  // Verify proof
  return merkleTree.verify(proof, leaf, root)
}