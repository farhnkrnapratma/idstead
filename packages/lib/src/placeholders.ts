const OPEN = '\uE000';
const CLOSE = '\uE001';
const MAX_PLACEHOLDER_EXPANSIONS = 5000;

export const PLACEHOLDER_TOKEN_RE = /\uE000[A-Z_]+_\d+\uE001/g;
export const PLACEHOLDER_CHAR_RE = /[\uE000\uE001]/g;

export function placeholderKey(kind: string, index: number): string {
    return `${OPEN}${kind}_${index}${CLOSE}`;
}

export function placeholderPrefix(kind: string): string {
    return `${OPEN}${kind}_`;
}

export function placeholderPattern(kind: string): string {
    return `${OPEN}${kind}_\\d+${CLOSE}`;
}

export function stripPlaceholderChars(text: string): string {
    return text.replace(PLACEHOLDER_CHAR_RE, '');
}

export function restoreAllPlaceholders(text: string, store: Map<string, string>): string {
    let budget = MAX_PLACEHOLDER_EXPANSIONS;
    const active = new Set<string>();
    const expand = (input: string): string =>
        input.replace(PLACEHOLDER_TOKEN_RE, token => {
            const value = store.get(token);
            if (value === undefined || active.has(token) || budget <= 0) return token;
            budget--;
            active.add(token);
            const expanded = expand(value);
            active.delete(token);
            return expanded;
        });
    return expand(text);
}

const BACKTICK_RUN_RE = /`+/g;

export function protectInlineCode(
    text: string,
    prefix: string,
    store: Map<string, string>
): string {
    return text
        .split('\n')
        .map(line => {
            if (!line.includes('`')) return line;
            const runs = [...line.matchAll(BACKTICK_RUN_RE)].map(match => ({
                start: match.index ?? 0,
                end: (match.index ?? 0) + match[0].length
            }));
            const next = new Array<number>(runs.length).fill(-1);
            const later = new Map<number, number>();
            for (let index = runs.length - 1; index >= 0; index--) {
                const length = runs[index].end - runs[index].start;
                next[index] = later.get(length) ?? -1;
                later.set(length, index);
            }
            let output = '';
            let cursor = 0;
            let index = 0;
            while (index < runs.length) {
                const close = next[index];
                if (close === -1) {
                    index++;
                    continue;
                }
                const key = placeholderKey(prefix, store.size);
                store.set(key, line.slice(runs[index].start, runs[close].end));
                output += line.slice(cursor, runs[index].start) + key;
                cursor = runs[close].end;
                index = close + 1;
            }
            return output + line.slice(cursor);
        })
        .join('\n');
}

export function replaceLineBlocks(
    text: string,
    opening: (line: string) => RegExpMatchArray | null,
    closingKey: (line: string) => string | null,
    openingKey: (match: RegExpMatchArray) => string,
    render: (match: RegExpMatchArray, body: string, block: string) => string
): string {
    const lines = text.split('\n');
    const bare = lines.map(line => line.replace(/\r$/, ''));
    const closers = new Map<string, number[]>();
    bare.forEach((line, index) => {
        const key = closingKey(line);
        if (key === null) return;
        const list = closers.get(key);
        if (list) list.push(index);
        else closers.set(key, [index]);
    });
    const pointers = new Map<string, number>();
    const output: string[] = [];
    for (let index = 0; index < lines.length; index++) {
        const match = opening(bare[index]);
        if (!match) {
            output.push(lines[index]);
            continue;
        }
        const key = openingKey(match);
        const list = closers.get(key) ?? [];
        let pointer = pointers.get(key) ?? 0;
        while (pointer < list.length && list[pointer] < index + 2) pointer++;
        pointers.set(key, pointer);
        if (pointer === list.length) {
            output.push(lines[index]);
            continue;
        }
        const close = list[pointer];
        output.push(
            render(
                match,
                lines.slice(index + 1, close).join('\n'),
                lines.slice(index, close + 1).join('\n')
            )
        );
        index = close;
    }
    return output.join('\n');
}

const FENCE_OPEN_RE = /^[ \t]*(`{3,}|~{3,})/;

export function protectFencedCode(
    text: string,
    prefix: string,
    store: Map<string, string>
): string {
    const lines = text.split('\n');
    const output: string[] = [];
    for (let index = 0; index < lines.length; index++) {
        const fence = lines[index].match(FENCE_OPEN_RE)?.[1];
        if (!fence) {
            output.push(lines[index]);
            continue;
        }
        const closing = new RegExp(`^[ \\t]*\\${fence[0]}{${fence.length},}[ \\t]*\\r?$`);
        let close = index + 1;
        while (close < lines.length && !closing.test(lines[close])) close++;
        const end = Math.min(close, lines.length - 1);
        const key = placeholderKey(prefix, store.size);
        store.set(key, lines.slice(index, end + 1).join('\n'));
        output.push(key);
        index = end;
    }
    return output.join('\n');
}
