// SPDX-FileCopyrightText: 2026 Farhan Kurnia Pratama
//
// SPDX-License-Identifier: AGPL-3.0-only

interface Clause {
    negate: boolean;
    words: string[];
}

function words(text: string): string[] {
    return text.toLowerCase().match(/[\p{L}\p{N}_]+/gu) ?? [];
}

function containsPhrase(tokens: string[], phrase: string[]): boolean {
    if (!phrase.length) return true;
    for (let start = 0; start + phrase.length <= tokens.length; start++)
        if (phrase.every((word, index) => tokens[start + index] === word)) return true;
    return false;
}

export function webSearchMatcher(query: string): (text: string) => boolean {
    const groups: Clause[][] = [[]];
    for (const match of query.matchAll(/(-?)"([^"]*)"?|(\S+)/g)) {
        const [, minus, quoted, bare] = match;
        if (bare !== undefined && bare.toLowerCase() === 'or') {
            groups.push([]);
            continue;
        }
        const negate = bare !== undefined ? bare.startsWith('-') : minus === '-';
        const phrase = words(quoted ?? bare.replace(/^-/, ''));
        if (phrase.length) groups[groups.length - 1].push({ negate, words: phrase });
    }
    const active = groups.filter(group => group.some(clause => !clause.negate));
    if (!active.length) return () => true;
    return text => {
        const tokens = words(text);
        return active.some(group =>
            group.every(clause => containsPhrase(tokens, clause.words) !== clause.negate)
        );
    };
}
