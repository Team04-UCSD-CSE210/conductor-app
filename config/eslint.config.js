import js from '@eslint/js';
import globals from 'globals';

export default [
  js.configs.recommended,
  {
    ignores: [
      '**/node_modules/**',
      '**/coverage/**',
      '**/dist/**',
      '**/build/**',
      // Ignore vendored/minified assets
      'src/public/js/echarts.min.js'
    ],
    languageOptions: {
      globals: {
        ...globals.node,
        ...globals.browser
      },
      ecmaVersion: 2022,
      sourceType: 'module'
    },
    rules: {
      'no-unused-vars': 'warn',
      'no-console': 'off'
    }
  }
];
