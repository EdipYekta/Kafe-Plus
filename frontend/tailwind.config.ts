/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    screens: {
      'xs': '380px',
      'sm': '640px',
      'md': '768px',
      'lg': '1024px',
      'xl': '1280px',
      '2xl': '1536px',
    },
    extend: {
      fontFamily: { sans: ['Inter', 'sans-serif'] },

      colors: {
        brand: {
          DEFAULT: '#f97316',
          dark: '#ea6c0a',
          light: '#fdba74',
        },
        surface: {
          1: '#0f0f13',
          2: '#1a1a24',
          3: '#222230',
          4: '#2a2a3a',
        },
      },
      animation: {
        'slide-up': 'slide-up 0.3s ease-out',
        'fade-in': 'fade-in 0.2s ease-out',
        'pulse-ring': 'pulse-ring 2s infinite',
        'spin-slow': 'spin 3s linear infinite',
      },
      keyframes: {
        'slide-up': {
          from: { opacity: 0, transform: 'translateY(20px)' },
          to: { opacity: 1, transform: 'translateY(0)' },
        },
        'fade-in': {
          from: { opacity: 0 },
          to: { opacity: 1 },
        },
        'pulse-ring': {
          '0%': { transform: 'scale(0.95)', boxShadow: '0 0 0 0 rgba(249,115,22,0.4)' },
          '70%': { transform: 'scale(1)', boxShadow: '0 0 0 10px rgba(249,115,22,0)' },
          '100%': { transform: 'scale(0.95)' },
        },
      },
      backdropBlur: { xs: '2px' },
    },
  },
  plugins: [],
}
