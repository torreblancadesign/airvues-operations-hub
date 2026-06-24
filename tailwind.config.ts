import type { Config } from "tailwindcss";

// Operational dashboard — DARK theme.
const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        // Surfaces
        bg: {
          DEFAULT: "#0B0F17",
          elevated: "#131825",
        },
        surface: {
          DEFAULT: "#161C2A",
          2: "#1A2030",
        },
        sidebar: "#0D121C",
        paper: "#0B0F17", // alias for legacy refs

        // Ink
        ink: {
          DEFAULT: "#E8ECF2",
          strong: "#F8FAFC",
          muted: "#A3ADBD",
          faint: "#6B7585",
        },

        // Rules
        rule: {
          DEFAULT: "#26303F",
          soft: "#1A2030",
          strong: "#34405A",
        },

        // Brand
        navy: {
          DEFAULT: "#2B4257",
          deep: "#1A2A38",
          soft: "rgba(43, 66, 87, 0.18)",
        },

        // Semantic accents
        emerald: {
          DEFAULT: "#22D3A8",
          soft: "rgba(34, 211, 168, 0.10)",
        },
        red: {
          DEFAULT: "#FB7185",
          soft: "rgba(251, 113, 133, 0.10)",
        },
        amber: {
          DEFAULT: "#FBBF24",
          soft: "rgba(251, 191, 36, 0.10)",
        },
        sky: {
          DEFAULT: "#7DD3FC",
          soft: "rgba(125, 211, 252, 0.10)",
        },
        violet: {
          DEFAULT: "#C4B5FD",
          soft: "rgba(196, 181, 253, 0.10)",
        },

        // Signal aliases (legacy refs)
        signal: {
          up: "#22D3A8",
          down: "#FB7185",
          warn: "#FBBF24",
        },

        // Legacy aliases for any unmigrated code
        card: "#161C2A",
        accent: "#22D3A8",
      },
      fontFamily: {
        sans: ["var(--font-sans)", "-apple-system", "system-ui", "sans-serif"],
        display: ["var(--font-display)", "Georgia", "serif"],
        mono: ["var(--font-mono)", "ui-monospace", "monospace"],
      },
      borderRadius: {
        card: "10px",
      },
      boxShadow: {
        card: "0 1px 2px rgba(0,0,0,0.4)",
      },
    },
  },
  plugins: [],
};

export default config;
