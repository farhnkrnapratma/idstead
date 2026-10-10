import { type Config } from 'prettier';

const config: Config = {
    experimentalTernaries: true,
    experimentalOperatorPosition: 'start',
    printWidth: 100,
    tabWidth: 4,
    useTabs: false,
    semi: true,
    singleQuote: true,
    quoteProps: 'as-needed',
    jsxSingleQuote: true,
    trailingComma: 'none',
    bracketSpacing: true,
    objectWrap: 'collapse',
    bracketSameLine: true,
    arrowParens: 'avoid',
    requirePragma: false,
    insertPragma: false,
    checkIgnorePragma: true,
    proseWrap: 'never',
    htmlWhitespaceSensitivity: 'css',
    endOfLine: 'lf',
    embeddedLanguageFormatting: 'auto',
    singleAttributePerLine: true,
    plugins: [
        'prettier-plugin-svelte',
        'prettier-plugin-tailwindcss',
        '@prettier/plugin-xml',
        'prettier-plugin-yaml'
    ],
    overrides: [
        { files: '*.svelte', options: { parser: 'svelte' } },
        { files: '*.svg', options: { tabWidth: 4, xmlWhitespaceSensitivity: 'strict' } },
        {
            files: '*.y[aml/ml]',
            options: {
                tabWidth: 4,
                yamlBlockStyle: 'folded',
                yamlCollectionStyle: 'block',
                yamlQuoteKeys: false,
                yamlQuoteValues: true
            }
        }
    ],
    tailwindStylesheet: './src/routes/global.css'
};

export default config;
