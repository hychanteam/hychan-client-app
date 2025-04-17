export const getRequiredChain = () => {
    const isProd = process.env.NEXT_PUBLIC_ENV === 'production';
  
    if (isProd) {
      return {
        chainId: '0x3e7', // 999 in hex
        chainName: 'Hyperliquid Mainnet',
        nativeCurrency: {
          name: 'HYPE',
          symbol: 'HYPE',
          decimals: 18,
        },
        rpcUrls: ['https://rpc.hyperliquid.xyz/evm'],
        blockExplorerUrls: [],
      };
    } else {
      return {
        chainId: '0x3e6', // 998 in hex
        chainName: 'Hyperliquid Testnet',
        nativeCurrency: {
          name: 'HYPE',
          symbol: 'HYPE',
          decimals: 18,
        },
        rpcUrls: ['https://rpc.hyperliquid-testnet.xyz/evm'],
        blockExplorerUrls: [],
      };
    }
  };