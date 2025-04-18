import { type NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"
import { readWhitelistCSV } from "@/lib/utils"
import path from "path"
import { generateMerkleProof, generateMerkleTree } from "@/lib/merkle"

// Initialize Supabase client
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ""
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || ""
const supabase = createClient(supabaseUrl, supabaseServiceKey)

export async function POST(request: NextRequest) {
  try {
    const { walletAddress, getProofOnly, phaseIndex } = await request.json()

    // If getProofOnly is true, return only the merkle proof
    if (getProofOnly) {
      try {
        const filePath = path.join(process.cwd(), "files", "eligibles.csv")
        const { GTDEntries, FCFSEntries } = readWhitelistCSV(filePath)
  
        const selectedEntries =
          phaseIndex === 0 ? GTDEntries : FCFSEntries
  
        const filteredEntries = selectedEntries.filter(
          (entry) => entry.allowedMints > 0,
        )
  
        const userEntry = filteredEntries.find(
          (entry) => entry.address.toLowerCase() === walletAddress.toLowerCase()
        )
  
        if (!userEntry) {
          return NextResponse.json(
            { error: "Wallet not found in whitelist" },
            { status: 404 }
          )
        }
  
        const merkleTree = generateMerkleTree(filteredEntries)
        const proof = generateMerkleProof(userEntry, merkleTree)
  
        return NextResponse.json({
          address: userEntry.address,
          allowedMints: userEntry.allowedMints,
          merkleProof: proof,
        })
      } catch (error) {
        console.error("Error generating Merkle proof:", error)
        return NextResponse.json(
          { error: "Failed to generate Merkle proof" },
          { status: 400 }
        )
      }
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
      return NextResponse.json({ error: "Failed to fetch whitelist data" }, { status: 400 })
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

