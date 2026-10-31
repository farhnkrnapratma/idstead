// SPDX-FileCopyrightText: 2026 Farhan Kurnia Pratama
//
// SPDX-License-Identifier: AGPL-3.0-only

import path from 'node:path';
import { defineConfig, includeIgnoreFile } from 'eslint/config';
import tseslint from 'typescript-eslint';
import svelte from 'eslint-plugin-svelte';

const typed = { projectService: true, extraFileExtensions: ['.svelte'] };

export default defineConfig(
    includeIgnoreFile(path.resolve(import.meta.dirname, '.gitignore')),
    { files: ['**/*.ts'], languageOptions: { parser: tseslint.parser, parserOptions: typed } },
    svelte.configs.base,
    {
        files: ['**/*.svelte', '**/*.svelte.ts'],
        languageOptions: { parserOptions: { ...typed, parser: tseslint.parser } }
    },
    {
        files: ['**/*.ts', '**/*.svelte'],
        plugins: { '@typescript-eslint': tseslint.plugin },
        rules: { '@typescript-eslint/no-deprecated': 'error' }
    }
);
