import { ethers } from "ethers"
import keccak256 from "keccak256"
import { MerkleTree } from "merkletreejs"

// Contract address - replace with your actual contract address
const CONTRACT_ADDRESS = process.env.NEXT_PUBLIC_CONTRACT_ADDRESS || ""

// Contract ABI for the functions we need
const contractABI = [
  // View functions
  "function mintPhases(uint256) view returns (uint256 startTime, uint256 endTime, uint256 phaseTimeLength)",
  "function phaseIndex() view returns (int256)",
  "function maxSupply() view returns (uint256)",
  "function totalSupply() view returns (uint256)",
  "function ownerAlloc() view returns (uint256)",
  "function degenAlloc() view returns (uint256)",
  "function maxDegenMintPerWallet() view returns (uint256)",
  "function degenCost() view returns (uint256)",
  "function revealed() view returns (bool)",
  "function tradingEnabled() view returns (bool)",
  "function categoryMintedCount(uint256,uint256) view returns (uint256)",
  "function addressMintedBalance(uint256,uint256,address) view returns (uint256)",
  "function degenMintedCount(address) view returns (uint256)",

  // Write functions
  "function safeMint(uint256 _mintAmount, uint256 _allowedMints, uint256 _categoryIndex, bytes32[] calldata _merkleProof) payable",
  "function degenSafeMint(uint256 _mintAmount) payable",

  // Events
  "event Transfer(address indexed from, address indexed to, uint256 indexed tokenId)",
]

// Interface for MintCategory
export interface MintCategory {
  price: ethers.BigNumberish
  merkleRoot: string
  maxMintPerWallet: number
  defaultMintableSupply: number
  mintableSupply: number
}

// Interface for MintPhase
export interface MintPhase {
  startTime: number
  endTime: number
  phaseTimeLength: number
  categories: MintCategory[]
}

// Function to get the contract instance
export const getContract = async (provider: ethers.Provider) => {
  const contract = new ethers.Contract(CONTRACT_ADDRESS, contractABI, provider)
  return contract
}

// Function to get contract instance with signer
export const getContractWithSigner = async (provider: ethers.BrowserProvider) => {
  const signer = await provider.getSigner()
  const contract = new ethers.Contract(CONTRACT_ADDRESS, contractABI, signer)
  return contract
}

// Function to get current phase index
export const getCurrentPhaseIndex = async (contract: ethers.Contract): Promise<number> => {
  try {
    const phaseIndex = await contract.phaseIndex()
    return Number(phaseIndex)
  } catch (error) {
    console.error("Error getting phase index:", error)
    return -1
  }
}

// Function to get phase information
export const getPhaseInfo = async (contract: ethers.Contract, phaseIndex: number): Promise<MintPhase | null> => {
  try {
    if (phaseIndex < 0) return null

    const phase = await contract.mintPhases(phaseIndex)

    // We need to make additional calls to get the categories
    // This is a simplified version - in a real implementation, you would need to
    // query the contract to get the categories array length and then fetch each category

    // For now, we'll assume we know the categories structure
    // In a real implementation, you would need to create a custom method on your contract
    // to return the full phase information including categories

    // This is a placeholder - you'll need to implement this based on your contract structure
    const categories: MintCategory[] = [
      {
        price: ethers.parseEther("2"),
        merkleRoot: "0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef",
        maxMintPerWallet: 2,
        defaultMintableSupply: 5000,
        mintableSupply: 5000,
      },
    ]

    return {
      startTime: Number(phase.startTime),
      endTime: Number(phase.endTime),
      phaseTimeLength: Number(phase.phaseTimeLength),
      categories: categories,
    }
  } catch (error) {
    console.error("Error getting phase info:", error)
    return null
  }
}

// Function to get supply information
export const getSupplyInfo = async (contract: ethers.Contract) => {
  try {
    const maxSupply = await contract.maxSupply()
    const totalSupply = await contract.totalSupply()
    const remainingSupply = maxSupply - totalSupply

    return {
      maxSupply: Number(maxSupply),
      totalSupply: Number(totalSupply),
      remainingSupply: Number(remainingSupply),
    }
  } catch (error) {
    console.error("Error getting supply info:", error)
    return {
      maxSupply: 0,
      totalSupply: 0,
      remainingSupply: 0,
    }
  }
}

// Function to get user's minted balance for a specific phase and category
export const getUserMintedBalance = async (
  contract: ethers.Contract,
  phaseIndex: number,
  categoryIndex: number,
  address: string,
): Promise<number> => {
  try {
    const balance = await contract.addressMintedBalance(phaseIndex, categoryIndex, address)
    return Number(balance)
  } catch (error) {
    console.error("Error getting user minted balance:", error)
    return 0
  }
}

// Function to get user's degen minted count
export const getUserDegenMintedCount = async (contract: ethers.Contract, address: string): Promise<number> => {
  try {
    const count = await contract.degenMintedCount(address)
    return Number(count)
  } catch (error) {
    console.error("Error getting user degen minted count:", error)
    return 0
  }
}

// Function to get category minted count
export const getCategoryMintedCount = async (
  contract: ethers.Contract,
  phaseIndex: number,
  categoryIndex: number,
): Promise<number> => {
  try {
    const count = await contract.categoryMintedCount(phaseIndex, categoryIndex)
    return Number(count)
  } catch (error) {
    console.error("Error getting category minted count:", error)
    return 0
  }
}

// Function to get degen mint info
export const getDegenMintInfo = async (
  contract: ethers.Contract,
  address: string,
): Promise<{
  mintedCount: number
  maxMintPerWallet: number
  remainingMints: number
  price: ethers.BigNumberish
}> => {
  try {
    const mintedCount = await contract.degenMintedCount(address)
    const maxMintPerWallet = await contract.maxDegenMintPerWallet()
    const degenCost = await contract.degenCost()

    return {
      mintedCount: Number(mintedCount),
      maxMintPerWallet: Number(maxMintPerWallet),
      remainingMints: Number(maxMintPerWallet) - Number(mintedCount),
      price: degenCost,
    }
  } catch (error) {
    console.error("Error getting degen mint info:", error)
    return {
      mintedCount: 0,
      maxMintPerWallet: 0,
      remainingMints: 0,
      price: ethers.parseEther("3"),
    }
  }
}

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

// Mock whitelist data for testing - in a real implementation, this would come from your database
export const mockGTDWhitelist = [
  { address: "0xf39Fd6e51aad88F6F4ce6aB8829539bad25F8901", allowedMints: 2 },
  { address: "0x70997970C51812dc3A010C7d01b50e0d17dc79C8", allowedMints: 2 },
  { address: "0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC", allowedMints: 1 },
]

export const mockFCFSWhitelist = [
  { address: "0x90F79bf6EB2c4f870365E785982E1ca93e6a4398", allowedMints: 1 },
  { address: "0x15d34AAf54267DB7D7c367839AAf71A00a2C6A65", allowedMints: 1 },
  { address: "0x9965507D1a55bcC2695C58ba16FB3763172Ea472", allowedMints: 1 },
]

