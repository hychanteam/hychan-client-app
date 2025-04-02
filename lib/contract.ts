import { ethers } from "ethers"
import MerkleTree from "merkletreejs"
import keccak256 from "keccak256"

// ABI for the ERC721ATokenMerkle contract (partial - just what we need)
export const CONTRACT_ABI = [
  "function safeMint(uint256 _mintAmount, uint256 _allowedMints, uint256 _categoryIndex, bytes32[] calldata _merkleProof) external payable",
  "function degenSafeMint(uint256 _mintAmount) external payable",
  "function phaseIndex() public view returns (int256)",
  "function mintPhases(uint256) public view returns (uint256 startTime, uint256 endTime, uint256 phaseTimeLength)",
  "function categoryMintedCount(uint256, uint256) public view returns (uint256)",
  "function addressMintedBalance(uint256, uint256, address) public view returns (uint256)",
  "function maxSupply() public view returns (uint256)",
  "function totalSupply() public view returns (uint256)",
  "function degenCost() public view returns (uint256)",
  "function degenMintedCount(address) public view returns (uint256)",
  "function maxDegenMintPerWallet() public view returns (uint256)",
  "function mintPhases(uint256) public view returns (uint256 startTime, uint256 endTime, uint256 phaseTimeLength, tuple(uint256 price, bytes32 merkleRoot, uint256 maxMintPerWallet, uint256 defaultMintableSupply, uint256 mintableSupply)[] categories)",
]

// Contract address - replace with your deployed contract address
export const CONTRACT_ADDRESS = "0x0000000000000000000000000000000000000000" // Replace with actual address

// Phase names for display
export const PHASE_NAMES = ["GTD Mint", "FCFS Mint", "Public Mint"]

// Function to generate a Merkle proof
export const generateMerkleProof = (
  address: string,
  allowedMints: number,
  whitelistData: Array<{ address: string; allowedMints: number }>,
) => {
  // Create leaf nodes
  const leaves = whitelistData.map((entry) =>
    keccak256(ethers.solidityPacked(["address", "uint256"], [entry.address, entry.allowedMints])),
  )

  // Create Merkle Tree
  const tree = new MerkleTree(leaves, keccak256, { sortPairs: true })

  // Create leaf for the user
  const leaf = keccak256(ethers.solidityPacked(["address", "uint256"], [address, allowedMints]))

  // Generate proof
  return tree.getHexProof(leaf)
}

// Function to get contract instance
export const getContract = async (provider: any) => {
  try {
    const signer = provider.getSigner()
    return new ethers.Contract(CONTRACT_ADDRESS, CONTRACT_ABI, signer)
  } catch (error) {
    console.error("Error getting contract:", error)
    throw error
  }
}

// Function to get current phase info
export const getCurrentPhaseInfo = async (contract: ethers.Contract) => {
  try {
    const phaseIndex = await contract.phaseIndex()

    // If phase is paused (-1), return null
    if (phaseIndex.toString() === "-1") {
      return {
        phaseIndex: -1,
        phaseName: "Minting Paused",
        startTime: 0,
        endTime: 0,
        active: false,
        categories: [],
      }
    }

    const phaseData = await contract.mintPhases(phaseIndex)
    const currentTime = Math.floor(Date.now() / 1000)

    // Extract categories from phaseData
    const categories = phaseData.categories || []

    return {
      phaseIndex: Number(phaseIndex),
      phaseName: PHASE_NAMES[Number(phaseIndex)] || `Phase ${phaseIndex}`,
      startTime: Number(phaseData.startTime),
      endTime: Number(phaseData.endTime),
      active: currentTime >= Number(phaseData.startTime) && currentTime <= Number(phaseData.endTime),
      categories: categories.map((cat: any, index: number) => ({
        index,
        price: cat.price,
        maxMintPerWallet: Number(cat.maxMintPerWallet),
        mintableSupply: Number(cat.mintableSupply),
      })),
    }
  } catch (error) {
    console.error("Error getting phase info:", error)
    return {
      phaseIndex: -1,
      phaseName: "Error",
      startTime: 0,
      endTime: 0,
      active: false,
      categories: [],
    }
  }
}

