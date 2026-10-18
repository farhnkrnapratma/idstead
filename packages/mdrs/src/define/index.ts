export { MAX_DOCUMENT_LENGTH } from '../limits';
export { DefineError, type DefineErrorInfo } from './errors';
export type { PathSegment } from './ast';
export {
    jsToDefineValue,
    defineValueToJs,
    toDisplayString,
    walkPath,
    type DefineValue
} from './values';
export {
    evaluateExpr,
    unavailableResolvers,
    type ApiRegistry,
    type ApiResolver,
    type EvalContext
} from './evaluate';
export { RESERVED_WORDS, isValidIdentifierName } from './identifiers';
export {
    DEFINE_BLOCK_RE,
    evaluateDefineBlock,
    extractDefineBlock,
    hasDefineEntries
} from './block';
export {
    interpolateBody,
    protectInterpolationTokens,
    resolveProtectedInterpolationTokens,
    scanInterpolationTokens,
    type InterpolationToken
} from './interpolation';
export { validateDefineForSave } from './validate';
