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
            'packages/lib/src/utils/**',
            'apps/web/src/lib/**',
            'apps/admin/src/lib/**'
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
        files: ['packages/mdrs/**'],
        rules: {
            '@typescript-eslint/no-restricted-imports': [
                'error',
                {
                    patterns: [
                        {
                            regex: '^(@supabase/|#lib|@fkp/|\\$app/|\\$lib|svelte($|/))',
                            allowTypeImports: true,
                            message:
                                '@fkp/mdrs is a standalone engine: no app, lib, Svelte or data-access imports; inject resolvers instead.'
                        }
                    ]
                }
            ]
        }
    },
    {
        files: ['packages/ui/**'],
        rules: {
            '@typescript-eslint/no-restricted-imports': [
                'error',
                {
                    patterns: [
                        {
                            regex: '(^|/)server/|^(@supabase/|#lib|@fkp/(lib|mdrs|ui)($|/))',
                            allowTypeImports: true,
                            message:
                                '@fkp/ui is the design system: browser-safe, and it may only depend on @fkp/domain.'
                        }
                    ]
                }
            ]
        }
    },
    {
        files: ['packages/mdrs-ui/**'],
        rules: {
            '@typescript-eslint/no-restricted-imports': [
                'error',
                {
                    patterns: [
                        {
                            regex: '(^|/)server/|^(@supabase/|#lib|@fkp/(lib|editor)($|/))',
                            allowTypeImports: true,
                            message:
                                '@fkp/mdrs-ui is the browser side of MDRS: it may depend on @fkp/ui, @fkp/domain and @fkp/mdrs only.'
                        }
                    ]
                }
            ]
        }
    },
    {
        files: ['packages/editor/**'],
        rules: {
            '@typescript-eslint/no-restricted-imports': [
                'error',
                {
                    patterns: [
                        {
                            regex: '(^|/)server/|^(@supabase/|#lib|@fkp/lib($|/))',
                            allowTypeImports: true,
                            message:
                                '@fkp/editor takes data access through props: no lib, Supabase or server imports.'
                        }
                    ]
                }
            ]
        }
    },
    {
        files: ['packages/domain/**'],
        rules: {
            '@typescript-eslint/no-restricted-imports': [
                'error',
                {
                    patterns: [
                        {
                            regex: '^(@supabase/|#lib|@fkp/|\\$app/|\\$lib|svelte($|/))',
                            allowTypeImports: true,
                            message:
                                '@fkp/domain holds pure, framework-free code: no workspace, Svelte, SvelteKit or Supabase imports.'
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
