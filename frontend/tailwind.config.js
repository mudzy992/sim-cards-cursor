import colors from 'tailwindcss/colors';

/**
 * Dark-only theme.
 *
 * The app's pages already use Tailwind's `slate` scale (and a handful of
 * semantic colors like emerald/red/blue/amber) for backgrounds, text and
 * borders — e.g. `bg-slate-50`, `text-slate-900`, `bg-emerald-50` +
 * `text-emerald-700`. Rather than touching every page, we redefine those
 * scales so the *same* class names now resolve to a dark, Vercel/Linear-style
 * neutral palette. The ramp is intentionally "inverted" (50 = darkest,
 * 900 = lightest) so the existing semantic usage (50/100 = background,
 * 700/800/900 = strong text) keeps working correctly on a dark canvas.
 *
 * Print-only surfaces (shipment label preview) are intentionally scoped out
 * of this remap — see `.print-preview-scope` in src/styles/index.css.
 */

/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: [
          'Inter',
          'ui-sans-serif',
          'system-ui',
          '-apple-system',
          'Segoe UI',
          'Roboto',
          'sans-serif',
        ],
        mono: ['"JetBrains Mono"', 'ui-monospace', 'SFMono-Regular', 'monospace'],
      },
      colors: {
        // Inverted neutral ramp — near-black surfaces, near-white text.
        slate: {
          50: '#09090b',
          100: '#111114',
          200: '#1e1f24',
          300: '#2b2c33',
          400: '#6c6d76',
          500: '#9a9ba5',
          600: '#b7b8c1',
          700: '#d1d2d8',
          800: '#e7e7eb',
          900: '#f8f8fa',
        },
        // Semantic surface tokens used for the few literal `bg-white` cards.
        surface: {
          DEFAULT: '#131316',
          raised: '#18191d',
          sunken: '#0a0a0c',
        },
        // Primary brand/accent — used for links, active nav, primary actions.
        brand: {
          400: '#818cf8',
          500: '#6366f1',
          600: '#4f46e5',
          700: '#4338ca',
        },
        emerald: {
          ...colors.emerald,
          50: '#0b2b21',
          100: '#0f3a2c',
          200: '#1d5b44',
          700: '#6ee7b7',
          800: '#a7f3d0',
        },
        red: {
          ...colors.red,
          50: '#341015',
          100: '#43141a',
          200: '#7a2530',
          600: '#f87171',
          700: '#fca5a5',
          800: '#fecdd3',
        },
        amber: {
          ...colors.amber,
          50: '#332405',
          100: '#3f2c07',
          200: '#6b4e14',
          700: '#fcd34d',
          800: '#fde68a',
        },
        blue: {
          ...colors.blue,
          50: '#0c1c33',
          100: '#122548',
          600: '#60a5fa',
          700: '#93c5fd',
        },
      },
      boxShadow: {
        card: '0 1px 0 0 rgba(255,255,255,0.04) inset, 0 8px 24px -12px rgba(0,0,0,0.6)',
      },
    },
  },
  plugins: [],
};
