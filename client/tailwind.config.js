/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        // ภาษาไทยและ UI ทั่วไปใช้ Google Font: Sarabun
        sans: ['Sarabun', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto', 'sans-serif'],
        // ตัวเลขการเงิน, Slip, ยอดเงิน Co-pay ใช้ JetBrains Mono ตามกฎ Coinbase Mono
        mono: ['"JetBrains Mono"', 'monospace'],
      },
      colors: {
        // Coinbase-inspired Fintech Palette
        brand: {
          blue: '#0052ff',
          'blue-hover': '#003ecc',
          'blue-light': '#eef2ff',
        },
        ink: {
          DEFAULT: '#0a0b0d',
          body: '#5b616e',
          muted: '#7c828a',
        },
        surface: {
          canvas: '#ffffff',
          soft: '#f7f7f7',
          dark: '#0a0b0d',
          'dark-card': '#16181c',
        },
        hairline: {
          DEFAULT: '#dee1e6',
          soft: '#eef0f3',
        },
        status: {
          success: '#05b169',
          error: '#cf202f',
          warning: '#f4b000',
        },
      },
      borderRadius: {
        pill: '100px', // กฎ Pill Geometry ตาม Coinbase Design System
        card: '24px',  // กฎ Card Radius 24px
      },
    },
  },
  plugins: [],
}
