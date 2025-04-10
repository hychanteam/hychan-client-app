import { ethers, Interface } from "ethers"
import abiJson from "../abi.json" assert { type: "json" }; 

// Contract address - replace with your actual contract address
const CONTRACT_ADDRESS = process.env.NEXT_PUBLIC_CONTRACT_ADDRESS || ""

// Contract ABI for the functions we need
const contractABI = abiJson.abi

export const iface = new Interface(contractABI);

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

// Interface for whitelist data
export interface WhitelistData {
  address: string
  allowedMintsGTD: number
  allowedMintsFCFS: number
  dcRole?: string | null
  dcId?: string | null
  isWhitelisted: boolean
}

// Interface for user mint info
export interface UserMintInfo {
  address: string,
  allowedMints: number,
  merkleProof: string[],
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
    handleCustomContractError(error)
    console.error("Error getting phase index:", error)
    return -1
  }
}

// Function to get phase information
export const getPhaseInfo = async (contract: ethers.Contract, phaseIndex: number): Promise<MintPhase | null> => {
  try {
    if (phaseIndex < 0) return null

    const phase = await contract.getMintPhase(phaseIndex)

    return {
      startTime: Number(phase.startTime),
      endTime: Number(phase.endTime),
      phaseTimeLength: Number(phase.phaseTimeLength),
      categories: phase.categories.map((cat: MintCategory) => ({
        price: Number(cat.price), // safe for large numbers
        merkleRoot: cat.merkleRoot,
        maxMintPerWallet: Number(cat.maxMintPerWallet),
        defaultMintableSupply: Number(cat.defaultMintableSupply),
        mintableSupply: Number(cat.mintableSupply),
      })),
    }
  } catch (error) {
    handleCustomContractError(error)
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
    handleCustomContractError(error)
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
    handleCustomContractError(error)
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
    handleCustomContractError(error)
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
    handleCustomContractError(error)
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
    const mintedCount = await contract.degenMintedCount()
    const maxMintPerWallet = await contract.maxDegenMintPerWallet()
    const degenCost = await contract.degenCost()

    return {
      mintedCount: Number(mintedCount),
      maxMintPerWallet: Number(maxMintPerWallet),
      remainingMints: Number(maxMintPerWallet) - Number(mintedCount),
      price: degenCost,
    }
  } catch (error) {
    handleCustomContractError(error)
    console.error("Error getting degen mint info:", error)
    return {
      mintedCount: 0,
      maxMintPerWallet: 0,
      remainingMints: 0,
      price: ethers.parseEther("3"),
    }
  }
}

// Function to fetch whitelist data for a specific wallet from the API
export const fetchWhitelistData = async (walletAddress: string): Promise<WhitelistData> => {
  try {
    const response = await fetch("/api/whitelist-data", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ walletAddress }),
    })

    if (!response.ok) {
      throw new Error(`API error: ${response.status}`)
    }

    const data = await response.json()
    return data
  } catch (error) {
    console.error("Error fetching whitelist data:", error)
    return {
      address: walletAddress,
      allowedMintsGTD: 0,
      allowedMintsFCFS: 0,
      isWhitelisted: false,
    }
  }
}

// Function to fetch address merkle proof whitelist data for Merkle tree generation
export const fetchMerkleProof = async (
  walletAddress: string,
  phaseIndex: number,
): Promise<UserMintInfo | null> => {
  try {
    const response = await fetch("/api/whitelist-data", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ walletAddress: walletAddress, getProofOnly: true, phaseIndex: phaseIndex }),
    })

    if (!response.ok) {
      throw new Error(`API error: ${response.status}`)
    }

    const data: UserMintInfo = await response.json()
    return data
  } catch (error) {
    console.error("Error fetching all whitelist data:", error)
    return null
  }
}

export const handleCustomContractError = (error: any) =>{
  if (error.data) {
    try {
      const decodedError = iface.parseError(error.data);
      console.error("Decoded custom error:", decodedError);
    } catch (decodeError) {
      console.warn("Failed to decode custom error:", decodeError);
    }
  }
}