import { describe, expect, test } from 'bun:test';
import {
    compact,
    createMediaCollector,
    errorMessage,
    nestComments,
    parseStamp,
    safeSegment,
    slugifyAlt,
    stripKeys
} from '../packages/lib/src/server/dataExportHelpers';

const hash = (char: string) => char.repeat(64);

describe('data export helpers', () => {
    test('parseStamp keeps valid stamps and falls back to UTC now', () => {
        expect(parseStamp('20261001-083926')).toBe('20261001-083926');
        expect(parseStamp('../../etc', new Date('2026-10-01T08:39:26Z'))).toBe('20261001-083926');
    });

    test('safeSegment blocks traversal', () => {
        expect(safeSegment('../a/b')).toBe('a-b');
        expect(safeSegment('..')).toBe('untitled');
        expect(safeSegment('hello world.pdf')).toBe('hello-world.pdf');
    });

    test('slugifyAlt handles empty, accents and collisions', () => {
        const used = new Set<string>();
        expect(slugifyAlt('Diagram Arsitéktur', 'image', used)).toBe('diagram-arsitektur');
        expect(slugifyAlt('Diagram Arsitéktur', 'image', used)).toBe('diagram-arsitektur-2');
        expect(slugifyAlt('', 'image', used)).toBe('image');
        expect(slugifyAlt('', 'image', used)).toBe('image-2');
    });

    test('media collector rewrites links and dedupes by hash', () => {
        const collector = createMediaCollector();
        const markdown = [
            `![Diagram](/blog/content/${hash('a')}.webp)`,
            `![Other](https://example.com/blog/content/${hash('a')}.webp)`,
            `<video controls src="/blog/content/${hash('b')}.mp4"></video>`,
            `![Demo clip](/blog/content/${hash('c')}.webm "Demo")`
        ].join('\n');
        expect(collector.rewrite(markdown)).toBe(
            [
                '![Diagram](assets/images/diagram.webp)',
                '![Other](assets/images/diagram.webp)',
                '<video controls src="assets/videos/video.mp4"></video>',
                '![Demo clip](assets/videos/demo-clip.webm "Demo")'
            ].join('\n')
        );
        expect([...collector.files]).toEqual([
            [`blog/content/${hash('a')}.webp`, 'assets/images/diagram.webp'],
            [`blog/content/${hash('c')}.webm`, 'assets/videos/demo-clip.webm'],
            [`blog/content/${hash('b')}.mp4`, 'assets/videos/video.mp4']
        ]);
    });

    test('nestComments builds replies without ids', () => {
        const row = (id: string, parent: string | null, at: string) => ({
            id,
            parent_id: parent,
            author_name: id,
            content: id,
            is_anonymous: false,
            is_admin: false,
            is_approved: true,
            created_at: at
        });
        const tree = nestComments([
            row('reply', 'root', '2026-01-02'),
            row('root', null, '2026-01-01'),
            row('orphan', 'missing', '2026-01-03')
        ]);
        expect(tree.map(node => node.author)).toEqual(['root', 'orphan']);
        expect(tree[0].replies[0].author).toBe('reply');
        expect(JSON.stringify(tree)).not.toContain('"id"');
    });

    test('stripKeys removes keys recursively', () => {
        expect(stripKeys([{ id: 1, a: { id: 2, b: 3 } }], ['id'])).toEqual([{ a: { b: 3 } }]);
    });

    test('compact drops empty values but keeps false and 0', () => {
        expect(
            compact({
                a: '',
                b: null,
                c: [],
                d: { e: null },
                f: false,
                g: 0,
                h: [{ i: '' }, { j: 'x' }],
                k: 'v'
            })
        ).toEqual({ f: false, g: 0, h: [{ j: 'x' }], k: 'v' });
        expect(compact([])).toEqual([]);
    });

    test('errorMessage reads plain error objects', () => {
        expect(errorMessage({ message: 'no such table: db_posts' })).toBe(
            'no such table: db_posts'
        );
        expect(errorMessage(new Error('boom'))).toBe('boom');
    });
});
