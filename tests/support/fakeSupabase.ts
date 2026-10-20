import type { SupabaseClient } from '@supabase/supabase-js';

export type Row = Record<string, unknown>;

export type FakeTables = Record<string, Row[]>;

type Filter = { column: string; test: (value: unknown) => boolean };

const STORAGE_ORIGIN = 'https://storage.test/blog-posts/';

function likePattern(pattern: string, insensitive: boolean) {
    let source = '';
    for (let i = 0; i < pattern.length; i++) {
        const char = pattern[i];
        if (char === '\\' && i + 1 < pattern.length) source += escapeRegex(pattern[++i]);
        else if (char === '%') source += '.*';
        else if (char === '_') source += '.';
        else source += escapeRegex(char);
    }
    return new RegExp(`^${source}$`, insensitive ? 'is' : 's');
}

function escapeRegex(char: string) {
    return char.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function parseOr(expression: string): Array<(row: Row) => boolean> {
    return expression.split(',').map(part => {
        const [column, operator, ...rest] = part.split('.');
        const value = rest.join('.');
        if (operator !== 'ilike') throw new Error(`Unsupported or() operator ${operator}`);
        const pattern = likePattern(value, true);
        return row => typeof row[column] === 'string' && pattern.test(row[column] as string);
    });
}

function foreignKey(parentTable: string) {
    const name = parentTable.replace(/^db_/, '');
    return `${name.endsWith('ies') ? name.slice(0, -3) + 'y' : name.replace(/s$/, '')}_id`;
}

function embeds(columns: string) {
    return [...columns.matchAll(/(?:(\w+):)?(db_\w+)\(([^)]*)\)/g)]
        .filter(([, , , fields]) => !fields.includes('!'))
        .map(([, alias, table, fields]) => ({
            alias: alias ?? table,
            table,
            count: fields.trim() === 'count',
            fields: fields.split(',').map(field => field.trim())
        }));
}

function inner(columns: string) {
    const match = columns.match(/(\w+):db_posts!inner\(([^)]*)\)/);
    return match ? { alias: match[1], fields: match[2].split(',').map(f => f.trim()) } : null;
}

export interface FakeOptions {
    defaults?: Record<string, () => Row>;
    afterInsert?: (table: string, row: Row, tables: FakeTables) => void;
    beforeUpdate?: (
        table: string,
        row: Row,
        patch: Row,
        tables: FakeTables
    ) => { code?: string; message: string } | null;
    rpc?: Record<
        string,
        (
            args: Row,
            tables: FakeTables
        ) => { data: unknown; error: { code?: string; message: string } | null }
    >;
}

function project(row: Row, columns: string): Row {
    if (columns.trim() === '*') return { ...row };
    return Object.fromEntries(
        columns.split(',').map(column => [column.trim(), row[column.trim()]])
    );
}

