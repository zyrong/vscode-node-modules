module.exports = {
  root: true,
  parser: '@typescript-eslint/parser',
  parserOptions: {
    ecmaVersion: 6,
    sourceType: 'module',
  },
  extends: ['prettier'],
  plugins: ['@typescript-eslint', 'prettier'],
  rules: {
    '@typescript-eslint/naming-convention': [
      'warn',
      {
        selector: 'variable',
        format: ['camelCase', 'UPPER_CASE'],
        filter: {
          regex: '(^_)|node_modules|publisher_name',
          match: false,
        },
      },
    ],
    '@typescript-eslint/semi': ['error', 'never'],
    curly: 'warn',
    eqeqeq: 'warn',
    'no-throw-literal': 'warn',
    semi: 'off',
  },
  ignorePatterns: ['out', 'dist', '**/*.d.ts'],
}
