// Discord OAuth2 configuration
const DISCORD_CLIENT_ID = process.env.NEXT_PUBLIC_DISCORD_CLIENT_ID || ""
const DISCORD_REDIRECT_URI = typeof window !== "undefined" ? `${window.location.origin}/api/discord/callback` : ""

// Generate a random state for CSRF protection
export const generateState = () => {
  const array = new Uint8Array(16)
  if (typeof window !== "undefined" && window.crypto) {
    window.crypto.getRandomValues(array)
  }
  return Array.from(array, (byte) => byte.toString(16).padStart(2, "0")).join("")
}

// Store state in localStorage
export const storeState = (state: string) => {
  if (typeof window !== "undefined") {
    localStorage.setItem("discord_oauth_state", state)
  }
}

// Verify state from localStorage
export const verifyState = (state: string) => {
  if (typeof window !== "undefined") {
    const storedState = localStorage.getItem("discord_oauth_state")
    return storedState === state
  }
  return false
}

// Clear state from localStorage
export const clearState = () => {
  if (typeof window !== "undefined") {
    localStorage.removeItem("discord_oauth_state")
  }
}

// Store wallet address for association with Discord ID
export const storeWalletAddress = (address: string) => {
  if (typeof window !== "undefined") {
    localStorage.setItem("wallet_address", address)
  }
}

// Get stored wallet address
export const getWalletAddress = () => {
  if (typeof window !== "undefined") {
    return localStorage.getItem("wallet_address")
  }
  return null
}

// Clear wallet address
export const clearWalletAddress = () => {
  if (typeof window !== "undefined") {
    localStorage.removeItem("wallet_address")
  }
}

// Store Discord credentials
export const storeDiscordCredentials = (id: string, username: string | null) => {
  if (typeof window !== "undefined") {
    const credentials = {
      id,
      username: username || "",
      timestamp: Date.now(),
    }
    localStorage.setItem("discord_credentials", JSON.stringify(credentials))
  }
}

// Get stored Discord credentials
export const getDiscordCredentials = () => {
  if (typeof window !== "undefined") {
    const credentialsStr = localStorage.getItem("discord_credentials")
    if (credentialsStr) {
      try {
        return JSON.parse(credentialsStr)
      } catch (e) {
        console.error("Error parsing Discord credentials:", e)
      }
    }
  }
  return null
}

// Clear Discord credentials
export const clearDiscordCredentials = () => {
  if (typeof window !== "undefined") {
    localStorage.setItem("discord_credentials", "")
  }
}

// Generate Discord OAuth2 URL
export const getDiscordAuthUrl = () => {
  const state = generateState()
  storeState(state)

  const params = new URLSearchParams({
    client_id: DISCORD_CLIENT_ID,
    redirect_uri: DISCORD_REDIRECT_URI,
    response_type: "code",
    scope: "identify",
    state: state,
  })

  return `https://discord.com/api/oauth2/authorize?${params.toString()}`
}

