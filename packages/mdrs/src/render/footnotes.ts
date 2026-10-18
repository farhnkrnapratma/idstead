function indexToLetter(idx: number): string {
    let result = '';
    let n = idx;
    while (n >= 0) {
        result = String.fromCharCode(97 + (n % 26)) + result;
        n = Math.floor(n / 26) - 1;
    }
    return result;
}

export function formatFootnoteReferences(html: string): string {
    const footnoteSectionRe =
        /<section\b([^>]*class="[^"]*mdrs-footnotes[^"]*"[^>]*)>([\s\S]*?)<\/section>/gi;

    return html.replace(
        footnoteSectionRe,
        (_sectionMatch: string, sectionAttrs: string, sectionBody: string) => {
            const updatedSectionBody = sectionBody.replace(
                /<li\b([^>]*id="([^"]*)"[^>]*)>([\s\S]*?)<\/li>/gi,
                (_liMatch: string, liAttrs: string, _liId: string, liInner: string) => {
                    const backrefRe = /<a\b[^>]*data-[^>]*backref[^>]*>([\s\S]*?)<\/a>/gi;
                    const matches = [...liInner.matchAll(backrefRe)];
                    if (matches.length === 0) return _liMatch;

                    const hrefs: string[] = [];
                    for (const m of matches) {
                        const hrefAttr = m[0].match(/href="([^"]*)"/i);
                        if (hrefAttr) hrefs.push(hrefAttr[1]);
                    }

                    let cleaned = liInner.replace(
                        /\s*<a\b[^>]*data-[^>]*backref[^>]*>[\s\S]*?<\/a>/gi,
                        ''
                    );

                    let prefix: string;
                    if (hrefs.length === 1) {
                        prefix = `<a href="${hrefs[0]}" class="mdrs-footnote-backref" aria-label="Back to reference">^</a>`;
                    } else {
                        const subLinks = hrefs
                            .map(
                                (href, i) =>
                                    `<a href="${href}" class="mdrs-footnote-backref mdrs-footnote-backref--sub" aria-label="Back to reference ${indexToLetter(i)}">${indexToLetter(i)}</a>`
                            )
                            .join('');
                        prefix = `<span class="mdrs-footnote-backref-static" aria-hidden="true">^</span><span class="mdrs-footnote-backrefs">${subLinks}</span>`;
                    }

                    if (/<p\b[^>]*>/i.test(cleaned)) {
                        cleaned = cleaned.replace(/^(<p\b[^>]*>)\s+/i, '$1');
                        cleaned = cleaned.replace(/(<p\b[^>]*>)/i, `$1${prefix}`);
                    } else {
                        cleaned = `${prefix}${cleaned.trimStart()}`;
                    }

                    return `<li${liAttrs}>${cleaned}</li>`;
                }
            );

            return `<section${sectionAttrs}>${updatedSectionBody}</section>`;
        }
    );
}
