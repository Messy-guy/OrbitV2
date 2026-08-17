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
        background: {
          DEFAULT: '#090A0C',
          secondary: '#0E1013',
          tertiary: '#131519',
        },
        panel: {
          DEFAULT: '#121418',
          elevated: '#171A20',
          hover: '#1D2128',
          subtle: '#0E1013',
        },
        border: {
          DEFAULT: '#22262E',
          subtle: '#181B20',
          hover: '#323844',
          active: '#4A5263',
        },
        text: {
          primary: '#F3F4F6',
          secondary: '#9CA3AF',
          muted: '#64748B',
          dim: '#475569',
        },
        accent: {
          DEFAULT: '#4F6BFF',
          hover: '#637DFF',
          muted: 'rgba(79, 107, 255, 0.12)',
          border: 'rgba(79, 107, 255, 0.28)',
          glow: 'rgba(79, 107, 255, 0.2)',
        },
        brand: {
          amber: '#F59E0B',
          emerald: '#10B981',
          cyan: '#06B6D4',
          indigo: '#4F6BFF',
          rose: '#F43F5E',
        },
        status: {
          success: '#10B981',
          warning: '#F59E0B',
          error: '#EF4444',
          info: '#3B82F6',
        },
      },
      fontFamily: {
        sans: ['Inter', '-apple-system', 'BlinkMacSystemFont', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'SFMono-Regular', 'Menlo', 'monospace'],
      },
      borderRadius: {
        panel: '8px',
        btn: '6px',
        badge: '4px',
        input: '6px',
      },
      boxShadow: {
        'subtle': '0 1px 2px 0 rgba(0, 0, 0, 0.4)',
        'panel': '0 4px 16px -2px rgba(0, 0, 0, 0.5), 0 0 0 1px rgba(255, 255, 255, 0.04)',
        'elevated': '0 12px 32px -4px rgba(0, 0, 0, 0.7), 0 0 0 1px rgba(255, 255, 255, 0.06)',
        'dock': '0 -4px 16px rgba(0, 0, 0, 0.4)',
      },
    },
  },
  plugins: [],
}
