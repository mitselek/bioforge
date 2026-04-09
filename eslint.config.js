import eslint from '@eslint/js'
import tseslint from 'typescript-eslint'

export default tseslint.config(
  eslint.configs.recommended,
  ...tseslint.configs.strictTypeChecked,
  ...tseslint.configs.stylisticTypeChecked,
  {
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/no-non-null-assertion': 'error',
      '@typescript-eslint/consistent-type-imports': 'error',
      '@typescript-eslint/switch-exhaustiveness-check': 'error',
      '@typescript-eslint/no-floating-promises': 'error',
      '@typescript-eslint/explicit-function-return-type': ['error', {
        allowExpressions: true,
        allowTypedFunctionExpressions: true,
      }],
      '@typescript-eslint/no-unnecessary-type-assertion': 'error',
      '@typescript-eslint/strict-boolean-expressions': 'error',
    },
  },
  {
    files: ['src/core/**/*.ts'],
    rules: {
      'no-restricted-imports': ['error', {
        patterns: [
          { group: ['**/ui/**', '**/src/ui/**'], message: 'src/core/ must not import from src/ui/ (architecture boundary)' },
          { group: ['blessed'], message: 'blessed is a UI-only dependency; src/core/ must not import it' },
        ],
      }],
      'no-restricted-syntax': ['error', {
        selector: 'CallExpression[callee.object.name="Math"][callee.property.name="random"]',
        message: 'Use src/core/rng.ts seeded PRNG instead of Math.random().',
      }],
    },
  },
  {
    // Test files interact with dynamic JSON, filesystem reads, and
    // fixture data. The no-unsafe-* family from strict-type-checked
    // fights JSON.parse + config-object access patterns that are
    // normal and safe in tests. Relax those specifically; keep the
    // rest of strict-type-checked (including no-explicit-any, which
    // still requires explicit any when intended).
    files: ['tests/**/*.ts'],
    rules: {
      '@typescript-eslint/no-unsafe-assignment': 'off',
      '@typescript-eslint/no-unsafe-member-access': 'off',
      '@typescript-eslint/no-unsafe-call': 'off',
      '@typescript-eslint/no-unsafe-return': 'off',
      '@typescript-eslint/no-unsafe-argument': 'off',
    },
  },
  {
    ignores: ['dist/**', 'node_modules/**', 'coverage/**', 'eslint.config.js', 'vitest.config.ts'],
  },
)
