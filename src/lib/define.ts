import {
  fetchAuthorProfile,
  fetchCvEntries,
  fetchFundingLinks,
  fetchContactInfo,
  fetchGroupedSkills,
  fetchSocials
} from '$lib/author';
import {sanitizePublicApiData} from '$lib/authorApi';

export class DefineError extends Error {
  key?: string;

  constructor(message: string, key?: string) {
    super(message);
    this.name = 'DefineError';
    this.key = key;
  }
}

export interface DefineErrorInfo {
  message: string;
  key?: string;
}

type TokenType =
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

interface Token {
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

function tokenize(source: string): Token[] {
  const tokens: Token[] = [];
  let i = 0;
  const n = source.length;

  while (i < n) {
    const c = source[i];

    if (c === '\n') {
      tokens.push({type: 'NEWLINE', value: '\n', pos: i});
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
      tokens.push({type: 'STRING', value, pos: i});
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
      tokens.push({type: 'NUMBER', value: source.slice(i, j), pos: i});
      i = j;
      continue;
    }
    if (isIdentStart(c)) {
      let j = i;
      while (j < n && isIdentPart(source[j])) j++;
      const word = source.slice(i, j);
      if (word === 'true' || word === 'false') {
        tokens.push({type: 'BOOLEAN', value: word, pos: i});
      } else {
        tokens.push({type: 'IDENT', value: word, pos: i});
      }
      i = j;
      continue;
    }

    const two = source.slice(i, i + 2);
    if (TWO_CHAR_OPS[two]) {
      tokens.push({type: TWO_CHAR_OPS[two], value: two, pos: i});
      i += 2;
      continue;
    }
    if (ONE_CHAR_OPS[c]) {
      tokens.push({type: ONE_CHAR_OPS[c], value: c, pos: i});
      i++;
      continue;
    }

    throw new DefineError(`Unexpected character '${c}' at position ${i}`);
  }

  tokens.push({type: 'EOF', value: '', pos: n});
  return tokens;
}

export interface PathSegment {
  kind: 'prop' | 'index';
  name?: string;
  value?: number | string;
}

interface NumberLit {
  kind: 'number';
  value: number;
}
interface StringLit {
  kind: 'string';
  value: string;
}
interface BoolLit {
  kind: 'boolean';
  value: boolean;
}
interface ArrayLit {
  kind: 'array';
  items: Expr[];
}
interface ObjectLit {
  kind: 'object';
  entries: {key: string; value: Expr}[];
}
interface Reference {
  kind: 'reference';
  root: string;
  path: PathSegment[];
}
interface UnaryExpr {
  kind: 'unary';
  op: '!' | '-';
  operand: Expr;
}
interface BinaryExpr {
  kind: 'binary';
  op: string;
  left: Expr;
  right: Expr;
}
type Expr =
  | NumberLit
  | StringLit
  | BoolLit
  | ArrayLit
  | ObjectLit
  | Reference
  | UnaryExpr
  | BinaryExpr;

interface Assignment {
  key: string;
  value: Expr;
}

const RELATIONAL_MAP: Record<string, string> = {
  GT: '>',
  LT: '<',
  GTE: '>=',
  LTE: '<='
};
const ADDITIVE_MAP: Record<string, string> = {PLUS: '+', MINUS: '-'};
const MULTIPLICATIVE_MAP: Record<string, string> = {
  STAR: '*',
  SLASH: '/',
  PERCENT: '%'
};

class Parser {
  private tokens: Token[];
  private pos = 0;

  constructor(tokens: Token[]) {
    this.tokens = tokens;
  }

  private peek(): Token {
    return this.tokens[this.pos];
  }

  private advance(): Token {
    return this.tokens[this.pos++];
  }

  private check(type: TokenType): boolean {
    return this.peek().type === type;
  }

  private expect(type: TokenType, message: string): Token {
    if (this.check(type)) return this.advance();
    const tok = this.peek();
    throw new DefineError(
      `${message} (got '${tok.value || tok.type}' at position ${tok.pos})`
    );
  }

