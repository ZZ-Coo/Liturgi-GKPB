import type { Config } from 'tailwindcss'

export default {
  content: ['./index.html', './src/**/*.{vue,ts}'],
  theme: {
    extend: {
      colors: {
        paper: '#F9F7F1',
        'paper-deep': '#F1EEE3',
        ink: '#1B2119',
        muted: '#767C6F',
        line: '#E3E0D2',
        accent: {
          DEFAULT: '#2C4E30',
          hover: '#213C25',
          soft: '#E6ECDE',
          line: '#C7D4BC',
        },
        gold: {
          DEFAULT: '#B8862F',
          soft: '#F3E7CE',
        },
        danger: '#963C2C',
        // liturgical season colours — used to tint the reading experience
        // to match the day's warnaLiturgi, so each week reads distinctly
        liturgi: {
          hijau: '#2C6B3F',
          'hijau-soft': '#E4EFE2',
          ungu: '#5B4B8A',
          'ungu-soft': '#EBE7F4',
          merah: '#A13B32',
          'merah-soft': '#F5E4E1',
          putih: '#A88A2E',
          'putih-soft': '#F4EEDC',
          hitam: '#2B2B27',
          'hitam-soft': '#E7E5DE',
        },
      },
      fontFamily: {
        display: ['"Fraunces"', 'serif'],
        sans: ['"Plus Jakarta Sans"', 'sans-serif'],
      },
      boxShadow: {
        soft: '0 1px 2px -1px rgba(27, 33, 25, 0.06), 0 4px 16px -8px rgba(27, 33, 25, 0.12)',
        card: '0 2px 6px -2px rgba(27, 33, 25, 0.08), 0 10px 30px -12px rgba(27, 33, 25, 0.14)',
        lift: '0 8px 24px -8px rgba(44, 78, 48, 0.28)',
      },
      borderRadius: {
        xl2: '1.25rem',
      },
    },
  },
  plugins: [],
} satisfies Config
