import type { Config } from 'tailwindcss'

// Every semantic token below resolves through a CSS variable (see
// style.css :root / html.dark), so existing usage across the app — bg-paper,
// text-ink, border-line, bg-accent-soft, bg-liturgi-hijau-soft, and so on —
// picks up dark-mode values automatically. No component needed a `dark:`
// variant added; the tokens themselves are theme-aware.
function withOpacity(cssVar: string) {
  return `rgb(var(${cssVar}) / <alpha-value>)`
}

export default {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{vue,ts}'],
  theme: {
    extend: {
      colors: {
        paper: withOpacity('--color-paper'),
        'paper-deep': withOpacity('--color-paper-deep'),
        surface: withOpacity('--color-surface'),
        ink: withOpacity('--color-ink'),
        muted: withOpacity('--color-muted'),
        line: withOpacity('--color-line'),
        accent: {
          DEFAULT: withOpacity('--color-accent'),
          hover: withOpacity('--color-accent-hover'),
          soft: withOpacity('--color-accent-soft'),
          line: withOpacity('--color-accent-line'),
        },
        gold: {
          DEFAULT: withOpacity('--color-gold'),
          soft: withOpacity('--color-gold-soft'),
        },
        danger: withOpacity('--color-danger'),
        // liturgical season colours — used to tint the reading experience
        // to match the day's warnaLiturgi, so each week reads distinctly
        liturgi: {
          hijau: withOpacity('--color-liturgi-hijau'),
          'hijau-soft': withOpacity('--color-liturgi-hijau-soft'),
          ungu: withOpacity('--color-liturgi-ungu'),
          'ungu-soft': withOpacity('--color-liturgi-ungu-soft'),
          merah: withOpacity('--color-liturgi-merah'),
          'merah-soft': withOpacity('--color-liturgi-merah-soft'),
          putih: withOpacity('--color-liturgi-putih'),
          'putih-soft': withOpacity('--color-liturgi-putih-soft'),
          hitam: withOpacity('--color-liturgi-hitam'),
          'hitam-soft': withOpacity('--color-liturgi-hitam-soft'),
        },
      },
      fontFamily: {
        display: ['"Fraunces"', 'serif'],
        sans: ['"Plus Jakarta Sans"', 'sans-serif'],
      },
      boxShadow: {
        soft: '0 1px 2px -1px rgba(0, 0, 0, 0.2), 0 4px 16px -8px rgba(0, 0, 0, 0.28)',
        card: '0 2px 6px -2px rgba(0, 0, 0, 0.22), 0 10px 30px -12px rgba(0, 0, 0, 0.32)',
        lift: '0 8px 24px -8px rgba(44, 78, 48, 0.28)',
      },
      borderRadius: {
        xl2: '1.25rem',
      },
    },
  },
  plugins: [],
} satisfies Configstyl