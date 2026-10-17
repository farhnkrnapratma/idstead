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
        .flatMap(statement =>
            [...statement.matchAll(/\b(?:delete\s+from|update\s+[\w."]+\s+set)\s[\s\S]*/gi)].map(
                match => match[0]
            )
        )
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

    test('finds unguarded statements after begin, then, else and loop', () => {
        expect(
            unfilteredStatements(`
                begin delete from public.a;
                if found then update public.b set x = 1; else delete from public.c where id = 1; end if;
                loop update public.d set y = 2 where id = 3; end loop;
                insert into public.e (id) values (1) on conflict (id) do update set id = 1;
            `)
        ).toEqual(['delete from public.a', 'update public.b set x = 1']);
    });

    test('clear-all is defined by the safeupdate-compatible migration', () => {
        expect(latestFunctions.get('db_clear_all_data')?.file).toBe(
            '20261012120000_clear_all_data_safeupdate.sql'
        );
    });
});
