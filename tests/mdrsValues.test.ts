// SPDX-FileCopyrightText: 2026 Farhan Kurnia Pratama
//
// SPDX-License-Identifier: AGPL-3.0-only

import { describe, expect, test } from 'bun:test';
import { DefineError } from '../packages/mdrs/core/src/define/errors';
import type { PathSegment } from '../packages/mdrs/core/src/define/ast';
import {
    arrayVal,
    boolVal,
    defineValuesEqual,
    jsToDefineValue,
    numberVal,
    objectVal,
    stringVal,
    toDisplayString,
    walkPath
} from '../packages/mdrs/core/src/define/values';

const prop = (name: string): PathSegment => ({ kind: 'prop', name });
const index = (value: number | string): PathSegment => ({ kind: 'index', value });

describe('jsToDefineValue', () => {
    test('maps JavaScript values onto define values', () => {
        expect(jsToDefineValue(null)).toEqual(stringVal(''));
        expect(jsToDefineValue(undefined)).toEqual(stringVal(''));
        expect(jsToDefineValue('a')).toEqual(stringVal('a'));
        expect(jsToDefineValue(3)).toEqual(numberVal(3));
        expect(jsToDefineValue(true)).toEqual(boolVal(true));
        expect(jsToDefineValue([1, 'a'])).toEqual(arrayVal([numberVal(1), stringVal('a')]));
        expect(jsToDefineValue({ k: [false] })).toEqual(
            objectVal({ k: arrayVal([boolVal(false)]) })
        );
        expect(jsToDefineValue(10n)).toEqual(stringVal('10'));
    });
});

describe('toDisplayString', () => {
    test('prints scalars plainly and containers as JSON', () => {
        expect(toDisplayString(stringVal('x'))).toBe('x');
        expect(toDisplayString(numberVal(2))).toBe('2');
        expect(toDisplayString(boolVal(false))).toBe('false');
        expect(toDisplayString(jsToDefineValue({ a: [1, { b: true }] }))).toBe(
            '{"a":[1,{"b":true}]}'
        );
    });
});

describe('defineValuesEqual', () => {
    test('compares containers element by element and key by key', () => {
        expect(defineValuesEqual(jsToDefineValue([1, 2]), jsToDefineValue([1, 2]))).toBe(true);
        expect(defineValuesEqual(jsToDefineValue([1, 2]), jsToDefineValue([1]))).toBe(false);
        expect(defineValuesEqual(jsToDefineValue([1, 2]), jsToDefineValue([1, 3]))).toBe(false);
        expect(defineValuesEqual(jsToDefineValue({ a: 1 }), jsToDefineValue({ a: 1 }))).toBe(true);
        expect(defineValuesEqual(jsToDefineValue({ a: 1 }), jsToDefineValue({ b: 1 }))).toBe(false);
        expect(defineValuesEqual(jsToDefineValue({ a: 1 }), jsToDefineValue({ a: 2 }))).toBe(false);
        expect(defineValuesEqual(jsToDefineValue({ a: 1 }), jsToDefineValue({}))).toBe(false);
    });

    test('treats different types as unequal and compares scalars by value', () => {
        expect(defineValuesEqual(numberVal(1), stringVal('1'))).toBe(false);
        expect(defineValuesEqual(boolVal(true), boolVal(true))).toBe(true);
        expect(defineValuesEqual(stringVal('a'), stringVal('b'))).toBe(false);
    });
});

describe('walkPath', () => {
    const data = jsToDefineValue({ list: [{ name: 'Ada' }], meta: { ok: true } });

    test('follows properties, keys and array indexes', () => {
        expect(walkPath(data, [prop('list'), index(0), prop('name')])).toEqual(stringVal('Ada'));
        expect(walkPath(data, [index('meta'), index('ok')])).toEqual(boolVal(true));
        expect(walkPath(data, [])).toBe(data);
    });

    test('reads the length of arrays', () => {
        expect(walkPath(data, [prop('list'), prop('length')])).toEqual(numberVal(1));
    });

    test('reports invalid property accesses', () => {
        expect(() => walkPath(numberVal(1), [prop('x')])).toThrow(
            "Cannot access property 'x' on a non-object value"
        );
        expect(() => walkPath(data, [prop('missing')])).toThrow(
            "Property 'missing' does not exist"
        );
    });

    test('reports invalid index and key accesses', () => {
        expect(() => walkPath(data, [index(0)])).toThrow('Cannot index a non-array value with [0]');
        expect(() => walkPath(data, [prop('list'), index(5)])).toThrow('Index [5] is out of range');
        expect(() => walkPath(data, [prop('list'), index(1.5)])).toThrow(
            'Index [1.5] is out of range'
        );
        expect(() => walkPath(numberVal(1), [index('k')])).toThrow(
            "Cannot access key 'k' on a non-object value"
        );
        expect(() => walkPath(data, [index('nope')])).toThrow("Key 'nope' does not exist");
    });

    test('throws define errors', () => {
        expect(() => walkPath(data, [prop('nope')])).toThrow(DefineError);
    });
});
