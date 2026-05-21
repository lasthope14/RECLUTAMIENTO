/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        brand: {
          50:  '#eff6ff',
          100: '#dbeafe',
          200: '#bfdbfe',
          300: '#93c5fd',
          400: '#60a5fa',
          500: '#2563eb', // Accent Indigo (Primary)
          600: '#1d4ed8',
          700: '#1e40af',
          800: '#1e3a8a',
          900: '#172554',
          950: '#0f172a',
        },
        surface: {
          50:  '#f8fafc', // Elevated panels / soft blue-gray background
          100: '#ffffff', // Primary Canvas Card Background
          200: '#e2e8f0', // Fine slate-200 borders
          300: '#cbd5e1', // Active borders / hover
          400: '#57657a', // Secondary text Slate-600 (Darker)
          500: '#475569', // Intermediate Slate-600
          600: '#334155', // Slate-700 body text
          700: '#1e293b', // Slate-800 headings
          800: '#0f172a', // Slate-900 text
          900: '#020617', // Slate-950 headlines
        },
      },
      fontFamily: {
        sans: ['Plus Jakarta Sans', 'Inter', 'system-ui', 'sans-serif'],
      },
      boxShadow: {
        'card': '0 1px 3px rgba(0,0,0,0.06), 0 1px 2px rgba(0,0,0,0.04)',
        'card-hover': '0 4px 12px rgba(0,0,0,0.08), 0 2px 4px rgba(0,0,0,0.04)',
        'drawer': '-4px 0 24px rgba(0,0,0,0.08)',
        'dropdown': '0 8px 24px rgba(0,0,0,0.10)',
      },
      animation: {
        'fade-in':   'fadeIn 0.25s ease-out',
        'slide-in':  'slideIn 0.3s cubic-bezier(0.16, 1, 0.3, 1)',
        'slide-up':  'slideUp 0.25s ease-out',
        'pulse-slow':'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
      },
      keyframes: {
        fadeIn:  { '0%': { opacity: '0' }, '100%': { opacity: '1' } },
        slideIn: { '0%': { transform: 'translateX(100%)' }, '100%': { transform: 'translateX(0)' } },
        slideUp: { '0%': { transform: 'translateY(8px)', opacity: '0' }, '100%': { transform: 'translateY(0)', opacity: '1' } },
      },
    },
  },
  plugins: [],
};
