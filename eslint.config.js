import eslint from '@eslint/js';
import tseslint from 'typescript-eslint';
import prettier from 'eslint-plugin-prettier';

export default [
  // First, the ignore config
  {
    ignores: [
      'projects/*/src/model/generated/**',
      'projects/*/db/migrations/**',
      'projects/*/abi/**'
    ]
  },
  // Then the TypeScript config
  {
    files: ['**/*.ts'],
    languageOptions: {
      parser: tseslint.parser,
      parserOptions: {
        project: [
          './tsconfig.base.json',           // Root tsconfig
          './projects/*/tsconfig.json',     // Project-specific tsconfigs
          './packages/*/tsconfig.json',     // Package-specific tsconfigs
          './abs-app/tsconfig.json'         // App-specific tsconfig
        ],
        tsconfigRootDir: '.',
        ecmaVersion: 'latest',
        sourceType: 'module'
      }
    },
    plugins: {
      '@typescript-eslint': tseslint.plugin,
      'prettier': prettier
    },
    rules: {
      'prettier/prettier': 'error',
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-unused-vars': 'off',
      '@typescript-eslint/no-require-imports': 'off',
      'no-empty': 'off',
      'no-undef': 'off'
    }
  }
];
