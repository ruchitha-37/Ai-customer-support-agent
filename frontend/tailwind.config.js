/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          dark: "#0C0D0F",         // Deep Obsidian Black
          card: "#141618",         // Rich Charcoal
          border: "#252830",       // Muted Graphite
          accent: "#D97706",       // Warm Amber Gold
          accentLight: "#FCD34D",  // Soft Golden Yellow
          teal: "#0D9488",         // Deep Teal
          tealLight: "#2DD4BF",    // Aqua Teal
          success: "#059669",      // Emerald Green
          danger: "#DC2626",       // Vivid Crimson Red
          warning: "#B45309",      // Deep Burnt Amber
          textPrimary: "#F5F5F4",  // Warm White
          textSecondary: "#A8A29E" // Warm Gray
        }
      },
      fontFamily: {
        sans: ['Outfit', 'Inter', 'sans-serif'],
      },
      animation: {
        'pulse-subtle': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'fade-in': 'fadeIn 0.3s ease-out forwards',
        'slide-up': 'slideUp 0.4s ease-out forwards',
        'glow': 'glow 2s ease-in-out infinite alternate',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        slideUp: {
          '0%': { transform: 'translateY(12px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
        glow: {
          '0%': { boxShadow: '0 0 5px rgba(217,119,6,0.3)' },
          '100%': { boxShadow: '0 0 20px rgba(217,119,6,0.6)' },
        }
      }
    },
  },
  plugins: [],
}
