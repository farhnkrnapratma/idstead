// SPDX-FileCopyrightText: 2026 Farhan Kurnia Pratama
//
// SPDX-License-Identifier: MIT OR Apache-2.0

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

export interface ArrayLit {
    kind: 'array';
    items: Expr[];
}

export interface ObjectLit {
    kind: 'object';
    entries: { key: string; value: Expr }[];
}

export interface Reference {
    kind: 'reference';
    root: string;
    path: PathSegment[];
}

export interface UnaryExpr {
    kind: 'unary';
    op: '!' | '-';
    operand: Expr;
}

export type TemplatePart =
    | { kind: 'text'; value: string }
    | { kind: 'variable'; name: string }
    | { kind: 'expression'; expr: Expr };

export interface TemplateLit {
    kind: 'template';
    parts: TemplatePart[];
}

export interface TernaryExpr {
    kind: 'ternary';
    test: Expr;
    consequent: Expr;
    alternate: Expr;
}

export interface BinaryExpr {
    kind: 'binary';
    op: string;
    left: Expr;
    right: Expr;
}

export type Expr =
    | NumberLit
    | StringLit
    | TemplateLit
    | BoolLit
    | ArrayLit
    | ObjectLit
    | Reference
    | UnaryExpr
    | BinaryExpr
    | TernaryExpr;

export interface Assignment {
    key: string;
    value: Expr;
}
