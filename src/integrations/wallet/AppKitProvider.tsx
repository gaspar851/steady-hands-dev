import { type ReactNode, useEffect } from "react";
import { WagmiProvider } from "wagmi";
import { initAppKit, wagmiAdapter } from "./appkit";

/**
 * Wraps the app with the WagmiProvider required by Reown AppKit's EVM
 * adapter and triggers AppKit initialization on the client.
 */
export function AppKitProvider({ children }: { children: ReactNode }) {
  useEffect(() => {
    initAppKit();
  }, []);

  // wagmiAdapter.wagmiConfig is constructed at module load; safe to use.
  return (
    <WagmiProvider config={wagmiAdapter.wagmiConfig as never}>
      {children}
    </WagmiProvider>
  );
}
