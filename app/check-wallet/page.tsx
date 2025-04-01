"use client"

import type React from "react"
import { useState } from "react"
import Link from "next/link"
import Image from "next/image"
import { ArrowLeft, Check, XIcon, Loader2 } from "lucide-react"
import Confetti from "react-confetti"
import { useWindowSize } from "react-use"

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
  const [showConfetti, setShowConfetti] = useState(false)
  const { width, height } = useWindowSize()

  // Function to validate EVM address format
  const isValidEVMAddress = (address: string) => {
    return /^0x[a-fA-F0-9]{40}$/.test(address)
  }

  // Function to check eligibility using the API
  const checkEligibility = async (address: string) => {
    setIsChecking(true)
    setError("")
    setCheckResult(null)

    try {
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
        setShowConfetti(true)
        // Hide confetti after 5 seconds
        setTimeout(() => setShowConfetti(false), 5000)
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

  return (
    <main className="min-h-screen bg-teal-800 text-white flex flex-col relative overflow-hidden">
      {showConfetti && (
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

          <h1 className="text-3xl md:text-4xl font-bold mb-8 mt-6">Wallet Checker</h1>

          <div className="w-full max-w-md bg-teal-900/60 backdrop-blur-sm p-6 rounded-lg border border-white/10">
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="space-y-2">
                <label htmlFor="wallet-address" className="block text-left text-sm font-medium">
                  EVM Wallet Address
                </label>
                <input
                  id="wallet-address"
                  type="text"
                  value={walletAddress}
                  onChange={(e) => setWalletAddress(e.target.value)}
                  placeholder="0x..."
                  className="w-full px-4 py-3 bg-teal-800/80 border border-white/20 rounded-md focus:outline-none focus:ring-2 focus:ring-teal-400"
                />
              </div>

              {error && <div className="text-red-300 text-sm text-left">{error}</div>}

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

            {checkResult && (
              <div
                className={`mt-8 p-4 rounded-md ${checkResult.eligible ? "bg-green-900/40 border border-green-500/30" : "bg-red-900/40 border border-red-500/30"}`}
              >
                <div className="flex items-center justify-center mb-2">
                  {checkResult.eligible ? (
                    <Check className="text-green-400 mr-2" size={24} />
                  ) : (
                    <XIcon className="text-red-400 mr-2" size={24} />
                  )}
                  <h3 className="text-xl font-bold">{checkResult.eligible ? "Eligible" : "Not Eligible"}</h3>
                </div>
                <p className="mb-4">{checkResult.message}</p>

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
                  <Link href="#" className="block mt-6">
                    <button className="bg-teal-400 hover:bg-teal-300 text-teal-900 py-2 px-6 rounded-md font-medium transition-colors w-full">
                      Mint coming soon
                    </button>
                  </Link>
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

