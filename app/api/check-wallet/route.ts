import { createClient } from "@supabase/supabase-js"
import { NextResponse } from "next/server"

// Update the Supabase client initialization with better error handling

// Environment variables should be set in your Vercel project
// or .env.local file (not committed to git)
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY

// Add this check to validate environment variables
if (!supabaseUrl || !supabaseKey) {
  console.error("Missing Supabase environment variables")
}

// Add a fallback for testing when environment variables aren't available

// Add this after the check for missing environment variables
// This will allow testing with addresses starting with 0x1 even if Supabase isn't configured
export async function POST(request: Request) {
  try {
    const { address } = await request.json()

    if (!address) {
      return NextResponse.json({ error: "Wallet address is required" }, { status: 400 })
    }

    // Check if environment variables are available
    if (!supabaseUrl || !supabaseKey) {
      console.warn("Supabase environment variables are not set, using test mode")

      // Test mode: addresses starting with 0x1 are eligible
      if (address.toLowerCase().startsWith("0x1")) {
        return NextResponse.json({
          eligible: true,
          message: "TEST MODE: Your wallet is eligible for minting.",
          data: {
            gtdMints: 2,
            fcfsMints: 1,
            discordRoles: ["FOGCHAN", "FLASHCHAN"],
          },
        })
      } else {
        return NextResponse.json({
          eligible: false,
          message: "TEST MODE: Your wallet is not on the allowlist for minting.",
        })
      }
    }

    // Initialize Supabase client
    const supabase = createClient(supabaseUrl, supabaseKey!, {
      auth: { persistSession: false }, // No session persistence on server
    })

    // Add a test query to verify connection
    try {
      // Query the database for the wallet address
      const { data, error } = await supabase
        .from("master_hype_evm_wallet_mint_details") // Replace with your actual table name
        .select("address, allowedMintsGTD, allowedMintsFCFS, dcRole")
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

      if (!data || data.length === 0) {
        return NextResponse.json({
          eligible: false,
          message: "Your wallet is not on the allowlist for minting.",
        })
      }

      // Use the first matching wallet if multiple were found
      const walletData = data[0]

      // Parse Discord roles from the string format ["ROLE1","ROLE2"]
      let discordRoles: string[] = []
      
      // If parsing fails, try to extract roles using regex
      const roleMatches = walletData.dcRole?.match(/"([^"]+)"/g) || []
      discordRoles = roleMatches.map((match:any) => match.replace(/"/g, ""))

      // Check if eligible (has any mints allocated)
      const isEligible = walletData.allowedMintsGTD > 0 || walletData.allowedMintsFCFS > 0

      return NextResponse.json({
        eligible: isEligible,
        message: isEligible
          ? "Congratulations! Your wallet is eligible for minting."
          : "Your wallet is not eligible for minting.",
        data: {
          gtdMints: walletData.allowedMintsGTD || 0,
          fcfsMints: walletData.allowedMintsFCFS || 0,
          discordRoles: discordRoles,
        },
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

