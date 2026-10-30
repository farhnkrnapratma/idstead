export { MAX_DOCUMENT_LENGTH } from '../limits';
export { DefineError, type DefineErrorInfo } from './errors';
export type { PathSegment } from './ast';
export { jsToDefineValue, walkPath, type DefineValue } from './values';
export { unavailableResolvers, type ApiRegistry, type ApiResolver } from './evaluate';
export { evaluateDefineBlock, extractDefineBlock, hasDefineEntries } from './block';
export { protectInterpolationTokens, resolveProtectedInterpolationTokens } from './interpolation';
export { conditionSources, resolveConditionals } from './conditionals';
export { validateDefineForSave } from './validate';
