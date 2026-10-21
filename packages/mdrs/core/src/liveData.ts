import { extractFrontmatter } from './frontmatter';
import { extractDefineBlock, hasDefineEntries } from './define';
import { stripPlaceholderChars } from './placeholders';

const API_REFERENCE_RE = /(^|[^\w$.])api\s*\./;

export function usesLiveData(markdown: string): boolean {
    const { body } = extractFrontmatter(stripPlaceholderChars(markdown));
    const { raw, body: rest } = extractDefineBlock(body);
    if (!hasDefineEntries(raw)) return false;
    return API_REFERENCE_RE.test(raw ?? '') || API_REFERENCE_RE.test(rest);
}
