import { describe, expect, test } from 'bun:test';
import { readdir, readFile } from 'node:fs/promises';

const migrationsDir = new URL('../supabase/migrations/', import.meta.url);
const files = (await readdir(migrationsDir)).filter(name => name.endsWith('.sql')).sort();

const latestFunctions = new Map<string, { file: string; body: string }>();
const droppedFunctions = new Set<string>();

for (const file of files) {
    const sql = await readFile(new URL(file, migrationsDir), 'utf8');
    for (const match of sql.matchAll(
        /create\s+(?:or\s+replace\s+)?function\s+public\.(\w+)\s*\([\s\S]*?\$(\w*)\$([\s\S]*?)\$\2\$/gi
    )) {
        latestFunctions.set(match[1].toLowerCase(), { file, body: match[3] });
        droppedFunctions.delete(match[1].toLowerCase());
    }
    for (const match of sql.matchAll(/drop\s+function\s+(?:if\s+exists\s+)?public\.(\w+)/gi))
        droppedFunctions.add(match[1].toLowerCase());
}

function unfilteredStatements(body: string): string[] {
    return body
        .replace(/--[^\n]*/g, '')
        .split(';')
        .map(statement => statement.replace(/\s+/g, ' ').trim())
        .filter(statement => /^(?:delete\s+from|update)\s/i.test(statement))
        .filter(statement => !/\swhere\s/i.test(statement));
}

describe('safeupdate compatibility', () => {
    test('no live database function runs DELETE or UPDATE without a WHERE clause', () => {
        const offenders = [...latestFunctions]
            .filter(([name]) => !droppedFunctions.has(name))
            .flatMap(([name, { file, body }]) =>
                unfilteredStatements(body).map(statement => `${name} (${file}): ${statement}`)
            );
        expect(offenders).toEqual([]);
    });

    test('clear-all is defined by the safeupdate-compatible migration', () => {
        expect(latestFunctions.get('db_clear_all_data')?.file).toBe(
            '20261012120000_clear_all_data_safeupdate.sql'
        );
    });
});
