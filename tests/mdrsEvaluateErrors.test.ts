// SPDX-FileCopyrightText: 2026 Farhan Kurnia Pratama
//
// SPDX-License-Identifier: AGPL-3.0-only

import { describe, expect, test } from 'bun:test';
import { validateDefineForSave, type JsonFetcher } from '../packages/mdrs/core/src/define';
import { resolveDefines } from '../packages/mdrs/core/src/markdown';

const URL = 'https://api.example.com/v1/data';
const data = {
    name: 'Ada',
    count: 3,
    on: true,
    nothing: null,
    tags: ['a', 'b'],
    nested: { 'odd-key': 'odd', list: [{ title: 'First' }] }
};
const resolvers: JsonFetcher = async () => data;

async function errorOf(expression: string, defines = '') {
    const { ok, errors } = await validateDefineForSave(
        `:::define\n${defines}v: ${expression}\n:::\n`,
        resolvers
    );
    expect(ok).toBe(false);
    return errors[0].message;
}

describe('MDRS expression errors', () => {
    test('reports malformed this references', async () => {
        expect(await errorOf('this')).toBe(
            'this must be followed by a property name, e.g. this.name'
        );
        expect(await errorOf('this.missing', '')).toContain("'missing' is undefined");
    });

    test('reports malformed get() calls', async () => {
        expect(await errorOf('get')).toBe("get must be called as get('https://…', '.path')");
        expect(await errorOf('fetch(1, 2)')).toBe("Unknown function 'fetch' (supported: get)");
        expect(await errorOf(`get('${URL}')`)).toContain(
            "Expected ',' between the get() arguments"
        );
        expect(await errorOf(`get('${URL}', '.a' '.b')`)).toContain(
            "Expected ')' after the get() arguments"
        );
        expect(await errorOf(`get('${URL}', 1)`)).toBe(
            'get() takes a URL string and a path string'
        );
    });

    test('rejects URLs that are not plain https', async () => {
        expect(await errorOf("get('not a url', '.a')")).toBe(
            "get() URL 'not a url' is not a valid URL"
        );
        expect(await errorOf("get('http://api.example.com/', '.a')")).toBe(
            "get() URL 'http://api.example.com/' must use https"
        );
        expect(await errorOf("get('https://u:p@api.example.com/', '.a')")).toBe(
            "get() URL 'https://u:p@api.example.com/' must not contain credentials"
        );
    });

    test('rejects local and private hosts', async () => {
        for (const url of [
            'https://localhost/',
            'https://api.localhost./',
            'https://127.0.0.1/',
            'https://2130706433/',
            'https://10.1.2.3/',
            'https://172.20.0.1/',
            'https://192.168.1.1/',
            'https://169.254.169.254/',
            'https://100.64.0.1/',
            'https://0.0.0.0/',
            'https://224.0.0.1/',
            'https://[::1]/'
        ])
            expect(await errorOf(`get('${url}', '.a')`)).toBe(
                `get() URL '${url}' must point to a public host`
            );
        const { errors } = await validateDefineForSave(
            ":::define\nv: get('https://172.32.0.1/', '.name')\n:::\n",
            resolvers
        );
        expect(errors).toEqual([]);
    });

    test('rejects paths that do not select one scalar', async () => {
        expect(await errorOf(`get('${URL}', 'name')`)).toBe(
            "get() path 'name' must start with '.'"
        );
        expect(await errorOf(`get('${URL}', '.')`)).toBe(
            "get() path '.' must select a value, e.g. '.name'"
        );
        expect(await errorOf(`get('${URL}', '.name!')`)).toBe(
            "Invalid get() path '.name!' at position 5"
        );
        expect(await errorOf(`get('${URL}', '.missing')`)).toBe(
            "Property 'missing' does not exist"
        );
        expect(await errorOf(`get('${URL}', '.toString')`)).toBe(
            "Property 'toString' does not exist"
        );
        expect(await errorOf(`get('${URL}', '.tags[5]')`)).toBe('Index [5] is out of range');
        expect(await errorOf(`get('${URL}', '.name[0]')`)).toBe(
            'Cannot index a non-array value with [0]'
        );
        expect(await errorOf(`get('${URL}', '.count.x')`)).toBe(
            "Cannot access property 'x' on a non-object value"
        );
        for (const path of ['.tags', '.nested', '.nothing'])
            expect(await errorOf(`get('${URL}', '${path}')`)).toBe(
                `get('${URL}', '${path}') must resolve to a string, number or boolean`
            );
    });

    test('limits a document to ten different URLs', async () => {
        const defines = Array.from(
            { length: 10 },
            (_, i) => `u${i}: get('${URL}?n=${i}', '.name')\n`
        ).join('');
        expect(await errorOf(`get('${URL}?n=10', '.name')`, defines)).toBe(
            'A document can call get() with at most 10 different URLs'
        );
    });

    test('reports when no fetcher is available', async () => {
        const { errors } = await validateDefineForSave(
            `:::define\nv: get('${URL}', '.name')\n:::\n`,
            async () => {
                throw new Error('offline');
            }
        );
        expect(errors[0].message).toBe('offline');
    });

    test('reports unknown variables', async () => {
        expect(await errorOf('nope')).toBe(
            "'nope' is not valid here — use this.nope inside :::define"
        );
        expect(await errorOf('"$nope"')).toContain("'nope' is undefined");
    });

    test('reports operand type mismatches', async () => {
        expect(await errorOf('!1')).toBe("'!' requires a boolean operand");
        expect(await errorOf('-"a"')).toBe("unary '-' requires a number operand");
        expect(await errorOf('1 && true')).toBe("'&&' requires boolean operands");
        expect(await errorOf('true && 1')).toBe("'&&' requires boolean operands");
        expect(await errorOf('1 || false')).toBe("'||' requires boolean operands");
        expect(await errorOf('false || 1')).toBe("'||' requires boolean operands");
        expect(await errorOf('true + false')).toBe(
            "'+' requires two numbers or at least one string"
        );
        expect(await errorOf('"a" - 1')).toBe("'-' requires two number operands");
        expect(await errorOf('1 < "a"')).toBe("'<' requires two number operands");
    });

    test('reports a template expression that fails', async () => {
        expect(await errorOf('"${1 ? 2 : 3}"')).toBe("'? :' requires a boolean condition");
    });
});

