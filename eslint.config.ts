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
            'packages/lib/src/mdrsResolvers.ts',
            'apps/web/src/lib/**',
            'apps/admin/src/lib/**'
        ],
        rules: {
            '@typescript-eslint/no-restricted-imports': [
                'error',
                {
                    patterns: [
                        {
                            regex: '(^|/)server/|^@idstead/data($|/)',
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
            'apps/admin/src/**/*.svelte',
            'apps/admin/src/**/*.svelte.ts',
            'apps/admin/src/lib/**/*.ts',
            'packages/lib/src/**/*.svelte',
            'packages/lib/src/stores/**',
            'packages/lib/src/utils/**'
        ],
        ignores: ['**/server/**'],
        rules: {
            'no-restricted-syntax': [
                'error',
                {
                    selector: "MemberExpression[object.name='supabase'][property.name!='auth']",
                    message:
                        'Browser code uses the Supabase client for auth only; read and write data through a first-party endpoint backed by @idstead/data.'
                }
            ]
        }
    },
    {
        files: ['packages/mdrs/core/**'],
        rules: {
            '@typescript-eslint/no-restricted-imports': [
                'error',
                {
                    patterns: [
                        {
                            regex: '^(@supabase/|#lib|@idstead/|\\$app/|\\$lib|svelte($|/))',
                            allowTypeImports: true,
                            message:
                                '@mdrs/core is a standalone engine: no app, lib, Svelte or data-access imports; inject resolvers instead.'
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
                            regex: '(^|/)server/|^(@supabase/|#lib|@idstead/(lib|mdrs|ui)($|/))',
                            allowTypeImports: true,
                            message:
                                '@idstead/ui is the design system: browser-safe, and it may only depend on @idstead/domain.'
                        }
                    ]
                }
            ]
        }
    },
    {
        files: ['packages/mdrs/dom/**'],
        rules: {
            '@typescript-eslint/no-restricted-imports': [
                'error',
                {
                    patterns: [
                        {
                            regex: '(^|/)server/|^(@supabase/|#lib|@idstead/(lib|editor)($|/))',
                            allowTypeImports: true,
                            message:
                                '@mdrs/dom is the browser side of MDRS: it may depend on @idstead/ui, @idstead/domain and @mdrs/core only.'
                        }
                    ]
                }
            ]
        }
    },
    {
        files: ['packages/mdrs/editor/**'],
        rules: {
            '@typescript-eslint/no-restricted-imports': [
                'error',
                {
                    patterns: [
                        {
                            regex: '(^|/)server/|^(@supabase/|#lib|@idstead/lib($|/))',
                            allowTypeImports: true,
                            message:
                                '@mdrs/editor takes data access through props: no lib, Supabase or server imports.'
                        }
                    ]
                }
            ]
        }
    },
    {
        files: [
            'apps/*/src/routes/**/*.ts',
            'apps/*/src/hooks.server.ts',
            'apps/api/src/**/*.ts',
            'apps/jobs/src/**/*.ts',
            'packages/lib/src/server/**/*.ts'
        ],
        ignores: ['packages/lib/src/server/data.ts', '**/*.svelte.ts'],
        rules: {
            '@typescript-eslint/no-restricted-imports': [
                'error',
                {
                    patterns: [
                        {
                            group: ['@idstead/data'],
                            importNamePattern: '^createSupabase',
                            message:
                                'Build data stores through dataStores() in packages/lib/src/server/data.ts, the only place that picks a data adapter.'
                        }
                    ]
                }
            ]
        }
    },
    {
        files: ['packages/data/**'],
        rules: {
            '@typescript-eslint/no-restricted-imports': [
                'error',
                {
                    patterns: [
                        {
                            regex: '^(#lib|@idstead/(?!domain($|/))|\\$app/|\\$lib|svelte($|/))',
                            allowTypeImports: true,
                            message:
                                '@idstead/data is the server-only data layer: it may depend on @idstead/domain and @supabase/* only.'
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
                            regex: '^(@supabase/|#lib|@idstead/|\\$app/|\\$lib|svelte($|/))',
                            allowTypeImports: true,
                            message:
                                '@idstead/domain holds pure, framework-free code: no workspace, Svelte, SvelteKit or Supabase imports.'
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
