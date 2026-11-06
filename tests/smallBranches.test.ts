// SPDX-FileCopyrightText: 2026 Farhan Kurnia Pratama
//
// SPDX-License-Identifier: AGPL-3.0-only

import { describe, expect, test } from 'bun:test';
import { importPostDocument } from '../packages/mdrs/core/src/frontmatter';
import { activitySentence } from '../packages/lib/src/adminActivity.ts';
import { segmentRounding } from '../apps/admin/src/lib/chartRounding.ts';
import { parseAdminSettings } from '../packages/lib/src/adminSettings.ts';
import { highlightMarkdown } from '../packages/mdrs/editor/src/highlight.ts';
import { isHiddenCommand } from '../apps/web/src/lib/commandVisibility.ts';
import { page } from '$app/state';
import { MAX_DOCUMENT_LENGTH, validateDefineForSave } from '../packages/mdrs/core/src/define';
import { encodeIndexedPng } from '../packages/lib/src/png.ts';
import { runApi } from '../packages/lib/src/server/api/responses.ts';
import { ApiRequestError } from '../packages/lib/src/server/api/params.ts';

describe('small branches', () => {
    test('rejects markdown above the render limit before parsing it', async () => {
        const result = await validateDefineForSave('x'.repeat(MAX_DOCUMENT_LENGTH + 1), {});
        expect(result).toEqual({
            ok: false,
            errors: [{ message: 'Markdown document is too large to render.' }]
        });
    });

    test('rejects palette sizes outside 2 to 256 colors', () => {
        expect(() => encodeIndexedPng(new Uint8Array(4), 1, 1, 1)).toThrow('Invalid palette size.');
        expect(() => encodeIndexedPng(new Uint8Array(4), 1, 1, 257)).toThrow(
            'Invalid palette size.'
        );
    });

    test('maps API request errors to responses and rethrows everything else', async () => {
        const handled = await runApi(async () => {
            throw new ApiRequestError(400, 'BAD', 'Bad input.');
        });
        expect(handled.status).toBe(400);
        expect(await handled.json()).toMatchObject({ code: 'BAD', message: 'Bad input.' });
        await expect(
            runApi(async () => {
                throw new Error('unexpected');
            })
        ).rejects.toThrow('unexpected');
    });

    test('ignores tags that are neither a list nor text', () => {
        const imported = importPostDocument('---\ntitle: Hello\ntags: 5\n---\nBody');
        expect(imported.tags).toBeUndefined();
    });

    test('describes feedback votes in activity sentences', () => {
        const feedback = (vote: string) =>
            activitySentence({
                kind: 'post_feedback',
                page_title: 'Post',
                page_url: null,
                meta: { vote }
            } as never);
        expect(feedback('yes')).toContain('as helpful.');
        expect(feedback('no')).toContain('as unhelpful.');
    });

    test('marks the row edges of a chart segment', () => {
        const keys = ['a', 'b', 'c'];
        expect(segmentRounding({ a: 0, b: 1, c: 0 }, keys, 1)).toBe('all');
        expect(segmentRounding({ a: 1, b: 0, c: 1 }, keys, 1)).toBe('none');
    });

    test('keeps only known chart ranges', () => {
        expect(parseAdminSettings({ chartRange: '7d' })).toMatchObject({ chartRange: '7d' });
        expect(parseAdminSettings({ chartRange: 'forever' })).not.toHaveProperty('chartRange');
    });

    test('wraps display math in highlighted formula placeholders', () => {
        expect(highlightMarkdown('$$ x^2 $$')).toContain('hljs-formula');
    });

    test('hides the mailing command when newsletters are off', () => {
        (page as unknown as { data: Record<string, unknown> }).data = {
            newsletterEnabled: false,
            cookieConsent: true
        };
        expect(isHiddenCommand('/mailing')).toBe(true);
        (page as unknown as { data: Record<string, unknown> }).data = {
            newsletterEnabled: true,
            cookieConsent: true
        };
        expect(isHiddenCommand('/mailing')).toBe(false);
    });
});
