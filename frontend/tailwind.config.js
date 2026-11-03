/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      fontFamily: { sans: ['"Be Vietnam Pro"', 'system-ui', 'sans-serif'] },
      colors: {
        surface: 'var(--surface)',
        ink: 'var(--ink)',
        muted: 'var(--muted)',
        line: 'var(--line)',
        hover: 'var(--hover)',
        accent: 'var(--accent)',
        'on-accent': 'var(--on-accent)',
      },
      boxShadow: { ui: 'var(--shadow)' },
    },
  },
  plugins: [],
}
