"use client"

import { useState } from "react";
import Link from "next/link"
import { FaXTwitter, FaDiscord } from 'react-icons/fa6';
import Image from "next/image"
import { X, DiscIcon as Discord, Loader2, CheckCircle2, AlertCircle } from "lucide-react"
import { ethers } from "ethers"

export default function Home() {
  const [walletAddress, setWalletAddress] = useState<string>("")
  const [isConnected, setIsConnected] = useState<boolean>(false)
  const [isConnecting, setIsConnecting] = useState<boolean>(false)
  const [error, setError] = useState<string>("")
  const [success, setSuccess] = useState<string>("")
  const [userData, setUserData] = useState<any>(null)

  // Connect wallet function
  const connectWallet = async () => {
    setIsConnecting(true)
    setError("")
    setSuccess("")

    try {
      if (window.ethereum) {
        const provider = new ethers.BrowserProvider(window.ethereum)
        const accounts = await provider.send("eth_requestAccounts", [])

        if (accounts.length > 0) {
          const address = accounts[0]
          setWalletAddress(address)
          setIsConnected(true)

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
              } else if (data.mintAmountsGTD > 0 || data.mintAmountsFCFS > 0) {
                setSuccess("Wallet verified! You are eligible for minting.")
              } else {
                setError("Your wallet is not on the allowlist for minting.")
              }
            } else {
              const errorData = await response.json()
              throw new Error(errorData.error || "Failed to fetch user data")
            }
          } catch (apiError) {
            console.error("API error:", apiError)
            setError(apiError instanceof Error ? apiError.message : "Failed to verify wallet")
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
    setUserData(null)
    setSuccess("")
    setError("")
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
          <div className="w-32 md:w-40">
            <Image
              src="/assets/images/png/title.png"
              alt="HYCHAN"
              width={160}
              height={48}
              priority
            />
          </div>
          
          {/* Connect Wallet button - hidden on mobile */}
          {isConnected ? (
            <button
              onClick={disconnectWallet}
              className="hidden md:block bg-transparent border border-white/30 text-white py-2 px-6 rounded-[8px] hover:bg-white/10 transition-colors"
            >
              {walletAddress.substring(0, 6)}...{walletAddress.substring(walletAddress.length - 4)}
            </button>
          ) : (
            <button
              onClick={connectWallet}
              disabled={isConnecting}
              className="hidden md:block bg-transparent border border-white/30 text-white py-2 px-6 rounded-[8px] hover:bg-white/10 transition-colors"
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
                <div className="p-3 bg-red-900/40 border border-red-500/30 rounded-md flex items-start">
                  <AlertCircle className="text-red-400 mr-2 flex-shrink-0 mt-0.5" size={16} />
                  <p className="text-sm text-left">{error}</p>
                </div>
              )}

              {success && (
                <div className="p-3 bg-green-900/40 border border-green-500/30 rounded-md flex items-start">
                  <CheckCircle2 className="text-green-400 mr-2 flex-shrink-0 mt-0.5" size={16} />
                  <p className="text-sm text-left">{success}</p>
                </div>
              )}
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

          {/* User Data Display */}
          {isConnected && userData && (userData.mintAmountsGTD > 0 || userData.mintAmountsFCFS > 0) && (
            <div className="mt-8 w-full max-w-md mx-auto bg-teal-900/60 backdrop-blur-sm p-4 rounded-lg border border-white/10">
              <h3 className="text-lg font-bold mb-3">Your Allocation</h3>

              <div className="grid grid-cols-2 gap-4">
                <div className="bg-teal-800/50 p-3 rounded-md">
                  <p className="text-xs text-teal-300 uppercase font-semibold">GTD Mints</p>
                  <p className="text-2xl font-bold">{userData.mintAmountsGTD}</p>
                </div>
                <div className="bg-teal-800/50 p-3 rounded-md">
                  <p className="text-xs text-teal-300 uppercase font-semibold">FCFS Mints</p>
                  <p className="text-2xl font-bold">{userData.mintAmountsFCFS}</p>
                </div>
              </div>

              {userData.dcRoles && userData.dcRoles.length > 0 && (
                <div className="mt-4 bg-teal-800/50 p-3 rounded-md">
                  <p className="text-xs text-teal-300 uppercase font-semibold mb-2">Discord Roles</p>
                  <div className="flex flex-wrap gap-2">
                    {userData.dcRoles.map((role: string, index: number) => (
                      <span key={index} className="inline-block bg-teal-700/70 px-2 py-1 rounded text-xs font-medium">
                        {role}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

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

