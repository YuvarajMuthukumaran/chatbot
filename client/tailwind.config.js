/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      colors: {
        sage: {
          50: "#f4f7f4",
          100: "#e6ede6",
          200: "#cfdecf",
          300: "#adc6ad",
          400: "#87a888",
          500: "#688c6a",
          600: "#516f53",
          700: "#425a44",
          800: "#374939",
          900: "#2f3d30",
        },
        teal: {
          50: "#f1f8f8",
          100: "#dcedee",
          200: "#bcdadd",
          300: "#8fbfc4",
          400: "#5fa0a7",
          500: "#43848c",
          600: "#376a72",
          700: "#31575e",
          800: "#2c474f",
          900: "#273c43",
        },
        lavender: {
          50: "#f6f5fa",
          100: "#ece9f5",
          200: "#dad4ec",
          300: "#c0b5dd",
          400: "#a390c9",
          500: "#8a71b4",
          600: "#73599c",
          700: "#5f4980",
          800: "#4f3d69",
          900: "#433458",
        },
        cream: "#fbf8f3",
        crisis: {
          DEFAULT: "#c23b32",
          dark: "#9c2e27",
        },
      },
      fontFamily: {
        sans: ["Inter", "Nunito", "system-ui", "sans-serif"],
      },
      borderRadius: {
        xl2: "1.25rem",
      },
      keyframes: {
        breathe: {
          "0%, 100%": { transform: "scale(1)" },
          "50%": { transform: "scale(1.06)" },
        },
        fadeSlideIn: {
          from: { opacity: 0, transform: "translateY(6px)" },
          to: { opacity: 1, transform: "translateY(0)" },
        },
      },
      animation: {
        breathe: "breathe 3.2s ease-in-out infinite",
        "fade-slide-in": "fadeSlideIn 0.35s ease-out",
      },
    },
  },
  plugins: [],
};
