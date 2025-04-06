/* eslint-disable @typescript-eslint/no-explicit-any */

// Add TypeScript declarations for window.ethereum
interface Window {
  ethereum?: {
    isMetaMask?: boolean
    request: (request: { method: string; params?: any[] }) => Promise<any>
    on: (eventName: string, callback: (...args: any[]) => void) => void
    removeListener: (eventName: string, callback: (...args: any[]) => void) => void
  }
}

/* eslint-enable @typescript-eslint/no-explicit-any */
