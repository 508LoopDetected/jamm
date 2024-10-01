/** @type {import('tailwindcss').Config} */
export default {
  content: ['./src/**/*.{html,js,svelte,ts}'],
  theme: {
    extend: {
      colors: {
        gray: {
          950: '#0a0a0a',
          900: '#171717',
          800: '#262626',
          700: '#343434',
          400: '#7a7a7a',
          300: '#9a9a9a',
        },
        red: {
          500: '#ef4444',
          600: '#dc2626',
        },
      },
    },
  },
  plugins: [],
}