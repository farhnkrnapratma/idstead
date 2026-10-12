export function extractReferences(markdown: string) {
    const lines = markdown.split(/\r?\n/);
    const output: string[] = [];
    const definitions: string[] = [];
    let fence = '';
    let inside = false;
    let found = false;
    let marker = 'REFERENCESPLACEMENT';
    while (markdown.includes(marker)) marker += 'X';
    for (const line of lines) {
        const boundary = line.match(/^ {0,3}(`{3,}|~{3,})(.*)$/);
        if (fence) {
            if (
                boundary
                && boundary[1][0] === fence[0]
                && boundary[1].length >= fence.length
                && !boundary[2].trim()
            )
                fence = '';
            (inside ? definitions : output).push(line);
            continue;
        }
        if (boundary) {
            fence = boundary[1];
            (inside ? definitions : output).push(line);
            continue;
        }
        if (/^ {0,3}:::references\s*$/i.test(line)) {
            if (found) throw new Error('Use only one references block per document.');
            found = true;
            inside = true;
            output.push('', marker, '');
        } else if (inside && /^\s*:::\s*$/.test(line)) {
            inside = false;
        } else {
            (inside ? definitions : output).push(line);
        }
    }
    if (inside) throw new Error('Close the references block with :::.');
    return {
        markdown: found ? [...output, '', ...definitions].join('\n') : markdown,
        marker: found ? marker : null
    };
}

export function placeReferences(html: string, marker: string | null) {
    if (!marker) return html;
    let references = '<section class="footnotes"><h2>References</h2></section>';
    const body = html.replace(
        /<section\b[^>]*class="[^"]*\bfootnotes\b[^"]*"[^>]*>[\s\S]*?<\/section>/i,
        section => {
            references = section.replace(
                /<h2\b([^>]*)>[\s\S]*?<\/h2>/i,
                (_heading, attrs: string) =>
                    `<h2${attrs.replace(/\sclass="[^"]*"/i, '')}>References</h2>`
            );
            return '';
        }
    );
    return body.replace(`<p>${marker}</p>`, references);
}