// Function to get supply info
export const getSupplyInfo = async (contract: ethers.Contract) => {
  try {
    const maxSupply = await contract.maxSupply()
    const totalSupply = await contract.totalSupply()

    return {
      maxSupply: Number(maxSupply),
      totalSupply: Number(totalSupply),
      remainingSupply: Number(maxSupply) - Number(totalSupply),
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

// Function to get user mint info for a specific category
export const getUserCategoryMintInfo = async (
  contract: ethers.Contract,
  address: string,
  phaseIndex: number,
  categoryIndex: number,
) => {
  try {
    const mintedBalance = await contract.addressMintedBalance(phaseIndex, categoryIndex, address)

    // Get the phase data to find the max mint per wallet for this category
    const phaseData = await contract.mintPhases(phaseIndex)
    const categories = phaseData.categories || []

    let maxMintPerWallet = 1 // Default

    if (categories.length > categoryIndex) {
      maxMintPerWallet = Number(categories[categoryIndex].maxMintPerWallet)
    }

    return {
      mintedCount: Number(mintedBalance),
      maxMintPerWallet: maxMintPerWallet,
      remainingMints: maxMintPerWallet - Number(mintedBalance),
    }
  } catch (error) {
    console.error(`Error getting user mint info for phase ${phaseIndex}, category ${categoryIndex}:`, error)
    return {
      mintedCount: 0,
      maxMintPerWallet: 0,
      remainingMints: 0,
    }
  }
}

// Function to get user mint info for all categories in a phase
export const getUserPhaseMintsInfo = async (contract: ethers.Contract, address: string, phaseIndex: number) => {
  try {
    // Get the phase data to find all categories
    const phaseData = await contract.mintPhases(phaseIndex)
    const categories = phaseData.categories || []

    // Get mint info for each category
    const categoryInfos = await Promise.all(
      Array.from({ length: categories.length }, (_, i) => getUserCategoryMintInfo(contract, address, phaseIndex, i)),
    )

    // Check if user has minted their full allocation for all categories
    const hasFullyMinted = categoryInfos.every((info) => info.remainingMints === 0 && info.maxMintPerWallet > 0)

    return {
      categories: categoryInfos,
      hasFullyMinted,
    }
  } catch (error) {
    console.error(`Error getting user phase mints info for phase ${phaseIndex}:`, error)
    return {
      categories: [],
      hasFullyMinted: false,
    }
  }
}

// Function to get degen mint info
export const getDegenMintInfo = async (contract: ethers.Contract, address: string) => {
  try {
    const degenMintedCount = await contract.degenMintedCount(address)
    const maxDegenMintPerWallet = await contract.maxDegenMintPerWallet()
    const degenCost = await contract.degenCost()

    return {
      mintedCount: Number(degenMintedCount),
      maxMintPerWallet: Number(maxDegenMintPerWallet),
      remainingMints: Number(maxDegenMintPerWallet) - Number(degenMintedCount),
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

// Function to format time remaining
export const formatTimeRemaining = (endTime: number) => {
  const now = Math.floor(Date.now() / 1000)
  const timeRemaining = endTime - now

  if (timeRemaining <= 0) return "Ended"

  const hours = Math.floor(timeRemaining / 3600)
  const minutes = Math.floor((timeRemaining % 3600) / 60)
  const seconds = timeRemaining % 60

  return `${hours}h ${minutes}m ${seconds}s`
}

// Mock whitelist data for testing - replace with actual data in production
export const mockGTDWhitelist = [
  { address: "0x1234567890123456789012345678901234567890", allowedMints: 2 },
  // Add more addresses as needed
]

export const mockFCFSWhitelist = [
  { address: "0x1234567890123456789012345678901234567890", allowedMints: 1 },
  // Add more addresses as needed
]

