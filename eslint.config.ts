import path from 'node:path';
import globals from 'globals';
import js from '@eslint/js';
import { defineConfig, includeIgnoreFile } from 'eslint/config';
import tseslint from 'typescript-eslint';
import svelte from 'eslint-plugin-svelte';
import prettier from 'eslint-config-prettier';

const gitignorePath = path.resolve(import.meta.dirname, '.gitignore');

export default defineConfig(
    includeIgnoreFile(gitignorePath),
    js.configs.recommended,
    tseslint.configs.recommended,
    svelte.configs.recommended,
    prettier,
    svelte.configs.prettier,
    {
        languageOptions: { globals: { ...globals.browser, ...globals.node } },
        rules: { 'no-undef': 'off' }
    },
    {
        files: ['**/*.svelte', '**/*.svelte.ts', '**/*.svelte.js'],
        languageOptions: {
            parserOptions: {
                projectService: true,
                extraFileExtensions: ['.svelte'],
                parser: tseslint.parser
            }
        }
    },
    {
        files: [
            '**/*.svelte',
            '**/*.svelte.ts',
            'packages/lib/src/components/**',
            'packages/lib/src/layout/**',
            'packages/lib/src/article/**',
            'packages/lib/src/stores/**',
            'packages/lib/src/utils/**'
        ],
        rules: {
            '@typescript-eslint/no-restricted-imports': [
                'error',
                {
                    patterns: [
                        {
                            regex: '(^|/)server/',
                            allowTypeImports: true,
                            message: 'Browser code must not import server-only modules.'
                        }
                    ]
                }
            ]
        }
    },
    {
        files: [
            'packages/lib/src/markdown.ts',
            'packages/lib/src/define.ts',
            'packages/lib/src/frontmatter.ts',
            'packages/lib/src/markdownReferences.ts',
            'packages/lib/src/markdownIcons.ts',
            'packages/lib/src/placeholders.ts',
            'packages/lib/src/sanitizeHtml.ts',
            'packages/lib/src/legacyMarkdown.ts',
            'packages/lib/src/mdrsValidation.ts'
        ],
        rules: {
            '@typescript-eslint/no-restricted-imports': [
                'warn',
                {
                    patterns: [
                        {
                            regex: '^(@supabase/|#lib/(supabase|authorApi|server/|stores/)|svelte($|/))',
                            allowTypeImports: true,
                            message:
                                'The MDRS engine stays free of data access and UI state; inject resolvers instead.'
                        }
                    ]
                }
            ]
        }
    },
    {
        rules: {
            'svelte/no-at-html-tags': 'off',
            'svelte/no-navigation-without-resolve': 'off',
            '@typescript-eslint/no-explicit-any': 'off',
            '@typescript-eslint/no-unused-vars': 'off',
            '@typescript-eslint/no-require-imports': 'off',
            'no-empty': ['error', { allowEmptyCatch: true }]
        }
    }
);
