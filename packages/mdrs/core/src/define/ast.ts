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

interface UnaryExpr {
    kind: 'unary';
    op: '!' | '-';
    operand: Expr;
}

export interface BinaryExpr {
    kind: 'binary';
    op: string;
    left: Expr;
    right: Expr;
}

export type Expr =
    NumberLit | StringLit | BoolLit | ArrayLit | ObjectLit | Reference | UnaryExpr | BinaryExpr;

export interface Assignment {
    key: string;
    value: Expr;
}
