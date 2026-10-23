// Literal colors for SVG and Recharts, which can't read CSS variables.
// Keep in step with the tokens in index.css.

export const MACRO_COLORS = {
  protein: 'rgb(var(--protein))',
  carbs: 'rgb(var(--carbs))',
  fat: 'rgb(var(--fat))',
}

export function chartColors(dark) {
  return dark
    ? {
        grid: '#232328', tick: '#76766F', ink: '#F5F5F0', surface: '#131316',
        accent: '#D6FF3D', accentSoft: '#3E4A16', danger: '#FF5C5C', empty: '#232328',
        protein: '#FF6B4A', carbs: '#FFBA38', fat: '#968CFF', water: '#48C7F0',
      }
    : {
        grid: '#E6E6DF', tick: '#76766F', ink: '#0C0C0E', surface: '#FFFFFF',
        // Volt bars get an ink edge in light mode so they hold up on white
        accent: '#B8E62A', accentSoft: '#DCEFA8', danger: '#D63030', empty: '#E6E6DF',
        protein: '#F05634', carbs: '#E69600', fat: '#7A6CF0', water: '#16A0D6',
      }
}
