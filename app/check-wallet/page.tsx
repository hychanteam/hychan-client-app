"use client"

import type React from "react"
import { useEffect, useRef, useState } from "react"
import Link from "next/link"
import Image from "next/image"
import { ArrowLeft, Check, XIcon, Loader2, X } from "lucide-react"
import Confetti from "react-confetti"
import { useWindowSize } from "react-use"
import { ethers } from "ethers"
import { 
  storeWalletAddress,
  getWalletAddress,
  clearWalletAddress,
  getDiscordCredentials,
  clearDiscordCredentials,
  getDiscordAuthUrl,
} from "../../lib/discord-auth"
import { FaDiscord } from "react-icons/fa"

type EligibilityResult = {
  eligible: boolean
  message: string
  data?: {
    gtdMints: number
    fcfsMints: number
    discordRoles: string[]
  }
}

export default function CheckWallet() {
  const [walletAddress, setWalletAddress] = useState("")
  const [isChecking, setIsChecking] = useState(false)
  const [checkResult, setCheckResult] = useState<EligibilityResult | null>(null)
  const [error, setError] = useState("")
  const [showSuccessConfetti, setShowSuccessConfetti] = useState(false)
  const { width, height } = useWindowSize()

  // Wallet connection state
  const [connectedWalletAddress, setConnectedWalletAddress] = useState<string>("")
  const [isConnected, setIsConnected] = useState<boolean>(false)
  const [isConnecting, setIsConnecting] = useState<boolean>(false)
  const [hasAutoChecked, setHasAutoChecked] = useState<boolean>(false)

  // Discord state
  const [discordId, setDiscordId] = useState<string | null>(null)
  const [discordUsername, setDiscordUsername] = useState<string | null>(null)

  // Ref to track pending wallet connection requests
  const pendingWalletRequestRef = useRef<boolean>(false)

  // Function to validate EVM address format
  const isValidEVMAddress = (address: string) => {
    return /^0x[a-fA-F0-9]{40}$/.test(address)
  }

  // Connect wallet function
  const connectWallet = async (silent = false) => {
    // If there's already a pending request, don't start another one
    if (pendingWalletRequestRef.current) {
      return false
    }

    if (!silent) setIsConnecting(true)
    setError("")

    // Set the pending flag
    pendingWalletRequestRef.current = true

    try {
      if (window.ethereum) {
        const provider = new ethers.BrowserProvider(window.ethereum)

        // Use eth_requestAccounts to prompt the wallet if not silent
        // Use eth_accounts to check without prompting if silent
        const method = silent ? "eth_accounts" : "eth_requestAccounts"
        const accounts = await provider.send(method, [])

        if (accounts.length > 0) {
          const address = accounts[0]
          setConnectedWalletAddress(address)
          setIsConnected(true)

          // Update the input field with the connected wallet address
          setWalletAddress(address)

          // Store wallet address in localStorage for persistence
          storeWalletAddress(address)

          // If this is the first connection, auto-check the wallet
          if (!hasAutoChecked) {
            checkEligibility(address)
            setHasAutoChecked(true)
          }

          return true // Successfully connected
        } else if (!silent) {
          // Only show this error if not in silent mode
          setError("No accounts found. Please unlock your wallet and try again.")
        }
      } else if (!silent) {
        // Only show this error if not in silent mode
        setError("No Ethereum wallet detected. Please install MetaMask.")
      }
      return false // Failed to connect
    } catch (err: unknown) {
      console.error("Error connecting wallet:", err);
    
      if (typeof err === "object" && err !== null) {
        const error = err as { code?: number; message?: string };
    
        const isPendingError =
          error.code === -32002 || (error.message && error.message.includes("already pending"));
    
        if (!silent && !isPendingError) {
          setError("Failed to connect wallet. Please try again.");
        }
      } else {
        if (!silent) {
          setError("An unknown error occurred.");
        }
      }
    
      return false;
    } finally {
      if (!silent) setIsConnecting(false)

      // Clear the pending flag
      pendingWalletRequestRef.current = false
    }
  }

  // Disconnect wallet function
  const disconnectWallet = () => {
    setConnectedWalletAddress("")
    setIsConnected(false)
    setHasAutoChecked(false)

    // Don't clear the wallet address from the input field
    // This allows the user to still check the wallet they were looking at

    // Clear stored wallet address
    clearWalletAddress()
  }

  // Connect Discord function
  const connectDiscord = () => {
    // Make sure we store the current wallet address before redirecting
    if (connectedWalletAddress) {
      storeWalletAddress(connectedWalletAddress)
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

  // Auto-connect wallet on page load
  useEffect(() => {
    const autoConnectWallet = async () => {
      // Check if we have a stored wallet address first
      const storedAddress = getWalletAddress()

      if (storedAddress) {
        // If we have a stored address, set it
        setConnectedWalletAddress(storedAddress)
        setIsConnected(true)

        // Update the input field with the connected wallet address
        setWalletAddress(storedAddress)

        // Auto-check the wallet
        await checkEligibility(storedAddress)
        setHasAutoChecked(true)
      } else {
        // Otherwise try silent connection (no popup)
        const connected = await connectWallet(true)

        if (connected && !hasAutoChecked) {
          // Auto-check the wallet if connected
          await checkEligibility(connectedWalletAddress)
          setHasAutoChecked(true)
        }
      }
    }

    if (!isConnected) {
      autoConnectWallet()
    }
  }, []) // eslint-disable-next-line react-hooks/exhaustive-deps

  // Listen for account changes
  useEffect(() => {
    if (window.ethereum) {
      const handleAccountsChanged = (accounts: string[]) => {
        if (accounts.length > 0) {
          const newAddress = accounts[0]
          setConnectedWalletAddress(newAddress)
          setIsConnected(true)

          // Update the input field with the new connected wallet address
          setWalletAddress(newAddress)

          // Update stored wallet address
          storeWalletAddress(newAddress)

          // Auto-check the new wallet
          checkEligibility(newAddress)
        } else {
          // User disconnected their wallet
          setConnectedWalletAddress("")
          setIsConnected(false)

          // Clear stored wallet address
          clearWalletAddress()
        }
      }

      window.ethereum.on("accountsChanged", handleAccountsChanged)

      return () => {
        window.ethereum?.removeListener("accountsChanged", handleAccountsChanged)
      }
    }
  }, [])

  // Function to check eligibility using the API
  const checkEligibility = async (address: string) => {
    setIsChecking(true)
    setError("")
    setCheckResult(null)
    setShowSuccessConfetti(false)

    try {
      // Then check eligibility
      const response = await fetch("/api/check-wallet", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ address }),
      })

      const result = await response.json()

      if (!response.ok) {
        // More detailed error message
        const errorMessage = result.error || "Failed to check eligibility"
        console.error("API error:", errorMessage)
        throw new Error(errorMessage)
      }

      setCheckResult(result)
      if (result.eligible) {
        setShowSuccessConfetti(true)
        // Hide confetti after 5 seconds
        setTimeout(() => setShowSuccessConfetti(false), 5000)
      }
    } catch (err) {
      console.error("Error details:", err)
      setError(
        err instanceof Error
          ? `Error: ${err.message}`
          : "An error occurred while checking eligibility. Please try again.",
      )
    } finally {
      setIsChecking(false)
    }
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()

    if (!walletAddress) {
      setError("Please enter a wallet address")
      return
    }

    if (!isValidEVMAddress(walletAddress)) {
      setError("Please enter a valid EVM wallet address")
      return
    }

    checkEligibility(walletAddress)
  }

  // Close error message
  const closeError = () => {
    setError("")
  }

  return (
    <main className="min-h-screen bg-teal-800 text-white flex flex-col relative overflow-hidden">
      {showSuccessConfetti && (
        <Confetti
        width={width}
        height={height}
        recycle={false}
        numberOfPieces={800}
        gravity={0.25}
        initialVelocityY={30}
        initialVelocityX={15}
        tweenDuration={50}
        colors={["#5eead4", "#2dd4bf", "#14b8a6", "#0d9488", "#0f766e", "#ffffff"]}
        confettiSource={{
          x: 0,
          y: height / 2,
          w: width, // Wider source area
          h: height, // Taller source area
        }}
        drawShape={(ctx) => {
          // Mix of different shapes for more variety
          const random = Math.random()
          if (random < 0.33) {
            // Circle
            ctx.beginPath()
            ctx.arc(0, 0, 7, 0, 2 * Math.PI)
            ctx.fill()
          } else if (random < 0.66) {
            // Square
            ctx.fillRect(-5, -5, 10, 10)
          } else {
            // Star
            const spikes = 5
            const outerRadius = 7
            const innerRadius = 3

            let rot = (Math.PI / 2) * 3
            let x = 0
            let y = 0
            const step = Math.PI / spikes

            ctx.beginPath()
            ctx.moveTo(x, y - outerRadius)

            for (let i = 0; i < spikes; i++) {
              x = Math.cos(rot) * outerRadius
              y = Math.sin(rot) * outerRadius
              ctx.lineTo(x, y)
              rot += step

              x = Math.cos(rot) * innerRadius
              y = Math.sin(rot) * innerRadius
              ctx.lineTo(x, y)
              rot += step
            }

            ctx.lineTo(0, -outerRadius)
            ctx.closePath()
            ctx.fill()
          }
        }}
        wind={0.01}
        friction={0.97}
      />
      )}

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

          <div className="hidden md:flex gap-2">
            {/* Wallet Connect Button */}
            {isConnected ? (
              <button
                onClick={disconnectWallet}
                className="bg-transparent border border-white/30 text-white py-2 px-4 rounded-[8px] hover:bg-white/10 transition-colors"
              >
                {connectedWalletAddress.substring(0, 6)}...
                {connectedWalletAddress.substring(connectedWalletAddress.length - 4)}
              </button>
            ) : (
              <button
                onClick={() => connectWallet(false)}
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

            {/* Discord Connect Button */}
            {discordId ? (
              <button
                onClick={disconnectDiscord}
                className="bg-indigo-600 hover:bg-indigo-700 text-white py-2 px-4 rounded-md transition-colors flex items-center"
              >
                <FaDiscord size={24} className="mr-2" />
                {discordUsername || "Discord"}
              </button>
            ) : (
              <button
                onClick={connectDiscord}
                className="bg-indigo-600 hover:bg-indigo-700 text-white py-2 px-4 rounded-md transition-colors flex items-center"
              >
                <FaDiscord size={24} className="mr-2" />
                Connect
              </button>
            )}
          </div>
        </header>

        <div className="flex-1 flex flex-col items-center justify-center text-center relative mt-4">
          <div className="text-4xl md:text-7xl font-bold tracking-wider">
              <Image
                  src="/assets/images/png/title-large.png"
                  alt="HYCHAN"
                  width={200} // Smaller width for mobile
                  height={60}
                  className="mx-auto md:w-[300px] md:h-[90px]"
              />
          </div>

          <h1 className="text-3xl md:text-4xl mb-8 mt-6">Wallet Checker</h1>

          <div className="w-full max-w-md bg-teal-900/60 backdrop-blur-sm p-6 rounded-lg border border-white/10">
            {/* Error message */}
            {error && (
              <div className="mb-4 p-3 bg-red-900/40 border border-red-500/30 rounded-md flex items-start relative">
                <XIcon className="text-red-400 mr-2 flex-shrink-0 mt-0.5" size={16} />
                <p className="text-sm text-left pr-6">{error}</p>
                <button
                  onClick={closeError}
                  className="absolute top-2 right-2 text-white/70 hover:text-white"
                  aria-label="Close error message"
                >
                  <X size={16} />
                </button>
              </div>
            )}

            {/* Wallet check form */}
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="space-y-2">
                <label htmlFor="wallet-address" className="block text-left text-sm font-medium">
                  {isConnected ? "Connected Wallet (edit to check any wallet)" : "Enter Wallet Address"}
                </label>
                <input
                  id="wallet-address"
                  type="text"
                  value={walletAddress}
                  onChange={(e) => setWalletAddress(e.target.value)}
                  placeholder="0x..."
                  className={`w-full px-4 py-3 bg-teal-800/80 border rounded-md focus:outline-none focus:ring-2 focus:ring-teal-400 ${
                    isConnected && walletAddress === connectedWalletAddress ? "border-teal-400/50" : "border-white/20"
                  }`}
                />
                {isConnected && walletAddress !== connectedWalletAddress && (
                  <div className="flex justify-end">
                    <button
                      type="button"
                      onClick={() => setWalletAddress(connectedWalletAddress)}
                      className="text-xs text-teal-300 hover:text-teal-200"
                    >
                      Reset to connected wallet
                    </button>
                  </div>
                )}
              </div>

              <button
                type="submit"
                disabled={isChecking}
                className="w-full bg-teal-400 hover:bg-teal-300 text-teal-900 py-3 px-4 rounded-md font-medium transition-colors disabled:opacity-70 disabled:cursor-not-allowed flex justify-center items-center"
              >
                {isChecking ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Checking...
                  </>
                ) : (
                  "Check"
                )}
              </button>
            </form>

            {/* Check result */}
            {checkResult && (
              <div
                className={`mt-8 p-4 rounded-md ${checkResult.eligible ? "bg-green-900/40 border border-green-500/30" : "bg-red-900/40 border border-red-500/30"}`}
              >
                {!checkResult.eligible ? (
                  <>
                    <div className="flex items-center justify-center mb-2">
                      <XIcon className="text-red-400 mr-2" size={24} />
                      <h3 className="text-xl font-bold">Not Eligible Yet</h3>
                    </div>
                    <p className="mb-4">
                      {checkResult.message} Join our Discord community to learn how you can get on the allowlist!
                    </p>
                    <Link
                      href="https://discord.gg/hychanhl"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-block mt-2 bg-teal-800/70 hover:bg-teal-700 text-white py-2 px-4 rounded-md transition-colors"
                    >
                      <FaDiscord className="inline-block mr-2" size={24} />
                      Join  
                    </Link>
                  </>
                ) : (
                  <>
                    <div className="flex items-center justify-center mb-2">
                      <Check className="text-green-400 mr-2" size={24} />
                      <h3 className="text-xl font-bold">Eligible</h3>
                    </div>
                    <p className="mb-4">{checkResult.message}</p>
                  </>
                )}

                {checkResult.eligible && checkResult.data && (
                  <div className="mt-4 space-y-4 text-left">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="bg-teal-800/50 p-3 rounded-md">
                        <p className="text-xs text-teal-300 uppercase font-semibold">GTD Mints</p>
                        <p className="text-2xl font-bold">{checkResult.data.gtdMints}</p>
                      </div>
                      <div className="bg-teal-800/50 p-3 rounded-md">
                        <p className="text-xs text-teal-300 uppercase font-semibold">FCFS Mints</p>
                        <p className="text-2xl font-bold">{checkResult.data.fcfsMints}</p>
                      </div>
                    </div>

                    {checkResult.data.discordRoles && checkResult.data.discordRoles.length > 0 && (
                      <div className="bg-teal-800/50 p-3 rounded-md">
                        <p className="text-xs text-teal-300 uppercase font-semibold mb-2">Discord Roles</p>
                        <div className="flex flex-wrap gap-2">
                          {checkResult.data.discordRoles.map((role, index) => (
                            <span
                              key={index}
                              className="inline-block bg-teal-700/70 px-2 py-1 rounded text-xs font-medium"
                            >
                              {role}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {checkResult.eligible && (
                  <button className="bg-teal-400 hover:bg-teal-300 text-teal-900 py-2 px-6 rounded-md font-medium transition-colors w-full">
                    Mint coming soon
                  </button>
                )}
              </div>
            )}
          </div>

          <div className="mt-8 text-sm text-white/70 max-w-md">
            <p>The purpose of this wallet checker is to verify minting eligibility. If a wallet is eligible, it will display the mint amount details.</p>
          </div>
        </div>
      </div>
    </main>
  )
}

