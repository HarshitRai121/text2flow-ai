/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./index.html", // For the public/index.html file
    "./src/**/*.{js,jsx,ts,tsx}", // For all your React components
  ],
  theme: {
    extend: {
      fontFamily: {
        // Define a custom font family for Inter
        inter: ['Inter', 'sans-serif'],
      },
    },
  },
  plugins: [],
}


