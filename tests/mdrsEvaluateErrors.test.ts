// SPDX-FileCopyrightText: 2026 Farhan Kurnia Pratama
//
// SPDX-License-Identifier: AGPL-3.0-only

import { describe, expect, test } from 'bun:test';
import {
    jsToDefineValue,
    validateDefineForSave,
    walkPath,
    type ApiRegistry
} from '../packages/mdrs/core/src/define';

const analytics = jsToDefineValue({ enabled: true, provider: 'umami' });
const resolvers: ApiRegistry = { analytics: async path => walkPath(analytics, path) };

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

    test('reports malformed api references', async () => {
        expect(await errorOf('api')).toBe('api must be followed by a version, e.g. api.v1.author');
        expect(await errorOf('api.v2.analytics')).toBe("Unknown API version 'v2' (supported: v1)");
        expect(await errorOf('api.v1')).toBe(
            'api.v1 must be followed by a resource name, e.g. api.v1.author'
        );
        expect(await errorOf('api.v1.blog.title')).toBe(
            "Unknown api.v1 resource 'blog' (supported: analytics)"
        );
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
