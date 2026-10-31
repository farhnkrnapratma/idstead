// SPDX-FileCopyrightText: 2026 Farhan Kurnia Pratama
//
// SPDX-License-Identifier: AGPL-3.0-only

import { describe, expect, test } from 'bun:test';
import { discoveryLinks } from '../packages/lib/src/server/discoveryLinks.ts';

const relations = (links: string[]) =>
    links.map(link => link.match(/rel="([^"]+)"/)?.[1]).filter(Boolean);

describe('discovery Link headers', () => {
    test('list every registered agent discovery relation', () => {
        const links = discoveryLinks('https://api.example.com');
        expect(new Set(relations(links))).toEqual(
            new Set(['api-catalog', 'service-desc', 'service-doc', 'describedby', 'ard', 'sitemap'])
        );
    });

    test('point the API description and docs at the API host, like the API catalog', () => {
        const links = discoveryLinks('https://api.example.com/');
        expect(links).toContain(
            '<https://api.example.com/v1/openapi.json>; rel="service-desc"; type="application/json"'
        );
        expect(links).toContain(
            '<https://api.example.com/v1>; rel="service-doc"; type="text/markdown"'
        );
    });

    test('every value is a single RFC 8288 link-value', () => {
        for (const link of discoveryLinks('https://api.example.com'))
            expect(link).toMatch(/^<[^<>\s]+>(; [a-z-]+="[^"]+")+$/);
    });
});
