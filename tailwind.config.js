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
        // Body copy
        sans: ['"Instrument Sans"', 'ui-sans-serif', 'system-ui', '-apple-system', 'Segoe UI', 'sans-serif'],
        // Scoreboard numbers and titles, always set in caps
        display: ['"Big Shoulders Display"', 'Impact', 'ui-sans-serif', 'sans-serif'],
        // The coach's voice: one italic line here and there, never for UI
        serif: ['"Instrument Serif"', 'ui-serif', 'Georgia', 'serif'],
      },
      colors: {
        bg: token('bg'),
        surface: token('surface'),
        surface2: token('surface-2'),
        raised: token('raised'),
        line: token('line'),
        ink: token('ink'),
        ink2: token('ink-2'),
        muted: token('muted'),
        // brand: text and strokes on a surface. accent: the volt fill.
        brand: token('brand'),
        'brand-soft': token('brand-soft'),
        accent: token('accent'),
        'on-accent': token('on-accent'),
        danger: token('danger'),
        success: token('success'),
        // Data colors, one hue per metric
        cal: token('accent'),
        protein: token('protein'),
        carbs: token('carbs'),
        fat: token('fat'),
        water: token('water'),
      },
      boxShadow: {
        card: '0 1px 2px rgb(8 8 10 / 0.05), 0 4px 14px -6px rgb(8 8 10 / 0.12)',
        float: '0 18px 40px -8px rgb(0 0 0 / 0.45), 0 2px 6px rgb(0 0 0 / 0.2)',
        // Volt halo under the primary action
        glow: '0 0 0 1px rgb(var(--accent) / 0.4), 0 8px 28px -8px rgb(var(--accent) / 0.55)',
      },
      keyframes: {
        'fade-in': { from: { opacity: 0, transform: 'translateY(4px)' }, to: { opacity: 1, transform: 'none' } },
        'slide-up': { from: { opacity: 0, transform: 'translateY(16px)' }, to: { opacity: 1, transform: 'none' } },
        // A tally stroke being drawn
        'stroke-in': { from: { transform: 'scaleY(0)' }, to: { transform: 'scaleY(1)' } },
      },
      animation: {
        'fade-in': 'fade-in 0.15s ease-out',
        'slide-up': 'slide-up 0.22s cubic-bezier(0.2, 0.8, 0.2, 1)',
        'stroke-in': 'stroke-in 0.35s cubic-bezier(0.2, 0.8, 0.2, 1) both',
      },
    },
  },
  plugins: [],
}
