/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        sidebar: {
          bg: '#1e293b',
          hover: '#334155',
          active: '#3b82f6',
          text: '#cbd5e1',
          'text-active': '#ffffff',
        },
      },
    },
  },
  plugins: [],
};
