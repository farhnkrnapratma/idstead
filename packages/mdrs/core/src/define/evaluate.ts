import {
    type ArrayLit,
    type BinaryExpr,
    type Expr,
    type ObjectLit,
    type PathSegment,
    type Reference,
    type TemplateLit,
    type TernaryExpr,
    type UnaryExpr
} from './ast';
import { DefineError } from './errors';
import { isValidIdentifierName } from './identifiers';
import {
    type DefineValue,
    arrayVal,
    boolVal,
    defineValuesEqual,
    numberVal,
    objectVal,
    stringVal,
    toDisplayString,
    walkPath
} from './values';

export type ApiResolver = (path: PathSegment[]) => Promise<DefineValue>;

export type ApiRegistry = Readonly<Record<string, ApiResolver>>;

export interface EvalContext {
    scope: Map<string, DefineValue>;
    allowThis: boolean;
    apiRegistry: ApiRegistry;
}

function scopeValue(name: string, ctx: EvalContext): DefineValue {
    const value = ctx.scope.get(name);
    if (value === undefined) {
        throw new DefineError(
            ctx.allowThis ?
                `'${name}' is undefined, or referenced before it was defined`
            :   `'${name}' is undefined`,
            name
        );
    }
    return value;
}

async function evaluateReference(node: Reference, ctx: EvalContext): Promise<DefineValue> {
    if (node.root === 'this') {
        if (!ctx.allowThis) {
            throw new DefineError('this.* is only valid inside a :::define block');
        }
        if (node.path.length === 0 || node.path[0].kind !== 'prop') {
            throw new DefineError('this must be followed by a property name, e.g. this.name');
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

    if (node.root === 'api') {
        if (node.path.length === 0 || node.path[0].kind !== 'prop') {
            throw new DefineError('api must be followed by a version, e.g. api.v1.author');
        }
        const version = node.path[0].name as string;
        if (version !== 'v1') {
            throw new DefineError(`Unknown API version '${version}' (supported: v1)`);
        }
        if (node.path.length < 2 || node.path[1].kind !== 'prop') {
            throw new DefineError('api.v1 must be followed by a resource name, e.g. api.v1.author');
        }
        const resource = node.path[1].name as string;
        const resolver =
            Object.hasOwn(ctx.apiRegistry, resource) ? ctx.apiRegistry[resource] : null;
        if (!resolver) {
            throw new DefineError(
                `Unknown api.v1 resource '${resource}' (supported: ${Object.keys(ctx.apiRegistry).join(', ')})`
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

async function evaluateBinary(node: BinaryExpr, ctx: EvalContext): Promise<DefineValue> {
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

async function evaluateTemplate(node: TemplateLit, ctx: EvalContext): Promise<DefineValue> {
    let text = '';
    for (const part of node.parts) {
        if (part.kind === 'text') text += part.value;
        else if (part.kind === 'variable') text += toDisplayString(scopeValue(part.name, ctx));
        else text += toDisplayString(await evaluateExpr(part.expr, ctx));
    }
    return stringVal(text);
}

async function evaluateTernary(node: TernaryExpr, ctx: EvalContext): Promise<DefineValue> {
    const test = await evaluateExpr(node.test, ctx);
    if (test.type !== 'boolean') throw new DefineError(`'? :' requires a boolean condition`);
    return evaluateExpr(test.value ? node.consequent : node.alternate, ctx);
}

async function evaluateArray(node: ArrayLit, ctx: EvalContext): Promise<DefineValue> {
    const items: DefineValue[] = [];
    for (const item of node.items) items.push(await evaluateExpr(item, ctx));
    return arrayVal(items);
}

async function evaluateObject(node: ObjectLit, ctx: EvalContext): Promise<DefineValue> {
    const entries: Record<string, DefineValue> = {};
    for (const entry of node.entries) {
        if (!isValidIdentifierName(entry.key))
            throw new DefineError(`'${entry.key}' is not a valid object key`, entry.key);
        entries[entry.key] = await evaluateExpr(entry.value, ctx);
    }
    return objectVal(entries);
}

async function evaluateUnary(node: UnaryExpr, ctx: EvalContext): Promise<DefineValue> {
    const value = await evaluateExpr(node.operand, ctx);
    if (node.op === '!') {
        if (value.type !== 'boolean') throw new DefineError(`'!' requires a boolean operand`);
        return boolVal(!(value.value as boolean));
    }
    if (value.type !== 'number') throw new DefineError(`unary '-' requires a number operand`);
    return numberVal(-(value.value as number));
}

export async function evaluateExpr(node: Expr, ctx: EvalContext): Promise<DefineValue> {
    switch (node.kind) {
        case 'number':
            return numberVal(node.value);
        case 'string':
            return stringVal(node.value);
        case 'boolean':
            return boolVal(node.value);
        case 'template':
            return evaluateTemplate(node, ctx);
        case 'ternary':
            return evaluateTernary(node, ctx);
        case 'array':
            return evaluateArray(node, ctx);
        case 'object':
            return evaluateObject(node, ctx);
        case 'reference':
            return evaluateReference(node, ctx);
        case 'unary':
            return evaluateUnary(node, ctx);
        case 'binary':
            return evaluateBinary(node, ctx);
    }
}

export function unavailableResolvers(): ApiRegistry {
    const unavailable: ApiResolver = async () => {
        throw new DefineError('Database access is unavailable in this context.');
    };
    return new Proxy({} as Record<string, ApiResolver>, {
        get: () => unavailable,
        has: () => true,
        ownKeys: () => [],
        getOwnPropertyDescriptor: () => ({
            configurable: true,
            enumerable: false,
            value: unavailable
        })
    });
}
