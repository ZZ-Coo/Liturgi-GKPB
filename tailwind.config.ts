import type { Config } from 'tailwindcss'

export default {
  content: ['./index.html', './src/**/*.{vue,ts}'],
  theme: {
    extend: {
      colors: {
        paper: '#F6F7F3',
        ink: '#1E2620',
        muted: '#6B7268',
        line: '#DFE3D9',
        accent: {
          DEFAULT: '#2F5233',
          hover: '#25401F',
          soft: '#E7EDE4',
        },
        danger: '#8C3B2E',
      },
      fontFamily: {
        display: ['"IBM Plex Serif"', 'serif'],
        sans: ['"IBM Plex Sans"', 'sans-serif'],
      },
    },
  },
  plugins: [],
} satisfies Config
