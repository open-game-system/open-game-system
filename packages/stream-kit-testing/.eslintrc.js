module.exports = {
  root: true,
  parser: '@typescript-eslint/parser',
  plugins: ['@typescript-eslint'],
  extends: [
    'eslint:recommended',
    'plugin:@typescript-eslint/recommended'
  ],
  env: {
    node: true,
    browser: true
  },
  rules: {
    '@typescript-eslint/no-explicit-any': 'off', // We need this for accessing internal state in tests
    '@typescript-eslint/no-unused-vars': ['error', { 'argsIgnorePattern': '^_' }]
  }
}; 