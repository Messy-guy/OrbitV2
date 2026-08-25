/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./app/**/*.{js,jsx,ts,tsx}",
    "./src/**/*.{js,jsx,ts,tsx}",
  ],
  presets: [require("nativewind/preset")],
  theme: {
    extend: {
      colors: {
        orbit: {
          canvas: '#08090C',
          chrome: '#0D0F15',
          card: '#12141C',
          elevated: '#171A24',
          border: 'rgba(255, 255, 255, 0.08)',
          borderHover: 'rgba(255, 255, 255, 0.16)',
          accent: '#10B981',
          accentGlow: 'rgba(16, 185, 129, 0.15)',
        },
      },
    },
  },
  plugins: [],
};
