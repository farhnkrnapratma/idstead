// SPDX-FileCopyrightText: 2026 Farhan Kurnia Pratama
//
// SPDX-License-Identifier: MIT OR Apache-2.0

const IDENTIFIER_RE = /^[A-Za-z_][A-Za-z0-9_]*$/;

const JS_RESERVED = new Set([
    'break',
    'case',
    'catch',
    'class',
    'const',
    'continue',
    'debugger',
    'default',
    'delete',
    'do',
    'else',
    'enum',
    'export',
    'extends',
    'false',
    'finally',
    'for',
    'function',
    'if',
    'import',
    'in',
    'instanceof',
    'new',
    'null',
    'return',
    'super',
    'switch',
    'this',
    'throw',
    'true',
    'try',
    'typeof',
    'var',
    'void',
    'while',
    'with',
    'implements',
    'interface',
    'let',
    'package',
    'private',
    'protected',
    'public',
    'static',
    'yield',
    'as',
    'async',
    'await',
    'from',
    'get',
    'set',
    'of'
]);

const LANGUAGE_RESERVED = new Set(['this', 'api', 'elif', 'endif']);

const EXTRA_RESERVED = new Set(['null', 'undefined', 'NaN', 'Infinity']);

const RESERVED_WORDS = new Set([...JS_RESERVED, ...LANGUAGE_RESERVED, ...EXTRA_RESERVED]);

export function isValidIdentifierName(name: string): boolean {
    return IDENTIFIER_RE.test(name) && !RESERVED_WORDS.has(name);
}
