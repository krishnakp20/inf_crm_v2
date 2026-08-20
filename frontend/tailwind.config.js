/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        brand: {
          50: "#f9f0f7",
          100: "#eed5e9",
          200: "#d8a0ce",
          500: "#bf60ad",
          600: "#a92b92",
          700: "#872275",
        },
        ink: "#17151f",
        surface: "#f7f6f3",
        muted: "#6e6a76",
      },
      fontFamily: {
        sans: ["Arial", "Helvetica", "sans-serif"],
      },
      borderRadius: {
        card: "13px",
      },
      boxShadow: {
        card: "0 2px 8px 0 rgba(23, 21, 31, 0.024)",
      },
    },
  },
  plugins: [],
};