  private skipSeparators(): void {
    while (this.check('COMMA') || this.check('NEWLINE')) this.advance();
  }

  parseDefineBlock(): Assignment[] {
    this.skipSeparators();
    const assignments: Assignment[] = [];
    while (!this.check('EOF')) {
      const keyToken = this.expect('IDENT', 'Expected a variable name');
      this.expect('COLON', `Expected ':' after '${keyToken.value}'`);
      const value = this.parseExpression();
      assignments.push({key: keyToken.value, value});
      this.skipSeparators();
    }
    return assignments;
  }

  parseExpression(): Expr {
    return this.parseLogicalOr();
  }

  private parseLogicalOr(): Expr {
    let left = this.parseLogicalAnd();
    while (this.check('OR')) {
      this.advance();
      const right = this.parseLogicalAnd();
      left = {kind: 'binary', op: '||', left, right};
    }
    return left;
  }

  private parseLogicalAnd(): Expr {
    let left = this.parseEquality();
    while (this.check('AND')) {
      this.advance();
      const right = this.parseEquality();
      left = {kind: 'binary', op: '&&', left, right};
    }
    return left;
  }

  private parseEquality(): Expr {
    let left = this.parseRelational();
    while (this.check('EQ') || this.check('NEQ')) {
      const opTok = this.advance();
      const right = this.parseRelational();
      left = {
        kind: 'binary',
        op: opTok.type === 'EQ' ? '==' : '!=',
        left,
        right
      };
    }
    return left;
  }

  private parseRelational(): Expr {
    let left = this.parseAdditive();
    while (
      this.check('GT')
      || this.check('LT')
      || this.check('GTE')
      || this.check('LTE')
    ) {
      const opTok = this.advance();
      const right = this.parseAdditive();
      left = {kind: 'binary', op: RELATIONAL_MAP[opTok.type], left, right};
    }
    return left;
  }

  private parseAdditive(): Expr {
    let left = this.parseMultiplicative();
    while (this.check('PLUS') || this.check('MINUS')) {
      const opTok = this.advance();
      const right = this.parseMultiplicative();
      left = {kind: 'binary', op: ADDITIVE_MAP[opTok.type], left, right};
    }
    return left;
  }

  private parseMultiplicative(): Expr {
    let left = this.parseUnary();
    while (this.check('STAR') || this.check('SLASH') || this.check('PERCENT')) {
      const opTok = this.advance();
      const right = this.parseUnary();
      left = {kind: 'binary', op: MULTIPLICATIVE_MAP[opTok.type], left, right};
    }
    return left;
  }

  private parseUnary(): Expr {
    if (this.check('NOT')) {
      this.advance();
      return {kind: 'unary', op: '!', operand: this.parseUnary()};
    }
    if (this.check('MINUS')) {
      this.advance();
      return {kind: 'unary', op: '-', operand: this.parseUnary()};
    }
    return this.parsePrimary();
  }

  private parsePrimary(): Expr {
    const tok = this.peek();
    if (tok.type === 'NUMBER') {
      this.advance();
      return {kind: 'number', value: parseFloat(tok.value)};
    }
    if (tok.type === 'STRING') {
      this.advance();
      return {kind: 'string', value: tok.value};
    }
    if (tok.type === 'BOOLEAN') {
      this.advance();
      return {kind: 'boolean', value: tok.value === 'true'};
    }
    if (tok.type === 'LBRACKET') return this.parseArrayLiteral();
    if (tok.type === 'LBRACE') return this.parseObjectLiteral();
    if (tok.type === 'LPAREN') {
      this.advance();
      const expr = this.parseExpression();
      this.expect('RPAREN', "Expected ')'");
      return expr;
    }
    if (tok.type === 'IDENT') return this.parseReferenceChain();
    throw new DefineError(
      `Unexpected token '${tok.value || tok.type}' at position ${tok.pos}`
    );
  }

