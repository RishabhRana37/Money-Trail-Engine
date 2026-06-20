/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        aura: {
          bg: "#0B0E14",
          panel: "#161B22",
          panelLight: "#21262D",
          border: "#30363D",
          accent: "#00F0FF",
          indigo: "#6366F1",
          textMuted: "#8B949E",
          textLight: "#C9D1D9",
          low: "#3FB950",
          medium: "#D29922",
          high: "#F0883E",
          critical: "#F85149",
        }
      },
      fontFamily: {
        mono: ['JetBrains Mono', 'monospace'],
        sans: ['Inter', 'Outfit', 'sans-serif'],
      }
    },
  },
  plugins: [],
}
