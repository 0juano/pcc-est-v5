/** @type {import('tailwindcss').Config} */
import tailwindScrollbar from 'tailwind-scrollbar';

export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        // Define custom colors for better dark/light mode contrast
        'dark-bg': '#1a1a1a',
        'dark-surface': '#2a2a2a',
        'dark-border': '#3a3a3a',
        'dark-text': '#e0e0e0',
        'dark-text-secondary': '#a0a0a0',
        'light-bg': '#f9f9f9',
        'light-surface': '#ffffff',
        'light-border': '#e0e0e0',
        'light-text': '#333333',
        'light-text-secondary': '#666666',
      },
    },
  },
  plugins: [
    tailwindScrollbar
  ],
} 