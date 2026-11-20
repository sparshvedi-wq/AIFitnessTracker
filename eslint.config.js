import js from '@eslint/js'
import globals from 'globals'
import react from 'eslint-plugin-react'
import reactHooks from 'eslint-plugin-react-hooks'
import jsxA11y from 'eslint-plugin-jsx-a11y'

// Lints the Tally web app in src/. The Expo launcher has its own config in expo/.
export default [
  { ignores: ['dist', 'expo', 'server', 'docs', 'artifacts', 'node_modules'] },
  {
    files: ['src/**/*.{js,jsx}', 'tests/**/*.mjs', 'scripts/**/*.mjs', '*.config.js'],
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      globals: { ...globals.browser, ...globals.node },
      parserOptions: { ecmaFeatures: { jsx: true } },
    },
    settings: { react: { version: '18.3' } },
    plugins: { react, 'react-hooks': reactHooks, 'jsx-a11y': jsxA11y },
    rules: {
      ...js.configs.recommended.rules,
      ...react.configs.recommended.rules,
      ...react.configs['jsx-runtime'].rules,
      ...reactHooks.configs.recommended.rules,
      ...jsxA11y.configs.recommended.rules,
      'react/prop-types': 'off',
      // Sheets focus their one input on open (search, name, weight); that is the expected flow.
      'jsx-a11y/no-autofocus': 'off',
      'jsx-a11y/label-has-associated-control': ['error', { assert: 'either', depth: 3 }],
      'no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_', ignoreRestSiblings: true },
      ],
    },
  },
]
