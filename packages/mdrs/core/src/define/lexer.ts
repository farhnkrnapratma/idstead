import { DefineError } from './errors';

export type TokenType =
    | 'NUMBER'
    | 'STRING'
    | 'BOOLEAN'
    | 'IDENT'
    | 'LBRACE'
    | 'RBRACE'
    | 'LBRACKET'
    | 'RBRACKET'
    | 'LPAREN'
    | 'RPAREN'
    | 'COLON'
    | 'DOT'
    | 'COMMA'
    | 'NEWLINE'
    | 'EQ'
    | 'NEQ'
    | 'GTE'
    | 'LTE'
    | 'GT'
    | 'LT'
    | 'AND'
    | 'OR'
    | 'NOT'
    | 'PLUS'
    | 'MINUS'
    | 'STAR'
    | 'SLASH'
    | 'PERCENT'
    | 'QUESTION'
    | 'TEMPLATE'
    | 'EOF';

export type RawTemplatePart =
    | { kind: 'text'; value: string }
    | { kind: 'variable'; name: string }
    | { kind: 'expression'; source: string; pos: number };

export interface Token {
    type: TokenType;
    value: string;
    pos: number;
    parts?: RawTemplatePart[];
}

function isIdentStart(c: string): boolean {
    return /[A-Za-z_]/.test(c);
}

function isIdentPart(c: string): boolean {
    return /[A-Za-z0-9_]/.test(c);
}

function isDigit(c: string): boolean {
    return c >= '0' && c <= '9';
}

const TWO_CHAR_OPS: Record<string, TokenType> = {
    '==': 'EQ',
    '!=': 'NEQ',
    '>=': 'GTE',
    '<=': 'LTE',
    '&&': 'AND',
    '||': 'OR'
};

const ONE_CHAR_OPS: Record<string, TokenType> = {
    '{': 'LBRACE',
    '}': 'RBRACE',
    '[': 'LBRACKET',
    ']': 'RBRACKET',
    '(': 'LPAREN',
    ')': 'RPAREN',
    ':': 'COLON',
    '.': 'DOT',
    ',': 'COMMA',
    '>': 'GT',
    '<': 'LT',
    '!': 'NOT',
    '+': 'PLUS',
    '-': 'MINUS',
    '*': 'STAR',
    '/': 'SLASH',
    '%': 'PERCENT',
    '?': 'QUESTION'
};

const DOUBLE_QUOTE_ESCAPES: Record<string, string> = {
    n: '\n',
    t: '\t',
    '"': '"',
    '\\': '\\',
    $: '$'
};

export function skipQuoted(source: string, start: number): number {
    const quote = source[start];
    let j = start + 1;
    while (j < source.length && source[j] !== quote) j += source[j] === '\\' ? 2 : 1;
    return j;
}

export function findExpressionEnd(
    source: string,
    openBrace: number,
    limit = source.length
): number {
    let depth = 0;
    let j = openBrace;
    const end = Math.min(source.length, limit);
    while (j < end) {
        const c = source[j];
        if (c === '"' || c === "'") {
            j = skipQuoted(source, j) + 1;
            continue;
        }
        if (c === '{') depth++;
        else if (c === '}') {
            depth--;
            if (depth === 0) return j;
        }
        j++;
    }
    return -1;
}

function readSingleQuoted(source: string, start: number): { value: string; end: number } {
    let value = '';
    let j = start + 1;
    while (j < source.length && source[j] !== "'") {
        if (source[j] === '\\' && (source[j + 1] === "'" || source[j + 1] === '\\')) {
            value += source[j + 1];
            j += 2;
        } else {
            value += source[j];
            j++;
        }
    }
    if (j >= source.length)
        throw new DefineError(`Unterminated string literal at position ${start}`);
    return { value, end: j + 1 };
}

function readDoubleQuoted(
    source: string,
    start: number
): { parts: RawTemplatePart[]; end: number } {
    const parts: RawTemplatePart[] = [];
    let text = '';
    const flush = () => {
        if (text) parts.push({ kind: 'text', value: text });
        text = '';
    };
    let j = start + 1;
    while (j < source.length && source[j] !== '"') {
        const c = source[j];
        if (c === '\\' && j + 1 < source.length) {
            const next = source[j + 1];
            text += DOUBLE_QUOTE_ESCAPES[next] ?? next;
            j += 2;
            continue;
        }
        if (c === '$' && source[j + 1] === '{') {
            const close = findExpressionEnd(source, j + 1);
            if (close === -1)
                throw new DefineError(`Unterminated \${...} in string at position ${j}`);
            flush();
            parts.push({ kind: 'expression', source: source.slice(j + 2, close), pos: j + 2 });
            j = close + 1;
            continue;
        }
        if (c === '$' && j + 1 < source.length && isIdentStart(source[j + 1])) {
            let k = j + 1;
            while (k < source.length && isIdentPart(source[k])) k++;
            flush();
            parts.push({ kind: 'variable', name: source.slice(j + 1, k) });
            j = k;
            continue;
        }
        text += c;
        j++;
    }
    if (j >= source.length)
        throw new DefineError(`Unterminated string literal at position ${start}`);
    flush();
    return { parts, end: j + 1 };
}

export function tokenize(source: string): Token[] {
    const tokens: Token[] = [];
    let i = 0;
    const n = source.length;

    while (i < n) {
        const c = source[i];

        if (c === '\n') {
            tokens.push({ type: 'NEWLINE', value: '\n', pos: i });
            i++;
            continue;
        }
        if (c === '\r' || c === ' ' || c === '\t') {
            i++;
            continue;
        }
        if (c === '/' && source[i + 1] === '/') {
            i += 2;
            while (i < n && source[i] !== '\n') i++;
            continue;
        }
        if (c === "'") {
            const { value, end } = readSingleQuoted(source, i);
            tokens.push({ type: 'STRING', value, pos: i });
            i = end;
            continue;
        }
        if (c === '"') {
            const { parts, end } = readDoubleQuoted(source, i);
            if (parts.every(part => part.kind === 'text'))
                tokens.push({
                    type: 'STRING',
                    value: parts.map(part => (part as { value: string }).value).join(''),
                    pos: i
                });
            else tokens.push({ type: 'TEMPLATE', value: source.slice(i, end), pos: i, parts });
            i = end;
            continue;
        }
        if (isDigit(c)) {
            let j = i;
            while (j < n && isDigit(source[j])) j++;
            if (source[j] === '.' && isDigit(source[j + 1])) {
                j++;
                while (j < n && isDigit(source[j])) j++;
            }
            tokens.push({ type: 'NUMBER', value: source.slice(i, j), pos: i });
            i = j;
            continue;
        }
        if (isIdentStart(c)) {
            let j = i;
            while (j < n && isIdentPart(source[j])) j++;
            const word = source.slice(i, j);
            if (word === 'true' || word === 'false') {
                tokens.push({ type: 'BOOLEAN', value: word, pos: i });
            } else {
                tokens.push({ type: 'IDENT', value: word, pos: i });
            }
            i = j;
            continue;
        }

        const two = source.slice(i, i + 2);
        if (TWO_CHAR_OPS[two]) {
            tokens.push({ type: TWO_CHAR_OPS[two], value: two, pos: i });
            i += 2;
            continue;
        }
        if (ONE_CHAR_OPS[c]) {
            tokens.push({ type: ONE_CHAR_OPS[c], value: c, pos: i });
            i++;
            continue;
        }

        throw new DefineError(`Unexpected character '${c}' at position ${i}`);
    }

    tokens.push({ type: 'EOF', value: '', pos: n });
    return tokens;
}
