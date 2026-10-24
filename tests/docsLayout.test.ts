import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { describe, expect, test } from 'bun:test';

const root = resolve(import.meta.dir, '..');
const docs = join(root, 'docs');
const EXEMPT = new Set(['README.md', 'SHOWCASE.md']);
const ENTRY_RE = /^(\d{3})-[a-z0-9]+(?:-[a-z0-9]+)*(\.md)?$/;
const ROOT_FILES = ['README.md', 'CLAUDE.md', 'CONTRIBUTING.md', 'SECURITY.md'];

function directories(dir: string): string[] {
    return [
        dir,
        ...readdirSync(dir)
            .map(name => join(dir, name))
            .filter(path => statSync(path).isDirectory())
            .flatMap(directories)
    ];
}

function markdownFiles(dir: string): string[] {
    return readdirSync(dir).flatMap(name => {
        const path = join(dir, name);
        if (statSync(path).isDirectory()) return markdownFiles(path);
        return path.endsWith('.md') ? [path] : [];
    });
}

function stripFences(text: string): string {
    return text.replace(/^(`{3,}|~{3,})[^\n]*\n[\s\S]*?^\1[ \t]*$/gm, '');
}

function stripCode(text: string): string {
    return stripFences(text).replace(/`[^`\n]*`/g, '');
}

function slug(text: string): string {
    return text
        .replace(/`/g, '')
        .toLowerCase()
        .replace(/[^\p{L}\p{N}\s_-]/gu, '')
        .trim()
        .replace(/\s/g, '-');
}

function anchors(file: string): Set<string> {
    const found = new Set<string>();
    const seen = new Map<string, number>();
    for (const line of stripFences(readFileSync(file, 'utf8')).split('\n')) {
        const heading = line.match(/^#{1,6}\s+(.*)$/);
        if (!heading) continue;
        const base = slug(heading[1]);
        const count = seen.get(base) ?? 0;
        seen.set(base, count + 1);
        found.add(count ? `${base}-${count}` : base);
    }
    return found;
}

describe('docs layout', () => {
    for (const dir of directories(docs)) {
        test(`${relative(root, dir) || 'docs'} is numbered 001…n`, () => {
            const entries = readdirSync(dir).filter(name => !EXEMPT.has(name));
            const bad = entries.filter(name => {
                const match = name.match(ENTRY_RE);
                const isDir = statSync(join(dir, name)).isDirectory();
                return !match || isDir === Boolean(match[2]);
            });
            expect(bad).toEqual([]);
            const numbers = entries.map(name => Number(name.slice(0, 3))).sort((a, b) => a - b);
            expect(numbers).toEqual(numbers.map((_, index) => index + 1));
        });
    }

    test('every relative link and anchor resolves', () => {
        const files = [...markdownFiles(docs), ...ROOT_FILES.map(name => join(root, name))];
        const broken: string[] = [];
        for (const file of files) {
            const text = stripCode(readFileSync(file, 'utf8'));
            for (const link of text.matchAll(/\]\(([^)\s]+)(?:\s+"[^"]*")?\)/g)) {
                const target = link[1];
                if (/^(?:https?:|mailto:|tel:|\/)/.test(target)) continue;
                const [path, hash] = target.split('#');
                const resolved = path ? resolve(dirname(file), path) : file;
                const where = `${relative(root, file)} → ${target}`;
                if (!existsSync(resolved)) broken.push(where);
                else if (hash && resolved.endsWith('.md') && !anchors(resolved).has(hash))
                    broken.push(where);
            }
        }
        expect(broken).toEqual([]);
    });
});
