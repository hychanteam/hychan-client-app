import { type NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"

// Initialize Supabase client
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ""
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || ""
const supabase = createClient(supabaseUrl, supabaseServiceKey)

export async function POST(request: NextRequest) {
  try {
    const { walletAddress, fetchAll } = await request.json()

    // If fetchAll is true, return all whitelist data for Merkle tree generation
    if (fetchAll) {
      const { data, error } = await supabase
        .from("master_hype_evm_wallet_mint_details")
        .select("address, allowedMintsGTD, allowedMintsFCFS")
        .not("allowedMintsGTD", "eq", 0)
        .not("allowedMintsFCFS", "eq", 0)

      if (error) {
        console.error("Database query error:", error)
        return NextResponse.json({ error: "Failed to fetch whitelist data" }, { status: 500 })
      }

      // Return all whitelist data
      return NextResponse.json({
        allWhitelistData: data || [],
      })
    }

    // Otherwise, fetch data for a specific wallet
    if (!walletAddress) {
      return NextResponse.json({ error: "Wallet address is required" }, { status: 400 })
    }

    // Query the database for the wallet address
    const { data, error } = await supabase
      .from("master_hype_evm_wallet_mint_details")
      .select("address, allowedMintsGTD, allowedMintsFCFS, dcRole, dcId")
      .eq("address", walletAddress.toLowerCase())
      .single()

    if (error) {
      console.error("Database query error:", error)
      return NextResponse.json({ error: "Failed to fetch whitelist data" }, { status: 500 })
    }

    // If no data found, return empty values
    if (!data) {
      return NextResponse.json({
        address: walletAddress,
        allowedMintsGTD: 0,
        allowedMintsFCFS: 0,
        dcRole: null,
        dcId: null,
        isWhitelisted: false,
      })
    }

    // Return the whitelist data
    return NextResponse.json({
      ...data,
      isWhitelisted: data.allowedMintsGTD > 0 || data.allowedMintsFCFS > 0,
    })
  } catch (error) {
    console.error("API error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

