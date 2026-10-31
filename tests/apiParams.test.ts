// SPDX-FileCopyrightText: 2026 Farhan Kurnia Pratama
//
// SPDX-License-Identifier: AGPL-3.0-only

import { describe, expect, test } from 'bun:test';
import {
    ApiRequestError,
    parseApiParams,
    parseBoolean,
    parsePositiveInt,
    resolveOutput
} from '../packages/lib/src/server/api/params.ts';

const url = (query: string) => new URL(`https://example.com/api/v1/author${query}`);

function rejection(run: () => unknown) {
    try {
        run();
    } catch (error) {
        if (error instanceof ApiRequestError) return error;
        throw error;
    }
    throw new Error('Expected an ApiRequestError.');
}

describe('API parameters', () => {
    test('accepts full names and one-letter aliases interchangeably', () => {
        const full = parseApiParams(url('?field=profile&output=md'), ['field', 'output']);
        const short = parseApiParams(url('?f=profile&o=md'), ['field', 'output']);
        expect(full.getAll('field')).toEqual(['profile']);
        expect(short.getAll('field')).toEqual(['profile']);
        expect(full.get('output')).toBe('md');
        expect(short.get('output')).toBe('md');
    });

    test('reads multi-value parameters from commas or repetition', () => {
        const commas = parseApiParams(url('?field=profile,resume'), ['field']);
        const repeated = parseApiParams(url('?f=profile&f=resume&f=profile'), ['field']);
        expect(commas.getAll('field')).toEqual(['profile', 'resume']);
        expect(repeated.getAll('field')).toEqual(['profile', 'resume']);
    });

    test('rejects a parameter sent under both its name and its alias', () => {
        const error = rejection(() => parseApiParams(url('?f=resume&field=resume'), ['field']));
        expect(error.status).toBe(400);
        expect(error.code).toBe('PARAM_CONFLICT');
    });

    test('rejects a repeated single-value parameter', () => {
        expect(rejection(() => parseApiParams(url('?o=md&o=json'), ['output'])).code).toBe(
            'PARAM_CONFLICT'
        );
    });

    test('rejects parameters the endpoint does not accept', () => {
        const error = rejection(() => parseApiParams(url('?format=md'), ['output']));
        expect(error.code).toBe('UNKNOWN_PARAMETER');
        expect(error.details).toContain("'format'");
        expect(rejection(() => parseApiParams(url('?f=resume'), ['output'])).code).toBe(
            'UNKNOWN_PARAMETER'
        );
    });

    test('lets output override Accept and rejects unsupported output', () => {
        const request = new Request('https://example.com', {
            headers: { Accept: 'text/markdown' }
        });
        const params = parseApiParams(url('?o=json'), ['output']);
        expect(resolveOutput(params, request, ['json', 'md'], 'json')).toBe('json');
        expect(
            resolveOutput(parseApiParams(url(''), ['output']), request, ['json', 'md'], 'json')
        ).toBe('md');
        expect(
            rejection(() =>
                resolveOutput(
                    parseApiParams(url('?o=pdf'), ['output']),
                    request,
                    ['json', 'md'],
                    'json'
                )
            ).code
        ).toBe('OUTPUT_UNSUPPORTED');
    });

    test('parses booleans strictly and clamps numbers', () => {
        expect(parseBoolean(parseApiParams(url('?c=false'), ['checksum']), 'checksum', true)).toBe(
            false
        );
        expect(parseBoolean(parseApiParams(url(''), ['checksum']), 'checksum', true)).toBe(true);
        expect(
            rejection(() =>
                parseBoolean(parseApiParams(url('?c=yes'), ['checksum']), 'checksum', true)
            ).code
        ).toBe('PARAM_INVALID');
        expect(parsePositiveInt('500', 20, 100)).toBe(100);
        expect(parsePositiveInt('abc', 20, 100)).toBe(20);
        expect(parsePositiveInt('0', 20, 100)).toBe(20);
    });
});
