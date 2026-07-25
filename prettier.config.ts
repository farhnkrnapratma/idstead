/** @format */

import {type Config} from 'prettier'

const config: Config = {
  experimentalTernaries: true,
  experimentalOperatorPosition: 'start',
  printWidth: 80,
  tabWidth: 2,
  useTabs: false,
  semi: false,
  singleQuote: true,
  quoteProps: 'as-needed',
  jsxSingleQuote: true,
  trailingComma: 'none',
  bracketSpacing: false,
  objectWrap: 'collapse',
  bracketSameLine: true,
  arrowParens: 'avoid',
  requirePragma: false,
  insertPragma: true,
  checkIgnorePragma: true,
  proseWrap: 'never',
  htmlWhitespaceSensitivity: 'css',
  endOfLine: 'lf',
  embeddedLanguageFormatting: 'auto',
  singleAttributePerLine: false,
  plugins: ['prettier-plugin-svelte', 'prettier-plugin-tailwindcss'],
  overrides: [{files: '*.svelte', options: {parser: 'svelte'}}],
  tailwindStylesheet: './src/routes/layout.css'
}

export default config
