export function parseDetailsBlocks(html: string): string {
    if (!html) return '';

    const marker = '<details';
    let startIndex = html.indexOf(marker);
    if (startIndex === -1) return html;

    let result = '';
    let cursor = 0;

    while (startIndex !== -1) {
        result += html.slice(cursor, startIndex);
        const openTagEnd = html.indexOf('>', startIndex);
        if (openTagEnd === -1) {
            result += html.slice(startIndex);
            return result;
        }

        const openTag = html.slice(startIndex, openTagEnd + 1);
        const detailsAttrsMatch = openTag.match(/^<details([^>]*)>/i);
        const detailsAttrs = detailsAttrsMatch ? detailsAttrsMatch[1] : '';

        let depth = 1;
        let pos = openTagEnd + 1;

        while (depth > 0 && pos < html.length) {
            const nextOpen = html.indexOf('<details', pos);
            const nextClose = html.indexOf('</details>', pos);

            if (nextClose === -1) break;

            if (nextOpen !== -1 && nextOpen < nextClose) {
                depth++;
                pos = nextOpen + 8;
            } else {
                depth--;
                if (depth === 0) {
                    const inner = html.slice(openTagEnd + 1, nextClose).trim();
                    const summaryMatch = inner.match(/^\s*<summary([^>]*)>([\s\S]*?)<\/summary>/i);
                    let summaryAttrs = '';
                    let summaryTitle = 'Details';
                    let innerBody = inner;

                    if (summaryMatch) {
                        summaryAttrs = summaryMatch[1];
                        summaryTitle = summaryMatch[2].trim();
                        innerBody = inner.slice(summaryMatch[0].length).trim();
                    }

                    const processedBody = parseDetailsBlocks(innerBody);

                    result += `<details${detailsAttrs} class="mdrs-details">
 <summary${summaryAttrs} class="mdrs-details-summary">
 <span class="mdrs-details-title">${summaryTitle}</span>
 <span class="mdrs-details-icon" aria-hidden="true">
 <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="mdrs-icon mdrs-icon-chevrons-up-down"><path d="m7 15 5 5 5-5"/><path d="m7 9 5-5 5 5"/></svg>
 <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="mdrs-icon mdrs-icon-chevrons-down-up"><path d="m7 20 5-5 5 5"/><path d="m7 4 5 5 5-5"/></svg>
 </span>
 </summary>
 <div class="mdrs-details-body">
 ${processedBody}
 </div>
</details>`;
                    cursor = nextClose + 10;
                    break;
                } else {
                    pos = nextClose + 10;
                }
            }
        }

        if (depth > 0) {
            result += html.slice(startIndex);
            return result;
        }

        startIndex = html.indexOf(marker, cursor);
    }

    result += html.slice(cursor);
    return result;
}
