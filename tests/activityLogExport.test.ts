// SPDX-FileCopyrightText: 2026 Farhan Kurnia Pratama
//
// SPDX-License-Identifier: AGPL-3.0-only

import { describe, expect, test } from 'bun:test';
import {
    formatActivityLogText,
    generateActivityLogPdf,
    type ActivityLogRow
} from '../packages/lib/src/server/activityLogExport.ts';

const row = (overrides: Partial<ActivityLogRow> = {}): ActivityLogRow => ({
    created_at: '2026-06-15T12:34:56.789Z',
    actor: 'admin',
    action: 'blog.update',
    category: 'blog',
    summary: 'Updated &quot;Post&quot; &amp; &lt;b&gt; &#39;x&#39; &#x2F; café',
    ip: '203.0.113.9',
    user_agent: 'Agent/1.0',
    ...overrides
});

describe('formatActivityLogText', () => {
    test('describes an empty range', () => {
        expect(formatActivityLogText([])).toBe('No activity in the selected range.\n');
    });

    test('formats rows and decodes entities', () => {
        const output = formatActivityLogText([
            row(),
            row({ actor: null, ip: null, user_agent: null, summary: '' })
        ]);
        const [first, second] = output.trimEnd().split('\n\n');
        expect(first).toBe(
            [
                'time: 2026-06-15 12:34:56 UTC',
                'category: blog',
                'action: blog.update',
                'actor: admin',
                `summary: Updated "Post" & <b> 'x' / caf`,
                'ip: 203.0.113.9',
                'user_agent: Agent/1.0'
            ].join('\n')
        );
        expect(second).toContain('actor: unknown');
        expect(second).toContain('ip: n/a');
        expect(second).toContain('user_agent: n/a');
        expect(output.endsWith('\n')).toBe(true);
    });
});

describe('generateActivityLogPdf', () => {
    const header = (bytes: Uint8Array) => new TextDecoder().decode(bytes.slice(0, 5));

    test('renders an empty document', async () => {
        const bytes = await generateActivityLogPdf([]);
        expect(header(bytes)).toBe('%PDF-');
    });

    test('renders rows and paginates', async () => {
        const rows = Array.from({ length: 80 }, (_, index) =>
            row({ summary: `entry ${index} ` + 'x'.repeat(200), actor: null, ip: null })
        );
        const bytes = await generateActivityLogPdf(rows);
        expect(header(bytes)).toBe('%PDF-');
        const { PDFDocument } = await import('pdf-lib');
        const document = await PDFDocument.load(bytes);
        expect(document.getPageCount()).toBeGreaterThan(1);
        const single = await PDFDocument.load(await generateActivityLogPdf([row()]));
        expect(single.getPageCount()).toBe(1);
    });
});
