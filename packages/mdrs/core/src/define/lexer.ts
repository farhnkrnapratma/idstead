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
    | 'EOF';

export interface Token {
    type: TokenType;
    value: string;
    pos: number;
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
    '%': 'PERCENT'
};

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
        if (c === '"') {
            let j = i + 1;
            let value = '';
            while (j < n && source[j] !== '"') {
                if (source[j] === '\\' && j + 1 < n) {
                    const next = source[j + 1];
                    if (next === 'n') value += '\n';
                    else if (next === 't') value += '\t';
                    else if (next === '"') value += '"';
                    else if (next === '\\') value += '\\';
                    else value += next;
                    j += 2;
                } else {
                    value += source[j];
                    j++;
                }
            }
            if (j >= n) {
                throw new DefineError(`Unterminated string literal at position ${i}`);
            }
            tokens.push({ type: 'STRING', value, pos: i });
            i = j + 1;
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