export function fakeSupabase(
    tables: FakeTables,
    files: Record<string, string> = {},
    options: FakeOptions = {}
) {
    function query(table: string) {
        let write: { rows: Row[]; conflict: string[] | null } | null = null;
        let written: Row[] | null = null;
        let patch: Row | null = null;
        let removing = false;

        function performDelete() {
            if (written) return written;
            const all = tables[table] ?? [];
            written = all.filter(row => filters.every(f => f.test(row[f.column])));
            tables[table] = all.filter(row => !written!.includes(row));
            return written;
        }

        let updateError: { code?: string; message: string } | null = null;

        function performUpdate() {
            if (written) return written;
            written = (tables[table] ?? []).filter(row =>
                filters.every(f => f.test(row[f.column]))
            );
            for (const row of written) {
                updateError = options.beforeUpdate?.(table, row, patch!, tables) ?? null;
                if (updateError) {
                    written = [];
                    break;
                }
            }
            for (const row of written) Object.assign(row, patch);
            return written;
        }

        function performWrite() {
            if (written) return written;
            written = [];
            for (const values of write!.rows) {
                const row = { ...(options.defaults?.[table]?.() ?? {}), ...values };
                const existing =
                    write!.conflict
                    && (tables[table] ?? []).some(item =>
                        write!.conflict!.every(column => item[column] === row[column])
                    );
                if (existing) continue;
                (tables[table] ??= []).push(row);
                options.afterInsert?.(table, row, tables);
                written.push(row);
            }
            return written;
        }
        const filters: Filter[] = [];
        const embedFilters: Filter[] = [];
        const orders: Array<{ column: string; ascending: boolean }> = [];
        let columns = '*';
        let selected = false;
        let withCount = false;
        let range: [number, number] | null = null;
        let max = Infinity;
        let ors: Array<(row: Row) => boolean> | null = null;

        function rows() {
            const relation = inner(columns);
            let result = (tables[table] ?? []).map(row => {
                const copy: Row = { ...row };
                for (const { alias, table: child, count, fields } of embeds(columns)) {
                    const key = foreignKey(table);
                    const related = (tables[child] ?? []).filter(
                        item =>
                            item[key] === row.id
                            && embedFilters
                                .filter(f => f.column.startsWith(`${alias}.`))
                                .every(f => f.test(item[f.column.slice(alias.length + 1)]))
                    );
                    copy[alias] =
                        count ?
                            [{ count: related.length }]
                        :   related.map(item =>
                                Object.fromEntries(fields.map(field => [field, item[field]]))
                            );
                }
                if (relation) {
                    const post = tables.db_posts.find(p => p.id === row.post_id);
                    copy[relation.alias] =
                        post ?
                            Object.fromEntries(relation.fields.map(field => [field, post[field]]))
                        :   null;
                }
                return copy;
            });
            if (relation) result = result.filter(row => row[relation.alias] !== null);
            result = result.filter(row =>
                filters.every(f => {
                    const [head, field] = f.column.split('.');
                    const value =
                        field && relation && head === relation.alias ?
                            (row[head] as Row)[field]
                        :   row[f.column];
                    return f.test(value);
                })
            );
            if (ors) result = result.filter(row => ors!.some(test => test(row)));
            result.sort((a, b) => {
                for (const { column, ascending } of orders) {
                    const x = String(a[column] ?? '');
                    const y = String(b[column] ?? '');
                    if (x !== y) return (x < y ? -1 : 1) * (ascending ? 1 : -1);
                }
                return 0;
            });
            return result;
        }

        function resolve() {
            if (removing)
                return {
                    data:
                        selected ?
                            performDelete().map(row => project(row, columns))
                        :   (performDelete(), null),
                    count: null,
                    error: null
                };
            if (patch) {
                const data =
                    selected ?
                        performUpdate().map(row => project(row, columns))
                    :   (performUpdate(), null);
                return updateError ?
                        { data: null, count: null, error: updateError }
                    :   { data, count: null, error: null };
            }
            if (write)
                return {
                    data:
                        selected ?
                            performWrite().map(row => project(row, columns))
                        :   (performWrite(), null),
                    count: null,
                    error: null
                };
            const all = rows();
            const count = withCount ? all.length : null;
            if (range) {
                const [from, to] = range;
                if (from > 0 && from >= all.length)
                    return { data: null, count, error: { code: 'PGRST103', message: 'range' } };
                return { data: all.slice(from, to + 1).slice(0, max), count, error: null };
            }
            return { data: all.slice(0, max), count, error: null };
        }

        const builder = {
            select(fields = '*', options?: { count?: string; head?: boolean }) {
                columns = fields;
                selected = true;
                withCount = options?.count === 'exact';
                return builder;
            },
            eq(column: string, value: unknown) {
                const filter = { column, test: (actual: unknown) => actual === value };
                if (embeds(columns).some(({ alias }) => column.startsWith(`${alias}.`)))
                    embedFilters.push(filter);
                else filters.push(filter);
                return builder;
            },
            neq(column: string, value: unknown) {
                filters.push({ column, test: actual => actual !== value });
                return builder;
            },
            is(column: string, value: unknown) {
                filters.push({ column, test: actual => actual === value });
                return builder;
            },
            like(column: string, pattern: string) {
                const regex = likePattern(pattern, false);
                filters.push({
                    column,
                    test: value => typeof value === 'string' && regex.test(value)
                });
                return builder;
            },
            or(expression: string) {
                ors = parseOr(expression);
                return builder;
            },
            order(column: string, options?: { ascending?: boolean }) {
                orders.push({ column, ascending: options?.ascending !== false });
                return builder;
            },
            range(from: number, to: number) {
                range = [from, to];
                return builder;
            },
            limit(count: number) {
                max = count;
                return builder;
            },
            insert(values: Row | Row[]) {
                write = { rows: [values].flat(), conflict: null };
                return builder;
            },
            lt(column: string, value: unknown) {
                filters.push({ column, test: actual => String(actual) < String(value) });
                return builder;
            },
            lte(column: string, value: unknown) {
                filters.push({ column, test: actual => String(actual) <= String(value) });
                return builder;
            },
            delete() {
                removing = true;
                return builder;
            },
            update(values: Row) {
                patch = values;
                return builder;
            },
            upsert(values: Row | Row[], settings?: { onConflict?: string }) {
                write = {
                    rows: [values].flat(),
                    conflict: settings?.onConflict?.split(',').map(c => c.trim()) ?? null
                };
                return builder;
            },
            async maybeSingle() {
                const { data, error } = resolve();
                return { data: (data ?? [])[0] ?? null, error };
            },
            async single() {
                const { data, error } = resolve();
                const row = (data ?? [])[0];
                return row ?
                        { data: row, error }
                    :   { data: null, error: error ?? { code: 'PGRST116', message: 'no rows' } };
            },
            then(onFulfilled: (value: ReturnType<typeof resolve>) => unknown) {
                return Promise.resolve(resolve()).then(onFulfilled);
            }
        };
        return builder;
    }

    const db = {
        from: (table: string) => query(table),
        rpc: async (name: string, args: Row = {}) => {
            const handler = options.rpc?.[name];
            return handler ?
                    handler(args, tables)
                :   { data: null, error: { message: `Unknown function ${name}` } };
        },
        storage: {
            from: () => ({
                getPublicUrl: (path: string) => ({ data: { publicUrl: STORAGE_ORIGIN + path } }),
                download: async (path: string) =>
                    path in files ?
                        { data: new Blob([files[path]]), error: null }
                    :   { data: null, error: { message: 'Object not found' } },
                upload: async (path: string, body: Blob, settings?: { upsert?: boolean }) => {
                    if (path in files && !settings?.upsert)
                        return { data: null, error: { message: 'The resource already exists' } };
                    files[path] = await body.text();
                    return { data: { path }, error: null };
                },
                remove: async (paths: string[]) => {
                    for (const path of paths) delete files[path];
                    return { data: paths.map(name => ({ name })), error: null };
                }
            })
        }
    } as unknown as SupabaseClient;

    const fetchFn = (async (input: string | URL) => {
        const path = String(input).replace(STORAGE_ORIGIN, '');
        return path in files ? new Response(files[path]) : new Response('missing', { status: 404 });
    }) as unknown as typeof fetch;

    return { db, fetch: fetchFn };
}
