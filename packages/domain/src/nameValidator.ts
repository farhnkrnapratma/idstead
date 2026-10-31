// SPDX-FileCopyrightText: 2026 Farhan Kurnia Pratama
//
// SPDX-License-Identifier: AGPL-3.0-only

export function normalizeName(name: string): string {
    let normalized = name.trim().toLowerCase().normalize('NFKC');
    normalized = normalized.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    const homoglyphs: Record<string, string> = {
        а: 'a',
        е: 'e',
        о: 'o',
        р: 'p',
        с: 'c',
        у: 'y',
        х: 'x',
        і: 'i',
        ј: 'j',
        ѕ: 's',
        ԁ: 'd',
        ԛ: 'q',
        ԝ: 'w',
        α: 'a',
        ε: 'e',
        ι: 'i',
        ο: 'o',
        ρ: 'p',
        υ: 'y',
        χ: 'x',
        '0': 'o',
        '1': 'i',
        l: 'i'
    };
    let homoglyphFree = '';
    for (const char of normalized) {
        homoglyphFree += homoglyphs[char] || char;
    }
    return homoglyphFree.replace(/[^a-z0-9]/g, '');
}

export function isNameReserved(name: string, extraReservedNames: string[] = []): boolean {
    const normalized = normalizeName(name);

    const substringReserved = [
        'admin',
        'administrator',
        'moderator',
        'owner',
        'support',
        'official',
        'system'
    ];

    const exactOrWordReserved = ['mod'];

    for (const extra of extraReservedNames) {
        if (!extra) continue;
        const clean = normalizeName(extra);
        if (clean.length >= 3) {
            substringReserved.push(clean);
        }
    }

    if (substringReserved.some(pattern => normalized.includes(pattern))) {
        return true;
    }

    if (exactOrWordReserved.includes(normalized)) {
        return true;
    }

    const words = name
        .toLowerCase()
        .split(/[^a-z0-9]+/)
        .map(w => normalizeName(w))
        .filter(Boolean);
    if (words.some(word => exactOrWordReserved.includes(word))) {
        return true;
    }

    return false;
}

export function extractAuthorNameTokens(
    author?: { name?: string; username?: string } | null
): string[] {
    if (!author) return [];
    const tokens: string[] = [];
    if (author.username) {
        tokens.push(author.username);
    }
    if (author.name) {
        tokens.push(author.name);
        const parts = author.name.split(/[^a-zA-Z0-9]+/).filter(p => p.length >= 3);
        tokens.push(...parts);
    }
    return tokens;
}
