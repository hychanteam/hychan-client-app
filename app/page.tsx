"use client"

import { useState, useEffect, useRef } from "react"
import Link from "next/link"
import Image from "next/image"
import { ArrowLeft, Loader2, AlertCircle, CheckCircle2, Gift, Sparkles } from "lucide-react"
import { ethers } from "ethers"
import { formatTimeRemaining, getTimeTillMinting } from "../lib/time-utils"
import {
  getDiscordAuthUrl,
  storeWalletAddress,
  getWalletAddress,
  clearWalletAddress,
  getDiscordCredentials,
  clearDiscordCredentials,
} from "../lib/auth"
import LoadingScreen from "../components/loading.screen"
import {
  getContract,
  getContractWithSigner,
  getCurrentPhaseIndex,
  getPhaseInfo,
  getSupplyInfo,
  getUserMintedBalance,
  getDegenMintInfo,
  fetchWhitelistData,
  WhitelistData,
  fetchMerkleProof,
  UserMintInfo,
  handleCustomContractError,
} from "../lib/contract"
import { FaDiscord } from "react-icons/fa"
import { getRequiredChain } from "@/lib/client-utils"

export default function MintPage() {
  const mintStartTime = new Date("2025-04-26T17:00:00Z"); // 5PM UTC
  
  // Loading state
  const [isLoading, setIsLoading] = useState(true)
  const [loadingProgress, setLoadingProgress] = useState(0)
  const [loadingMessage, setLoadingMessage] = useState("Initializing...")

  // State variables
  const [timeLeft, setTimeLeft] = useState(getTimeTillMinting(mintStartTime));
  const [walletAddress, setWalletAddress] = useState<string>("")
  const [isConnected, setIsConnected] = useState<boolean>(false)
  const [isConnecting, setIsConnecting] = useState<boolean>(false)
  const [provider, setProvider] = useState<ethers.BrowserProvider | null>(null)
  const [contract, setContract] = useState<ethers.Contract | null>(null)
  const [mintAmount, setMintAmount] = useState<number>(1)
  const [isMinting, setIsMinting] = useState<boolean>(false)
  const [error, setError] = useState<string>("")
  const [success, setSuccess] = useState<string>("")
  const [phaseIndex, setPhaseIndex] = useState<number>(-1)
  const [phaseInfo, setPhaseInfo] = useState<{
    phaseIndex: number
    phaseName: string
    startTime: number
    endTime: number
    active: boolean
    categories: any[]
  }>({
    phaseIndex: -2,
    phaseName: "Mint Starting Soon",
    startTime: 0,
    endTime: 0,
    active: false,
    categories: [],
  })
  const [supplyInfo, setSupplyInfo] = useState({
    maxSupply: 0,
    totalSupply: 0,
    remainingSupply: 0,
  })
  const [userPhaseInfo, setUserPhaseInfo] = useState<any>({
    categories: [],
    hasFullyMinted: false,
    isUserEligibleInCurrentPhase: false,
  })
  const [degenMintInfo, setDegenMintInfo] = useState<any>({
    mintedCount: 0,
    maxMintPerWallet: 1,
    remainingMints: 1,
    degenTotalSupply: 0,
    degenMaxSupply: 0,
    price: ethers.parseEther("3"),
  })
  const [timeRemaining, setTimeRemaining] = useState<string>("")
  const [mintPrice, setMintPrice] = useState<string>("3.0 $HYPE")
  const [refreshCounter, setRefreshCounter] = useState<number>(0)
  const [selectedCategory, setSelectedCategory] = useState<number>(0)
  const [showDegenSurprise, setShowDegenSurprise] = useState<boolean>(false)
  const [isDegenRevealed, setIsDegenRevealed] = useState<boolean>(false)
  const [whitelistData, setWhitelistData] = useState<WhitelistData | null>(null)
  // Add a new state variable for all whitelist data
  const [userMintInfo, setUserMintInfo] = useState<UserMintInfo | null>(null)

  // Discord state
  const [discordId, setDiscordId] = useState<string | null>(null)
  const [discordUsername, setDiscordUsername] = useState<string | null>(null)

  // Ref to track initialization steps
  const initSteps = useRef({
    walletChecked: false,
    discordChecked: false,
    dataFetched: false,
    contractInitialized: false,
  })

  const initConnection = async (provider: ethers.BrowserProvider, accounts: any) => {
    const address = accounts[0]
    setWalletAddress(address)
    setIsConnected(true)
    setProvider(provider)

    // Initialize contract
    const contract = await getContract(provider)
    setContract(contract)

    // Store the wallet address for future use
    storeWalletAddress(address)

    // Fetch whitelist data from our new API
    const whitelistData = await fetchWhitelistData(address)
    setWhitelistData(whitelistData)

    // Set user eligibility based on whitelist data
    const isEligibleForGTD = whitelistData.allowedMintsGTD > 0
    const isEligibleForFCFS = whitelistData.allowedMintsFCFS > 0
    setUserPhaseInfo({
      ...userPhaseInfo,
      isUserEligibleInCurrentPhase: phaseIndex === 0 ? isEligibleForGTD : phaseIndex === 1 ? isEligibleForFCFS : true
    })

    // Fetch contract data
    await fetchContractData(contract, address)
  }

  // Connect wallet function
  const connectWallet = async () => {
    setIsConnecting(true)
    setError("")

    try {
      if (window.ethereum) {
        const provider = new ethers.BrowserProvider(window.ethereum)
        switchToRequiredNetwork(provider);

        const accounts = await provider.send("eth_requestAccounts", [])
        if (accounts.length > 0) {
          initConnection(provider, accounts)
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
      isUserEligibleInCurrentPhase: false
    })
    setDegenMintInfo({
      mintedCount: 0,
      maxMintPerWallet: 1,
      remainingMints: 1,
      degenTotalSupply: 0,
      degenMaxSupply: 0,
      price: ethers.parseEther("3"),
    })
    setShowDegenSurprise(false)
    setIsDegenRevealed(false)

    setWhitelistData(null)

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

  // Check if phase is active (time hasn't ended)
  const isPhaseActive = () => {
    const now = Math.floor(Date.now() / 1000)
    return phaseInfo.active && phaseInfo.endTime > now
  }

  // Check supply info every x second
  const pollSupplyInfo = async (contractInstance: ethers.Contract) => {
    const supply = await getSupplyInfo(contractInstance)
    setSupplyInfo(supply)
  }

  // Fetch contract data
  const fetchContractData = async (contractInstance: ethers.Contract, address: string) => {
    try {
      // Get current phase index
      const currentPhaseIndex = await getCurrentPhaseIndex(contractInstance)
      setPhaseIndex(currentPhaseIndex)
      
      // Get phase info
      if (currentPhaseIndex >= 0) {
        const phase = await getPhaseInfo(contractInstance, currentPhaseIndex)

        if (phase) {
          setPhaseInfo({
            phaseIndex: currentPhaseIndex,
            phaseName:
              currentPhaseIndex === -2
                ? "Mint Starting Soon"
                : currentPhaseIndex === 0
                  ? "OG / GTD Mint (Phase 1)"
                  : currentPhaseIndex === 1
                    ? "FCFS Mint (Phase 2)"
                    : currentPhaseIndex === 2
                      ? "Public Mint (Phase 3)"
                      : "Minting Paused",
            startTime: phase.startTime,
            endTime: phase.endTime,
            active: true,
            categories: phase.categories,
          })

          // Set mint price based on selected category
          if (phase.categories.length > selectedCategory) {
            const categoryPrice = ethers.formatEther(phase.categories[selectedCategory].price.toString())
            setMintPrice(`${categoryPrice} $HYPE`)
          }
        }
      }

      // Get supply info
      const supply = await getSupplyInfo(contractInstance)
      setSupplyInfo(supply)

      // Get user phase info if connected
      if (address && currentPhaseIndex >= 0) {
        const phase = await getPhaseInfo(contractInstance, currentPhaseIndex)

        if (phase) {
          const whitelistData = await fetchWhitelistData(address)
          const allowedMintsGTD = whitelistData.allowedMintsGTD
          const allowedMintsFCFS = whitelistData.allowedMintsFCFS

          const categories = await Promise.all(
            phase.categories.map(async (category, idx) => {
              let maxMintPerWallet;

              switch (phaseIndex) {
                case 0:
                  maxMintPerWallet = allowedMintsGTD;
                  break;
                case 1:
                  maxMintPerWallet = allowedMintsFCFS;
                  break;
                case 2:
                default:
                  maxMintPerWallet = category.maxMintPerWallet;
                  break;
              }
              const mintedCount = await getUserMintedBalance(contractInstance, currentPhaseIndex, idx, address)
              const remainingMints = maxMintPerWallet - mintedCount

              return {
                index: idx,
                maxMintPerWallet,
                mintedCount,
                remainingMints,
              }
            }),
          )

          setUserPhaseInfo({
            categories,
            hasFullyMinted: categories.every((cat) => cat.remainingMints <= 0),
            isUserEligibleInCurrentPhase: phaseIndex === 0 ? allowedMintsGTD > 0 : phaseIndex === 1 ? allowedMintsFCFS > 0 : true
          })

          // Set user eligibility based on whitelist data
          const isEligibleForGTD = allowedMintsGTD > 0
          const isEligibleForFCFS = allowedMintsFCFS > 0
          const isUserEligible = phaseIndex === 0 ? isEligibleForGTD : phaseIndex === 1 ? isEligibleForFCFS : true

          // Check if user has fully minted to show degen option
          // Only show degen mint if user is eligible (has mintAmounts from database)
          if (categories.every((cat) => cat.remainingMints <= 0) || !isUserEligible) {
            setShowDegenSurprise(true)

            // Get degen mint info
            const degenInfo = await getDegenMintInfo(contractInstance, address)
            setDegenMintInfo(degenInfo)
          } else {
            setShowDegenSurprise(false)
          }
        }
      }

      return true
    } catch (error: any) {
      handleCustomContractError(error)
      console.error("Error fetching contract data:", error)
      return false
    }
  }

  // Add a function to fetch all whitelist data
  const fetchUserMintInfo = async (phaseIdx: number) => {
    try {
      const data = await fetchMerkleProof(walletAddress, phaseIdx)

      setUserMintInfo(data)
      return data
    } catch (error) {
      console.error("Error fetching all whitelist data:", error)
      return null
    }
  }

  // Regular mint function
  const mint = async () => {
    if (!isConnected || !contract || !provider) return

    setIsMinting(true)
    setError("")
    setSuccess("")

    try {
      // Check if phase is still active
      if (!isPhaseActive()) {
        throw new Error("PhaseEnded: This mint phase has ended")
      }

      // Get signer for transaction
      const contractWithSigner = await getContractWithSigner(provider)

      // Determine the allowed mints based on the phase
      let allowedMints = 0
      let merkleProof: string[] = []

      // For GTD and FCFS phases, we need to check eligibility and generate merkle proofs
      if (phaseIndex < 2) {
        if (!userPhaseInfo.isUserEligibleInCurrentPhase) {
          throw new Error("NotEligible: You are not eligible for this mint phase")
        }

        // Make sure we have whitelist data
        if (!whitelistData) {
          // Fetch whitelist data if not available
          const data = await fetchWhitelistData(walletAddress)
          setWhitelistData(data)

          // Set allowed mints based on the phase
          if (phaseIndex === 0) {
            allowedMints = data.allowedMintsGTD
          } else if (phaseIndex === 1) {
            allowedMints = data.allowedMintsFCFS
          }
        } else {
          // Set allowed mints based on the phase
          if (phaseIndex === 0) {
            allowedMints = whitelistData.allowedMintsGTD
          } else if (phaseIndex === 1) {
            allowedMints = whitelistData.allowedMintsFCFS
          }
        }

        // If we don't have all whitelist data yet, fetch it
        let mintingInfo = userMintInfo
        if (!mintingInfo) {
          mintingInfo = await fetchUserMintInfo(phaseIndex)
        }

        merkleProof = mintingInfo?.merkleProof || [""]
      } else {
        // For public mint (phase 2), no merkle proof is needed
        allowedMints = phaseInfo.categories[selectedCategory].maxMintPerWallet
      }

      // Calculate price
      const category = phaseInfo.categories[selectedCategory]
      const price = category.price.toString()
      const totalPrice = ethers.getBigInt(price) * BigInt(mintAmount)

      // Execute the mint transaction
      const tx = await contractWithSigner.safeMint(
        mintAmount,
        allowedMints,
        selectedCategory,
        merkleProof,
        { value: totalPrice }
      );
      await tx.wait();

      setSuccess(`Successfully minted ${mintAmount} HYCHAN!`)

      // Refresh data after successful mint
      setRefreshCounter((prev) => prev + 1)
      
    } catch (err: any) {
      handleCustomContractError(err)
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
        } else if (err.message.includes("NotEligible")) {
          errorMessage = "You are not eligible for this mint phase"
        } else if (err.message.includes("PhaseEnded")) {
          errorMessage = "This mint phase has ended"
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
    if (!isConnected || !contract || !provider) return

    setIsMinting(true)
    setError("")
    setSuccess("")

    try {
      // Check if phase is still active
      if (!isPhaseActive()) {
        throw new Error("PhaseEnded: This mint phase has ended")
      }

      // Get signer for transaction
      const contractWithSigner = await getContractWithSigner(provider)

      // Calculate price
      const price = degenMintInfo.price
      const totalPrice = price

      // Execute the degen mint transaction
      const tx = await contractWithSigner.degenSafeMint(1, { value: totalPrice })

      // Wait for transaction to be mined
      await tx.wait()

      setSuccess(`Successfully minted a DEGEN HYCHAN!`)

      // Refresh data after successful mint
      setRefreshCounter((prev) => prev + 1)
    } catch (err: any) {
      handleCustomContractError(err)
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
        } else if (err.message.includes("PhaseEnded")) {
          errorMessage = "This mint phase has ended"
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

  // Initialize the page
  const initializePage = async () => {
    setIsLoading(true)
    setLoadingProgress(0)
    setLoadingMessage("Initializing...")

    // Step 1: Check wallet connection
    setLoadingMessage("Checking wallet connection...")
    setLoadingProgress(10)
    await checkConnection()
    initSteps.current.walletChecked = true
    setLoadingProgress(30)

    // Step 2: Check Discord credentials
    setLoadingMessage("Checking Discord credentials...")
    checkDiscordCredentials()
    initSteps.current.discordChecked = true
    setLoadingProgress(50)

    // Step 3: Initialize contract data
    setLoadingMessage("Loading contract data...")
    const contractInitialized = await initializeContractData()
    initSteps.current.contractInitialized = true
    setLoadingProgress(70)

    // Step 4: Fetch all whitelist data if contract is initialized
    if (contractInitialized && contract) {
      setLoadingMessage("Loading whitelist data...")
      const currentPhaseIdx = await getCurrentPhaseIndex(contract)
      if (currentPhaseIdx >= 0 && currentPhaseIdx < 2) {
        // Only for GTD and FCFS phases
        await fetchUserMintInfo(currentPhaseIdx)
      }
    }
    setLoadingProgress(90)

    // Step 5: Update time remaining
    setLoadingMessage("Finalizing...")
    updateTimeRemaining()
    setLoadingProgress(95)

    // Add a small delay to ensure smooth transition
    await new Promise((resolve) => setTimeout(resolve, 800))
    setLoadingProgress(100)

    // Complete loading
    await new Promise((resolve) => setTimeout(resolve, 200))
    setIsLoading(false)
  }

  // Check connection function
  const checkConnection = async () => {
    // First check if we have a stored wallet address
    const storedAddress = getWalletAddress()

    if (storedAddress) {
      setWalletAddress(storedAddress)
      setIsConnected(true)

      // Fetch whitelist data from our new API
      const whitelistData = await fetchWhitelistData(storedAddress)
      setWhitelistData(whitelistData)

      // Set user eligibility based on whitelist data
      const isEligibleForGTD = whitelistData.allowedMintsGTD > 0
      const isEligibleForFCFS = whitelistData.allowedMintsFCFS > 0
      setUserPhaseInfo({
        ...userPhaseInfo,
        isUserEligibleInCurrentPhase: phaseIndex === 0 ? isEligibleForGTD : phaseIndex === 1 ? isEligibleForFCFS : true
      })

      // Also set up provider if window.ethereum is available
      if (window.ethereum) {
        const provider = new ethers.BrowserProvider(window.ethereum)
        setProvider(provider)

        // switch to required network
        switchToRequiredNetwork(provider);

        // Initialize contract
        const contract = await getContract(provider)
        setContract(contract)

        // Fetch contract data
        await fetchContractData(contract, storedAddress)
      }

      return true
    }

    // If no stored address, try to get it from the wallet
    if (window.ethereum) {
      try {
        const provider = new ethers.BrowserProvider(window.ethereum)
        switchToRequiredNetwork(provider);

        const accounts = await provider.send("eth_accounts", [])
        if (accounts.length > 0) {
          initConnection(provider, accounts)
          return true
        }
      } catch (err) {
        console.error("Error checking wallet connection:", err)
      }
    }

    return false
  }

  const switchToRequiredNetwork = async (provider: ethers.BrowserProvider) =>{
    const network = await provider.getNetwork();
    const required = getRequiredChain();

    if ((network.chainId !== BigInt(required.chainId)) && window.ethereum) {
      try {
        // Try switching to the required network
        await window.ethereum.request({
          method: 'wallet_switchEthereumChain',
          params: [{ chainId: required.chainId }],
        });
      } catch (switchError: any) {
        if (switchError.code === 4902) {
          // Chain not added to wallet? Try adding it.
          try {
            await window.ethereum.request({
              method: 'wallet_addEthereumChain',
              params: [required],
            });
          } catch (addError) {
            console.error("Failed to add network:", addError);
            setError("Failed to add network. Please try manually.");
            return;
          }
        } else {
          console.error("Failed to switch network:", switchError);
          setError("Please switch to the correct network manually.");
          return;
        }
      }
    }
  }

  // Check Discord credentials
  const checkDiscordCredentials = () => {
    const credentials = getDiscordCredentials()
    if (credentials && credentials.id) {
      setDiscordId(credentials.id)
      setDiscordUsername(credentials.username || null)
    }
  }

  // Initialize contract data
  const initializeContractData = async () => {
    try {
      // If we have a contract and wallet address, fetch data
      if (contract && walletAddress) {
        await fetchContractData(contract, walletAddress)
        return true
      }

      // If we have window.ethereum but no contract yet, initialize it
      if (window.ethereum && !contract) {
        const provider = new ethers.BrowserProvider(window.ethereum)
        switchToRequiredNetwork(provider);
        
        const contractInstance = await getContract(provider)
        setContract(contractInstance)

        // Call every 1 second
        setInterval(() => {
          pollSupplyInfo(contractInstance)
        }, 2000)

        // Get current phase index
        const currentPhaseIndex = await getCurrentPhaseIndex(contractInstance)
        setPhaseIndex(currentPhaseIndex)

        // Get supply info
        const supply = await getSupplyInfo(contractInstance)
        setSupplyInfo(supply)

        // Get phase info if phase is active
        if (currentPhaseIndex >= 0) {
          const phase = await getPhaseInfo(contractInstance, currentPhaseIndex)

          if (phase) {
            setPhaseInfo({
              phaseIndex: currentPhaseIndex,
              phaseName:
              currentPhaseIndex === -2
                ? "Mint Starting Soon"
                : currentPhaseIndex === 0
                  ? "OG / GTD Mint (Phase 1)"
                  : currentPhaseIndex === 1
                    ? "FCFS Mint (Phase 2)"
                    : currentPhaseIndex === 2
                      ? "Public Mint (Phase 3)"
                      : "Minting Paused",
              startTime: phase.startTime,
              endTime: phase.endTime,
              active: true,
              categories: phase.categories,
            })

            // Set mint price based on selected category
            if (phase.categories.length > selectedCategory) {
              const categoryPrice = ethers.formatEther(phase.categories[selectedCategory].price.toString())
              setMintPrice(`${categoryPrice} $HYPE`)
            }
          }
        }

        return true
      }

      return false
    } catch (error) {
      console.error("Error initializing contract data:", error)
      return false
    }
  }

  // Effect for initial page load
  useEffect(() => {
    initializePage()

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
    if (phaseInfo.endTime > 0 && !isLoading) {
      updateTimeRemaining()

      const interval = setInterval(() => {
        updateTimeRemaining()
      }, 1000)

      return () => clearInterval(interval)
    }
  }, [phaseInfo.endTime, isLoading])

  // Effect to check if user has fully minted and show degen surprise
  useEffect(() => {
    if (userPhaseInfo.hasFullyMinted && userPhaseInfo.isUserEligibleInCurrentPhase) {
      setShowDegenSurprise(true)
    } else {
      setShowDegenSurprise(false)
    }
  }, [userPhaseInfo.hasFullyMinted, userPhaseInfo.isUserEligibleInCurrentPhase])

  // Effect for fetching contract data when refreshCounter changes
  useEffect(() => {
    if (isConnected && !isLoading && contract && walletAddress) {
      fetchContractData(contract, walletAddress)
    }
  }, [refreshCounter, isConnected, isLoading, contract, walletAddress])

  useEffect(() => {
    const timer = setInterval(() => {
      setTimeLeft(getTimeTillMinting(mintStartTime));
    }, 1000);

    return () => clearInterval(timer); // cleanup
  }, []);

  // Increment mint amount
  const incrementMintAmount = () => {
    if (userPhaseInfo.categories && userPhaseInfo.categories.length > selectedCategory) {
      const maxMint = userPhaseInfo.categories[selectedCategory].maxMintPerWallet
      const userMinted = userPhaseInfo.categories[selectedCategory]?.mintedCount || 0
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
    if (userPhaseInfo.categories && userPhaseInfo.categories.length > selectedCategory) {
      return userPhaseInfo.categories[selectedCategory]?.remainingMints || 0
    }
    return 0
  }

  // Check if minting is available for the selected category
  const isMintingAvailable = () => {
    // Check if phase is active AND time hasn't ended
    return (
      isPhaseActive() &&
      getRemainingMints() > 0 &&
      // For GTD and FCFS phases, check if user is eligible
      ((phaseIndex >= 0 && phaseIndex <= 2) || userPhaseInfo.isUserEligibleInCurrentPhase)
    )
  }

  // Show loading screen while initializing
  if (isLoading) {
    return <LoadingScreen message={loadingMessage} progress={loadingProgress} />
  }

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
          <span>
            <span className="hidden md:inline">Back to Home</span>
          </span>
        </Link>

          <div className="flex gap-2">
            {/* Wallet Connect Button */}
            {isConnected ? (
              <button
                onClick={disconnectWallet}
                className="bg-transparent border border-white/30 text-white py-2 px-4 rounded-md hover:bg-white/10 transition-colors text-md"
              >
                {walletAddress.substring(0, 6)}...{walletAddress.substring(walletAddress.length - 4)}
              </button>
            ) : (
              <button
                onClick={connectWallet}
                disabled={isConnecting}
                className="bg-transparent border border-white/30 text-white py-2 px-4 rounded-md font-medium transition-colors disabled:opacity-70 disabled:cursor-not-allowed flex items-center"
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

            {isConnected && (
              discordId ? (
                <button
                  onClick={disconnectDiscord}
                  className="bg-indigo-600 hover:bg-indigo-700 text-white py-2 px-4 rounded-md transition-colors flex items-center max-w-[150px]"
                >
                  <FaDiscord size={24} className="mr-2 shrink-0" />
                  <span className="truncate whitespace-nowrap overflow-hidden">
                    {discordUsername || "Discord"}
                  </span>
                </button>
              ) : (
                <button
                  onClick={connectDiscord}
                  className="bg-indigo-600 hover:bg-indigo-700 text-white py-2 px-4 rounded-md transition-colors flex items-center"
                >
                  <FaDiscord size={24} className="mr-2" />
                  Connect
                </button>
              )
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
              <h2 className="text-xl mb-2">{phaseInfo.phaseName}</h2>

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
                  {supplyInfo.totalSupply} Minted
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
                  {phaseIndex >= 0 && (
                      <div className="flex justify-between items-center mb-2">
                      <span>Price:</span>
                      <span className="font-bold">{mintPrice}</span>
                    </div>
                  )}

                  {userPhaseInfo.categories && userPhaseInfo.categories.length > selectedCategory && (
                    <>
                      <div className="flex justify-between items-center mb-2">
                        <span>Your Minted:</span>
                        <span>
                          {userPhaseInfo.categories[selectedCategory]?.mintedCount || 0}{" / "}
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
                        `Mint ${mintAmount} (${Number(mintPrice.split(" ")[0]) * mintAmount} $HYPE)`
                      )}
                    </button>
                  </div>
                ) : (
                  <div className="text-center py-2">
                    {phaseIndex === -2 ? (
                      timeLeft.total > 0 ? (
                        <p className="text-yellow-300">
                          Minting will begin in {timeLeft.days}d {timeLeft.hours}h {timeLeft.minutes}m {timeLeft.seconds}s
                        </p>
                      ) : (
                        <p className="text-yellow-300">Ready ?</p>
                      )
                    ) : phaseIndex === -1 ? (
                      <p className="text-yellow-300">The minting is paused</p>
                    ) : !isPhaseActive() ? (
                      <p className="text-yellow-300">This mint phase has ended</p>
                    ) : !userPhaseInfo.isUserEligibleInCurrentPhase && phaseIndex < 2 ? (
                      <p className="text-yellow-300">You are not eligible for this mint phase</p>
                    ) : userPhaseInfo?.categories?.[selectedCategory]?.maxMintPerWallet <= 0 ? (
                      <p className="text-yellow-300">You are not eligible for this phase</p>
                    ) : getRemainingMints() <= 0 ? (
                      <p className="text-yellow-300">You have reached your mint limit for this category</p>
                    ) : (
                      <p className="text-yellow-300">Minting unavailable</p>
                    )}
                  </div>
                )}

                {/* Surprise Degen Mint Button - Only show if user is eligible */}
                {((showDegenSurprise && userPhaseInfo.isUserEligibleInCurrentPhase && userPhaseInfo?.categories?.[selectedCategory]?.remainingMints === 0) || !userPhaseInfo.isUserEligibleInCurrentPhase) && (
                  <div className="mt-6 border-t border-white/10 pt-6">
                    {!isDegenRevealed ? (
                      <button
                        onClick={revealDegenMint}
                        className="w-full bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white py-3 px-4 rounded-md font-medium transition-colors flex justify-center items-center gap-2"
                      >
                        <Gift className="h-5 w-5" />
                        Try your luck!
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
                            mint a rare HYCHAN.
                          </p>
                          <div className="mt-4 h-2 bg-zinc-800 rounded-full overflow-hidden">
                            <div
                              className="h-full bg-fuchsia-500"
                              style={{
                                width: `${degenMintInfo.degenMaxSupply > 0 ? (degenMintInfo.degenTotalSupply / degenMintInfo.degenMaxSupply) * 100 : 0}%`,
                              }}
                            />
                          </div>
                          <div className="flex justify-between items-center text-sm mt-1 mb-2">
                            <span>
                              {degenMintInfo.degenTotalSupply} / {degenMintInfo.degenMaxSupply}
                            </span>
                            <span>{degenMintInfo.degenMaxSupply - degenMintInfo.degenTotalSupply} remaining</span>
                          </div>
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

                        {degenMintInfo.remainingMints > 0 && isPhaseActive() ? (
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
                                Mint Degen
                              </>
                            )}
                          </button>
                        ) : !isPhaseActive() ? (
                          <p className="text-yellow-300 text-center">This mint phase has ended</p>
                        ) : (
                          <p className="text-yellow-300 text-center">You have already minted your Degen allocation</p>
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
                <p className="mb-4">Connect your wallet using the button in the navbar to mint HYCHAN</p>
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
                <h4 className="font-bold">OG / GTD Mint (Phase 1)</h4>
                <p className="text-sm opacity-80 mt-1">
                  Guaranteed mint for whitelisted wallets. 3 $HYPE, Max 2 per wallet.
                </p>
              </div>

              <div
                className={`p-4 rounded-md border ${phaseInfo.phaseIndex === 1 ? "bg-teal-700/60 border-teal-400/50" : "bg-teal-900/40 border-white/10"}`}
              >
                <h4 className="font-bold">FCFS Mint (Phase 2)</h4>
                <p className="text-sm opacity-80 mt-1">
                  First come, first served mint for whitelisted wallets. 3 $HYPE, Max 1 per wallet.
                </p>
              </div>

              <div
                className={`p-4 rounded-md border ${phaseInfo.phaseIndex === 2 ? "bg-teal-700/60 border-teal-400/50" : "bg-teal-900/40 border-white/10"}`}
              >
                <h4 className="font-bold">Public Mint (Phase 3)</h4>
                <p className="text-sm opacity-80 mt-1">Open to everyone. 4 $HYPE, Max 1 per wallet.</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </main>
  )
}