  private parseArrayLiteral(): ArrayLit {
    this.expect('LBRACKET', "Expected '['");
    this.skipSeparators();
    const items: Expr[] = [];
    while (!this.check('RBRACKET')) {
      items.push(this.parseExpression());
      this.skipSeparators();
    }
    this.expect('RBRACKET', "Expected ']'");
    return {kind: 'array', items};
  }

  private parseObjectLiteral(): ObjectLit {
    this.expect('LBRACE', "Expected '{'");
    this.skipSeparators();
    const entries: {key: string; value: Expr}[] = [];
    while (!this.check('RBRACE')) {
      const keyToken = this.expect('IDENT', 'Expected an object key');
      this.expect('COLON', `Expected ':' after '${keyToken.value}'`);
      const value = this.parseExpression();
      entries.push({key: keyToken.value, value});
      this.skipSeparators();
    }
    this.expect('RBRACE', "Expected '}'");
    return {kind: 'object', entries};
  }

  private parseReferenceChain(): Reference {
    const rootTok = this.expect('IDENT', 'Expected an identifier');
    const path: PathSegment[] = [];
    for (;;) {
      if (this.check('DOT')) {
        this.advance();
        const propTok = this.expect(
          'IDENT',
          'Expected a property name after .'
        );
        path.push({kind: 'prop', name: propTok.value});
      } else if (this.check('LBRACKET')) {
        this.advance();
        const idxTok = this.peek();
        if (idxTok.type === 'NUMBER') {
          this.advance();
          path.push({kind: 'index', value: parseFloat(idxTok.value)});
        } else if (idxTok.type === 'STRING') {
          this.advance();
          path.push({kind: 'index', value: idxTok.value});
        } else {
          throw new DefineError(
            `Expected a number or string inside [...] at position ${idxTok.pos}`
          );
        }
        this.expect('RBRACKET', "Expected ']'");
      } else {
        break;
      }
    }
    return {kind: 'reference', root: rootTok.value, path};
  }
}

export interface DefineValue {
  type: 'string' | 'number' | 'boolean' | 'array' | 'object';
  value:
    string | number | boolean | DefineValue[] | Record<string, DefineValue>;
}

function stringVal(v: string): DefineValue {
  return {type: 'string', value: v};
}
function numberVal(v: number): DefineValue {
  return {type: 'number', value: v};
}
function boolVal(v: boolean): DefineValue {
  return {type: 'boolean', value: v};
}
function arrayVal(v: DefineValue[]): DefineValue {
  return {type: 'array', value: v};
}
function objectVal(v: Record<string, DefineValue>): DefineValue {
  return {type: 'object', value: v};
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
  if (v.type === 'array')
    return (v.value as DefineValue[]).map(defineValueToJs);
  if (v.type === 'object') {
    const out: Record<string, unknown> = {};
    for (const [k, val] of Object.entries(
      v.value as Record<string, DefineValue>
    )) {
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

function defineValuesEqual(a: DefineValue, b: DefineValue): boolean {
  if (a.type !== b.type) return false;
  if (a.type === 'array') {
    const av = a.value as DefineValue[];
    const bv = b.value as DefineValue[];
    return (
      av.length === bv.length && av.every((v, i) => defineValuesEqual(v, bv[i]))
    );
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
        throw new DefineError(
          `Cannot access property '${name}' on a non-object value`
        );
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
          throw new DefineError(
            `Cannot access key '${idx}' on a non-object value`
          );
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

export type ApiResolver = (path: PathSegment[]) => Promise<DefineValue>;
export type DbResolver = ApiResolver;
export interface ApiRegistry {
  author: ApiResolver;
  blog: ApiResolver;
}
export type DbRegistry = ApiRegistry;

export interface EvalContext {
  scope: Map<string, DefineValue>;
  allowThis: boolean;
  apiRegistry: ApiRegistry;
}

async function evaluateReference(
  node: Reference,
  ctx: EvalContext
): Promise<DefineValue> {
  if (node.root === 'this') {
    if (!ctx.allowThis) {
      throw new DefineError('this.* is only valid inside a :::define block');
    }
    if (node.path.length === 0 || node.path[0].kind !== 'prop') {
      throw new DefineError(
        'this must be followed by a property name, e.g. this.name'
      );
    }
    const varName = node.path[0].name as string;
    const base = ctx.scope.get(varName);
    if (base === undefined) {
      throw new DefineError(
        `'${varName}' is undefined, or referenced before it was defined`,
        varName
      );
    }
    return walkPath(base, node.path.slice(1));
  }

  if (node.root === 'db') {
    throw new DefineError(
      "'db.*' is no longer supported — use 'api.v1.*' instead (e.g. api.v1.author)"
    );
  }

  if (node.root === 'api') {
    if (node.path.length === 0 || node.path[0].kind !== 'prop') {
      throw new DefineError(
        'api must be followed by a version, e.g. api.v1.author'
      );
    }
    const version = node.path[0].name as string;
    if (version !== 'v1') {
      throw new DefineError(`Unknown API version '${version}' (supported: v1)`);
    }
    if (node.path.length < 2 || node.path[1].kind !== 'prop') {
      throw new DefineError(
        'api.v1 must be followed by a resource name, e.g. api.v1.author'
      );
    }
    const resource = node.path[1].name as string;
    const resolver = ctx.apiRegistry[resource as keyof ApiRegistry];
    if (!resolver) {
      throw new DefineError(
        `Unknown api.v1 resource '${resource}' (supported: author, blog)`
      );
    }
    return resolver(node.path.slice(2));
  }

  if (ctx.allowThis) {
    throw new DefineError(
      `'${node.root}' is not valid here — use this.${node.root} inside :::define`
    );
  }
  const base = ctx.scope.get(node.root);
  if (base === undefined) {
    throw new DefineError(`'${node.root}' is undefined`);
  }
  return walkPath(base, node.path);
}

async function evaluateBinary(
  node: BinaryExpr,
  ctx: EvalContext
): Promise<DefineValue> {
  if (node.op === '&&') {
    const left = await evaluateExpr(node.left, ctx);
    if (left.type !== 'boolean') {
      throw new DefineError(`'&&' requires boolean operands`);
    }
    if (!(left.value as boolean)) return boolVal(false);
    const right = await evaluateExpr(node.right, ctx);
    if (right.type !== 'boolean') {
      throw new DefineError(`'&&' requires boolean operands`);
    }
    return boolVal(right.value as boolean);
  }
  if (node.op === '||') {
    const left = await evaluateExpr(node.left, ctx);
    if (left.type !== 'boolean') {
      throw new DefineError(`'||' requires boolean operands`);
    }
    if (left.value as boolean) return boolVal(true);
    const right = await evaluateExpr(node.right, ctx);
    if (right.type !== 'boolean') {
      throw new DefineError(`'||' requires boolean operands`);
    }
    return boolVal(right.value as boolean);
  }

  const left = await evaluateExpr(node.left, ctx);
  const right = await evaluateExpr(node.right, ctx);

  if (node.op === '==') return boolVal(defineValuesEqual(left, right));
  if (node.op === '!=') return boolVal(!defineValuesEqual(left, right));

  if (node.op === '+') {
    if (left.type === 'string' || right.type === 'string') {
      return stringVal(toDisplayString(left) + toDisplayString(right));
    }
    if (left.type === 'number' && right.type === 'number') {
      return numberVal((left.value as number) + (right.value as number));
    }
    throw new DefineError(`'+' requires two numbers or at least one string`);
  }

  if (left.type !== 'number' || right.type !== 'number') {
    throw new DefineError(`'${node.op}' requires two number operands`);
  }
  const a = left.value as number;
  const b = right.value as number;
  switch (node.op) {
    case '-':
      return numberVal(a - b);
    case '*':
      return numberVal(a * b);
    case '/':
      return numberVal(a / b);
    case '%':
      return numberVal(a % b);
    case '>':
      return boolVal(a > b);
    case '<':
      return boolVal(a < b);
    case '>=':
      return boolVal(a >= b);
    case '<=':
      return boolVal(a <= b);
    default:
      throw new DefineError(`Unknown operator '${node.op}'`);
  }
}

export async function evaluateExpr(
  node: Expr,
  ctx: EvalContext
): Promise<DefineValue> {
  switch (node.kind) {
    case 'number':
      return numberVal(node.value);
    case 'string':
      return stringVal(node.value);
    case 'boolean':
      return boolVal(node.value);
    case 'array': {
      const items: DefineValue[] = [];
      for (const item of node.items) items.push(await evaluateExpr(item, ctx));
      return arrayVal(items);
    }
    case 'object': {
      const entries: Record<string, DefineValue> = {};
      for (const entry of node.entries) {
        if (!isValidIdentifierName(entry.key)) {
          throw new DefineError(
            `'${entry.key}' is not a valid object key`,
            entry.key
          );
        }
        entries[entry.key] = await evaluateExpr(entry.value, ctx);
      }
      return objectVal(entries);
    }
    case 'reference':
      return evaluateReference(node, ctx);
    case 'unary': {
      const v = await evaluateExpr(node.operand, ctx);
      if (node.op === '!') {
        if (v.type !== 'boolean') {
          throw new DefineError(`'!' requires a boolean operand`);
        }
        return boolVal(!(v.value as boolean));
      }
      if (v.type !== 'number') {
        throw new DefineError(`unary '-' requires a number operand`);
      }
      return numberVal(-(v.value as number));
    }
    case 'binary':
      return evaluateBinary(node, ctx);
  }
}

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
const LANGUAGE_RESERVED = new Set(['this', 'api', 'db']);
const EXTRA_RESERVED = new Set(['null', 'undefined', 'NaN', 'Infinity']);
export const RESERVED_WORDS = new Set([
  ...JS_RESERVED,
  ...LANGUAGE_RESERVED,
  ...EXTRA_RESERVED
]);

export function isValidIdentifierName(name: string): boolean {
  return IDENTIFIER_RE.test(name) && !RESERVED_WORDS.has(name);
}

export function protectWithPlaceholders(
  text: string,
  regex: RegExp,
  prefix: string,
  store: Map<string, string>
): string {
  let counter = store.size;
  return text.replace(regex, match => {
    const key = `@@${prefix}_${counter++}@@`;
    store.set(key, match);
    return key;
  });
}

export function restoreAllPlaceholders(
  text: string,
  store: Map<string, string>
): string {
  let result = text;
  for (const [key, value] of store.entries()) {
    result = result.replaceAll(key, () => value);
  }
  return result;
}

export async function evaluateDefineBlock(
  raw: string | null,
  apiRegistry: ApiRegistry
): Promise<{scope: Map<string, DefineValue>; errors: DefineErrorInfo[]}> {
  const scope = new Map<string, DefineValue>();
  const errors: DefineErrorInfo[] = [];
  if (!raw) return {scope, errors};

  let assignments: Assignment[];
  try {
    assignments = new Parser(tokenize(raw)).parseDefineBlock();
  } catch (err) {
    errors.push({message: err instanceof Error ? err.message : String(err)});
    return {scope, errors};
  }

  const seenKeys = new Set<string>();
  for (const assignment of assignments) {
    const {key, value} = assignment;
    if (!isValidIdentifierName(key)) {
      errors.push({
        message: `'${key}' is not a valid variable name (check reserved words / naming rules)`,
        key
      });
      continue;
    }
    if (seenKeys.has(key)) {
      errors.push({message: `'${key}' is already defined`, key});
      continue;
    }
    try {
      const result = await evaluateExpr(value, {
        scope,
        allowThis: true,
        apiRegistry
      });
      scope.set(key, result);
      seenKeys.add(key);
    } catch (err) {
      errors.push({
        message: err instanceof Error ? err.message : String(err),
        key
      });
    }
  }

  return {scope, errors};
}

const LEADING_WS_RE = /^[\s\uFEFF]*/;
export const DEFINE_BLOCK_RE =
  /^:::define[^\n]*\r?\n([\s\S]*?)\r?\n:::[ \t]*(?=\r?\n|$)/i;
const STRAY_DEFINE_BLOCK_RE =
  /^[ \t]*:::define[^\n]*\r?\n[\s\S]*?\r?\n[ \t]*:::[ \t]*$/gim;

function maskFencedCodeBlocks(markdown: string): string {
  const lines = markdown.split(/(\r?\n)/);
  let fence: {char: string; length: number} | null = null;

  return lines
    .map(line => {
      if (/^\r?\n$/.test(line)) return line;

      const opening = line.match(/^ {0,3}(`{3,}|~{3,})/);
      if (!fence && opening) {
        fence = {char: opening[1][0], length: opening[1].length};
        return line.replace(/[^\r]/g, ' ');
      }

      if (fence) {
        const closing = new RegExp(
          `^ {0,3}${fence.char}{${fence.length},}[ \\t]*$`
        );
        const masked = line.replace(/[^\r]/g, ' ');
        if (closing.test(line)) fence = null;
        return masked;
      }

      return line;
    })
    .join('');
}

export function extractDefineBlock(markdown: string): {
  raw: string | null;
  body: string;
  errors: DefineErrorInfo[];
} {
  const errors: DefineErrorInfo[] = [];
  const trimmed = markdown.replace(LEADING_WS_RE, '');
  const match = trimmed.match(DEFINE_BLOCK_RE);
  let raw: string | null = null;
  let body = markdown;

  if (match) {
    raw = match[1];
    body = trimmed.slice(match[0].length).replace(/^\r?\n/, '');
  }

  STRAY_DEFINE_BLOCK_RE.lastIndex = 0;
  if (STRAY_DEFINE_BLOCK_RE.test(maskFencedCodeBlocks(body))) {
    errors.push({
      message:
        'Only one :::define block is allowed, and it must be the first thing in the document.'
    });
  }

  return {raw, body, errors};
}

export function protectDefineBlockForTranslation(
  markdown: string,
  store: Map<string, string>
): string {
  return protectWithPlaceholders(
    markdown,
    DEFINE_BLOCK_RE,
    'DEFINE_BLOCK',
    store
  );
}

export interface InterpolationToken {
  start: number;
  end: number;
  kind: 'conditional' | 'plain';
  bracketContent?: string;
  exprSource: string;
}

function findMatchingBracket(
  text: string,
  openPos: number,
  openChar: string,
  closeChar: string
): number {
  const n = text.length;
  let depth = 0;
  let j = openPos;
  while (j < n) {
    const c = text[j];
    if (c === '"') {
      j++;
      while (j < n && text[j] !== '"') {
        if (text[j] === '\\') j += 2;
        else j++;
      }
      j++;
      continue;
    }
    if (c === openChar) depth++;
    else if (c === closeChar) {
      depth--;
      if (depth === 0) return j;
    }
    j++;
  }
  return -1;
}

export function scanInterpolationTokens(text: string): InterpolationToken[] {
  const tokens: InterpolationToken[] = [];
  let i = 0;
  const n = text.length;

  while (i < n) {
    if (text[i] === '[') {
      const closeBracket = findMatchingBracket(text, i, '[', ']');
      if (
        closeBracket !== -1
        && text[closeBracket + 1] === '.'
        && text[closeBracket + 2] === '$'
        && text[closeBracket + 3] === '{'
      ) {
        const openBrace = closeBracket + 3;
        const closeBrace = findMatchingBracket(text, openBrace, '{', '}');
        if (closeBrace !== -1) {
          tokens.push({
            start: i,
            end: closeBrace + 1,
            kind: 'conditional',
            bracketContent: text.slice(i + 1, closeBracket),
            exprSource: text.slice(openBrace + 1, closeBrace)
          });
          i = closeBrace + 1;
          continue;
        }
      }
      i++;
      continue;
    }
    if (text[i] === '$' && text[i + 1] === '{') {
      const closeBrace = findMatchingBracket(text, i + 1, '{', '}');
      if (closeBrace !== -1) {
        tokens.push({
          start: i,
          end: closeBrace + 1,
          kind: 'plain',
          exprSource: text.slice(i + 2, closeBrace)
        });
        i = closeBrace + 1;
        continue;
      }
    }
    i++;
  }

  return tokens;
}

function renderDefineErrorMarker(message: string): string {
  const escaped = message
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
  return `<span class="markdown-define-error text-danger font-mono text-xs" title="${escaped}">[define error]</span>`;
}

async function evaluateInterpolationToken(
  token: InterpolationToken,
  scope: Map<string, DefineValue>,
  apiRegistry: ApiRegistry
): Promise<{replacement: string; error?: DefineErrorInfo}> {
  try {
    const expr = new Parser(tokenize(token.exprSource)).parseExpression();
    const value = await evaluateExpr(expr, {
      scope,
      allowThis: false,
      apiRegistry
    });
    if (token.kind === 'conditional') {
      if (value.type !== 'boolean') {
        throw new DefineError(
          'Expected a boolean expression inside [...].${...}'
        );
      }
      return {replacement: value.value ? (token.bracketContent ?? '') : ''};
    }
    return {replacement: toDisplayString(value)};
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return {replacement: renderDefineErrorMarker(message), error: {message}};
  }
}

export async function interpolateBody(
  bodyMarkdown: string,
  scope: Map<string, DefineValue>,
  apiRegistry: ApiRegistry
): Promise<{output: string; errors: DefineErrorInfo[]}> {
  if (!bodyMarkdown) return {output: '', errors: []};

  const codePlaceholders = new Map<string, string>();
  let text = protectWithPlaceholders(
    bodyMarkdown,
    /^[ \t]*(`{3,}|~{3,})[^\n]*\r?\n[\s\S]*?\r?\n[ \t]*\1[ \t]*$/gm,
    'FENCED_CODE',
    codePlaceholders
  );
  text = protectWithPlaceholders(
    text,
    /(`+)(?:[^\n`]|`(?!\1))+\1/g,
    'INLINE_CODE',
    codePlaceholders
  );

  const tokens = scanInterpolationTokens(text);
  const errors: DefineErrorInfo[] = [];
  let result = text;

  for (let i = tokens.length - 1; i >= 0; i--) {
    const token = tokens[i];
    const {replacement, error} = await evaluateInterpolationToken(
      token,
      scope,
      apiRegistry
    );
    if (error) errors.push(error);
    result =
      result.slice(0, token.start) + replacement + result.slice(token.end);
  }

  result = restoreAllPlaceholders(result, codePlaceholders);
  return {output: result, errors};
}

export function protectInterpolationTokens(
  markdown: string,
  store: Map<string, string>
): string {
  const codePlaceholders = new Map<string, string>();
  let text = protectWithPlaceholders(
    markdown,
    /^[ \t]*(`{3,}|~{3,})[^\n]*\r?\n[\s\S]*?\r?\n[ \t]*\1[ \t]*$/gm,
    'FENCED_CODE',
    codePlaceholders
  );
  text = protectWithPlaceholders(
    text,
    /(`+)(?:[^\n`]|`(?!\1))+\1/g,
    'INLINE_CODE',
    codePlaceholders
  );

  const tokens = scanInterpolationTokens(text);
  let result = text;
  for (let i = tokens.length - 1; i >= 0; i--) {
    const token = tokens[i];
    const key = `@@INTERPOLATION_${store.size}@@`;
    store.set(key, text.slice(token.start, token.end));
    result = result.slice(0, token.start) + key + result.slice(token.end);
  }

  return restoreAllPlaceholders(result, codePlaceholders);
}

export async function resolveProtectedInterpolationTokens(
  text: string,
  store: Map<string, string>,
  scope: Map<string, DefineValue>,
  apiRegistry: ApiRegistry
): Promise<{output: string; errors: DefineErrorInfo[]}> {
  let result = text;
  const errors: DefineErrorInfo[] = [];

  for (const [key, originalSpan] of store.entries()) {
    const tokens = scanInterpolationTokens(originalSpan);
    let replacement = originalSpan;
    if (tokens.length === 1 && tokens[0].start === 0) {
      const {replacement: r, error} = await evaluateInterpolationToken(
        tokens[0],
        scope,
        apiRegistry
      );
      replacement = r;
      if (error) errors.push(error);
    }
    result = result.replaceAll(key, () => replacement);
  }

  return {output: result, errors};
}

export function createApiRegistry(supabaseClient: any): ApiRegistry {
  if (!supabaseClient) {
    const unavailable: ApiResolver = async () => {
      throw new DefineError('Database access is unavailable in this context.');
    };
    return {author: unavailable, blog: unavailable};
  }
  return {
    author: path => resolveAuthorPath(path, supabaseClient),
    blog: path => resolveBlogPath(path, supabaseClient)
  };
}

export const createDbRegistry = createApiRegistry;

async function resolveAuthorPath(
  path: PathSegment[],
  supabaseClient: any
): Promise<DefineValue> {
  const [profile, cv, funding, contact, skills, socials] = await Promise.all([
    fetchAuthorProfile(supabaseClient, {includeEmail: true}),
    fetchCvEntries(supabaseClient),
    fetchFundingLinks(supabaseClient),
    fetchContactInfo(supabaseClient),
    fetchGroupedSkills(supabaseClient),
    fetchSocials(supabaseClient)
  ]);
  const combined = sanitizePublicApiData({
    profile,
    cv,
    funding,
    contact,
    skills,
    socials
  });
  if (profile?.email && combined.profile) {
    combined.profile.email = profile.email;
  }
  return walkPath(jsToDefineValue(combined), path);
}

async function resolveBlogPath(
  path: PathSegment[],
  supabaseClient: any
): Promise<DefineValue> {
  const [first, ...rest] = path;

  if (first && first.kind === 'index' && typeof first.value === 'string') {
    const slug = first.value;
    const {data: post, error} = await supabaseClient
      .from('db_posts')
      .select('*')
      .eq('slug', slug)
      .eq('published', true)
      .maybeSingle();

    if (error || !post) {
      throw new DefineError(
        `api.v1.blog['${slug}'] does not resolve to a published post`
      );
    }

    let content = '';
    if (post.storage_path) {
      try {
        const {data: urlData} = supabaseClient.storage
          .from('blog-posts')
          .getPublicUrl(post.storage_path);
        const fileRes = await fetch(urlData.publicUrl);
        if (fileRes.ok) content = await fileRes.text();
      } catch {}
    }

    return walkPath(jsToDefineValue({...post, content}), rest);
  }

  const {data: posts, error} = await supabaseClient
    .from('db_posts')
    .select(
      'id, title, slug, excerpt, summary, tldr, collaborators, created_at, updated_at'
    )
    .eq('published', true)
    .order('created_at', {ascending: false})
    .range(0, 19);

  if (error) {
    throw new DefineError('Could not fetch the blog post list.');
  }

  return walkPath(arrayVal((posts ?? []).map(jsToDefineValue)), path);
}

export async function validateDefineForSave(
  markdown: string,
  apiRegistry: ApiRegistry
): Promise<{ok: boolean; errors: DefineErrorInfo[]}> {
  const {
    raw: defineRaw,
    body: bodyAfterDefine,
    errors: placementErrors
  } = extractDefineBlock(markdown);
  const {scope, errors: defineErrors} = await evaluateDefineBlock(
    defineRaw,
    apiRegistry
  );
  const {errors: interpolationErrors} = await interpolateBody(
    bodyAfterDefine,
    scope,
    apiRegistry
  );

  const errors = [...placementErrors, ...defineErrors, ...interpolationErrors];
  return {ok: errors.length === 0, errors};
}
