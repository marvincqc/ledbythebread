/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: "#8B5E3C",
          light: "#A67C5B",
          dark: "#6B4423",
        },
        accent: {
          DEFAULT: "#F4A261",
          light: "#F7BC8A",
          dark: "#D4823C",
        },
        background: "#FFF8F0",
        "text-main": "#3E2723",
        "text-muted": "#7A5C52",
        success: "#4CAF50",
        error: "#D32F2F",
        warning: "#FF9800",
      },
      fontFamily: {
        heading: ['"Playfair Display"', "Georgia", "serif"],
        body: ["Inter", "system-ui", "sans-serif"],
      },
      borderRadius: {
        button: "8px",
        card: "12px",
      },
      screens: {
        xs: "375px",
      },
    },
  },
  plugins: [],
};
