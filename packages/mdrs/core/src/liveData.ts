// SPDX-FileCopyrightText: 2026 Farhan Kurnia Pratama
//
// SPDX-License-Identifier: MIT OR Apache-2.0

import { extractFrontmatter } from './frontmatter';
import { conditionSources, extractDefineBlock, hasDefineEntries } from './define';
import { stripPlaceholderChars } from './placeholders';

const API_REFERENCE_RE = /(^|[^\w$.])api\s*\./;

export function usesLiveData(markdown: string): boolean {
    const { body } = extractFrontmatter(stripPlaceholderChars(markdown));
    const { raw, body: rest } = extractDefineBlock(body);
    if (conditionSources(rest).some(source => API_REFERENCE_RE.test(source))) return true;
    if (!hasDefineEntries(raw)) return false;
    return API_REFERENCE_RE.test(raw ?? '') || API_REFERENCE_RE.test(rest);
}
