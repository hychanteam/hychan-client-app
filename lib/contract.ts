import { ethers } from "ethers"
import keccak256 from "keccak256"
import { MerkleTree } from "merkletreejs"

const CONTRACT_ADDRESS = "0xYourContractAddressHere" // Replace with actual contract address

// Function to get the contract instance
export const getContract = async (provider: any) => {
  const signer = await provider.getSigner()
  const contract = new ethers.Contract(CONTRACT_ADDRESS, contractABI, signer)
  return contract
}

// Function to get current phase info
export const getCurrentPhaseInfo = async (contract: ethers.Contract) => {
  try {
    const phaseIndex = Number(await contract.currentPhase())
    const phaseName = await contract.getPhaseName(phaseIndex)
    const startTime = Number(await contract.getPhaseStartTime(phaseIndex))
    const endTime = Number(await contract.getPhaseEndTime(phaseIndex))
    const active = await contract.isPhaseActive(phaseIndex)
    const categoriesCount = Number(await contract.categoriesCount())

    const categories = []
    for (let i = 0; i < categoriesCount; i++) {
      const category = await contract.getCategory(i)
      categories.push({
        index: i,
        name: category.name,
        price: category.price,
        maxMintPerWallet: Number(category.maxMintPerWallet),
      })
    }

    return {
      phaseIndex,
      phaseName,
      startTime,
      endTime,
      active,
      categories,
    }
  } catch (error) {
    console.error("Error getting current phase info:", error)
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
    const maxSupply = Number(await contract.maxSupply())
    const totalSupply = Number(await contract.totalSupply())
    const remainingSupply = maxSupply - totalSupply

    return {
      maxSupply,
      totalSupply,
      remainingSupply,
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

// Function to get user phase mints info
export const getUserPhaseMintsInfo = async (contract: ethers.Contract, walletAddress: string, phaseIndex: number) => {
  try {
    const categoriesCount = Number(await contract.categoriesCount())
    const categories = []

    for (let i = 0; i < categoriesCount; i++) {
      const maxMintPerWallet = Number(await contract.getMaxMintPerWalletForPhaseAndCategory(phaseIndex, i))
      const mintedCount = Number(await contract.numberMinted(walletAddress, i))
      const remainingMints = maxMintPerWallet - mintedCount

      categories.push({
        index: i,
        maxMintPerWallet,
        mintedCount,
        remainingMints,
      })
    }

    const hasFullyMinted = categories.every((category) => category.remainingMints <= 0)

    return {
      categories,
      hasFullyMinted,
    }
  } catch (error) {
    console.error("Error getting user phase mints info:", error)
    return {
      categories: [],
      hasFullyMinted: false,
    }
  }
}

// Function to get degen mint info
export const getDegenMintInfo = async (contract: ethers.Contract, walletAddress: string) => {
  try {
    const mintedCount = Number(await contract.degenMinted(walletAddress))
    const maxMintPerWallet = 1 // Degen mint is limited to 1 per wallet
    const remainingMints = maxMintPerWallet - mintedCount
    const price = await contract.degenMintPrice()

    return {
      mintedCount,
      maxMintPerWallet,
      remainingMints,
      price,
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

// Function to generate Merkle Proof
export const generateMerkleProof = (address: string, allowedMints: number, whitelist: string[]) => {
  const leafNodes = whitelist.map((addr) => keccak256(addr))
  const merkleTree = new MerkleTree(leafNodes, keccak256, { sortPairs: true })
  const proof = merkleTree.getHexProof(keccak256(address))
  return proof
}

// Mock Whitelists (Replace with actual data)
export const mockGTDWhitelist = [
  "0xf39Fd6e51aad88F6F4ce6aB8829539bad25F8901",
  "0x70997970C51812dc3A010C7d01b50e0d17dc79C8",
  "0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC",
]

export const mockFCFSWhitelist = [
  "0x90F79bf6EB2c4f870365E785982E1ca93e6a4398",
  "0x15d34AAf54267DB7D7c367839AAf71A00a2C6A65",
  "0x9965507D1a55bcC2695C58ba16FB3763172Ea472",
]

const contractABI = [
  {
    inputs: [],
    stateMutability: "nonpayable",
    type: "constructor",
  },
  {
    anonymous: false,
    inputs: [
      {
        indexed: true,
        internalType: "address",
        name: "owner",
        type: "address",
      },
      {
        indexed: true,
        internalType: "address",
        name: "approved",
        type: "address",
      },
      {
        indexed: true,
        internalType: "uint256",
        name: "tokenId",
        type: "uint256",
      },
    ],
    name: "Approval",
    type: "event",
  },
  {
    anonymous: false,
    inputs: [
      {
        indexed: true,
        internalType: "address",
        name: "owner",
        type: "address",
      },
      {
        indexed: true,
        internalType: "address",
        name: "operator",
        type: "address",
      },
      {
        indexed: false,
        internalType: "bool",
        name: "approved",
        type: "bool",
      },
    ],
    name: "ApprovalForAll",
    type: "event",
  },
  {
    inputs: [
      {
        internalType: "address",
        name: "approved",
        type: "address",
      },
      {
        internalType: "uint256",
        name: "tokenId",
        type: "uint256",
      },
    ],
    name: "approve",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [
      {
        internalType: "address",
        name: "owner",
        type: "address",
      },
    ],
    name: "balanceOf",
    outputs: [
      {
        internalType: "uint256",
        name: "",
        type: "uint256",
      },
    ],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [],
    name: "categoriesCount",
    outputs: [
      {
        internalType: "uint256",
        name: "",
        type: "uint256",
      },
    ],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [],
    name: "currentPhase",
    outputs: [
      {
        internalType: "uint8",
        name: "",
        type: "uint8",
      },
    ],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [
      {
        internalType: "uint256",
        name: "_mintAmount",
        type: "uint256",
      },
    ],
    name: "degenSafeMint",
    outputs: [],
    stateMutability: "payable",
    type: "function",
  },
  {
    inputs: [
      {
        internalType: "address",
        name: "",
        type: "address",
      },
    ],
    name: "degenMinted",
    outputs: [
      {
        internalType: "uint256",
        name: "",
        type: "uint256",
      },
    ],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [],
    name: "degenMintPrice",
    outputs: [
      {
        internalType: "uint256",
        name: "",
        type: "uint256",
      },
    ],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [
      {
        internalType: "uint256",
        name: "categoryId",
        type: "uint256",
      },
    ],
    name: "getCategory",
    outputs: [
      {
        components: [
          {
            internalType: "string",
            name: "name",
            type: "string",
          },
          {
            internalType: "uint256",
            name: "price",
            type: "uint256",
          },
          {
            internalType: "uint256",
            name: "maxMintPerWallet",
            type: "uint256",
          },
        ],
        internalType: "struct HyChan.Category",
        name: "",
        type: "tuple",
      },
    ],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [
      {
        internalType: "uint8",
        name: "_phase",
        type: "uint8",
      },
    ],
    name: "getPhaseEndTime",
    outputs: [
      {
        internalType: "uint256",
        name: "",
        type: "uint256",
      },
    ],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [
      {
        internalType: "uint8",
        name: "_phase",
        type: "uint8",
      },
    ],
    name: "getPhaseName",
    outputs: [
      {
        internalType: "string",
        name: "",
        type: "string",
      },
    ],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [
      {
        internalType: "uint8",
        name: "_phase",
        type: "uint8",
      },
    ],
    name: "getPhaseStartTime",
    outputs: [
      {
        internalType: "uint256",
        name: "",
        type: "uint256",
      },
    ],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [
      {
        internalType: "uint8",
        name: "_phase",
        type: "uint8",
      },
      {
        internalType: "uint256",
        name: "categoryId",
        type: "uint256",
      },
    ],
    name: "getMaxMintPerWalletForPhaseAndCategory",
    outputs: [
      {
        internalType: "uint256",
        name: "",
        type: "uint256",
      },
    ],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [
      {
        internalType: "address",
        name: "owner",
        type: "address",
      },
      {
        internalType: "address",
        name: "operator",
        type: "address",
      },
    ],
    name: "isApprovedForAll",
    outputs: [
      {
        internalType: "bool",
        name: "",
        type: "bool",
      },
    ],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [
      {
        internalType: "uint8",
        name: "_phase",
        type: "uint8",
      },
    ],
    name: "isPhaseActive",
    outputs: [
      {
        internalType: "bool",
        name: "",
        type: "bool",
      },
    ],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [],
    name: "maxSupply",
    outputs: [
      {
        internalType: "uint256",
        name: "",
        type: "uint256",
      },
    ],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [
      {
        internalType: "address",
        name: "",
        type: "address",
      },
      {
        internalType: "uint256",
        name: "",
        type: "uint256",
      },
    ],
    name: "numberMinted",
    outputs: [
      {
        internalType: "uint256",
        name: "",
        type: "uint256",
      },
    ],
    stateMutability: "view",
    type: "function",
  },
  {
    anonymous: false,
    inputs: [
      {
        indexed: true,
        internalType: "address",
        name: "previousOwner",
        type: "address",
      },
      {
        indexed: true,
        internalType: "address",
        name: "newOwner",
        type: "address",
      },
    ],
    name: "OwnershipTransferred",
    type: "event",
  },
  {
    inputs: [],
    name: "owner",
    outputs: [
      {
        internalType: "address",
        name: "",
        type: "address",
      },
    ],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [],
    name: "renounceOwnership",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [
      {
        internalType: "uint256",
        name: "_mintAmount",
        type: "uint256",
      },
      {
        internalType: "uint256",
        name: "_allowedMints",
        type: "uint256",
      },
      {
        internalType: "uint256",
        name: "_categoryId",
        type: "uint256",
      },
      {
        internalType: "bytes32[]",
        name: "_merkleProof",
        type: "bytes32[]",
      },
    ],
    name: "safeMint",
    outputs: [],
    stateMutability: "payable",
    type: "function",
  },
  {
    inputs: [
      {
        internalType: "address",
        name: "from",
        type: "address",
      },
      {
        internalType: "address",
        name: "to",
        type: "address",
      },
      {
        internalType: "uint256",
        name: "tokenId",
        type: "uint256",
      },
    ],
    name: "safeTransfer",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [
      {
        internalType: "address",
        name: "from",
        type: "address",
      },
      {
        internalType: "address",
        name: "to",
        type: "address",
      },
      {
        internalType: "uint256",
        name: "tokenId",
        type: "uint256",
      },
      {
        internalType: "bytes",
        name: "data",
        type: "bytes",
      },
    ],
    name: "safeTransfer",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [
      {
        internalType: "address",
        name: "operator",
        type: "address",
      },
      {
        internalType: "bool",
        name: "approved",
        type: "bool",
      },
    ],
    name: "setApprovalForAll",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [
      {
        internalType: "bytes4",
        name: "interfaceId",
        type: "bytes4",
      },
    ],
    name: "supportsInterface",
    outputs: [
      {
        internalType: "bool",
        name: "",
        type: "bool",
      },
    ],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [],
    name: "symbol",
    outputs: [
      {
        internalType: "string",
        name: "",
        type: "string",
      },
    ],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [
      {
        internalType: "uint256",
        name: "tokenId",
        type: "uint256",
      },
    ],
    name: "tokenURI",
    outputs: [
      {
        internalType: "string",
        name: "",
        type: "string",
      },
    ],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [],
    name: "totalSupply",
    outputs: [
      {
        internalType: "uint256",
        name: "",
        type: "uint256",
      },
    ],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [
      {
        internalType: "address",
        name: "to",
        type: "address",
      },
      {
        internalType: "uint256",
        name: "tokenId",
        type: "uint256",
      },
    ],
    name: "transferFrom",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [
      {
        internalType: "address",
        name: "newOwner",
        type: "address",
      },
    ],
    name: "transferOwnership",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
]

