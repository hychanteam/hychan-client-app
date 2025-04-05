"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import Image from "next/image"
import { ArrowLeft, Loader2, AlertCircle, CheckCircle2, Gift, Sparkles, DiscIcon as Discord } from "lucide-react"
import { ethers } from "ethers"
import { formatTimeRemaining } from "../../lib/time-utils"
import {
  getDiscordAuthUrl,
  storeWalletAddress,
  getWalletAddress,
  clearWalletAddress,
  getDiscordCredentials,
  clearDiscordCredentials,
} from "../../lib/auth"

// Mock data based on smart contract structure
const mockMintPhases = [
  {
    startTime: Math.floor(Date.now() / 1000) - 86400, // 1 day ago
    endTime: Math.floor(Date.now() / 1000) + 86400 * 3, // 3 days from now
    phaseTimeLength: 86400 * 4, // 4 days
    categories: [
      {
        price: ethers.parseEther("2"),
        merkleRoot: "0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef",
        maxMintPerWallet: 2,
        defaultMintableSupply: 5000,
        mintableSupply: 5000,
      },
      {
        price: ethers.parseEther("2.5"),
        merkleRoot: "0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890",
        maxMintPerWallet: 1,
        defaultMintableSupply: 3000,
        mintableSupply: 3000,
      },
    ],
  },
  {
    startTime: Math.floor(Date.now() / 1000) + 86400 * 3, // 3 days from now
    endTime: Math.floor(Date.now() / 1000) + 86400 * 6, // 6 days from now
    phaseTimeLength: 86400 * 3, // 3 days
    categories: [
      {
        price: ethers.parseEther("3"),
        merkleRoot: "0x0987654321fedcba0987654321fedcba0987654321fedcba0987654321fedcba",
        maxMintPerWallet: 1,
        defaultMintableSupply: 2000,
        mintableSupply: 2000,
      },
    ],
  },
]

const mockContractState = {
  phaseIndex: 0,
  revealed: false,
  tradingEnabled: false,
  maxSupply: 10000,
  totalSupply: 3500,
  ownerAlloc: 44,
  degenAlloc: 1000,
  maxDegenMintPerWallet: 1,
  degenCost: ethers.parseEther("3"),
  categoryMintedCount: [
    [1500, 1000], // Phase 0: Category 0 has 1500 minted, Category 1 has 1000 minted
    [0], // Phase 1: Category 0 has 0 minted
  ],
}

// Mock user data
const mockUserData = {
  addressMintedBalance: [
    [0, 0], // Phase 0: User has minted 0 from Category 0, 0 from Category 1
    [0], // Phase 1: User has minted 0 from Category 0
  ],
  degenMintedCount: 0,
}

