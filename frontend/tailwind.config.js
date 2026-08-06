/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        brand: {
          50: "#f4f4ff",
          100: "#eeedff",
          500: "#7a7bec",
          600: "#5b5ce2",
          700: "#4749c9",
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
