/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: '#FF9AB2',
          light: '#FFB8CC',
          dark: '#FC819E',
          50: '#FFF5F7',
          100: '#FFEBF0',
          200: '#FFD6E1',
          300: '#FFB8CC',
          400: '#FF9AB2',
          500: '#FC819E',
          600: '#F0627E',
          700: '#E04464',
          800: '#C92A4A',
          900: '#A31D38',
        },
        accent: {
          DEFAULT: '#A78BFA',
          light: '#C4B5FD',
          dark: '#8B5CF6',
        },
        warm: {
          DEFAULT: '#FBBF24',
          light: '#FCD34D',
          dark: '#F59E0B',
        },
      },
      fontFamily: {
        sans: ['"Noto Sans SC"', '"PingFang SC"', '"Microsoft YaHei"', 'sans-serif'],
        mono: ['"JetBrains Mono"', '"Fira Code"', 'monospace'],
      },
      borderRadius: {
        'card': '16px',
        'btn': '12px',
        'tag': '20px',
        'input': '10px',
      },
      boxShadow: {
        'card': '0 2px 12px rgba(0, 0, 0, 0.06)',
        'card-hover': '0 8px 30px rgba(0, 0, 0, 0.12)',
        'avatar': '0 2px 8px rgba(0, 0, 0, 0.1)',
      },
      animation: {
        'float': 'float 3s ease-in-out infinite',
        'like-bounce': 'like-bounce 0.4s ease-out',
      },
      keyframes: {
        float: {
          '0%, 100%': { transform: 'translateY(0px)' },
          '50%': { transform: 'translateY(-10px)' },
        },
        'like-bounce': {
          '0%': { transform: 'scale(0.8)' },
          '50%': { transform: 'scale(1.2)' },
          '100%': { transform: 'scale(1)' },
        },
      },
    },
  },
  plugins: [
    require('@tailwindcss/typography'),
  ],
}
