/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: [
          '"Inter Variable"',
          'Inter',
          'ui-sans-serif',
          'system-ui',
          '-apple-system',
          'Segoe UI',
          'Roboto',
          'sans-serif',
        ],
        mono: [
          '"JetBrains Mono Variable"',
          '"JetBrains Mono"',
          'ui-monospace',
          'SFMono-Regular',
          'monospace',
        ],
      },
      colors: {
        canvas: 'var(--bg-canvas)',
        surface: {
          DEFAULT: 'var(--bg-surface)',
          raised: 'var(--bg-surface-raised)',
          sunken: 'var(--bg-surface-sunken)',
          hover: 'var(--bg-surface-hover)',
        },
        fg: {
          primary: 'var(--text-primary)',
          secondary: 'var(--text-secondary)',
          muted: 'var(--text-muted)',
        },
        line: {
          subtle: 'var(--border-subtle)',
          DEFAULT: 'var(--border-default)',
          strong: 'var(--border-strong)',
        },
        accent: {
          DEFAULT: 'var(--accent-primary)',
          hover: 'var(--accent-hover)',
          foreground: 'var(--accent-on-primary)',
          fg: 'var(--accent-link)',
          link: 'var(--accent-link)',
          soft: 'var(--accent-soft-bg)',
          'soft-fg': 'var(--accent-soft-fg)',
        },
        status: {
          'success-bg': 'var(--status-success-bg)',
          'success-fg': 'var(--status-success-fg)',
          'success-border': 'var(--status-success-border)',
          'warning-bg': 'var(--status-warning-bg)',
          'warning-fg': 'var(--status-warning-fg)',
          'warning-border': 'var(--status-warning-border)',
          'danger-bg': 'var(--status-danger-bg)',
          'danger-fg': 'var(--status-danger-fg)',
          'danger-border': 'var(--status-danger-border)',
          'info-bg': 'var(--status-info-bg)',
          'info-fg': 'var(--status-info-fg)',
          'info-border': 'var(--status-info-border)',
          'neutral-bg': 'var(--status-neutral-bg)',
          'neutral-fg': 'var(--status-neutral-fg)',
          'neutral-border': 'var(--status-neutral-border)',
        },
      },
      borderColor: {
        subtle: 'var(--border-subtle)',
        default: 'var(--border-default)',
        strong: 'var(--border-strong)',
      },
      boxShadow: {
        card: 'var(--shadow-card)',
        elevated: 'var(--shadow-elevated)',
      },
    },
  },
  plugins: [],
};
