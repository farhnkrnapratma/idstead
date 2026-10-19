export interface SearchFlags {
    caseSensitive: boolean;
    wholeWord: boolean;
    regex: boolean;
}

export function matchFuzzy(
    target: string,
    queryText: string,
    options: SearchFlags
): { matched: boolean; score: number } {
    if (!target || !queryText) return { matched: false, score: 0 };

    if (options.regex) {
        const re = compileSearchRegex(queryText, options);
        if (re && re.test(target)) {
            return { matched: true, score: 80 };
        }
        return { matched: false, score: 0 };
    }

    if (options.wholeWord) {
        const escaped = queryText.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const flags = options.caseSensitive ? '' : 'i';
        try {
            const re = new RegExp(`\\b${escaped}\\b`, flags);
            if (re.test(target)) {
                return { matched: true, score: 90 };
            }
        } catch {}
        return { matched: false, score: 0 };
    }

    const t = options.caseSensitive ? target : target.toLowerCase();
    const q = options.caseSensitive ? queryText : queryText.toLowerCase();

    if (t === q) return { matched: true, score: 100 };
    if (t.startsWith(q)) return { matched: true, score: 80 };
    if (t.includes(q)) return { matched: true, score: 60 };

    let tIdx = 0;
    let qIdx = 0;
    let score = 0;
    let consecutive = 0;

    while (tIdx < t.length && qIdx < q.length) {
        if (t[tIdx] === q[qIdx]) {
            score += 10 + consecutive * 5;
            consecutive++;
            qIdx++;
        } else {
            consecutive = 0;
        }
        tIdx++;
    }

    if (qIdx === q.length) {
        return { matched: true, score };
    }

    return { matched: false, score: 0 };
}

export function compileSearchRegex(regexStr: string, options: SearchFlags): RegExp | null {
    try {
        let pattern = regexStr;
        let flags = options.caseSensitive ? '' : 'i';
        if (regexStr.startsWith('/') && regexStr.lastIndexOf('/') > 0) {
            const lastSlash = regexStr.lastIndexOf('/');
            pattern = regexStr.substring(1, lastSlash);
            const customFlags = regexStr.substring(lastSlash + 1);
            if (customFlags) {
                flags = customFlags;
            }
        }
        return new RegExp(pattern, flags);
    } catch {
        return null;
    }
}

const highlightCache = new Map<string, { text: string; match: boolean }[]>();
const MAX_HIGHLIGHT_CACHE = 500;

export function clearHighlightCache() {
    highlightCache.clear();
}

export function highlightChunks(
    text: string,
    query: string,
    options: SearchFlags
): { text: string; match: boolean }[] {
    if (!text) return [];
    const trimmed = query.trim();
    if (!trimmed) return [{ text, match: false }];

    const cacheKey = `${options.caseSensitive ? '1' : '0'}:${options.wholeWord ? '1' : '0'}:${options.regex ? '1' : '0'}:${trimmed}:${text}`;
    const cached = highlightCache.get(cacheKey);
    if (cached) return cached;

    if (options.regex) {
        try {
            let pattern = trimmed;
            let flags = options.caseSensitive ? 'g' : 'gi';
            if (trimmed.startsWith('/') && trimmed.lastIndexOf('/') > 0) {
                const lastSlash = trimmed.lastIndexOf('/');
                pattern = trimmed.substring(1, lastSlash);
                const customFlags = trimmed.substring(lastSlash + 1);
                flags = customFlags.includes('g') ? customFlags : customFlags + 'g';
            }
            if (!pattern) return [{ text, match: false }];
            const regex = new RegExp(`(${pattern})`, flags);
            const parts = text.split(regex);
            const testRegex = new RegExp(`^(${pattern})$`, options.caseSensitive ? '' : 'i');
            const result = parts
                .filter(part => part.length > 0)
                .map(part => ({ text: part, match: testRegex.test(part) }));
            if (highlightCache.size >= MAX_HIGHLIGHT_CACHE) highlightCache.clear();
            highlightCache.set(cacheKey, result);
            return result;
        } catch {
            return [{ text, match: false }];
        }
    }

    const rawTokens = trimmed
        .split(/\s+/)
        .map(t => t.trim())
        .filter(Boolean);

    if (rawTokens.length === 0) return [{ text, match: false }];

    const searchTerms: string[] = [];
    for (const t of rawTokens) {
        const term = options.caseSensitive ? t : t.toLowerCase();
        if (!searchTerms.includes(term)) searchTerms.push(term);
        if (term.startsWith('/') && term.length > 1) {
            const stripped = term.slice(1);
            if (!searchTerms.includes(stripped)) searchTerms.push(stripped);
        }
    }

    const escapedTerms = searchTerms
        .filter(t => t.length > 0)
        .sort((a, b) => b.length - a.length)
        .map(t => {
            const esc = t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            return options.wholeWord ? `\\b${esc}\\b` : esc;
        });

    if (escapedTerms.length === 0) return [{ text, match: false }];

    try {
        const flags = options.caseSensitive ? 'g' : 'gi';
        const regex = new RegExp(`(${escapedTerms.join('|')})`, flags);
        const parts = text.split(regex);
        const wordRegexes =
            options.wholeWord ?
                escapedTerms.map(et => new RegExp(`^${et}$`, options.caseSensitive ? '' : 'i'))
            :   null;
        const result = parts
            .filter(part => part.length > 0)
            .map(part => {
                const comp = options.caseSensitive ? part : part.toLowerCase();
                const isMatch =
                    wordRegexes ?
                        wordRegexes.some(re => re.test(part))
                    :   searchTerms.includes(comp);
                return { text: part, match: isMatch };
            });
        if (highlightCache.size >= MAX_HIGHLIGHT_CACHE) highlightCache.clear();
        highlightCache.set(cacheKey, result);
        return result;
    } catch {
        return [{ text, match: false }];
    }
}
