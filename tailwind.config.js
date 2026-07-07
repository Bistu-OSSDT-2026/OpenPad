/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        panel: '#171717',
        panelSoft: '#222222',
        line: '#383838',
        signal: '#36f2a8',
        warning: '#f7c948',
      },
      boxShadow: {
        pad: 'inset 0 -4px 0 rgba(0,0,0,0.35), 0 10px 24px rgba(0,0,0,0.28)',
      },
    },
  },
  plugins: [],
};
