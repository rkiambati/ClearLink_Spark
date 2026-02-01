import type { Config } from "tailwindcss";

export default {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./lib/**/*.{js,ts,jsx,tsx,mdx}",
    "./prisma/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        spark: {
          mint: "#B0D1B2",
          navy: "#2D479E",
          ink: "#0B1220",
          fog: "#F5F7FB",
          stroke: "rgba(45,71,158,0.14)",
          strokeStrong: "rgba(45,71,158,0.20)",
        },
      },
      boxShadow: {
        soft: "0 10px 30px rgba(10, 20, 40, 0.12)",
        lift: "0 14px 40px rgba(10, 20, 40, 0.18)",
        glowMint:
          "0 0 0 1px rgba(176,209,178,0.40), 0 18px 60px rgba(176,209,178,0.22)",
        glowNavy:
          "0 0 0 1px rgba(45,71,158,0.28), 0 18px 60px rgba(45,71,158,0.18)",
        glowRed:
          "0 0 0 1px rgba(239,68,68,0.34), 0 18px 70px rgba(239,68,68,0.22)",
        glowAmber:
          "0 0 0 1px rgba(245,158,11,0.34), 0 18px 70px rgba(245,158,11,0.18)",
        glowSky:
          "0 0 0 1px rgba(45,71,158,0.22), 0 18px 60px rgba(45,71,158,0.14)",
      },
      borderRadius: {
        xl: "16px",
        "2xl": "22px",
        "3xl": "28px",
      },
    },
  },
  plugins: [],
} satisfies Config;
