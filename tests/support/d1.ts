import { Database, type SQLQueryBindings } from 'bun:sqlite';
import { readdirSync, readFileSync } from 'node:fs';
import type {
    ContentBucket,
    D1Like,
    D1Row,
    D1Statement
} from '../../packages/data/src/d1/client.ts';

const MIGRATIONS = new URL('../../packages/data/d1/migrations/', import.meta.url);

function d1Value(value: unknown): SQLQueryBindings {
    if (value === undefined) throw new Error('D1_TYPE_ERROR: Type undefined is not supported');
    if (typeof value === 'boolean') return value ? 1 : 0;
    return value as SQLQueryBindings;
}

class ShimStatement implements D1Statement {
    private readonly sqlite: Database;
    private readonly sql: string;
    private readonly params: SQLQueryBindings[];

    constructor(sqlite: Database, sql: string, params: SQLQueryBindings[] = []) {
        this.sqlite = sqlite;
        this.sql = sql;
        this.params = params;
    }

    bind(...values: unknown[]): D1Statement {
        return new ShimStatement(this.sqlite, this.sql, values.map(d1Value));
    }

    rows<T>(): T[] {
        return this.sqlite.query(this.sql).all(...this.params) as T[];
    }

    async first<T = D1Row>(): Promise<T | null> {
        return this.rows<T>()[0] ?? null;
    }

    async all<T = D1Row>(): Promise<{ results: T[] }> {
        return { results: this.rows<T>() };
    }

    async run(): Promise<{ meta: { changes: number } }> {
        const result = this.sqlite.query(this.sql).run(...this.params);
        return { meta: { changes: result.changes } };
    }
}

export interface D1Shim {
    db: D1Like;
    sqlite: Database;
}

export function d1Shim(): D1Shim {
    const sqlite = new Database(':memory:');
    sqlite.run('PRAGMA foreign_keys = ON');
    for (const file of readdirSync(MIGRATIONS)
        .filter(name => name.endsWith('.sql'))
        .sort())
        sqlite.run(readFileSync(new URL(file, MIGRATIONS), 'utf8'));
    const db: D1Like = {
        prepare: sql => new ShimStatement(sqlite, sql),
        async batch<T = D1Row>(statements: D1Statement[]) {
            return sqlite.transaction(() =>
                statements.map(statement => ({ results: (statement as ShimStatement).rows<T>() }))
            )();
        }
    };
    return { db, sqlite };
}

export function insertRows(sqlite: Database, table: string, rows: D1Row[]) {
    for (const row of rows) {
        const keys = Object.keys(row);
        sqlite
            .query(
                `INSERT INTO ${table} (${keys.join(', ')}) VALUES (${keys.map(() => '?').join(', ')})`
            )
            .run(...keys.map(key => d1Value(row[key])));
    }
}

export function memoryBucket(
    objects: Record<string, string> = {}
): ContentBucket & { objects: Record<string, string> } {
    return {
        objects,
        async get(key) {
            return key in objects ? { text: async () => objects[key] } : null;
        },
        async put(key, value) {
            objects[key] = value;
            return {};
        },
        async delete(keys) {
            for (const key of Array.isArray(keys) ? keys : [keys]) delete objects[key];
        }
    };
}
