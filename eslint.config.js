import eslint from '@eslint/js';
import tseslint from 'typescript-eslint';
import prettier from 'eslint-plugin-prettier';

export default [
  eslint.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ['**/*.ts'],
    ignores: [
      'projects/*/src/migrations/**',
      '**/migrations/**',
    ],
    plugins: {
      '@typescript-eslint': tseslint.plugin,
      'prettier': prettier
    },
    rules: {
      'prettier/prettier': 'error'
    }
  }
];
