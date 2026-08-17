/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        canvas: {
          DEFAULT: '#16171C',
          chrome: '#131418',
        },
        background: {
          DEFAULT: '#16171C',
          secondary: '#131418',
          tertiary: '#1A1B20',
        },
        panel: {
          DEFAULT: '#1B1C22',
          elevated: '#20222A',
          highlight: '#282A34',
          hover: '#252730',
          subtle: '#14151A',
        },
        well: {
          DEFAULT: '#111216',
          secondary: '#14151A',
          subtle: '#17181F',
        },
        border: {
          DEFAULT: '#2B2D37',
          subtle: '#22242C',
          hover: '#383B48',
          active: '#484C5C',
          highlight: '#5A5F73',
        },
        text: {
          primary: '#F3F4F8',
          secondary: '#C0C4D2',
          muted: '#84899A',
          dim: '#5A5E6E',
        },
        accent: {
          DEFAULT: '#FFFFFF',
          hover: '#FFFFFF',
          dark: '#111216',
          muted: 'rgba(255, 255, 255, 0.08)',
          border: 'rgba(255, 255, 255, 0.20)',
          glow: 'rgba(255, 255, 255, 0.12)',
        },
        status: {
          success: '#10B981',
          warning: '#F59E0B',
          error: '#EF4444',
          info: '#9CA3AF',
        },
      },
      fontFamily: {
        sans: ['Inter', '-apple-system', 'BlinkMacSystemFont', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'SFMono-Regular', 'Menlo', 'monospace'],
      },
      borderRadius: {
        panel: '8px',
        btn: '5px',
        badge: '4px',
        input: '5px',
      },
      boxShadow: {
        'subtle': '0 1px 2px 0 rgba(0, 0, 0, 0.3)',
        'panel': 'inset 0 1px 0 rgba(255, 255, 255, 0.05), 0 4px 16px -2px rgba(0, 0, 0, 0.4), 0 1px 3px rgba(0, 0, 0, 0.25)',
        'elevated': 'inset 0 1px 0 rgba(255, 255, 255, 0.08), 0 12px 36px -4px rgba(0, 0, 0, 0.6), 0 4px 12px rgba(0, 0, 0, 0.35)',
        'dock': '0 -2px 10px rgba(0, 0, 0, 0.3)',
        'well': 'inset 0 2px 4px rgba(0, 0, 0, 0.35)',
      },
    },
  },
  plugins: [],
}
