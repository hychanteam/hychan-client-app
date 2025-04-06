"use client"

import { useState, useEffect } from "react"
import Image from "next/image"
import { Loader2 } from "lucide-react"

interface LoadingScreenProps {
  message?: string
  progress?: number
}

export default function LoadingScreen({ message = "Loading...", progress }: LoadingScreenProps) {
  const [dots, setDots] = useState(".")

  // Animate the dots for a more dynamic loading indicator
  useEffect(() => {
    const interval = setInterval(() => {
      setDots((prev) => {
        if (prev === "...") return "."
        return prev + "."
      })
    }, 500)

    return () => clearInterval(interval)
  }, [])

  return (
    <div className="fixed inset-0 bg-teal-800 flex flex-col items-center justify-center z-50">
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

      <div className="relative z-10 flex flex-col items-center">
        <div className="text-4xl md:text-7xl font-bold tracking-wider mt-2 mb-6">
            <Image
                src="/assets/images/png/title-large.png"
                alt="HYCHAN"
                width={200} // Smaller width for mobile
                height={60}
                className="mx-auto md:w-[300px] md:h-[90px]"
            />
        </div>

        <div className="flex items-center mb-4">
          <Loader2 className="h-8 w-8 animate-spin mr-3 text-teal-400" />
          <p className="text-xl font-medium">
            {message}
            {dots}
          </p>
        </div>

        {progress !== undefined && (
          <div className="w-64 mt-4">
            <div className="h-2 bg-teal-900 rounded-full overflow-hidden">
              <div
                className="h-full bg-teal-400 transition-all duration-300 ease-out"
                style={{ width: `${Math.max(5, Math.min(100, progress))}%` }}
              />
            </div>
            <div className="mt-1 text-xs text-right text-teal-300">{Math.round(progress)}%</div>
          </div>
        )}
      </div>
    </div>
  )
}

