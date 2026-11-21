// SPDX-FileCopyrightText: 2026 Farhan Kurnia Pratama
//
// SPDX-License-Identifier: MIT OR Apache-2.0

import { extractFrontmatter } from '../frontmatter';
import { extractReferences } from '../references';
import { evaluateDefineBlock, extractDefineBlock, hasDefineEntries } from './block';
import type { DefineErrorInfo } from './errors';
import { documentFetcher, type JsonFetcher } from './fetcher';
import { resolveConditionals } from './conditionals';
import { interpolateBody } from './interpolation';
import { MAX_DOCUMENT_LENGTH } from '../limits';

export async function validateDefineForSave(
    markdown: string,
    fetcher: JsonFetcher
): Promise<{ ok: boolean; errors: DefineErrorInfo[] }> {
    const get = documentFetcher(fetcher);
    if (markdown.length > MAX_DOCUMENT_LENGTH) {
        return { ok: false, errors: [{ message: 'Markdown document is too large to render.' }] };
    }
    const frontmatter = extractFrontmatter(markdown);
    const frontmatterErrors: DefineErrorInfo[] = frontmatter.error
        ? [{ message: frontmatter.error }]
        : [];
    const {
        raw: defineRaw,
        body: bodyAfterDefine,
        errors: placementErrors
    } = extractDefineBlock(frontmatter.body);
    const { scope, errors: defineErrors } = await evaluateDefineBlock(defineRaw, get);
    const interpolate = hasDefineEntries(defineRaw);
    const { output: allBranches, errors: conditionalErrors } = await resolveConditionals(
        bodyAfterDefine,
        scope,
        get,
        { inline: interpolate, mode: 'validate' }
    );
    const { errors: interpolationErrors } = interpolate
        ? await interpolateBody(allBranches, scope, get)
        : { errors: [] };
    const structureErrors: DefineErrorInfo[] = [];
    try {
        extractReferences(bodyAfterDefine);
    } catch (err) {
        structureErrors.push({ message: err instanceof Error ? err.message : String(err) });
    }

    const errors = [
        ...frontmatterErrors,
        ...placementErrors,
        ...defineErrors,
        ...conditionalErrors,
        ...interpolationErrors,
        ...structureErrors
    ];
    return { ok: errors.length === 0, errors };
}
