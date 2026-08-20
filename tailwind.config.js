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
          DEFAULT: 'var(--bg-canvas, #0b0c0e)',
          chrome: 'var(--bg-chrome, #101114)',
        },
        background: {
          DEFAULT: 'var(--bg-canvas, #0b0c0e)',
          secondary: 'var(--bg-chrome, #101114)',
          tertiary: 'var(--bg-well, #060709)',
        },
        panel: {
          DEFAULT: 'var(--bg-panel, rgba(18, 19, 23, 0.88))',
          elevated: 'var(--bg-panel-elevated, rgba(24, 25, 30, 0.95))',
          highlight: 'var(--bg-panel-hover, rgba(34, 36, 44, 0.7))',
          hover: 'var(--bg-panel-hover, rgba(34, 36, 44, 0.7))',
          subtle: 'var(--bg-well, #060709)',
        },
        well: {
          DEFAULT: 'var(--bg-well, #060709)',
          secondary: 'var(--bg-well-secondary, #0a0b0d)',
          subtle: 'var(--bg-canvas, #0b0c0e)',
        },
        border: {
          DEFAULT: 'var(--border-base, rgba(255, 255, 255, 0.1))',
          subtle: 'var(--border-subtle, rgba(255, 255, 255, 0.06))',
          hover: 'var(--border-hover, rgba(255, 255, 255, 0.2))',
          active: 'var(--border-active, rgba(255, 255, 255, 0.4))',
          highlight: 'var(--border-highlight, rgba(255, 255, 255, 0.7))',
        },
        text: {
          primary: 'var(--text-primary, #EDEDED)',
          secondary: 'var(--text-secondary, #B4B7C4)',
          muted: 'var(--text-muted, #7A7E8F)',
          dim: 'var(--text-dim, #4E5262)',
        },
        accent: {
          DEFAULT: 'var(--accent-primary, #10b981)',
          hover: 'var(--accent-primary, #10b981)',
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
