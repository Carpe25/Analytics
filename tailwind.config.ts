import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: ["class"],
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        background: "#F5F7F8",
        foreground: "#17212B",
        card: {
          DEFAULT: "#F5F7F8",
          foreground: "#17212B",
        },
        popover: {
          DEFAULT: "#F5F7F8",
          foreground: "#17212B",
        },
        primary: {
          DEFAULT: "#17212B",
          foreground: "#F5F7F8",
        },
        secondary: {
          DEFAULT: "#F5F7F8",
          foreground: "#17212B",
        },
        muted: {
          DEFAULT: "rgba(23, 33, 43, 0.08)",
          foreground: "rgba(23, 33, 43, 0.65)",
        },
        accent: {
          DEFAULT: "rgba(23, 33, 43, 0.06)",
          foreground: "#17212B",
        },
        destructive: {
          DEFAULT: "#17212B",
          foreground: "#F5F7F8",
        },
        border: "rgba(23, 33, 43, 0.15)",
        input: "rgba(23, 33, 43, 0.15)",
        ring: "#17212B",
      },
      fontFamily: {
        sans: ["Inter", "-apple-system", "BlinkMacSystemFont", "sans-serif"],
      },
    },
  },
  plugins: [],
};
export default config;
