import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import astro from 'eslint-plugin-astro';

export default [
  { ignores: ['dist/', '.astro/', '.wrangler/', 'node_modules/', 'e2e-artifacts/', 'test-results/', 'playwright-report/'] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  ...astro.configs.recommended,
  {
    languageOptions: {
      globals: { console: 'readonly', process: 'readonly', URL: 'readonly', fetch: 'readonly', document: 'readonly', window: 'readonly' },
    },
    rules: {
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
      // Never browser prompts: confirmations use the in-app dialog (src/scripts/confirm.ts)
      'no-alert': 'error',
      'no-restricted-globals': [
        'error',
        { name: 'alert', message: 'Use in-app UI, never a browser prompt.' },
        { name: 'confirm', message: 'Use an in-app dialog, never a browser prompt.' },
        { name: 'prompt', message: 'Use an in-app dialog, never a browser prompt.' },
      ],
      'no-restricted-syntax': [
        'error',
        { selector: "Literal[value='beforeunload']", message: 'No beforeunload: use pagehide for flushes and an in-app dialog for leave guards.' },
        { selector: "MemberExpression[property.name='onbeforeunload']", message: 'No beforeunload: use pagehide for flushes and an in-app dialog for leave guards.' },
      ],
    },
  },
];
