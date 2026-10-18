/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        sidebar: '#211B3B',
        primary: {
          DEFAULT: '#6855F5',
          hover: '#5442E2',
          light: '#EEECFE',
        },
        hero: '#30265C',
        canvas: '#F7F6FC',
        card: '#FFFFFF',
        main: '#292444',
        secondary: '#625C78',
        success: {
          DEFAULT: '#087F70',
          light: '#E6F5F3',
        },
        warning: {
          DEFAULT: '#92520A',
          light: '#FEF6EE',
        },
        danger: {
          DEFAULT: '#C5221F',
          light: '#FDECEB',
        },
        border: '#E7E3F0',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
      },
      boxShadow: {
        card: '0 1px 3px 0 rgba(33, 27, 59, 0.06), 0 1px 2px 0 rgba(33, 27, 59, 0.04)',
        'card-hover': '0 4px 12px 0 rgba(33, 27, 59, 0.08), 0 2px 4px 0 rgba(33, 27, 59, 0.04)',
        modal: '0 20px 25px -5px rgba(33, 27, 59, 0.15), 0 10px 10px -5px rgba(33, 27, 59, 0.08)',
      },
    },
  },
  plugins: [],
}
