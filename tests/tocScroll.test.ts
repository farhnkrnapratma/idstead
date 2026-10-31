// SPDX-FileCopyrightText: 2026 Farhan Kurnia Pratama
//
// SPDX-License-Identifier: AGPL-3.0-only

import { describe, expect, test } from 'bun:test';
import { proportionalScrollTop } from '../apps/web/src/lib/components/tocScroll.ts';

const article = { scrollHeight: 10_800, clientHeight: 800 };

describe('proportionalScrollTop', () => {
    test('moves the article by the same share the table of contents moved', () => {
        expect(
            proportionalScrollTop({ scrollTop: 0, scrollHeight: 1200, clientHeight: 600 }, article)
        ).toBe(0);
        expect(
            proportionalScrollTop(
                { scrollTop: 300, scrollHeight: 1200, clientHeight: 600 },
                article
            )
        ).toBe(5000);
        expect(
            proportionalScrollTop(
                { scrollTop: 600, scrollHeight: 1200, clientHeight: 600 },
                article
            )
        ).toBe(10_000);
    });

    test('stays inside the article when the source overshoots', () => {
        expect(
            proportionalScrollTop(
                { scrollTop: 900, scrollHeight: 1200, clientHeight: 600 },
                article
            )
        ).toBe(10_000);
        expect(
            proportionalScrollTop(
                { scrollTop: -40, scrollHeight: 1200, clientHeight: 600 },
                article
            )
        ).toBe(0);
    });

    test('returns 0 when either side cannot scroll', () => {
        expect(
            proportionalScrollTop({ scrollTop: 0, scrollHeight: 600, clientHeight: 600 }, article)
        ).toBe(0);
        expect(
            proportionalScrollTop(
                { scrollTop: 100, scrollHeight: 1200, clientHeight: 600 },
                { scrollHeight: 500, clientHeight: 800 }
            )
        ).toBe(0);
    });
});
