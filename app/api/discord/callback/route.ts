import { NextResponse } from "next/server"

// Environment variables
const DISCORD_CLIENT_ID = process.env.NEXT_PUBLIC_DISCORD_CLIENT_ID || ""
const DISCORD_CLIENT_SECRET = process.env.DISCORD_CLIENT_SECRET || ""
const DISCORD_REDIRECT_URI = process.env.NEXT_PUBLIC_BASE_URL
  ? `${process.env.NEXT_PUBLIC_BASE_URL}/api/discord/callback`
  : ""

export async function GET(request: Request) {
  // Get the code and state from the URL
  const url = new URL(request.url)
  const code = url.searchParams.get("code")

  if (!code) {
    return NextResponse.redirect(`${url.origin}?error=no_code`)
  }

  try {
    // Exchange code for access token
    const tokenResponse = await fetch("https://discord.com/api/oauth2/token", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        client_id: DISCORD_CLIENT_ID,
        client_secret: DISCORD_CLIENT_SECRET,
        grant_type: "authorization_code",
        code,
        redirect_uri: DISCORD_REDIRECT_URI,
      }),
    })

    if (!tokenResponse.ok) {
      console.error("Failed to exchange code for token:", await tokenResponse.text())
      return NextResponse.redirect(`${url.origin}?error=token_exchange_failed`)
    }

    const tokenData = await tokenResponse.json()
    const { access_token } = tokenData

    // Get user info from Discord
    const userResponse = await fetch("https://discord.com/api/users/@me", {
      headers: {
        Authorization: `Bearer ${access_token}`,
      },
    })

    if (!userResponse.ok) {
      console.error("Failed to get user info:", await userResponse.text())
      return NextResponse.redirect(`${url.origin}?error=user_info_failed`)
    }

    const userData = await userResponse.json()
    const discordId = userData.id
    const discordUsername = userData.username

    // Store the Discord ID in a cookie for the client to use
    const response = NextResponse.redirect(`${url.origin}?discord_auth=success`)
    response.cookies.set("discord_user_id", discordId, {
      httpOnly: false, // Allow JavaScript access
      maxAge: 3600, // 1 hour
      path: "/",
    })
    response.cookies.set("discord_username", discordUsername, {
      httpOnly: false, // Allow JavaScript access
      maxAge: 3600, // 1 hour
      path: "/",
    })

    return response
  } catch (error) {
    console.error("Discord auth error:", error)
    return NextResponse.redirect(`${url.origin}?error=discord_auth_failed`)
  }
}

