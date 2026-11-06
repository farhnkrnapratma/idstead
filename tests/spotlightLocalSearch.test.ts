// SPDX-FileCopyrightText: 2026 Farhan Kurnia Pratama
//
// SPDX-License-Identifier: AGPL-3.0-only

import { describe, expect, test } from 'bun:test';
import {
    dedupeItems,
    searchLocalItems,
    type LocalSearchMatcher,
    type LocalSearchSource
} from '../apps/web/src/lib/components/spotlight/localSearch.ts';
import type { SpotlightItem } from '../apps/web/src/lib/components/spotlight/types.ts';
import { resolveHistoryItem } from '../apps/web/src/lib/components/spotlight/history.ts';

const item = (id: string, title: string, extra: Partial<SpotlightItem> = {}): SpotlightItem =>
    ({ id, category: 'pages', title, ...extra }) as SpotlightItem;

const matcher: LocalSearchMatcher = {
    fuzzy: (target, query) => ({
        matched: target.toLowerCase().includes(query.toLowerCase()),
        score: 50
    }),
    compile: pattern => {
        try {
            return new RegExp(pattern, 'i');
        } catch {
            return null;
        }
    }
};

const source = (overrides: Partial<LocalSearchSource> = {}): LocalSearchSource => ({
    commands: [
        item('cmd-theme', '/theme', { subtitle: 'Switch the colour theme.' }),
        item('cmd-top', '/top', { subtitle: 'Scroll to the top of page.' }),
        item('cmd-share', 'Share this page', { subtitle: 'Open the share dialog.' })
    ],
    dynamicCommands: query => (query.startsWith('/mail') ? [item('dyn-mail', '/mailing')] : []),
    projects: [
        {
            name: 'idstead',
            desc: 'Personal site',
            url: 'https://example.com/idstead',
            tags: ['svelte', 'web', 'site', 'extra']
        },
        { name: 'mnn', desc: 'Notes', url: 'https://example.com/mnn' }
    ],
    links: [item('link-about', 'About', { subtitle: 'Who I am', url: '/about' })],
    ...overrides
});

describe('searchLocalItems', () => {
    test('returns nothing for a blank query', () => {
        expect(searchLocalItems('   ', false, source(), matcher)).toEqual([]);
    });

    test('lists every command for a lone slash, sorted by title', () => {
        const titles = searchLocalItems('/', false, source(), matcher).map(entry => entry.title);
        expect(titles).toEqual(
            ['/mailing', '/theme', '/top'].filter(title => titles.includes(title))
        );
    });

    test('ranks command prefixes and dynamic commands for slash queries', () => {
        const results = searchLocalItems('/the', false, source(), matcher);
        expect(results[0].id).toBe('cmd-theme');
        const dynamic = searchLocalItems('/mail', false, source(), matcher);
        expect(dynamic.map(entry => entry.id)).toContain('dyn-mail');
    });

    test('matches commands by subtitle and skips links for slash queries', () => {
        const results = searchLocalItems('/colour', false, source(), matcher);
        expect(results).toEqual([]);
        expect(
            searchLocalItems('colour', false, source(), matcher).map(entry => entry.id)
        ).toContain('cmd-theme');
        expect(searchLocalItems('/about', false, source(), matcher)).toEqual([]);
    });

    test('matches projects with a trimmed tag list and an icon', () => {
        const results = searchLocalItems('idstead', false, source(), matcher);
        const project = results.find(entry => entry.id === 'proj-idstead');
        expect(project).toMatchObject({
            category: 'projects',
            badge: 'Project',
            url: 'https://example.com/idstead'
        });
        expect(project?.tags).toEqual(['svelte', 'web', 'site']);
    });

    test('matches links by title and by subtitle outside slash queries', () => {
        expect(
            searchLocalItems('about', false, source(), matcher).map(entry => entry.id)
        ).toContain('link-about');
        expect(
            searchLocalItems('who i am', false, source(), matcher).map(entry => entry.id)
        ).toContain('link-about');
    });

    test('uses regular expressions for commands, projects and links', () => {
        const commands = searchLocalItems('^/th', true, source(), matcher);
        expect(commands.map(entry => entry.id)).toContain('cmd-theme');
        const tagged = searchLocalItems('svel', true, source(), matcher);
        expect(tagged.map(entry => entry.id)).toContain('proj-idstead');
        const links = searchLocalItems('About', true, source(), matcher);
        expect(links.map(entry => entry.id)).toContain('link-about');
    });

    test('drops invalid regular expressions instead of throwing', () => {
        const broken: LocalSearchMatcher = { ...matcher, compile: () => null };
        expect(searchLocalItems('[', true, source(), broken)).toEqual([]);
    });

    test('removes duplicate ids and titles', () => {
        const duplicated = source({ links: [item('cmd-top', '/top'), item('link-other', 'Top')] });
        const titles = searchLocalItems('top', false, duplicated, matcher).map(
            entry => entry.title
        );
        expect(new Set(titles.map(title => title.toLowerCase())).size).toBe(titles.length);
    });
});

describe('dedupeItems', () => {
    test('removes repeated ids, titles and urls', () => {
        const result = dedupeItems([
            item('a', 'One', { url: '/one' }),
            item('a', 'Other', { url: '/other' }),
            item('b', 'one', { url: '/second' }),
            item('c', 'Two', { url: '/one' }),
            item('d', 'Three')
        ]);
        expect(result.map(entry => entry.id)).toEqual(['a', 'd']);
    });
});

describe('resolveHistoryItem', () => {
    const historySource = {
        defaultCommands: [item('cmd-theme', '/theme')],
        dynamicCommands: (query: string) =>
            query === '/code clean' ?
                [item('dyn-code-clean', '/code clean')]
            :   [item('dyn-x', query)],
        projects: [{ name: 'idstead', desc: 'Site', url: 'https://example.com/idstead' }],
        results: [item('res-1', 'Result one')]
    };
    const entry = (id: string, title: string, extra: Record<string, unknown> = {}) =>
        ({ id, title, category: 'pages', subtitle: 'sub', ...extra }) as never;

    test('finds the default command, the minimal-code alias and dynamic commands', () => {
        expect(resolveHistoryItem(entry('cmd-theme', '/theme'), historySource)?.id).toBe(
            'cmd-theme'
        );
        expect(
            resolveHistoryItem(entry('dyn-code-minimal', '/code minimal'), historySource)?.id
        ).toBe('dyn-code-clean');
        expect(resolveHistoryItem(entry('dyn-y', '/other'), historySource)?.id).toBe('dyn-x');
    });

    test('rebuilds projects, posts and falls back to current results', () => {
        expect(resolveHistoryItem(entry('proj-idstead', 'idstead'), historySource)).toMatchObject({
            category: 'projects',
            url: 'https://example.com/idstead',
            badge: 'Project'
        });
        expect(
            resolveHistoryItem(entry('post-hello', 'Hello', { category: 'posts' }), historySource)
        ).toMatchObject({ category: 'posts', url: 'hello', badge: 'Post' });
        expect(resolveHistoryItem(entry('res-1', 'Result one'), historySource)?.id).toBe('res-1');
        expect(resolveHistoryItem(entry('gone', 'Gone'), historySource)).toBeNull();
    });
});
