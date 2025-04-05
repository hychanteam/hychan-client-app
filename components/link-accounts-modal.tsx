"use client"

import { X, Loader2, CheckCircle2, AlertCircle } from "lucide-react"

interface LinkAccountsModalProps {
  isOpen: boolean
  onClose: () => void
  walletAddress: string
  discordUsername: string | null
  isLinking: boolean
  error: string | null
  onLinkAccounts: () => Promise<void>
}

export default function LinkAccountsModal({
  isOpen,
  onClose,
  walletAddress,
  discordUsername,
  isLinking,
  error,
  onLinkAccounts,
}: LinkAccountsModalProps) {
  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70">
      <div className="relative w-full max-w-md bg-teal-900/95 backdrop-blur-sm p-6 rounded-lg border border-white/10 shadow-xl">
        {/* Close button */}
        <button onClick={onClose} className="absolute top-4 right-4 text-white/70 hover:text-white">
          <X size={20} />
        </button>

        {/* Error message */}
        {error && (
          <div className="mb-4 p-3 bg-red-900/40 border border-red-500/30 rounded-md flex items-start">
            <AlertCircle className="text-red-400 mr-2 flex-shrink-0 mt-0.5" size={16} />
            <p className="text-sm text-left text-white">{error}</p>
          </div>
        )}

        <h2 className="text-xl font-bold mb-6 text-center text-white">Link Your Accounts</h2>

        <div className="mb-6 space-y-4">
          <div className="bg-teal-800/50 p-4 rounded-md border border-white/10">
            <div className="flex items-center mb-1">
              <CheckCircle2 className="text-green-400 mr-2" size={16} />
              <p className="font-medium text-white text-sm">Wallet Connected</p>
            </div>
            <p className="text-white/80 text-sm truncate">{walletAddress}</p>
          </div>

          <div className="bg-teal-800/50 p-4 rounded-md border border-white/10">
            <div className="flex items-center mb-1">
              <CheckCircle2 className="text-green-400 mr-2" size={16} />
              <p className="font-medium text-white text-sm">Discord Connected</p>
            </div>
            <p className="text-white/80 text-sm">{discordUsername || "Discord User"}</p>
          </div>
        </div>

        <p className="text-sm text-white/80 mb-6 text-center">
          Link your wallet with your Discord account to verify eligibility and receive your roles.
        </p>

        {/* Link Accounts Button */}
        <button
          onClick={onLinkAccounts}
          disabled={isLinking}
          className="w-full bg-teal-400 hover:bg-teal-300 text-teal-900 py-3 px-4 rounded-md font-medium transition-colors flex items-center justify-center disabled:opacity-50"
        >
          {isLinking ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Linking...
            </>
          ) : (
            "Link Accounts"
          )}
        </button>
      </div>
    </div>
  )
}