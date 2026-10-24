export type D1Row = Record<string, unknown>;

export interface D1Statement {
    bind(...values: unknown[]): D1Statement;
    first<T = D1Row>(): Promise<T | null>;
    all<T = D1Row>(): Promise<{ results: T[] }>;
    run(): Promise<{ meta: { changes: number } }>;
}

export interface D1Like {
    prepare(query: string): D1Statement;
    batch<T = D1Row>(statements: D1Statement[]): Promise<Array<{ results: T[] }>>;
}

interface ContentObject {
    text(): Promise<string>;
}

export interface ContentBucket {
    get(key: string): Promise<ContentObject | null>;
    put(
        key: string,
        value: string,
        options?: { httpMetadata?: { contentType?: string } }
    ): Promise<unknown>;
    delete(keys: string | string[]): Promise<void>;
}

export function flag(value: unknown): boolean {
    return value === 1 || value === true;
}

export function jsonStrings(value: unknown): string[] {
    if (typeof value !== 'string') return [];
    try {
        const parsed: unknown = JSON.parse(value);
        return Array.isArray(parsed) ?
                parsed.filter((item): item is string => typeof item === 'string')
            :   [];
    } catch {
        return [];
    }
}

export function likePattern(term: string): string {
    return `%${term.replace(/[\\%_]/g, character => `\\${character}`)}%`;
}

export function contentKey(storagePath: string): string {
    return `content/${storagePath}`;
}

export async function readContent(
    bucket: ContentBucket,
    storagePath: string | null,
    timeoutMs?: number
): Promise<string | null> {
    if (!storagePath) return null;
    const read = bucket
        .get(contentKey(storagePath))
        .then(object => (object ? object.text() : null))
        .catch(() => null);
    if (!timeoutMs) return read;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const timeout = new Promise<null>(resolve => {
        timer = setTimeout(() => resolve(null), timeoutMs);
    });
    try {
        return await Promise.race([read, timeout]);
    } finally {
        if (timer !== undefined) clearTimeout(timer);
    }
}