export default function MintPage() {
  // State variables
  const [walletAddress, setWalletAddress] = useState<string>("")
  const [isConnected, setIsConnected] = useState<boolean>(false)
  const [isConnecting, setIsConnecting] = useState<boolean>(false)
  const [provider, setProvider] = useState<any>(null)
  const [contract, setContract] = useState<any>(null)
  const [mintAmount, setMintAmount] = useState<number>(1)
  const [isMinting, setIsMinting] = useState<boolean>(false)
  const [error, setError] = useState<string>("")
  const [success, setSuccess] = useState<string>("")
  const [mintPhases, setMintPhases] = useState(mockMintPhases)
  const [contractState, setContractState] = useState(mockContractState)
  const [userData, setUserData] = useState(mockUserData)
  const [currentPhase, setCurrentPhase] = useState(mockMintPhases[0])
  const [phaseInfo, setPhaseInfo] = useState({
    phaseIndex: contractState.phaseIndex,
    phaseName:
      contractState.phaseIndex === 0
        ? "GTD Mint (Phase 1)"
        : contractState.phaseIndex === 1
          ? "FCFS Mint (Phase 2)"
          : contractState.phaseIndex === 2
            ? "Public Mint (Phase 3)"
            : "Minting Paused",
    startTime: contractState.phaseIndex >= 0 ? mockMintPhases[contractState.phaseIndex].startTime : 0,
    endTime: contractState.phaseIndex >= 0 ? mockMintPhases[contractState.phaseIndex].endTime : 0,
    active: contractState.phaseIndex >= 0,
    categories: contractState.phaseIndex >= 0 ? mockMintPhases[contractState.phaseIndex].categories : [],
  })
  const [supplyInfo, setSupplyInfo] = useState({
    maxSupply: mockContractState.maxSupply,
    totalSupply: mockContractState.totalSupply,
    remainingSupply: mockContractState.maxSupply - mockContractState.totalSupply,
  })
  const [userPhaseInfo, setUserPhaseInfo] = useState<any>({
    categories: [],
    hasFullyMinted: false,
  })
  const [degenMintInfo, setDegenMintInfo] = useState<any>({
    mintedCount: 0,
    maxMintPerWallet: 1,
    remainingMints: 1,
    price: ethers.parseEther("3"),
  })
  const [timeRemaining, setTimeRemaining] = useState<string>("")
  const [mintPrice, setMintPrice] = useState<string>("2 HYPE")
  const [refreshCounter, setRefreshCounter] = useState<number>(0)
  const [selectedCategory, setSelectedCategory] = useState<number>(0)
  const [showDegenSurprise, setShowDegenSurprise] = useState<boolean>(false)
  const [isDegenRevealed, setIsDegenRevealed] = useState<boolean>(false)

  // Discord state
  const [discordId, setDiscordId] = useState<string | null>(null)
  const [discordUsername, setDiscordUsername] = useState<string | null>(null)

  // Connect wallet function
  const connectWallet = async () => {
    setIsConnecting(true)
    setError("")

    try {
      if (window.ethereum) {
        const provider = new ethers.BrowserProvider(window.ethereum)
        const accounts = await provider.send("eth_requestAccounts", [])

        if (accounts.length > 0) {
          const address = accounts[0]
          setWalletAddress(address)
          setIsConnected(true)
          setProvider(provider)

          // Store wallet address in localStorage for persistence
          storeWalletAddress(address)

          // Fetch user data from the API
          try {
            const response = await fetch("/api/user-data", {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
              },
              body: JSON.stringify({ address }),
            })

            if (response.ok) {
              const data = await response.json()
              setUserData(data)
              console.log("User data fetched:", data)

              // Show success message if Discord roles were assigned
              if (data.roleAssigned) {
                setSuccess("Discord roles assigned successfully!")
              }
            } else {
              console.error("Failed to fetch user data:", await response.text())
            }
          } catch (apiError) {
            console.error("API error:", apiError)
          }
        }
      } else {
        setError("No Ethereum wallet detected. Please install MetaMask.")
      }
    } catch (err: any) {
      console.error("Error connecting wallet:", err)
      setError("Failed to connect wallet. Please try again.")
    } finally {
      setIsConnecting(false)
    }
  }

  // Disconnect wallet function
  const disconnectWallet = () => {
    setWalletAddress("")
    setIsConnected(false)
    setProvider(null)
    setContract(null)
    setUserPhaseInfo({
      categories: [],
      hasFullyMinted: false,
    })
    setDegenMintInfo({
      mintedCount: 0,
      maxMintPerWallet: 1,
      remainingMints: 1,
      price: ethers.parseEther("3"),
    })
    setShowDegenSurprise(false)
    setIsDegenRevealed(false)
    setUserData(mockUserData)

    // Clear stored wallet address
    clearWalletAddress()
  }

  // Connect Discord function
  const connectDiscord = () => {
    // Make sure we store the current wallet address before redirecting
    if (walletAddress) {
      storeWalletAddress(walletAddress)
    }

    window.location.href = getDiscordAuthUrl()
  }

  // Disconnect Discord function
  const disconnectDiscord = () => {
    setDiscordId(null)
    setDiscordUsername(null)

    // Clear Discord cookies
    document.cookie = "discord_user_id=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;"
    document.cookie = "discord_username=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;"

    // Clear Discord credentials from localStorage
    clearDiscordCredentials()
  }

  // Regular mint function
  const mint = async () => {
    if (!isConnected) return

    setIsMinting(true)
    setError("")
    setSuccess("")

    try {
      // Simulate minting delay
      await new Promise((resolve) => setTimeout(resolve, 2000))

      // Check if user has exceeded their mint limit
      const currentMinted = userData.addressMintedBalance[phaseInfo.phaseIndex][selectedCategory]
      const maxMintPerWallet = phaseInfo.categories[selectedCategory].maxMintPerWallet

      if (currentMinted + mintAmount > maxMintPerWallet) {
        throw new Error("WalletLimitExceeded: You've reached your mint limit for this category")
      }

      // Check if category has enough supply
      const categoryMinted = contractState.categoryMintedCount[phaseInfo.phaseIndex][selectedCategory]
      const categorySupply = phaseInfo.categories[selectedCategory].mintableSupply

      if (categorySupply > 0 && categoryMinted + mintAmount > categorySupply) {
        throw new Error("CategorySoldOut: This category is sold out")
      }

      setSuccess(`Successfully minted ${mintAmount} HYCHAN NFT${mintAmount > 1 ? "s" : ""}!`)

      // Update user data
      setUserData((prev) => {
        const newAddressMintedBalance = [...prev.addressMintedBalance]
        newAddressMintedBalance[phaseInfo.phaseIndex] = [...newAddressMintedBalance[phaseInfo.phaseIndex]]
        newAddressMintedBalance[phaseInfo.phaseIndex][selectedCategory] += mintAmount

        return {
          ...prev,
          addressMintedBalance: newAddressMintedBalance,
        }
      })

      // Update contract state
      setContractState((prev) => {
        const newCategoryMintedCount = [...prev.categoryMintedCount]
        newCategoryMintedCount[phaseInfo.phaseIndex] = [...newCategoryMintedCount[phaseInfo.phaseIndex]]
        newCategoryMintedCount[phaseInfo.phaseIndex][selectedCategory] += mintAmount

        return {
          ...prev,
          totalSupply: prev.totalSupply + mintAmount,
          categoryMintedCount: newCategoryMintedCount,
        }
      })

      // Refresh data after successful mint
      setRefreshCounter((prev) => prev + 1)
    } catch (err: any) {
      console.error("Error minting:", err)

      // Extract error message from blockchain error
      let errorMessage = "Failed to mint. Please try again."

      if (err.message) {
        if (err.message.includes("WalletLimitExceeded")) {
          errorMessage = "You've reached your mint limit for this category"
        } else if (err.message.includes("CategorySoldOut")) {
          errorMessage = "This category is sold out"
        } else if (err.message.includes("SoldOut")) {
          errorMessage = "The collection is sold out"
        } else if (err.message.includes("InsufficientPayment")) {
          errorMessage = "Insufficient payment amount"
        } else if (err.message.includes("InvalidProof")) {
          errorMessage = "You're not on the allowlist for this phase"
        } else if (err.message.includes("user rejected")) {
          errorMessage = "Transaction was rejected"
        }
      }

      setError(errorMessage)
    } finally {
      setIsMinting(false)
    }
  }

  // Degen mint function
  const degenMint = async () => {
    if (!isConnected) return

    setIsMinting(true)
    setError("")
    setSuccess("")

    try {
      // Simulate minting delay
      await new Promise((resolve) => setTimeout(resolve, 2000))

      // Check if user has exceeded their degen mint limit
      if (userData.degenMintedCount >= contractState.maxDegenMintPerWallet) {
        throw new Error("WalletLimitExceeded: You've reached your degen mint limit")
      }

      // Check if degen allocation has enough supply
      const degenMinted =
        contractState.totalSupply - contractState.categoryMintedCount.flat().reduce((a, b) => a + b, 0)

      if (degenMinted >= contractState.degenAlloc) {
        throw new Error("SoldOut: Degen allocation is sold out")
      }

      setSuccess(`Successfully minted a DEGEN HYCHAN NFT!`)

      // Update user data
      setUserData((prev) => ({
        ...prev,
        degenMintedCount: prev.degenMintedCount + 1,
      }))

      // Update contract state
      setContractState((prev) => ({
        ...prev,
        totalSupply: prev.totalSupply + 1,
      }))

      // Refresh data after successful mint
      setRefreshCounter((prev) => prev + 1)
    } catch (err: any) {
      console.error("Error minting degen:", err)

      // Extract error message from blockchain error
      let errorMessage = "Failed to mint. Please try again."

      if (err.message) {
        if (err.message.includes("WalletLimitExceeded")) {
          errorMessage = "You've reached your degen mint limit"
        } else if (err.message.includes("SoldOut")) {
          errorMessage = "Degen allocation is sold out"
        } else if (err.message.includes("InsufficientPayment")) {
          errorMessage = "Insufficient payment amount"
        } else if (err.message.includes("user rejected")) {
          errorMessage = "Transaction was rejected"
        }
      }

      setError(errorMessage)
    } finally {
      setIsMinting(false)
    }
  }

  // Reveal degen mint
  const revealDegenMint = () => {
    setIsDegenRevealed(true)
  }

  // Update time remaining
  const updateTimeRemaining = () => {
    if (phaseInfo.endTime > 0) {
      setTimeRemaining(formatTimeRemaining(phaseInfo.endTime))
    }
  }

  const checkConnection = async () => {
    // First check if we have a stored wallet address
    const storedAddress = getWalletAddress()

    if (storedAddress) {
      setWalletAddress(storedAddress)
      setIsConnected(true)

      // Fetch user data using the stored address
      try {
        const response = await fetch("/api/user-data", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ address: storedAddress }),
        })

        if (response.ok) {
          const data = await response.json()
          setUserData(data)
          console.log("User data fetched from stored address:", data)
        }
      } catch (apiError) {
        console.error("API error:", apiError)
      }

      // Also set up provider if window.ethereum is available
      if (window.ethereum) {
        const provider = new ethers.BrowserProvider(window.ethereum)
        setProvider(provider)
      }

      return true
    }

    // If no stored address, try to get it from the wallet
    if (window.ethereum) {
      try {
        const provider = new ethers.BrowserProvider(window.ethereum)
        const accounts = await provider.send("eth_accounts", [])

        if (accounts.length > 0) {
          const address = accounts[0]
          setWalletAddress(address)
          setIsConnected(true)
          setProvider(provider)

          // Store the wallet address for future use
          storeWalletAddress(address)

          // Fetch user data from the API
          try {
            const response = await fetch("/api/user-data", {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
              },
              body: JSON.stringify({ address }),
            })

            if (response.ok) {
              const data = await response.json()
              setUserData(data)
              console.log("User data fetched:", data)
            }
          } catch (apiError) {
            console.error("API error:", apiError)
          }

          return true
        }
      } catch (err) {
        console.error("Error checking wallet connection:", err)
      }
    }

    // Check for Discord credentials
    const credentials = getDiscordCredentials()
    if (credentials && credentials.id) {
      setDiscordId(credentials.id)
      setDiscordUsername(credentials.username || null)
    }

    return false
  }

  // Effect for initial wallet connection check
  useEffect(() => {
    checkConnection()

    // Listen for account changes
    if (window.ethereum) {
      const handleAccountsChanged = (accounts: string[]) => {
        if (accounts.length > 0) {
          setWalletAddress(accounts[0])
        } else {
          disconnectWallet()
        }
      }

      window.ethereum.on("accountsChanged", handleAccountsChanged)

      return () => {
        window.ethereum?.removeListener("accountsChanged", handleAccountsChanged)
      }
    }
  }, [])

  // Effect for updating time remaining
  useEffect(() => {
    if (phaseInfo.endTime > 0) {
      updateTimeRemaining()

      const interval = setInterval(() => {
        updateTimeRemaining()
      }, 1000)

      return () => clearInterval(interval)
    }
  }, [phaseInfo.endTime])

  // Check for stored Discord credentials on mount
  useEffect(() => {
    const checkDiscordCredentials = () => {
      const credentials = getDiscordCredentials()
      if (credentials && credentials.id) {
        setDiscordId(credentials.id)
        setDiscordUsername(credentials.username || null)
      }
    }

    checkDiscordCredentials()
  }, [])

  // Effect to check if user has fully minted and show degen surprise
  useEffect(() => {
    if (userPhaseInfo.hasFullyMinted) {
      setShowDegenSurprise(true)
    }
  }, [userPhaseInfo.hasFullyMinted])

  // Increment mint amount
  const incrementMintAmount = () => {
    if (phaseInfo.categories && phaseInfo.categories.length > selectedCategory) {
      const maxMint = phaseInfo.categories[selectedCategory].maxMintPerWallet
      const userMinted = userData.addressMintedBalance[phaseInfo.phaseIndex][selectedCategory] || 0
      const remaining = maxMint - userMinted

      if (mintAmount < remaining) {
        setMintAmount(mintAmount + 1)
      }
    }
  }

  // Decrement mint amount
  const decrementMintAmount = () => {
    if (mintAmount > 1) {
      setMintAmount(mintAmount - 1)
    }
  }

  // Get remaining mints for the selected category
  const getRemainingMints = () => {
    if (phaseInfo.phaseIndex >= 0 && phaseInfo.categories.length > selectedCategory) {
      const maxMintPerWallet = phaseInfo.categories[selectedCategory].maxMintPerWallet
      const userMinted = userData.addressMintedBalance[phaseInfo.phaseIndex][selectedCategory] || 0
      return maxMintPerWallet - userMinted
    }
    return 0
  }

  // Check if minting is available for the selected category
  const isMintingAvailable = () => {
    return phaseInfo.active && getRemainingMints() > 0
  }

  // Effect for fetching contract data
  useEffect(() => {
    if (isConnected) {
      // In a real implementation, this would fetch data from the contract
      // For now, we'll just use our mock data

      // Set phase info
      setPhaseInfo({
        phaseIndex: contractState.phaseIndex,
        phaseName:
          contractState.phaseIndex === 0
            ? "GTD Mint (Phase 1)"
            : contractState.phaseIndex === 1
              ? "FCFS Mint (Phase 2)"
              : contractState.phaseIndex === 2
                ? "Public Mint (Phase 3)"
                : "Minting Paused",
        startTime: contractState.phaseIndex >= 0 ? mintPhases[contractState.phaseIndex].startTime : 0,
        endTime: contractState.phaseIndex >= 0 ? mintPhases[contractState.phaseIndex].endTime : 0,
        active: contractState.phaseIndex >= 0,
        categories: contractState.phaseIndex >= 0 ? mintPhases[contractState.phaseIndex].categories : [],
      })

      // Set supply info
      setSupplyInfo({
        maxSupply: contractState.maxSupply,
        totalSupply: contractState.totalSupply,
        remainingSupply: contractState.maxSupply - contractState.totalSupply,
      })

      // Set user phase info
      if (contractState.phaseIndex >= 0) {
        const categories = mintPhases[contractState.phaseIndex].categories.map((category, idx) => {
          const maxMintPerWallet = category.maxMintPerWallet
          const mintedCount = userData.addressMintedBalance[contractState.phaseIndex][idx] || 0
          const remainingMints = maxMintPerWallet - mintedCount

          return {
            index: idx,
            maxMintPerWallet,
            mintedCount,
            remainingMints,
          }
        })

        setUserPhaseInfo({
          categories,
          hasFullyMinted: categories.every((cat) => cat.remainingMints <= 0),
        })

        // Check if user has fully minted to show degen option
        if (categories.every((cat) => cat.remainingMints <= 0)) {
          setShowDegenSurprise(true)

          // Set degen mint info
          setDegenMintInfo({
            mintedCount: userData.degenMintedCount,
            maxMintPerWallet: contractState.maxDegenMintPerWallet,
            remainingMints: contractState.maxDegenMintPerWallet - userData.degenMintedCount,
            price: contractState.degenCost,
          })
        }
      }

      // Set mint price based on selected category
      if (contractState.phaseIndex >= 0 && mintPhases[contractState.phaseIndex].categories.length > selectedCategory) {
        const categoryPrice = ethers.formatEther(
          mintPhases[contractState.phaseIndex].categories[selectedCategory].price,
        )
        setMintPrice(`${categoryPrice} HYPE`)
      } else {
        setMintPrice("Minting Paused")
      }
    }
  }, [contractState, mintPhases, userData, isConnected, refreshCounter, selectedCategory])

  return (
    <main className="min-h-screen bg-teal-800 text-white flex flex-col relative overflow-hidden">
      {/* Background image with overlay */}
      <div className="absolute inset-0 z-0">
        <Image
          src="/assets/images/png/landing-background.png"
          alt="Background art"
          fill
          priority
          className="object-cover object-center"
        />
        <div className="absolute inset-0 bg-teal-800/50" />
      </div>

      <div className="container mx-auto px-4 py-6 flex-1 flex flex-col relative z-10">
        <header className="flex justify-between items-center h-12">
          <Link href="/" className="flex items-center text-white hover:text-teal-300 transition-colors">
            <ArrowLeft className="mr-2" size={20} />
            <span>Back to Home</span>
          </Link>

          <div className="flex gap-2">
            {/* Wallet Connect Button */}
            {isConnected ? (
              <button
                onClick={disconnectWallet}
                className="bg-transparent border border-white/30 text-white py-2 px-4 rounded-md hover:bg-white/10 transition-colors text-sm"
              >
                {walletAddress.substring(0, 6)}...{walletAddress.substring(walletAddress.length - 4)}
              </button>
            ) : (
              <button
                onClick={connectWallet}
                disabled={isConnecting}
                className="bg-teal-400 hover:bg-teal-300 text-teal-900 py-2 px-4 rounded-md font-medium transition-colors disabled:opacity-70 disabled:cursor-not-allowed flex items-center"
              >
                {isConnecting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Connecting...
                  </>
                ) : (
                  "Connect Wallet"
                )}
              </button>
            )}

            {/* Discord Connect Button */}
            {discordId ? (
              <button
                onClick={disconnectDiscord}
                className="bg-indigo-600 hover:bg-indigo-700 text-white py-2 px-4 rounded-md transition-colors flex items-center"
              >
                <Discord className="mr-2 h-4 w-4" />
                {discordUsername || "Discord"}
              </button>
            ) : (
              <button
                onClick={connectDiscord}
                className="bg-indigo-600 hover:bg-indigo-700 text-white py-2 px-4 rounded-md transition-colors flex items-center"
              >
                <Discord className="mr-2 h-4 w-4" />
                Link Discord
              </button>
            )}
          </div>
        </header>

        <div className="flex-1 flex flex-col items-center justify-center text-center relative mt-8">
          <div className="text-4xl md:text-7xl font-bold tracking-wider mt-2 mb-6">
            <Image
              src="/assets/images/png/title-large.png"
              alt="HYCHAN"
              width={200} // Smaller width for mobile
              height={60}
              className="mx-auto md:w-[300px] md:h-[90px]"
            />
          </div>

          <div className="w-full max-w-md bg-teal-900/60 backdrop-blur-sm p-6 rounded-lg border border-white/10 mb-8">
            {/* Phase Info */}
            <div className="mb-6">
              <h2 className="text-xl font-bold mb-2">{phaseInfo.phaseName}</h2>

              {phaseInfo.phaseIndex >= 0 && (
                <div className="flex justify-between items-center text-sm">
                  <span>Time Remaining:</span>
                  <span className="font-mono">{timeRemaining}</span>
                </div>
              )}

              <div className="mt-4 h-2 bg-teal-800/80 rounded-full overflow-hidden">
                <div
                  className="h-full bg-teal-400"
                  style={{
                    width: `${supplyInfo.maxSupply > 0 ? (supplyInfo.totalSupply / supplyInfo.maxSupply) * 100 : 0}%`,
                  }}
                />
              </div>

              <div className="flex justify-between items-center text-sm mt-1">
                <span>
                  {supplyInfo.totalSupply} / {supplyInfo.maxSupply}
                </span>
                <span>{supplyInfo.remainingSupply} remaining</span>
              </div>
            </div>

            {/* Mint Controls */}
            {isConnected ? (
              <div>
                {/* Category Selection if multiple categories */}
                {phaseInfo.categories && phaseInfo.categories.length > 1 && (
                  <div className="mb-4">
                    <label className="block text-sm font-medium mb-2">Select Category:</label>
                    <div className="grid grid-cols-2 gap-2">
                      {phaseInfo.categories.map((category: any, index: number) => (
                        <button
                          key={index}
                          onClick={() => setSelectedCategory(index)}
                          className={`py-2 px-3 rounded-md text-sm font-medium transition-colors ${
                            selectedCategory === index
                              ? "bg-teal-400 text-teal-900"
                              : "bg-teal-800/70 hover:bg-teal-700"
                          }`}
                        >
                          Category {index + 1}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                <div className="mb-6">
                  <div className="flex justify-between items-center mb-2">
                    <span>Price per NFT:</span>
                    <span className="font-bold">{mintPrice}</span>
                  </div>

                  {userPhaseInfo.categories && userPhaseInfo.categories.length > selectedCategory && (
                    <>
                      <div className="flex justify-between items-center mb-2">
                        <span>Your Minted:</span>
                        <span>
                          {userPhaseInfo.categories[selectedCategory]?.mintedCount || 0} /
                          {userPhaseInfo.categories[selectedCategory]?.maxMintPerWallet || 0}
                        </span>
                      </div>

                      <div className="flex justify-between items-center">
                        <span>Remaining Mints:</span>
                        <span>{getRemainingMints()}</span>
                      </div>
                    </>
                  )}
                </div>

                {isMintingAvailable() ? (
                  <div>
                    <div className="flex items-center justify-center mb-4">
                      <button
                        onClick={decrementMintAmount}
                        disabled={mintAmount <= 1}
                        className="bg-teal-800 hover:bg-teal-700 text-white w-10 h-10 rounded-l-md flex items-center justify-center disabled:opacity-50"
                      >
                        -
                      </button>
                      <div className="bg-teal-800/80 w-16 h-10 flex items-center justify-center font-bold">
                        {mintAmount}
                      </div>
                      <button
                        onClick={incrementMintAmount}
                        disabled={mintAmount >= getRemainingMints()}
                        className="bg-teal-800 hover:bg-teal-700 text-white w-10 h-10 rounded-r-md flex items-center justify-center disabled:opacity-50"
                      >
                        +
                      </button>
                    </div>

                    <button
                      onClick={mint}
                      disabled={isMinting || mintAmount <= 0 || mintAmount > getRemainingMints()}
                      className="w-full bg-teal-400 hover:bg-teal-300 text-teal-900 py-3 px-4 rounded-md font-medium transition-colors disabled:opacity-70 disabled:cursor-not-allowed flex justify-center items-center"
                    >
                      {isMinting ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Minting...
                        </>
                      ) : (
                        `Mint ${mintAmount} NFT${mintAmount > 1 ? "s" : ""} (${Number(mintPrice.split(" ")[0]) * mintAmount} HYPE)`
                      )}
                    </button>
                  </div>
                ) : (
                  <div className="text-center py-2">
                    {!phaseInfo.active ? (
                      <p className="text-yellow-300">Minting is not active in this phase</p>
                    ) : getRemainingMints() <= 0 ? (
                      <p className="text-yellow-300">You have reached your mint limit for this category</p>
                    ) : (
                      <p className="text-yellow-300">Minting unavailable</p>
                    )}
                  </div>
                )}

                {/* Surprise Degen Mint Button */}
                {showDegenSurprise && (
                  <div className="mt-6 border-t border-white/10 pt-6">
                    {!isDegenRevealed ? (
                      <button
                        onClick={revealDegenMint}
                        className="w-full bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white py-3 px-4 rounded-md font-medium transition-colors flex justify-center items-center gap-2"
                      >
                        <Gift className="h-5 w-5" />
                        Click to see surprise!
                        <Sparkles className="h-5 w-5" />
                      </button>
                    ) : (
                      <div className="space-y-4">
                        <div className="bg-gradient-to-r from-purple-500/20 to-pink-500/20 p-4 rounded-md">
                          <h3 className="text-lg font-bold mb-2 flex items-center gap-2">
                            <Sparkles className="h-5 w-5 text-purple-400" />
                            Degen Mint Unlocked!
                          </h3>
                          <p className="text-sm mb-3">
                            Congratulations! You've unlocked the special Degen Mint. This is a limited opportunity to
                            mint a rare HYCHAN NFT.
                          </p>
                          <div className="flex justify-between items-center text-sm mb-2">
                            <span>Price:</span>
                            <span className="font-bold">{ethers.formatEther(degenMintInfo.price)} HYPE</span>
                          </div>
                          <div className="flex justify-between items-center text-sm">
                            <span>Remaining:</span>
                            <span>
                              {degenMintInfo.remainingMints} / {degenMintInfo.maxMintPerWallet}
                            </span>
                          </div>
                        </div>

                        {degenMintInfo.remainingMints > 0 ? (
                          <button
                            onClick={degenMint}
                            disabled={isMinting}
                            className="w-full bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white py-3 px-4 rounded-md font-medium transition-colors flex justify-center items-center gap-2"
                          >
                            {isMinting ? (
                              <>
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                Minting...
                              </>
                            ) : (
                              <>
                                <Gift className="h-5 w-5" />
                                Mint Degen NFT
                              </>
                            )}
                          </button>
                        ) : (
                          <p className="text-yellow-300 text-center">You have already minted your Degen NFT</p>
                        )}
                      </div>
                    )}
                  </div>
                )}

                {/* Error and Success Messages */}
                {error && (
                  <div className="mt-4 p-3 bg-red-900/40 border border-red-500/30 rounded-md flex items-start">
                    <AlertCircle className="text-red-400 mr-2 flex-shrink-0 mt-0.5" size={16} />
                    <p className="text-sm text-left">{error}</p>
                  </div>
                )}

                {success && (
                  <div className="mt-4 p-3 bg-green-900/40 border border-green-500/30 rounded-md flex items-start">
                    <CheckCircle2 className="text-green-400 mr-2 flex-shrink-0 mt-0.5" size={16} />
                    <p className="text-sm text-left">{success}</p>
                  </div>
                )}
              </div>
            ) : (
              <div className="text-center py-6">
                <p className="mb-4">Connect your wallet to mint HYCHAN NFTs</p>
                <button
                  onClick={connectWallet}
                  disabled={isConnecting}
                  className="bg-teal-400 hover:bg-teal-300 text-teal-900 py-3 px-6 rounded-md font-medium transition-colors disabled:opacity-70 disabled:cursor-not-allowed flex items-center justify-center mx-auto"
                >
                  {isConnecting ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Connecting...
                    </>
                  ) : (
                    "Connect Wallet"
                  )}
                </button>
              </div>
            )}
          </div>

          {/* Mint Phases Info */}
          <div className="w-full max-w-md">
            <h3 className="text-xl font-bold mb-4">Mint Phases</h3>

            <div className="grid gap-4">
              <div
                className={`p-4 rounded-md border ${phaseInfo.phaseIndex === 0 ? "bg-teal-700/60 border-teal-400/50" : "bg-teal-900/40 border-white/10"}`}
              >
                <h4 className="font-bold">GTD Mint (Phase 1)</h4>
                <p className="text-sm opacity-80 mt-1">
                  Guaranteed mint for whitelisted wallets. 2 HYPE per NFT, max 2 per wallet.
                </p>
              </div>

              <div
                className={`p-4 rounded-md border ${phaseInfo.phaseIndex === 1 ? "bg-teal-700/60 border-teal-400/50" : "bg-teal-900/40 border-white/10"}`}
              >
                <h4 className="font-bold">FCFS Mint (Phase 2)</h4>
                <p className="text-sm opacity-80 mt-1">
                  First come, first served mint for whitelisted wallets. 2 HYPE per NFT, max 1 per wallet.
                </p>
              </div>

              <div
                className={`p-4 rounded-md border ${phaseInfo.phaseIndex === 2 ? "bg-teal-700/60 border-teal-400/50" : "bg-teal-900/40 border-white/10"}`}
              >
                <h4 className="font-bold">Public Mint (Phase 3)</h4>
                <p className="text-sm opacity-80 mt-1">Open to everyone. 2 HYPE per NFT, max 1 per wallet.</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </main>
  )
}