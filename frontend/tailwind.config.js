/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  darkMode: "class",
  theme: {
    extend: {
      fontFamily: {
        sans: ["DM Sans", "system-ui", "sans-serif"],
        display: ["Syne", "DM Sans", "system-ui", "sans-serif"],
      },
      colors: {
        surface: {
          DEFAULT: "#0c0c0e",
          raised: "#141417",
          border: "rgba(255,255,255,0.08)",
        },
      },
      boxShadow: {
        soft: "0 8px 32px rgba(0,0,0,0.45)",
      },
      keyframes: {
        fadeIn: {
          "0%": { opacity: "0", transform: "translateY(6px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
      },
      animation: {
        fadeIn: "fadeIn 0.35s ease-out forwards",
      },
    },
  },
  plugins: [],
};