describe('MDRS expression operators', () => {
    async function resultOf(expression: string) {
        const { ok, errors } = await validateDefineForSave(
            `:::define\nv: ${expression}\n:::\n`,
            resolvers
        );
        expect(errors).toEqual([]);
        expect(ok).toBe(true);
    }

    test('evaluates arithmetic, comparisons and equality', async () => {
        for (const expression of [
            '6 - 2',
            '3 * 4',
            '9 / 3',
            '7 % 4',
            '3 > 2',
            '2 < 3',
            '2 >= 2',
            '2 <= 3',
            '1 == 1',
            '1 != 2',
            '-5',
            '!false',
            '"a" + "b"',
            '1 + 2',
            'true || false',
            'true && true'
        ]) {
            await resultOf(expression);
        }
    });
});

describe('get() values', () => {
    async function valueOf(expression: string) {
        return resolveDefines(`:::define\nv: ${expression}\n:::\n\n\${v}`, resolvers);
    }

    test('returns strings, numbers and booleans selected with a jq-style path', async () => {
        expect(await valueOf(`get('${URL}', '.name')`)).toBe('Ada');
        expect(await valueOf(`get('${URL}', '.count') + 1`)).toBe('4');
        expect(await valueOf(`get('${URL}', '.on') ? "yes" : "no"`)).toBe('yes');
        expect(await valueOf(`get('${URL}', '.tags[1]')`)).toBe('b');
        expect(await valueOf(`get('${URL}', '.tags.[0]')`)).toBe('a');
        expect(await valueOf(`get('${URL}', '.nested["odd-key"]')`)).toBe('odd');
        expect(await valueOf(`get('${URL}', '.nested.list[0].title')`)).toBe('First');
    });
});
