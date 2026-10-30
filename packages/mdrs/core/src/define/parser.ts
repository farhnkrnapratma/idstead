import {
    type ArrayLit,
    type Assignment,
    type Expr,
    type ObjectLit,
    type PathSegment,
    type Reference,
    type TemplateLit
} from './ast';
import { DefineError } from './errors';
import { type Token, type TokenType, tokenize } from './lexer';

const RELATIONAL_MAP: Record<string, string> = { GT: '>', LT: '<', GTE: '>=', LTE: '<=' };

const ADDITIVE_MAP: Record<string, string> = { PLUS: '+', MINUS: '-' };

const MULTIPLICATIVE_MAP: Record<string, string> = { STAR: '*', SLASH: '/', PERCENT: '%' };

export class Parser {
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
        throw new DefineError(`${message} (got '${tok.value || tok.type}' at position ${tok.pos})`);
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
            assignments.push({ key: keyToken.value, value });
            this.skipSeparators();
        }
        return assignments;
    }

    parseExpression(): Expr {
        return this.parseTernary();
    }

    parseCompleteExpression(): Expr {
        const expr = this.parseExpression();
        if (!this.check('EOF')) {
            const tok = this.peek();
            throw new DefineError(
                `Unexpected token '${tok.value || tok.type}' at position ${tok.pos}`
            );
        }
        return expr;
    }

    private parseTernary(): Expr {
        const test = this.parseLogicalOr();
        if (!this.check('QUESTION')) return test;
        this.advance();
        const consequent = this.parseTernary();
        this.expect('COLON', "Expected ':' in a ternary expression");
        const alternate = this.parseTernary();
        return { kind: 'ternary', test, consequent, alternate };
    }

    private parseLogicalOr(): Expr {
        let left = this.parseLogicalAnd();
        while (this.check('OR')) {
            this.advance();
            const right = this.parseLogicalAnd();
            left = { kind: 'binary', op: '||', left, right };
        }
        return left;
    }

    private parseLogicalAnd(): Expr {
        let left = this.parseEquality();
        while (this.check('AND')) {
            this.advance();
            const right = this.parseEquality();
            left = { kind: 'binary', op: '&&', left, right };
        }
        return left;
    }

    private parseEquality(): Expr {
        let left = this.parseRelational();
        while (this.check('EQ') || this.check('NEQ')) {
            const opTok = this.advance();
            const right = this.parseRelational();
            left = { kind: 'binary', op: opTok.type === 'EQ' ? '==' : '!=', left, right };
        }
        return left;
    }

    private parseRelational(): Expr {
        let left = this.parseAdditive();
        while (this.check('GT') || this.check('LT') || this.check('GTE') || this.check('LTE')) {
            const opTok = this.advance();
            const right = this.parseAdditive();
            left = { kind: 'binary', op: RELATIONAL_MAP[opTok.type], left, right };
        }
        return left;
    }

    private parseAdditive(): Expr {
        let left = this.parseMultiplicative();
        while (this.check('PLUS') || this.check('MINUS')) {
            const opTok = this.advance();
            const right = this.parseMultiplicative();
            left = { kind: 'binary', op: ADDITIVE_MAP[opTok.type], left, right };
        }
        return left;
    }

    private parseMultiplicative(): Expr {
        let left = this.parseUnary();
        while (this.check('STAR') || this.check('SLASH') || this.check('PERCENT')) {
            const opTok = this.advance();
            const right = this.parseUnary();
            left = { kind: 'binary', op: MULTIPLICATIVE_MAP[opTok.type], left, right };
        }
        return left;
    }

    private parseUnary(): Expr {
        if (this.check('NOT')) {
            this.advance();
            return { kind: 'unary', op: '!', operand: this.parseUnary() };
        }
        if (this.check('MINUS')) {
            this.advance();
            return { kind: 'unary', op: '-', operand: this.parseUnary() };
        }
        return this.parsePrimary();
    }

    private parsePrimary(): Expr {
        const tok = this.peek();
        if (tok.type === 'NUMBER') {
            this.advance();
            return { kind: 'number', value: parseFloat(tok.value) };
        }
        if (tok.type === 'STRING') {
            this.advance();
            return { kind: 'string', value: tok.value };
        }
        if (tok.type === 'TEMPLATE') {
            this.advance();
            return this.templateLiteral(tok);
        }
        if (tok.type === 'BOOLEAN') {
            this.advance();
            return { kind: 'boolean', value: tok.value === 'true' };
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
        throw new DefineError(`Unexpected token '${tok.value || tok.type}' at position ${tok.pos}`);
    }

    private templateLiteral(tok: Token): TemplateLit {
        return {
            kind: 'template',
            parts: (tok.parts ?? []).map(part =>
                part.kind === 'expression' ?
                    {
                        kind: 'expression',
                        expr: new Parser(tokenize(part.source)).parseCompleteExpression()
                    }
                :   part
            )
        };
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
        return { kind: 'array', items };
    }

    private parseObjectLiteral(): ObjectLit {
        this.expect('LBRACE', "Expected '{'");
        this.skipSeparators();
        const entries: { key: string; value: Expr }[] = [];
        while (!this.check('RBRACE')) {
            const keyToken = this.expect('IDENT', 'Expected an object key');
            this.expect('COLON', `Expected ':' after '${keyToken.value}'`);
            const value = this.parseExpression();
            entries.push({ key: keyToken.value, value });
            this.skipSeparators();
        }
        this.expect('RBRACE', "Expected '}'");
        return { kind: 'object', entries };
    }

    private parseReferenceChain(): Reference {
        const rootTok = this.expect('IDENT', 'Expected an identifier');
        const path: PathSegment[] = [];
        for (;;) {
            if (this.check('DOT')) {
                this.advance();
                const propTok = this.expect('IDENT', 'Expected a property name after .');
                path.push({ kind: 'prop', name: propTok.value });
            } else if (this.check('LBRACKET')) {
                this.advance();
                const idxTok = this.peek();
                if (idxTok.type === 'NUMBER') {
                    this.advance();
                    path.push({ kind: 'index', value: parseFloat(idxTok.value) });
                } else if (idxTok.type === 'STRING') {
                    this.advance();
                    path.push({ kind: 'index', value: idxTok.value });
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
        return { kind: 'reference', root: rootTok.value, path };
    }
}
