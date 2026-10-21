import hljs from 'highlight.js';
import { replaceMathBlocks, MATH_INLINE_RE } from '@mdrs/core';

function escapeFormula(formula: string): string {
    return formula.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

export function highlightMarkdown(code: string): string {
    try {
        const formulas: { id: string; html: string }[] = [];
        const hold = (kind: string, source: string) => {
            const id = `XQZMATH${kind}${formulas.length}XQZ`;
            formulas.push({
                id,
                html: `<span class="hljs-formula">${escapeFormula(source)}</span>`
            });
            return id;
        };
        const withBlocks = replaceMathBlocks(code, (_prefix, _source, block) =>
            hold('BLOCK', block)
        );
        const withInline = withBlocks.replace(MATH_INLINE_RE, match => hold('INLINE', match));
        let html = hljs.highlight(withInline, { language: 'markdown' }).value;
        for (const formula of formulas) html = html.replaceAll(formula.id, () => formula.html);
        return html;
    } catch {
        return code;
    }
}
