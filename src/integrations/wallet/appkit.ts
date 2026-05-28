/**
 * Reown AppKit initialization (EVM + Solana).
 *
 * Browser-only. Loaded once at app boot from AppKitProvider.
 * The Reown project ID is a publishable identifier — safe to expose to the
 * browser bundle as VITE_REOWN_PROJECT_ID.
 */
import { createAppKit } from "@reown/appkit/react";
import { WagmiAdapter } from "@reown/appkit-adapter-wagmi";
import { SolanaAdapter } from "@reown/appkit-adapter-solana";
import {
  mainnet,
  sepolia,
  solana,
  solanaDevnet,
} from "@reown/appkit/networks";

const projectId = import.meta.env.VITE_REOWN_PROJECT_ID as string | undefined;

// Default to testnets unless the deployment opts in to mainnet via the build
// env var. Keeps preview/dev safe.
const useMainnet = import.meta.env.VITE_WALLET_NETWORK === "mainnet";

const evmNetworks = useMainnet ? [mainnet] : [sepolia];
const solanaNetworks = useMainnet ? [solana] : [solanaDevnet];

export const wagmiAdapter = new WagmiAdapter({
  networks: evmNetworks,
  projectId: projectId ?? "missing-reown-project-id",
  ssr: false,
});

export const solanaAdapter = new SolanaAdapter({});

let initialized = false;

export function initAppKit() {
  if (initialized) return;
  if (!projectId) {
    // Defer init silently; ConnectWalletButton will render a disabled state
    // until the env var is configured.
    return;
  }
  createAppKit({
    adapters: [wagmiAdapter, solanaAdapter],
    networks: [...evmNetworks, ...solanaNetworks],
    projectId,
    metadata: {
      name: "Open Trader",
      description: "Open-source crypto trading protocol",
      url:
        typeof window !== "undefined"
          ? window.location.origin
          : "https://opentrader.app",
      icons: ["/icon-512.png"],
    },
    features: {
      analytics: false,
      email: false,
      socials: false,
    },
    themeMode: "dark",
  });
  initialized = true;
}

export const isAppKitConfigured = !!projectId;
