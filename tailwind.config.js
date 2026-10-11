/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./public/**/*.{html,js}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['"Plus Jakarta Sans Variable"', 'system-ui', 'sans-serif'],
        display: ['"Fraunces Variable"', 'Georgia', 'serif'],
      },
      colors: {
        ink: '#12202b',
        brand: {
          50: '#eef8f7', 100: '#d4eeeb', 200: '#a9ddd8', 300: '#74c4be', 400: '#3fa59f',
          500: '#1b8a85', 600: '#146f6b', 700: '#115a58', 800: '#0f4846', 900: '#0d3a39', 950: '#062324',
        },
      },
    },
  },
  plugins: [],
};
