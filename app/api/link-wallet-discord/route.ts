import { createClient } from "@supabase/supabase-js"
import { NextResponse } from "next/server"

// Environment variables
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY
const discordServerId = process.env.DISCORD_SERVER_ID || "1234567890"
const discordBotToken = process.env.DISCORD_BOT_TOKEN

export async function POST(request: Request) {
  try {
    const { walletAddress, discordId, discordUsername } = await request.json()

    if (!walletAddress || !discordId) {
      return NextResponse.json({ error: "Wallet address and Discord ID are required" }, { status: 400 })
    }

    // Check if environment variables are available
    if (!supabaseUrl || !supabaseKey) {
      console.warn("Supabase environment variables are not set, using test mode")

      // Test mode response
      return NextResponse.json({
        success: true,
        message: "TEST MODE: Wallet linked with Discord ID",
        walletAddress,
        discordId,
        discordUsername,
        roleAssigned: false,
      })
    }

    // Initialize Supabase client
    const supabase = createClient(supabaseUrl, supabaseKey)

    try {
      // First, check if the wallet exists in the database
      const { data: walletData, error: walletError } = await supabase
        .from("master_hype_evm_wallet_mint_details")
        .select("address, allowedMintsGTD, allowedMintsFCFS, dcRole, dcId")
        .eq("address", walletAddress.toLowerCase())

      if (walletError) {
        console.error("Supabase query error:", walletError)
        return NextResponse.json(
          {
            error: `Database query error: ${walletError.message}`,
          },
          { status: 500 },
        )
      }

      // If wallet not found, return error
      if (!walletData || walletData.length === 0) {
        return NextResponse.json(
          {
            error: "Wallet not found in the allowlist",
            walletAddress,
            discordId,
            success: false,
          },
          { status: 404 },
        )
      }

      // Check if wallet is already linked to a different Discord ID
      if (walletData[0].dcId && walletData[0].dcId !== discordId) {
        return NextResponse.json(
          {
            error: "This wallet is already linked to a different Discord account",
            walletAddress,
            success: false,
          },
          { status: 409 }, // Conflict status code
        )
      }

      // Check if this Discord ID is already linked to a different wallet
      const { data: existingLinks, error: existingLinksError } = await supabase
        .from("master_hype_evm_wallet_mint_details")
        .select("address")
        .eq("dcId", discordId)
        .neq("address", walletAddress.toLowerCase())

      if (existingLinksError) {
        console.error("Error checking existing links:", existingLinksError)
        return NextResponse.json(
          {
            error: `Database query error: ${existingLinksError.message}`,
          },
          { status: 500 },
        )
      }

      if (existingLinks && existingLinks.length > 0) {
        return NextResponse.json(
          {
            error: "This Discord account is already linked to a different wallet",
            discordId,
            success: false,
          },
          { status: 409 }, // Conflict status code
        )
      }

      // Parse Discord roles from the string format ["ROLE1","ROLE2"]
      let discordRoles: string[] = []

      // If parsing fails, try to extract roles using regex
      const roleMatches = walletData[0].dcRole?.match(/"([^"]+)"/g) || []
      discordRoles = roleMatches.map((match: string) => match.replace(/"/g, ""))

      // Assign Discord roles if Discord ID is available and bot token exists
      let roleAssigned = false
      let roleMessage = "No Discord roles to assign"

      if (discordRoles.length > 0 && discordBotToken) {
        try {
          // Map role names to Discord role IDs (you would need to maintain this mapping)
          const roleMapping: Record<string, string> = {
            MINTCHAN: "1351040396104302603", // Replace with actual Discord role IDs
            OGCHAN: "1351040640070320158",
            FLASHCHAN: "1353017517966098534",
            // Add more role mappings as needed
          }

          // Get Discord role IDs to assign
          const roleIds = discordRoles.map((role) => roleMapping[role]).filter((id) => id !== undefined)

          if (roleIds.length > 0) {
            const assignmentResults = await Promise.all(
              roleIds.map(async (roleId) => {
                const url = `https://discord.com/api/v10/guilds/${discordServerId}/members/${discordId}/roles/${roleId}`
                try {
                  const response = await fetch(url, {
                    method: "PUT",
                    headers: {
                      Authorization: `Bot ${discordBotToken}`,
                      "Content-Type": "application/json",
                    },
                  })
      
                  const responseText = await response.text()
      
                  return {
                    roleId,
                    success: response.ok,
                    status: response.status,
                    message: responseText,
                  }
                } catch (error) {
                  console.error(`Error assigning role ${roleId}:`, error)
                  return {
                    roleId,
                    success: false,
                    status: 0,
                    error: error instanceof Error ? error.message : "Unknown error",
                  }
                }
              })
            )
      
            roleAssigned = assignmentResults.every((result) => result.success)
            // roleMessage = roleAssigned
            //   ? "All Discord roles assigned successfully."
            //   : `Some roles failed to assign:\n${assignmentResults
            //       .filter((r) => !r.success)
            //       .map((r) => `- Role ${r.roleId}: ${r.status} ${r.error || r.message || "Unknown error"}`)
            //       .join("\n")}`

            roleMessage = roleAssigned
              ? "All Discord roles assigned successfully."
              : `Looks like you are not in discord, join here with the discord link https://discord.gg`

            if(roleAssigned){
              // Update the wallet with the Discord ID
                const { error: updateError } = await supabase
                .from("master_hype_evm_wallet_mint_details")
                .update({ dcId: discordId })
                .eq("address", walletAddress.toLowerCase())

              if (updateError) {
                console.error("Error updating wallet with Discord ID:", updateError)
                return NextResponse.json(
                  {
                    error: `Failed to link wallet with Discord ID: ${updateError.message}`,
                  },
                  { status: 500 },
                )
              }
            }
          } else {
            roleMessage = "No valid Discord role IDs found to assign."
          }
        } catch (e) {
          console.error("Unexpected error during role assignment:", e)
          roleMessage = "Unexpected error occurred during Discord role assignment."
        }
      } else {
        roleMessage = "Missing roles, bot token, or Discord user/server ID."
      }

      return NextResponse.json({
        success: true,
        message: "Wallet successfully linked with Discord ID",
        roleAssigned,
        roleMessage,
        walletAddress,
        discordId,
        discordUsername,
        mintAmountsGTD: walletData[0].allowedMintsGTD || 0,
        mintAmountsFCFS: walletData[0].allowedMintsFCFS || 0,
        discordRoles,
      })
    } catch (dbError) {
      console.error("Database operation error:", dbError)
      return NextResponse.json(
        {
          error: `Database operation failed: ${dbError instanceof Error ? dbError.message : "Unknown error"}`,
        },
        { status: 500 },
      )
    }
  } catch (error) {
    console.error("Server error:", error)
    return NextResponse.json(
      {
        error: `Internal server error: ${error instanceof Error ? error.message : "Unknown error"}`,
      },
      { status: 500 },
    )
  }
}

