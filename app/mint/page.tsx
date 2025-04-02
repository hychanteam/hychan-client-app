"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import Image from "next/image"
import { ArrowLeft, Loader2, AlertCircle, CheckCircle2, Gift, Sparkles } from "lucide-react"
import { ethers } from "ethers"
import {
  CONTRACT_ABI,
  getContract,
  getCurrentPhaseInfo,
  getSupplyInfo,
  getUserPhaseMintsInfo,
  getDegenMintInfo,
  formatTimeRemaining,
  generateMerkleProof,
  mockGTDWhitelist,
  mockFCFSWhitelist,
} from "../../lib/contract"

const expectedChainId = BigInt(process.env.NEXT_PUBLIC_EXPECTED_CHAIN_ID!)

export default function MintPage() {
  // State variables
  const [walletAddress, setWalletAddress] = useState<string>("")
  const [isConnected, setIsConnected] = useState<boolean>(false)
  const [isConnecting, setIsConnecting] = useState<boolean>(false)
  const [provider, setProvider] = useState<any>(null)
  const [contract, setContract] = useState<ethers.Contract | null>(null)
  const [mintAmount, setMintAmount] = useState<number>(1)
  const [isMinting, setIsMinting] = useState<boolean>(false)
  const [error, setError] = useState<string>("")
  const [success, setSuccess] = useState<string>("")
  const [phaseInfo, setPhaseInfo] = useState<any>({
    phaseIndex: -1,
    phaseName: "Loading...",
    startTime: 0,
    endTime: 0,
    active: false,
    categories: [],
  })
  const [supplyInfo, setSupplyInfo] = useState<any>({
    maxSupply: 0,
    totalSupply: 0,
    remainingSupply: 0,
  })
  const [userPhaseInfo, setUserPhaseInfo] = useState<any>({
    categories: [],
    hasFullyMinted: false,
  })
  const [degenMintInfo, setDegenMintInfo] = useState<any>({
    mintedCount: 0,
    maxMintPerWallet: 0,
    remainingMints: 0,
    price: ethers.parseEther("3"),
  })
  const [timeRemaining, setTimeRemaining] = useState<string>("")
  const [mintPrice, setMintPrice] = useState<string>("2 HYPE")
  const [refreshCounter, setRefreshCounter] = useState<number>(0)
  const [selectedCategory, setSelectedCategory] = useState<number>(0)
  const [showDegenSurprise, setShowDegenSurprise] = useState<boolean>(false)
  const [isDegenRevealed, setIsDegenRevealed] = useState<boolean>(false)

  const checkNetwork = async (provider: ethers.BrowserProvider) =>{
    // Check network
    const network = await provider.getNetwork();
    console.log("Connected to:", network.name, "Chain ID:", network.chainId);

    if (network.chainId !== expectedChainId) {
        setError("Wrong network! Please switch to the correct network.");
        return;
    }
  }

  // Connect wallet function
  const connectWallet = async () => {
    setIsConnecting(true)
    setError("")

    try {
      if (window.ethereum) {
        const provider = new ethers.BrowserProvider(window.ethereum)
        const accounts = await provider.send("eth_requestAccounts", [])

        if (accounts.length > 0) {
          setWalletAddress(accounts[0])
          setIsConnected(true)
          setProvider(provider)

          await checkNetwork(provider);

          // Initialize contract
          const contract = await getContract(provider)
          setContract(contract)
        }
      } else {
        setError("No Ethereum wallet detected. Please install MetaMask.")
      }
    } catch (err) {
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
      maxMintPerWallet: 0,
      remainingMints: 0,
      price: ethers.parseEther("3"),
    })
    setShowDegenSurprise(false)
    setIsDegenRevealed(false)
  }

  // Regular mint function
  const mint = async () => {
    if (!contract || !isConnected) return

    setIsMinting(true)
    setError("")
    setSuccess("")

    try {
      let tx

      // Different mint functions based on phase
      if (phaseInfo.phaseIndex === 0) {
        // GTD Phase
        const allowedMints = 2 // Based on deploy script
        const proof = generateMerkleProof(walletAddress, allowedMints, mockGTDWhitelist)

        tx = await contract.safeMint(
          mintAmount,
          allowedMints,
          selectedCategory, // Category index
          proof,
          { value: ethers.parseEther((2 * mintAmount).toString()) }, // 2 HYPE per NFT
        )
      } else if (phaseInfo.phaseIndex === 1) {
        // FCFS Phase
        const allowedMints = 1 // Based on deploy script
        const proof = generateMerkleProof(walletAddress, allowedMints, mockFCFSWhitelist)

        tx = await contract.safeMint(
          mintAmount,
          allowedMints,
          selectedCategory, // Category index
          proof,
          { value: ethers.parseEther((2 * mintAmount).toString()) }, // 2 HYPE per NFT
        )
      } else if (phaseInfo.phaseIndex === 2) {
        // Public Phase
        tx = await contract.safeMint(
          mintAmount,
          0, // Not used for public mint
          selectedCategory, // Category index
          [], // Empty proof for public mint
          { value: ethers.parseEther((2 * mintAmount).toString()) }, // 2 HYPE per NFT
        )
      }

      await tx.wait()
      setSuccess(`Successfully minted ${mintAmount} HYCHAN NFT${mintAmount > 1 ? "s" : ""}!`)

      // Refresh data after successful mint
      setRefreshCounter((prev) => prev + 1)
    } catch (err: any) {
      console.error("Error minting:", err)

      // Extract error message from blockchain error
      let errorMessage = "Failed to mint. Please try again."

      if (err.reason) {
        errorMessage = err.reason
      } else if (err.message) {
        // Try to extract the revert reason
        const match = err.message.match(/reverted with reason string '([^']+)'/)
        if (match && match[1]) {
          errorMessage = match[1]
        } else if (err.message.includes("user rejected transaction")) {
          errorMessage = "Transaction was rejected."
        }
      }

      setError(errorMessage)
    } finally {
      setIsMinting(false)
    }
  }

  // Degen mint function
  const degenMint = async () => {
    if (!contract || !isConnected) return;

    setIsMinting(true);
    setError("");
    setSuccess("");

    try {
        const degenPrice = degenMintInfo.price;
        const tx = await contract.degenSafeMint(
            1, // Always mint 1 for degen
            { value: degenPrice } // 3 HYPE per NFT for degen mint
        );

        await tx.wait();
        setSuccess(`Successfully minted a HYCHAN!`);

        // Refresh data after successful mint
        setRefreshCounter((prev) => prev + 1);
    } catch (err: any) {
        console.error("Error minting degen:", err);

        // Default error message
        let errorMessage = "Failed to mint. Please try again.";

        if (err.reason) {
            errorMessage = err.reason;
        } else if (err.message) {
            // Handle user rejection
            if (err.message.includes("user rejected transaction")) {
                errorMessage = "Transaction was rejected.";
            }
        }

        // Handle custom Solidity errors
        if (err.data) {
            try {
                const iface = new ethers.Interface(CONTRACT_ABI);
                const decodedError = iface.parseError(err.data);

                if (decodedError) {
                    errorMessage = `Error: ${decodedError.name}`;

                    // If the custom error has parameters, include them in the message
                    if (decodedError.args && decodedError.args.length > 0) {
                        errorMessage += ` (${decodedError.args.join(", ")})`;
                    }
                }
            } catch (decodeError) {
                console.warn("Failed to decode custom error:", decodeError);
            }
        }

        setError(errorMessage);
    } finally {
        setIsMinting(false);
    }
};

  // Reveal degen mint
  const revealDegenMint = () => {
    setIsDegenRevealed(true)
  }

  // Fetch contract data
  const fetchContractData = async () => {
    if (!contract || !isConnected) return

    try {
      // Get phase info
      const phase = await getCurrentPhaseInfo(contract)
      setPhaseInfo(phase)

      // Get supply info
      const supply = await getSupplyInfo(contract)
      setSupplyInfo(supply)

      // Get user mint info for the current phase
      if (walletAddress && phase.phaseIndex >= 0) {
        const userInfo = await getUserPhaseMintsInfo(contract, walletAddress, phase.phaseIndex)
        setUserPhaseInfo(userInfo)

        // Check if user has fully minted their allocation
        if (userInfo.hasFullyMinted) {
          setShowDegenSurprise(true)

          // Get degen mint info
          const degenInfo = await getDegenMintInfo(contract, walletAddress)
          setDegenMintInfo(degenInfo)
        } else {
          setShowDegenSurprise(false)
          setIsDegenRevealed(false)
        }
      }

      // Set mint price based on phase
      if (phase.phaseIndex === -1) {
        setMintPrice("Minting Paused")
      } else {
        // Get price from the selected category if available
        if (phase.categories && phase.categories.length > selectedCategory) {
          const categoryPrice = ethers.formatEther(phase.categories[selectedCategory].price)
          setMintPrice(`${categoryPrice} HYPE`)
        } else {
          setMintPrice("2 HYPE")
        }
      }
    } catch (err) {
      console.error("Error fetching contract data:", err)
    }
  }

  // Update time remaining
  const updateTimeRemaining = () => {
    if (phaseInfo.endTime > 0) {
      setTimeRemaining(formatTimeRemaining(phaseInfo.endTime))
    }
  }

  // Effect for initial wallet connection check
  useEffect(() => {
    const checkConnection = async () => {
      if (window.ethereum) {
        try {
          const provider = new ethers.BrowserProvider(window.ethereum)
          const accounts = await provider.send("eth_accounts", [])

          if (accounts.length > 0) {
            setWalletAddress(accounts[0])
            setIsConnected(true)
            setProvider(provider)

            await checkNetwork(provider);

            // Initialize contract
            const contract = await getContract(provider)
            setContract(contract)
          }
        } catch (err) {
          console.error("Error checking wallet connection:", err)
        }
      }
    }

    checkConnection()

    // Listen for account changes
    if (window.ethereum) {
      window.ethereum.on("accountsChanged", (accounts: string[]) => {
        if (accounts.length > 0) {
          setWalletAddress(accounts[0])
        } else {
          disconnectWallet()
        }
      })
    }

    return () => {
      if (window.ethereum) {
        window.ethereum.removeListener("accountsChanged", () => {})
      }
    }
  }, [])

  // Effect for fetching contract data
  useEffect(() => {
    if (contract && isConnected) {
      fetchContractData()
    }
  }, [contract, isConnected, walletAddress, refreshCounter, selectedCategory])

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

  // Increment mint amount
  const incrementMintAmount = () => {
    if (phaseInfo.categories && phaseInfo.categories.length > selectedCategory) {
      const maxMint = phaseInfo.categories[selectedCategory].maxMintPerWallet
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
    return phaseInfo.active && getRemainingMints() > 0
  }

  return (
    <main className="min-h-screen bg-teal-800 text-white flex flex-col relative overflow-hidden">
      {/* Background image with overlay */}
      <div className="absolute inset-0 z-0">
        <Image
          src="/assets/images/png/landing-background.png"
          alt="landing-background"
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
        </header>

        <div className="flex-1 flex flex-col items-center justify-center text-center relative mt-8">
          <div className="text-4xl md:text-7xl font-bold tracking-wider mb-6">
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
                <p className="mb-4">Connect your wallet to mint HYCHAN</p>
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

