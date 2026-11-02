// SPDX-FileCopyrightText: 2026 Farhan Kurnia Pratama
//
// SPDX-License-Identifier: AGPL-3.0-only

import { describe, expect, test } from 'bun:test';
import path from 'node:path';

const read = (name: string) =>
    Bun.file(path.resolve(import.meta.dir, '../.github/workflows', name)).text();

const CHECKOUT = /uses: actions\/checkout@[0-9a-f]{40}/g;
const TRUSTED = 'contains(fromJSON(\'["OWNER","MEMBER","COLLABORATOR"]\'), ';

describe('GitHub workflows', () => {
    test.each(['claude.yml', 'claude-code-review.yml'])(
        '%s keeps no checkout credentials',
        async name => {
            const text = await read(name);
            const checkouts = text.match(CHECKOUT)?.length ?? 0;
            expect(checkouts).toBeGreaterThan(0);
            expect(text.match(/persist-credentials: false/g)?.length).toBe(checkouts);
        }
    );

    test('the Claude job runs only for owners, members and collaborators', async () => {
        const text = await read('claude.yml');
        for (const field of [
            'github.event.comment.author_association',
            'github.event.review.author_association',
            'github.event.issue.author_association'
        ])
            expect(text).toContain(`${TRUSTED}${field})`);
        expect(text.split(TRUSTED).length - 1).toBe(4);
    });

    test('the Claude job still listens to the four comment and issue events', async () => {
        const text = await read('claude.yml');
        for (const event of [
            'issue_comment:',
            'pull_request_review_comment:',
            'issues:',
            'pull_request_review:'
        ])
            expect(text).toContain(`    ${event}`);
    });
});
