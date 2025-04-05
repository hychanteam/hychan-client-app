import { createClient } from "@supabase/supabase-js"
import { NextResponse } from "next/server"

// Environment variables
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY
const discordServerId = process.env.DISCORD_SERVER_ID || "1234567890"
const discordBotToken = process.env.DISCORD_BOT_TOKEN

// Add this check to validate environment variables
if (!supabaseUrl || !supabaseKey) {
  console.error("Missing Supabase environment variables")
}

if (!discordBotToken) {
  console.warn("Missing Discord bot token - role assignment will be disabled")
}

export async function POST(request: Request) {
  try {
    const { address, discordId } = await request.json()

    if (!address) {
      return NextResponse.json({ error: "Wallet address is required" }, { status: 400 })
    }

    // Check if environment variables are available
    if (!supabaseUrl || !supabaseKey) {
      console.warn("Supabase environment variables are not set, using test mode")

      // Test mode: addresses starting with 0x1 are eligible
      if (address.toLowerCase().startsWith("0x1")) {
        return NextResponse.json({
          address: address.toLowerCase(),
          mintAmountsGTD: 2,
          mintAmountsFCFS: 1,
          dcRoles: ["FOGCHAN", "FLASHCHAN"],
          dcId: discordId || "123456789012345678", // Use provided Discord ID or mock one
          roleAssigned: false,
          message: "TEST MODE: Discord roles not assigned in test mode",
          eligible: true,
        })
      } else {
        return NextResponse.json({
          address: address.toLowerCase(),
          mintAmountsGTD: 0,
          mintAmountsFCFS: 0,
          dcRoles: [],
          dcId: null,
          roleAssigned: false,
          message: "TEST MODE: Wallet not found",
          eligible: false,
        })
      }
    }

    // Initialize Supabase client
    const supabase = createClient(supabaseUrl, supabaseKey)

    try {
      // Query the database for the wallet address
      const { data, error } = await supabase
        .from("master_hype_evm_wallet_mint_details") // Replace with your actual table name
        .select("address, allowedMintsGTD, allowedMintsFCFS, dcRole, dcId")
        .eq("address", address.toLowerCase())

      if (error) {
        console.error("Supabase query error:", error)
        return NextResponse.json(
          {
            error: `Database query error: ${error.message}`,
          },
          { status: 500 },
        )
      }

      // Check if any data was returned
      if (!data || data.length === 0) {
        return NextResponse.json({
          address: address.toLowerCase(),
          mintAmountsGTD: 0,
          mintAmountsFCFS: 0,
          dcRoles: [],
          dcId: null,
          roleAssigned: false,
          message: "Wallet not found in database",
          eligible: false,
        })
      }

      // Use the first matching wallet if multiple were found
      const walletData = data[0]

      // Parse Discord roles from the string format ["ROLE1","ROLE2"]
      let discordRoles: string[] = []

      // If parsing fails, try to extract roles using regex
      const roleMatches = walletData.dcRole?.match(/"([^"]+)"/g) || []
      discordRoles = roleMatches.map((match: string) => match.replace(/"/g, ""))

      // Check if eligible (has any mints allocated)
      const isEligible = walletData.allowedMintsGTD > 0 || walletData.allowedMintsFCFS > 0

      // Check if the wallet is linked with the provided Discord ID
      const isLinked = discordId && walletData.dcId === discordId

      // Prepare response data
      const responseData = {
        address: walletData.address,
        mintAmountsGTD: walletData.allowedMintsGTD || 0,
        mintAmountsFCFS: walletData.allowedMintsFCFS || 0,
        dcRoles: discordRoles,
        dcId: walletData.dcId,
        roleAssigned: false,
        message: "",
        eligible: isEligible,
        isLinked: isLinked,
      }

      // Assign Discord roles if Discord ID is available
      if (walletData.dcId && discordRoles.length > 0 && discordBotToken) {
        try {
          // Map role names to Discord role IDs (you would need to maintain this mapping)
          const roleMapping: Record<string, string> = {
            FOGCHAN: "123456789012345678", // Replace with actual Discord role IDs
            FLASHCHAN: "123456789012345679",
            // Add more role mappings as needed
          }

          // Get Discord role IDs to assign
          const roleIds = discordRoles.map((role) => roleMapping[role]).filter((id) => id !== undefined)

          if (roleIds.length > 0) {
            // Assign roles using Discord API
            const assignmentResults = await Promise.all(
              roleIds.map(async (roleId) => {
                try {
                  const response = await fetch(
                    `https://discord.com/api/v10/guilds/${discordServerId}/members/${walletData.dcId}/roles/${roleId}`,
                    {
                      method: "PUT",
                      headers: {
                        Authorization: `Bot ${discordBotToken}`,
                        "Content-Type": "application/json",
                      },
                    },
                  )

                  return {
                    roleId,
                    success: response.ok,
                    status: response.status,
                  }
                } catch (error) {
                  console.error(`Error assigning role ${roleId}:`, error)
                  return {
                    roleId,
                    success: false,
                    error: error instanceof Error ? error.message : "Unknown error",
                  }
                }
              }),
            )

            const allSuccessful = assignmentResults.every((result) => result.success)
            responseData.roleAssigned = allSuccessful
            responseData.message = allSuccessful
              ? "Discord roles assigned successfully"
              : "Some Discord roles could not be assigned"
          } else {
            responseData.message = "No mappable Discord roles found"
          }
        } catch (error) {
          console.error("Error in Discord role assignment:", error)
          responseData.message = "Error assigning Discord roles"
        }
      } else if (!walletData.dcId) {
        responseData.message = "No Discord ID associated with this wallet"
      } else if (discordRoles.length === 0) {
        responseData.message = "No Discord roles to assign"
      } else if (!discordBotToken) {
        responseData.message = "Discord bot token not configured"
      }

      return NextResponse.json(responseData)
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

