/** @type {import('tailwindcss').Config} */

// Semantic colors come from CSS variables in index.css, so light and dark
// mode share one set of class names (bg-surface, text-ink, border-line...).
const token = (name) => `rgb(var(--${name}) / <alpha-value>)`

export default {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'ui-sans-serif', 'system-ui', '-apple-system', 'Segoe UI', 'Roboto', 'sans-serif'],
      },
      colors: {
        bg: token('bg'),
        surface: token('surface'),
        surface2: token('surface-2'),
        line: token('line'),
        ink: token('ink'),
        ink2: token('ink-2'),
        muted: token('muted'),
        brand: token('brand'),
        'brand-soft': token('brand-soft'),
        danger: token('danger'),
        success: token('success'),
        // Data colors: calories use the brand color; macros + water are fixed hues
        cal: token('brand'),
        protein: '#E5484D',
        carbs: '#F0A020',
        fat: '#7C66DC',
        water: '#3B9EFF',
      },
      boxShadow: {
        card: '0 1px 2px rgb(16 24 40 / 0.04), 0 1px 3px rgb(16 24 40 / 0.06)',
        float: '0 8px 24px rgb(16 24 40 / 0.18)',
      },
      keyframes: {
        'fade-in': { from: { opacity: 0, transform: 'translateY(4px)' }, to: { opacity: 1, transform: 'none' } },
        'slide-up': { from: { opacity: 0, transform: 'translateY(16px)' }, to: { opacity: 1, transform: 'none' } },
      },
      animation: {
        'fade-in': 'fade-in 0.15s ease-out',
        'slide-up': 'slide-up 0.22s cubic-bezier(0.2, 0.8, 0.2, 1)',
      },
    },
  },
  plugins: [],
}
