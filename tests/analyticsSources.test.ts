// SPDX-FileCopyrightText: 2026 Farhan Kurnia Pratama
//
// SPDX-License-Identifier: AGPL-3.0-only

import { expect, test } from 'bun:test';
import { analyticsSources } from '../packages/lib/src/server/analytics.ts';

test('allows the script and collector of each analytics provider', () => {
    expect(analyticsSources({ provider: 'none' } as never)).toEqual({
        script: [],
        connect: [],
        img: []
    });
    const umami = analyticsSources({
        provider: 'umami',
        scriptUrl: 'https://stats.example.com/script.js'
    } as never);
    expect(umami.script).toEqual(['https://stats.example.com']);
    expect(umami.connect).toContain('https://stats.example.com');
    const plausible = analyticsSources({
        provider: 'plausible',
        scriptUrl: 'https://plausible.io/js/script.js'
    } as never);
    expect(plausible.script).toEqual(['https://plausible.io']);
    const cloudflare = analyticsSources({ provider: 'cloudflare' } as never);
    expect(cloudflare.script).toEqual(['https://static.cloudflareinsights.com']);
    expect(cloudflare.connect).toEqual(['https://cloudflareinsights.com']);
});
