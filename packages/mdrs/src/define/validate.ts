import { extractFrontmatter } from '../frontmatter';
import { extractReferences } from '../references';
import { evaluateDefineBlock, extractDefineBlock, hasDefineEntries } from './block';
import { type DefineErrorInfo } from './errors';
import { type ApiRegistry } from './evaluate';
import { interpolateBody } from './interpolation';
import { MAX_DOCUMENT_LENGTH } from '../limits';

export async function validateDefineForSave(
    markdown: string,
    apiRegistry: ApiRegistry
): Promise<{ ok: boolean; errors: DefineErrorInfo[] }> {
    if (markdown.length > MAX_DOCUMENT_LENGTH) {
        return { ok: false, errors: [{ message: 'Markdown document is too large to render.' }] };
    }
    const frontmatter = extractFrontmatter(markdown);
    const frontmatterErrors: DefineErrorInfo[] =
        frontmatter.error ? [{ message: frontmatter.error }] : [];
    const {
        raw: defineRaw,
        body: bodyAfterDefine,
        errors: placementErrors
    } = extractDefineBlock(frontmatter.body);
    const { scope, errors: defineErrors } = await evaluateDefineBlock(defineRaw, apiRegistry);
    const { errors: interpolationErrors } =
        hasDefineEntries(defineRaw) ?
            await interpolateBody(bodyAfterDefine, scope, apiRegistry)
        :   { errors: [] };
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
        ...interpolationErrors,
        ...structureErrors
    ];
    return { ok: errors.length === 0, errors };
}
