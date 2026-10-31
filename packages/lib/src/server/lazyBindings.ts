// SPDX-FileCopyrightText: 2026 Farhan Kurnia Pratama
//
// SPDX-License-Identifier: AGPL-3.0-only

import type { ContentBucket, D1Like } from '@idstead/data';

type D1Statement = ReturnType<D1Like['prepare']>;

class LazyStatement {
    readonly load: () => Promise<D1Like>;
    readonly sql: string;
    readonly values: unknown[];

    constructor(load: () => Promise<D1Like>, sql: string, values: unknown[] = []) {
        this.load = load;
        this.sql = sql;
        this.values = values;
    }

    bind(...values: unknown[]): LazyStatement {
        return new LazyStatement(this.load, this.sql, values);
    }

    real(db: D1Like): D1Statement {
        return db.prepare(this.sql).bind(...this.values);
    }

    async first<T>() {
        return this.real(await this.load()).first<T>();
    }

    async all<T>() {
        return this.real(await this.load()).all<T>();
    }

    async run() {
        return this.real(await this.load()).run();
    }
}

export function lazyD1(load: () => Promise<D1Like>): D1Like {
    return {
        prepare: sql => new LazyStatement(load, sql) as unknown as D1Statement,
        async batch(statements) {
            const db = await load();
            return db.batch(
                statements.map(statement => (statement as unknown as LazyStatement).real(db))
            );
        }
    };
}

export function lazyBucket(load: () => Promise<ContentBucket>): ContentBucket {
    return {
        get: async key => (await load()).get(key),
        put: async (key, value, options) => (await load()).put(key, value, options),
        delete: async keys => (await load()).delete(keys)
    };
}
