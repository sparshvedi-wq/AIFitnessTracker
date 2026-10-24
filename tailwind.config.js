/** @type {import('tailwindcss').Config} */

// Ink: warm paper on near-black with one ice-blue accent. Colors are CSS
// variables in index.css so opacity modifiers (bg-accent/15) keep working.
const token = (name) => `rgb(var(--${name}) / <alpha-value>)`

export default {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      fontFamily: {
        // Body copy
        sans: ['"Hanken Grotesk"', 'ui-sans-serif', 'system-ui', '-apple-system', 'Segoe UI', 'sans-serif'],
        // Headings
        display: ['"Young Serif"', 'ui-serif', 'Georgia', 'serif'],
        // Numbers: a calmer serif so commas and decimals read cleanly
        num: ['Fraunces', 'ui-serif', 'Georgia', 'serif'],
      },
      colors: {
        bg: token('bg'),
        surface: token('surface'),
        surface2: token('surface-2'),
        raised: token('raised'),
        line: token('line'),
        outline: token('outline'),
        ink: token('ink'),
        ink2: token('ink-2'),
        muted: token('muted'),
        faint: token('faint'),
        // The paper fill used for hero cards, and the text that sits on it
        paper: token('ink'),
        'on-paper': token('bg'),
        'paper-muted': token('paper-muted'),
        'paper-chip': token('paper-chip'),
        brand: token('accent'),
        'brand-soft': token('brand-soft'),
        accent: token('accent'),
        'accent-2': token('accent-2'),
        'on-accent': token('bg'),
        danger: token('danger'),
        success: token('accent'),
      },
      borderRadius: {
        // Three round corners and one tucked one, so cards aren't all plain boxes
        tuck: '22px 22px 22px 6px',
        'tuck-r': '22px 22px 6px 22px',
        'tuck-tr': '22px 6px 22px 22px',
        'tuck-tl': '6px 22px 22px 22px',
        hero: '28px 28px 28px 8px',
        btn: '999px 999px 999px 10px',
      },
      boxShadow: {
        float: '0 18px 40px -8px rgb(0 0 0 / 0.55), 0 2px 6px rgb(0 0 0 / 0.25)',
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
