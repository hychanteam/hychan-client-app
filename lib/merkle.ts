import { MerkleTree } from "merkletreejs"
import keccak256 from "keccak256"

export function generateMerkleTree(entries: { address: string; allowedMints: number }[]): MerkleTree {
  // Create leaf nodes by hashing encoded address + allowedMints
  const leafNodes = entries.map(({ address, allowedMints }) => {
      const leaf = keccak256(
          Buffer.concat([
              Buffer.from(address.slice(2), "hex"), // Remove "0x" prefix and convert to Buffer
              Buffer.from(allowedMints.toString(16).padStart(64, "0"), "hex"), // 32-byte uint256
          ])
      );

      return leaf
  });

  const merkleTree = new MerkleTree(leafNodes, keccak256, { sortPairs: true });
  return merkleTree;
}

export function generateMerkleProof(
  entry: { address: string; allowedMints: number },
  merkleTree: MerkleTree
): string[] {
  const leaf = keccak256(
      Buffer.concat([
          Buffer.from(entry.address.slice(2), "hex"), // Remove "0x" prefix and convert to Buffer
          Buffer.from(entry.allowedMints.toString(16).padStart(64, "0"), "hex"), // 32-byte uint256
      ])
  );

  // Get Merkle proof
  const proof = merkleTree.getHexProof(leaf);
  return proof;
}