import js from '@eslint/js';
import react from 'eslint-plugin-react';
import globals from 'globals';
import babelParser from '@babel/eslint-parser';

export default [
  js.configs.recommended,
  {
    files: ['src/**/*.{js,jsx}'],
    languageOptions: {
      parser: babelParser,
      parserOptions: {
        requireConfigFile: false,
        ecmaVersion: 2022,
        sourceType: 'module',
        ecmaFeatures: {
          jsx: true,
        },
        babelOptions: {
          presets: ['@babel/preset-react'],
        },
      },
      globals: {
        ...globals.browser,
      },
    },
    plugins: {
      react,
    },
    rules: {
      'no-console': ['warn', { allow: ['warn', 'error'] }],
      'react/react-in-jsx-scope': 'off',
      'react/prop-types': 'off',
      'no-unused-vars': 'off',
      'no-empty': 'off',
    },
    settings: {
      react: {
        version: 'detect',
      },
    },
  },
];

