import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"
import fs from "fs";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

// Helper to read CSV files into string[]
export function readWhitelistCSV(filePath: string): {
  GTDEntries: { address: string; allowedMints: number }[];
  FCFSEntries: { address: string; allowedMints: number }[];
} {
  const GTDEntries: { address: string; allowedMints: number }[] = [];
  const FCFSEntries: { address: string; allowedMints: number }[] = [];

  try {
    const data = fs.readFileSync(filePath, "utf8");

    const rows = data
      .split("\n")
      .map((line) => line.trim())
      .filter((line) => line.length > 0);

    const hasHeader = rows[0].toLowerCase().includes("address");
    const startIndex = hasHeader ? 1 : 0;

    for (let i = startIndex; i < rows.length; i++) {
      const [id, addressRaw, allowedMintsGTD, allowedMintsFCFS] = rows[i].split(",");

      const address = addressRaw?.trim().toLowerCase();
      const GTD = parseInt(allowedMintsGTD?.trim(), 10);
      const FCFS = parseInt(allowedMintsFCFS?.trim(), 10);

      if (!address || (!GTD && !FCFS)) {
        console.warn(`Skipping invalid or zero entry at line ${i + 1}: ${rows[i]}`);
        continue;
      }

      if (!isNaN(GTD) && GTD > 0) {
        GTDEntries.push({ address, allowedMints: GTD });
      }

      if (!isNaN(FCFS) && FCFS > 0) {
        FCFSEntries.push({ address, allowedMints: FCFS });
      }
    }

    return { GTDEntries, FCFSEntries };
  } catch (error) {
    console.error(`Failed to read ${filePath}:`, error);
    return { GTDEntries: [], FCFSEntries: [] };
  }
}