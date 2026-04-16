import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./lib/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        ink: "#111827",
        fog: "#f5f7fb",
        line: "#d7deea",
        accent: "#0f766e",
        accentSoft: "#dff5f2",
        amberSoft: "#fff1d6",
      },
      boxShadow: {
        panel: "0 20px 60px rgba(15, 23, 42, 0.08)",
      },
      fontFamily: {
        sans: ["ui-sans-serif", "system-ui", "sans-serif"],
      },
    },
  },
  plugins: [],
};

export default config;
