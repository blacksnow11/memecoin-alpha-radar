/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        cyber: {
          bg: "#06080F",
          card: "#0C111C",
          cardHover: "#131B2E",
          border: "#1E293B",
          borderHighlight: "#334155",
          accent: "#38BDF8",
          emerald: "#10B981",
          emeraldGlow: "#059669",
          crimson: "#F43F5E",
          amber: "#F59E0B",
          purple: "#8B5CF6",
          solana: "#9945FF",
          base: "#0052FF",
          eth: "#627EEA",
          bsc: "#F3BA2F",
        },
      },
      fontFamily: {
        mono: ['ui-monospace', 'SFMono-Regular', 'Menlo', 'Monaco', 'Consolas', 'monospace'],
      },
      animation: {
        'pulse-subtle': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'glow-emerald': 'glowEmerald 2s ease-in-out infinite alternate',
      },
      keyframes: {
        glowEmerald: {
          '0%': { boxShadow: '0 0 5px rgba(16, 185, 129, 0.2)' },
          '100%': { boxShadow: '0 0 15px rgba(16, 185, 129, 0.6)' },
        }
      }
    },
  },
  plugins: [],
};
