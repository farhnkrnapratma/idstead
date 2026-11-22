// SPDX-FileCopyrightText: 2026 Farhan Kurnia Pratama
//
// SPDX-License-Identifier: MIT OR Apache-2.0

export { MAX_DOCUMENT_LENGTH } from '../limits';
export { DefineError, type DefineErrorInfo } from './errors';
export { checkGetUrl, documentFetcher, unavailableFetcher, type JsonFetcher } from './fetcher';
export { evaluateDefineBlock, extractDefineBlock, hasDefineEntries } from './block';
export { protectInterpolationTokens, resolveProtectedInterpolationTokens } from './interpolation';
export { conditionSources, resolveConditionals } from './conditionals';
export { validateDefineForSave } from './validate';
