// SPDX-FileCopyrightText: 2026 Farhan Kurnia Pratama
//
// SPDX-License-Identifier: AGPL-3.0-only

const HASH_SOURCE = /^'sha(?:256|384|512)-[A-Za-z0-9+/=]+'$/;
const INLINE_SCRIPT = /<script\b([^>]*)>([\s\S]*?)<\/script\s*>/gi;
const EXECUTABLE_TYPES = new Set(['', 'module', 'text/javascript', 'application/javascript']);

function scriptType(attributes: string): string {
    return attributes.match(/\btype\s*=\s*["']?\s*([^"'\s>]+)/i)?.[1].toLowerCase() ?? '';
}

async function sha256Source(text: string): Promise<string> {
    const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
    return `'sha256-${btoa(String.fromCharCode(...new Uint8Array(digest)))}'`;
}

export async function inlineScriptHashes(html: string): Promise<string[]> {
    const hashes: string[] = [];
    for (const [, attributes, body] of html.matchAll(INLINE_SCRIPT)) {
        if (/\bsrc\s*=/i.test(attributes) || !EXECUTABLE_TYPES.has(scriptType(attributes)))
            continue;
        hashes.push(await sha256Source(body));
    }
    return hashes;
}

export function bootstrapScriptHashes(policy: string | null): string[] {
    const scriptSrc =
        policy
            ?.split(';')
            .map(part => part.trim())
            .find(part => part.startsWith('script-src ')) ?? '';
    return scriptSrc
        .split(' ')
        .slice(1)
        .filter(source => HASH_SOURCE.test(source));
}
