/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './app/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        bg: '#0A0A0B',
        bg2: '#111113',
        bg3: '#1C1C1F',
        bg4: '#27272A',
        card: '#18181B',
        surface: '#18181B',
        border: '#27272A',
        'border-accent': '#3F3F46',
        accent: '#F97316',
        'accent-dim': '#EA6C0A',
        green: '#4ADE80',
        'green-bg': 'rgba(34,197,94,0.12)',
        red: '#F87171',
        'red-bg': 'rgba(239,68,68,0.12)',
        amber: '#FCD34D',
        'amber-bg': 'rgba(245,158,11,0.12)',
        blue: '#3B82F6',
        success: '#4ADE80',
        warning: '#FCD34D',
        danger: '#F87171',
        text: '#FAFAFA',
        'text-secondary': '#A1A1AA',
        muted: '#52525B',
      },
      fontFamily: {
        display: ['var(--font-bebas)', 'sans-serif'],
        mono: ['var(--font-ibm-mono)', 'monospace'],
        body: ['var(--font-outfit)', 'sans-serif'],
      },
      letterSpacing: {
        widest: '0.2em',
        ultra: '0.3em',
      },
      borderRadius: {
        sm: '8px',
        DEFAULT: '12px',
        lg: '16px',
        xl: '20px',
        '2xl': '24px',
      },
    },
  },
  plugins: [],
};
