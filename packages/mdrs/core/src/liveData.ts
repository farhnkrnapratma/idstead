// SPDX-FileCopyrightText: 2026 Farhan Kurnia Pratama
//
// SPDX-License-Identifier: MIT OR Apache-2.0

import { extractFrontmatter } from './frontmatter';
import { conditionSources, extractDefineBlock, hasDefineEntries } from './define';
import { stripPlaceholderChars } from './placeholders';

const GET_CALL_RE = /(^|[^\w$.])get\s*\(/;

export function usesLiveData(markdown: string): boolean {
    const { body } = extractFrontmatter(stripPlaceholderChars(markdown));
    const { raw, body: rest } = extractDefineBlock(body);
    if (conditionSources(rest).some(source => GET_CALL_RE.test(source))) return true;
    if (!hasDefineEntries(raw)) return false;
    return GET_CALL_RE.test(raw ?? '') || GET_CALL_RE.test(rest);
}
