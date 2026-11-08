// SPDX-FileCopyrightText: 2026 Farhan Kurnia Pratama
//
// SPDX-License-Identifier: AGPL-3.0-only

import { describe, expect, test } from 'bun:test';
import {
    contentDigest,
    discoveryOperations,
    skillDocument
} from '../packages/lib/src/server/apiDiscovery.ts';

describe('API discovery helpers', () => {
    test('lists read operations under the configured API origin', () => {
        const operations = discoveryOperations('https://api.example.com/');
        expect(operations.length).toBeGreaterThan(0);
        for (const operation of operations) {
            expect(operation.url.startsWith('https://api.example.com/v1')).toBe(true);
            expect(operation.name).toMatch(/^[a-z0-9-]*$/);
            expect(operation.description.length).toBeGreaterThan(0);
            expect(operation.mediaType.length).toBeGreaterThan(0);
        }
    });

    test('requires a configured API base URL', () => {
        expect(() => discoveryOperations(null)).toThrow('PUBLIC_API_BASE_URL is not configured.');
        expect(() => discoveryOperations('   ')).toThrow('PUBLIC_API_BASE_URL is not configured.');
    });

    test('renders a skill document for a listed operation and nothing for an unknown one', () => {
        const [first] = discoveryOperations('https://api.example.com');
        const document = skillDocument(first.name, 'https://api.example.com');
        expect(document).toContain(`name: ${first.name}`);
        expect(document).toContain(`Use GET ${first.url}.`);
        expect(document).toContain('read-only');
        expect(skillDocument('no-such-operation', 'https://api.example.com')).toBeNull();
    });

    test('computes a SHA-256 digest with the sha256 prefix', async () => {
        expect(await contentDigest('')).toBe(
            'sha256:e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855'
        );
        expect(await contentDigest('abc')).toMatch(/^sha256:[0-9a-f]{64}$/);
    });
});
