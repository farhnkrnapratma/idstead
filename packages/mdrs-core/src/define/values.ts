import { type PathSegment } from './ast';
import { DefineError } from './errors';

export interface DefineValue {
    type: 'string' | 'number' | 'boolean' | 'array' | 'object';
    value: string | number | boolean | DefineValue[] | Record<string, DefineValue>;
}

export function stringVal(v: string): DefineValue {
    return { type: 'string', value: v };
}

export function numberVal(v: number): DefineValue {
    return { type: 'number', value: v };
}

export function boolVal(v: boolean): DefineValue {
    return { type: 'boolean', value: v };
}

export function arrayVal(v: DefineValue[]): DefineValue {
    return { type: 'array', value: v };
}

export function objectVal(v: Record<string, DefineValue>): DefineValue {
    return { type: 'object', value: v };
}

export function jsToDefineValue(x: unknown): DefineValue {
    if (x === null || x === undefined) return stringVal('');
    if (typeof x === 'string') return stringVal(x);
    if (typeof x === 'number') return numberVal(x);
    if (typeof x === 'boolean') return boolVal(x);
    if (Array.isArray(x)) return arrayVal(x.map(jsToDefineValue));
    if (typeof x === 'object') {
        const out: Record<string, DefineValue> = {};
        for (const [k, v] of Object.entries(x as Record<string, unknown>)) {
            out[k] = jsToDefineValue(v);
        }
        return objectVal(out);
    }
    return stringVal(String(x));
}

export function defineValueToJs(v: DefineValue): unknown {
    if (v.type === 'array') return (v.value as DefineValue[]).map(defineValueToJs);
    if (v.type === 'object') {
        const out: Record<string, unknown> = {};
        for (const [k, val] of Object.entries(v.value as Record<string, DefineValue>)) {
            out[k] = defineValueToJs(val);
        }
        return out;
    }
    return v.value;
}

export function toDisplayString(v: DefineValue): string {
    if (v.type === 'string') return v.value as string;
    if (v.type === 'number') return String(v.value);
    if (v.type === 'boolean') return String(v.value);
    return JSON.stringify(defineValueToJs(v));
}

export function defineValuesEqual(a: DefineValue, b: DefineValue): boolean {
    if (a.type !== b.type) return false;
    if (a.type === 'array') {
        const av = a.value as DefineValue[];
        const bv = b.value as DefineValue[];
        return av.length === bv.length && av.every((v, i) => defineValuesEqual(v, bv[i]));
    }
    if (a.type === 'object') {
        const av = a.value as Record<string, DefineValue>;
        const bv = b.value as Record<string, DefineValue>;
        const aKeys = Object.keys(av);
        const bKeys = Object.keys(bv);
        return (
            aKeys.length === bKeys.length
            && aKeys.every(k => k in bv && defineValuesEqual(av[k], bv[k]))
        );
    }
    return a.value === b.value;
}

export function walkPath(base: DefineValue, path: PathSegment[]): DefineValue {
    let current = base;
    for (const segment of path) {
        if (segment.kind === 'prop') {
            const name = segment.name as string;
            if (current.type === 'array' && name === 'length') {
                current = numberVal((current.value as DefineValue[]).length);
                continue;
            }
            if (current.type !== 'object') {
                throw new DefineError(`Cannot access property '${name}' on a non-object value`);
            }
            const obj = current.value as Record<string, DefineValue>;
            if (!(name in obj)) {
                throw new DefineError(`Property '${name}' does not exist`);
            }
            current = obj[name];
        } else {
            const idx = segment.value as number | string;
            if (typeof idx === 'number') {
                if (current.type !== 'array') {
                    throw new DefineError(`Cannot index a non-array value with [${idx}]`);
                }
                const arr = current.value as DefineValue[];
                if (!Number.isInteger(idx) || idx < 0 || idx >= arr.length) {
                    throw new DefineError(`Index [${idx}] is out of range`);
                }
                current = arr[idx];
            } else {
                if (current.type !== 'object') {
                    throw new DefineError(`Cannot access key '${idx}' on a non-object value`);
                }
                const obj = current.value as Record<string, DefineValue>;
                if (!(idx in obj)) {
                    throw new DefineError(`Key '${idx}' does not exist`);
                }
                current = obj[idx];
            }
        }
    }
    return current;
}
