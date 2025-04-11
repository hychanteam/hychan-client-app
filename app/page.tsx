"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import Link from "next/link"
import Image from "next/image"
import { X, Loader2, CheckCircle2, AlertCircle } from "lucide-react"
import { ethers } from "ethers"
import {
  getDiscordAuthUrl,
  clearState,
  storeWalletAddress,
  getWalletAddress,
  clearWalletAddress,
  storeDiscordCredentials,
  getDiscordCredentials,
  clearDiscordCredentials,
} from "../lib/discord-auth"
import { FaDiscord } from "react-icons/fa"
import { FaXTwitter } from "react-icons/fa6"

export default function Home() {
  const [walletAddress, setWalletAddress] = useState<string>("")
  const [isConnected, setIsConnected] = useState<boolean>(false)
  const [isConnecting, setIsConnecting] = useState<boolean>(false)
  const [isLinkingDiscord, setIsLinkingDiscord] = useState<boolean>(false)
  const [error, setError] = useState<string>("")
  const [success, setSuccess] = useState<string>("")
  const [discordId, setDiscordId] = useState<string | null>(null)
  const [discordUsername, setDiscordUsername] = useState<string | null>(null)
  const [isWalletLinked, setIsWalletLinked] = useState<boolean>(false)
  const [hasAttemptedAutoConnect, setHasAttemptedAutoConnect] = useState<boolean>(false)
  const [hasCheckedDiscordCredentials, setHasCheckedDiscordCredentials] = useState<boolean>(false)

  // Refs for message timeouts
  const errorTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const successTimeoutRef = useRef<NodeJS.Timeout | null>(null)

  // Ref to track pending wallet connection requests
  const pendingWalletRequestRef = useRef<boolean>(false)

  // Function to set error with auto-dismiss
  const setErrorWithTimeout = useCallback((message: string) => {
    // Clear any existing timeout
    if (errorTimeoutRef.current) {
      clearTimeout(errorTimeoutRef.current)
    }

    // Set the error message
    setError(message)

    // Set a new timeout to clear the message after 5 seconds
    errorTimeoutRef.current = setTimeout(() => {
      setError("")
    }, 5000)
  }, [])

  // Function to set success with auto-dismiss
  const setSuccessWithTimeout = useCallback((message: string) => {
    // Clear any existing timeout
    if (successTimeoutRef.current) {
      clearTimeout(successTimeoutRef.current)
    }

    // Set the success message
    setSuccess(message)

    // Set a new timeout to clear the message after 5 seconds
    successTimeoutRef.current = setTimeout(() => {
      setSuccess("")
    }, 5000)
  }, [])

  // Clear timeouts on unmount
  useEffect(() => {
    return () => {
      if (errorTimeoutRef.current) clearTimeout(errorTimeoutRef.current)
      if (successTimeoutRef.current) clearTimeout(successTimeoutRef.current)
    }
  }, [])

  // Connect wallet function - can be called manually or automatically
  const connectWallet = useCallback(
    async (silent = false) => {
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
            setWalletAddress(address)
            setIsConnected(true)

            // Store wallet address in localStorage for persistence
            storeWalletAddress(address)

            return true // Successfully connected
          } else if (!silent) {
            // Only show this error if not in silent mode
            setErrorWithTimeout("No accounts found. Please unlock your wallet and try again.")
          }
        } else if (!silent) {
          // Only show this error if not in silent mode
          setErrorWithTimeout("No Ethereum wallet detected. Please install MetaMask.")
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
    },
    [setErrorWithTimeout],
  )

  // Link wallet with Discord ID
  const linkWalletWithDiscord = useCallback(
    async (walletAddr: string, discId: string, discUsername: string | null) => {
      if (!walletAddr || !discId) {
        setErrorWithTimeout("Both wallet and Discord must be connected to link accounts")
        return
      }

      setIsLinkingDiscord(true)
      setError("")
      setSuccess("")

      try {
        const response = await fetch("/api/link-wallet-discord", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            walletAddress: walletAddr,
            discordId: discId,
            discordUsername: discUsername,
          }),
        })

        const data = await response.json()

        if (!response.ok) {
          throw new Error(data.error || "Failed to link wallet with Discord")
        }

        setIsWalletLinked(true)

        // Store Discord credentials for persistence
        storeDiscordCredentials(discId, discUsername)

        // Clear stored wallet address after successful linking
        clearWalletAddress()

        if (data.roleAssigned) {
          setSuccessWithTimeout("Wallet linked with Discord and roles assigned successfully!")
        } else {
          setErrorWithTimeout(data.roleMessage)
        }

        return true
      } catch (err) {
        console.error("Error linking wallet with Discord:", err)
        setErrorWithTimeout(err instanceof Error ? err.message : "Failed to link wallet with Discord")
        return false
      } finally {
        setIsLinkingDiscord(false)
      }
    },
    [setErrorWithTimeout, setSuccessWithTimeout],
  )

  // Check for stored Discord credentials on mount
  useEffect(() => {
    const checkDiscordCredentials = () => {
      const credentials = getDiscordCredentials()
      if (credentials && credentials.id) {
        setDiscordId(credentials.id)
        setDiscordUsername(credentials.username || null)

        // If wallet is already connected, check if they're linked
        if (isConnected && walletAddress) {
          // Fetch user data to check if wallet is linked with Discord
          fetch("/api/user-data", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              address: walletAddress,
              discordId: credentials.id,
            }),
          })
            .then((response) => response.json())
            .then((data) => {
              if (data.dcId === credentials.id) {
                setIsWalletLinked(true)
              }
            })
            .catch((err) => {
              console.error("Error checking user data:", err)
            })
        }
      }

      setHasCheckedDiscordCredentials(true)
    }

    if (!hasCheckedDiscordCredentials) {
      checkDiscordCredentials()
    }
  }, [isConnected, walletAddress, hasCheckedDiscordCredentials])

  // Auto-connect wallet on page load
  useEffect(() => {
    const autoConnectWallet = async () => {
      // Check if we have a stored wallet address first
      const storedAddress = getWalletAddress()

      if (storedAddress) {
        // If we have a stored address, set it
        setWalletAddress(storedAddress)
        setIsConnected(true)

        // If we also have Discord ID from a redirect, try to link accounts
        const url = new URL(window.location.href)
        if (url.searchParams.get("discord_auth") === "success") {
          // This will be handled by the Discord auth effect
        }
      } else {
        // Otherwise try silent connection (no popup)
        const connected = await connectWallet(true)

        // If silent connection failed and we haven't shown a popup yet, try with popup
        if (!connected && !hasAttemptedAutoConnect) {
          await connectWallet(false)
        }
      }

      setHasAttemptedAutoConnect(true)
    }

    if (!isConnected && !hasAttemptedAutoConnect) {
      autoConnectWallet()
    }
  }, [connectWallet, isConnected, hasAttemptedAutoConnect])

  // Listen for account changes
  useEffect(() => {
    if (window.ethereum) {
      const handleAccountsChanged = (accounts: string[]) => {
        if (accounts.length > 0) {
          const newAddress = accounts[0]
          setWalletAddress(newAddress)
          setIsConnected(true)

          // Update stored wallet address
          storeWalletAddress(newAddress)

          // If Discord is connected but not linked, try to link automatically
          if (discordId && !isWalletLinked) {
            linkWalletWithDiscord(newAddress, discordId, discordUsername)
          }
        } else {
          // User disconnected their wallet
          setWalletAddress("")
          setIsConnected(false)
          setIsWalletLinked(false)

          // Clear stored wallet address
          clearWalletAddress()
        }
      }

      window.ethereum.on("accountsChanged", handleAccountsChanged)

      return () => {
        window.ethereum?.removeListener("accountsChanged", handleAccountsChanged)
      }
    }
  }, [discordId, discordUsername, isWalletLinked, linkWalletWithDiscord])

  // Check for Discord auth callback and automatically link accounts
  useEffect(() => {
    const checkDiscordAuth = async () => {
      const url = new URL(window.location.href)
      const discordAuth = url.searchParams.get("discord_auth")
      const errorParam = url.searchParams.get("error")

      if (errorParam) {
        setErrorWithTimeout(`Discord authentication failed: ${errorParam}`)
        // Clean up URL
        window.history.replaceState({}, document.title, window.location.pathname)
        return
      }

      if (discordAuth === "success") {
        // Get Discord ID from cookie
        const discordId = document.cookie
          .split("; ")
          .find((row) => row.startsWith("discord_user_id="))
          ?.split("=")[1]

        const discordUsername = document.cookie
          .split("; ")
          .find((row) => row.startsWith("discord_username="))
          ?.split("=")[1]

        if (discordId) {
          setDiscordId(discordId)
          setDiscordUsername(discordUsername || null)

          // Store Discord credentials for persistence
          storeDiscordCredentials(discordId, discordUsername || null)

          // Get the stored wallet address
          const storedWalletAddress = getWalletAddress()

          // If we have a stored wallet address, use it
          if (storedWalletAddress) {
            setWalletAddress(storedWalletAddress)
            setIsConnected(true)

            // Link accounts with the stored wallet address
            await linkWalletWithDiscord(storedWalletAddress, discordId, discordUsername || null)
          }
          // If wallet is already connected in state, use that
          else if (isConnected && walletAddress) {
            await linkWalletWithDiscord(walletAddress, discordId, discordUsername || null)
          }
          // If no wallet is connected, try to connect silently
          else {
            const connected = await connectWallet(true)
            if (connected) {
              // Now link the accounts
              await linkWalletWithDiscord(walletAddress, discordId, discordUsername || null)
            } else {
              // Prompt user to connect wallet
              setSuccessWithTimeout("Discord connected! Please connect your wallet to complete the linking process.")
            }
          }
        }

        // Clean up URL
        window.history.replaceState({}, document.title, window.location.pathname)
      }

      // Clean up Discord auth state
      clearState()
    }

    checkDiscordAuth()
  }, [connectWallet, isConnected, linkWalletWithDiscord, walletAddress, setErrorWithTimeout, setSuccessWithTimeout])

  // Connect Discord function
  const connectDiscord = () => {
    // Make sure we store the current wallet address before redirecting
    if (walletAddress) {
      storeWalletAddress(walletAddress)
    }

    window.location.href = getDiscordAuthUrl()
  }

  // Disconnect wallet function
  const disconnectWallet = () => {
    setWalletAddress("")
    setIsConnected(false)
    setSuccess("")
    setError("")
    setIsWalletLinked(false)

    // Clear stored wallet address
    clearWalletAddress()

    // Keep Discord connection
  }

  // Disconnect Discord function
  const disconnectDiscord = () => {
    setDiscordId(null)
    setDiscordUsername(null)
    setIsWalletLinked(false)

    // Clear Discord cookies
    document.cookie = "discord_user_id=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;"
    document.cookie = "discord_username=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;"

    // Clear Discord credentials from localStorage
    clearDiscordCredentials()
  }

  // Close error message
  const closeError = () => {
    if (errorTimeoutRef.current) {
      clearTimeout(errorTimeoutRef.current)
    }
    setError("")
  }

  // Close success message
  const closeSuccess = () => {
    if (successTimeoutRef.current) {
      clearTimeout(successTimeoutRef.current)
    }
    setSuccess("")
  }
  
  return (
    <main className="min-h-screen bg-teal-800 text-white flex flex-col relative overflow-hidden">
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
        <header className="flex justify-center md:justify-between items-center h-12">
          <div className="w-32 md:w-40"/>

          <div className="flex-1" />
          
          {/* Navbar buttons - hidden on mobile */}
          <div className="flex gap-2">
            {isConnected ? (
              <button
                onClick={disconnectWallet}
                className="bg-transparent border border-white/30 text-white py-2 px-4 rounded-[8px] hover:bg-white/10 transition-colors"
              >
                {walletAddress.substring(0, 6)}...{walletAddress.substring(walletAddress.length - 4)}
              </button>
            ) : (
              <button
                onClick={() => connectWallet(false)}
                disabled={isConnecting || pendingWalletRequestRef.current}
                className="bg-transparent border border-white/30 text-white py-2 px-4 rounded-[8px] transition-colors flex items-center disabled:opacity-70"
              >
                {isConnecting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Connecting...
                  </>
                ) : (
                  "Connect"
                )}
              </button>
            )}

            {isConnected && !isWalletLinked && !discordId && (
              <button
                onClick={connectDiscord}
                className="bg-indigo-600 hover:bg-indigo-700 text-white py-2 px-4 rounded-[8px] transition-colors flex items-center"
              >
                <FaDiscord size={24} className="mr-2" />
                Connect
              </button>
            )}

            {isConnected && discordId && (
              <button
                onClick={disconnectDiscord}
                className="bg-indigo-600 hover:bg-indigo-700 text-white py-2 px-4 rounded-md transition-colors flex items-center max-w-[150px]"
              >
                <FaDiscord size={24} className="mr-2 shrink-0" />
                <span className="truncate whitespace-nowrap overflow-hidden">
                  {discordUsername || "Discord"}
                </span>
              </button>
            )}
          </div>
        </header>

        <div className="flex-1 flex flex-col items-center justify-center text-center relative mt-16 md:mt-0">
          <h2 className="text-4xl md:text-5xl mb-4 md:mb-6">
            We Are
            <div className="text-4xl md:text-7xl font-bold tracking-wider mt-2">
              <Image
                src="/assets/images/png/title-large.png"
                alt="HYCHAN"
                width={200} // Smaller width for mobile
                height={60}
                className="mx-auto md:w-[300px] md:h-[90px]"
              />
            </div>
          </h2>

          {/* Status Messages */}
          {(error || success) && (
            <div className="w-full max-w-md mx-auto mb-6">
              {error && (
                <div className="p-3 bg-red-900/40 border border-red-500/30 rounded-md flex items-start relative">
                  <AlertCircle className="text-red-400 mr-2 flex-shrink-0 mt-0.5" size={16} />
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

              {success && (
                <div className="p-3 bg-green-900/40 border border-green-500/30 rounded-md flex items-start relative">
                  <CheckCircle2 className="text-green-400 mr-2 flex-shrink-0 mt-0.5" size={16} />
                  <p className="text-sm text-left pr-6">{success}</p>
                  <button
                    onClick={closeSuccess}
                    className="absolute top-2 right-2 text-white/70 hover:text-white"
                    aria-label="Close success message"
                  >
                    <X size={16} />
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Loading indicator during linking */}
          {isLinkingDiscord && (
            <div className="w-full max-w-md mx-auto mb-6 flex items-center justify-center">
              <Loader2 className="h-6 w-6 animate-spin text-teal-400 mr-2" />
              <p>Linking your accounts...</p>
            </div>
          )}

          <div className="flex flex-col sm:flex-row gap-4 mt-0">
            <button className="bg-teal-400 hover:bg-teal-300 text-white py-3 px-12 rounded-md text-2xl font-medium tracking-wider transition-colors">
              Coming Soon
            </button>

            <Link href="/check-wallet">
              <button className="bg-transparent border border-white/30 hover:bg-white/10 text-white py-3 px-12 rounded-md text-2xl font-medium tracking-wider transition-colors">
                Check Wallet
              </button>
            </Link>
          </div>

          <div className="mt-12 space-y-2">
            <p className="text-2xl text-teal-300 opacity-80">we advise you to be liquid</p>
          </div>

          <div className="max-w-sm mx-auto mt-12 text-center">
            <p className="text-lg leading-relaxed">
            The first anime NFT on Hyperliquid.<br/> 
            Cyber waifus, zero patience, 100% degen. 
            You either get in early or cry later. Just dominance.
            </p>
          </div>
        </div>

        <div className="flex justify-center gap-4 mt-auto mb-8">
          <Link href="https://x.com/hychanhl" target="_blank" className="border border-white/30 p-3 rounded-md hover:bg-white/10 transition-colors">
            <FaXTwitter size={24} />
          </Link>
          <Link href="https://discord.gg/hychanhl" className="border border-white/30 p-3 rounded-md hover:bg-white/10 transition-colors">
            <FaDiscord size={24} />
          </Link>
        </div>
      </div>
    </main>
  )
}

