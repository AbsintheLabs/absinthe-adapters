import tseslint from 'typescript-eslint';
import prettier from 'eslint-plugin-prettier';

export default [
  // First, the ignore config
  {
    ignores: [
      '**/lib/**',
      '**/dist/**',
      '**/build/**',
      'projects/*/src/model/generated/**',
      'projects/*/db/migrations/**',
      'projects/*/abi/**',
      'projects',
    ],
  },
  // Then the TypeScript config
  {
    files: ['**/*.ts'],
    languageOptions: {
      parser: tseslint.parser,
      parserOptions: {
        project: [
          './tsconfig.json', // Root tsconfig
        ],
        tsconfigRootDir: process.cwd(),
        ecmaVersion: 'latest',
        sourceType: 'module',
      },
    },
    plugins: {
      '@typescript-eslint': tseslint.plugin,
      prettier: prettier,
    },
    rules: {
      'prettier/prettier': 'error',
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-unused-vars': 'off',
      '@typescript-eslint/no-require-imports': 'off',
      'no-empty': 'off',
      'no-undef': 'off',
    },
  },
];
