/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: ['./src/renderer/index.html', './src/renderer/src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // Surfaces
        bg: 'rgb(var(--bg) / <alpha-value>)',
        'bg-elevated': 'rgb(var(--bg-elevated) / <alpha-value>)',
        surface: 'rgb(var(--surface) / <alpha-value>)',
        'surface-2': 'rgb(var(--surface-2) / <alpha-value>)',
        'surface-hover': 'rgb(var(--surface-hover) / <alpha-value>)',
        border: 'rgb(var(--border) / <alpha-value>)',
        'border-strong': 'rgb(var(--border-strong) / <alpha-value>)',
        // Text
        fg: 'rgb(var(--fg) / <alpha-value>)',
        'fg-muted': 'rgb(var(--fg-muted) / <alpha-value>)',
        'fg-subtle': 'rgb(var(--fg-subtle) / <alpha-value>)',
        // Accent (sky -> cyan "cloud" gradient, on a slate base)
        accent: 'rgb(var(--accent) / <alpha-value>)',
        'accent-hover': 'rgb(var(--accent-hover) / <alpha-value>)',
        'accent-fg': 'rgb(var(--accent-fg) / <alpha-value>)',
        'accent-soft': 'rgb(var(--accent-soft) / <alpha-value>)',
        violet: 'rgb(var(--violet) / <alpha-value>)',
        // Semantic
        ok: 'rgb(var(--ok) / <alpha-value>)',
        'ok-soft': 'rgb(var(--ok-soft) / <alpha-value>)',
        warn: 'rgb(var(--warn) / <alpha-value>)',
        'warn-soft': 'rgb(var(--warn-soft) / <alpha-value>)',
        error: 'rgb(var(--error) / <alpha-value>)',
        'error-soft': 'rgb(var(--error-soft) / <alpha-value>)',
        info: 'rgb(var(--info) / <alpha-value>)',
        'info-soft': 'rgb(var(--info-soft) / <alpha-value>)'
      },
      fontFamily: {
        sans: [
          'Inter',
          'system-ui',
          '-apple-system',
          'BlinkMacSystemFont',
          'Segoe UI',
          'Roboto',
          'Helvetica Neue',
          'Arial',
          'sans-serif'
        ],
        mono: ['ui-monospace', 'SFMono-Regular', 'Menlo', 'Consolas', 'Liberation Mono', 'monospace']
      },
      borderRadius: {
        xl: '0.875rem',
        '2xl': '1.125rem'
      },
      boxShadow: {
        card: '0 1px 2px 0 rgb(0 0 0 / 0.06), 0 1px 3px 0 rgb(0 0 0 / 0.10)',
        elevated: '0 4px 12px -2px rgb(0 0 0 / 0.18), 0 2px 6px -2px rgb(0 0 0 / 0.12)',
        glow: '0 0 0 1px rgb(var(--accent) / 0.25), 0 8px 30px -6px rgb(var(--accent) / 0.35)'
      },
      transitionTimingFunction: {
        smooth: 'cubic-bezier(0.4, 0, 0.2, 1)'
      },
      keyframes: {
        'fade-in': {
          from: { opacity: '0', transform: 'translateY(4px)' },
          to: { opacity: '1', transform: 'translateY(0)' }
        },
        shimmer: { '100%': { transform: 'translateX(100%)' } }
      },
      animation: {
        'fade-in': 'fade-in 0.24s cubic-bezier(0.4, 0, 0.2, 1)',
        shimmer: 'shimmer 1.6s infinite'
      }
    }
  },
  plugins: []
}
