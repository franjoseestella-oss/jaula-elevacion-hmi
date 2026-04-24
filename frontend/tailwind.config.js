/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        logisnext: {
          magenta: '#dd2876',
          red: '#e00000',
          darkslate: '#2e404a',
          slate: '#5d7a8a',
          lightslate: '#aebfc9',
          lightgray: '#efefef'
        }
      },
      fontFamily: {
        primary: ['Inter', 'Roboto', 'Helvetica Neue', 'sans-serif'],
      }
    },
  },
  plugins: [],
}
