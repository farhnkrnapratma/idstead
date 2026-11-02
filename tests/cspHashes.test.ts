// SPDX-FileCopyrightText: 2026 Farhan Kurnia Pratama
//
// SPDX-License-Identifier: AGPL-3.0-only

import { describe, expect, test } from 'bun:test';
import path from 'node:path';
import { bootstrapScriptHashes, inlineScriptHashes } from '../packages/lib/src/server/cspHashes';
import { htmlContentSecurityPolicy } from '../packages/lib/src/server/csp';

const sha256 = async (text: string) =>
    `'sha256-${Buffer.from(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text))).toString('base64')}'`;

describe('inline script hashes', () => {
    test('hashes the exact body of each executable inline script', async () => {
        const html = '<script>window.a = 1;</script><p>x</p><script type="module">b()</script>';
        expect(await inlineScriptHashes(html)).toEqual([
            await sha256('window.a = 1;'),
            await sha256('b()')
        ]);
    });

    test('skips external, data and JSON-LD scripts', async () => {
        const html = [
            '<script src="/x.js"></script>',
            '<script async src="https://example.test/y.js"></script>',
            '<script type="application/ld+json">{"@type":"Blog"}</script>',
            '<script type="application/json" data-sveltekit-fetched>{}</script>'
        ].join('');
        expect(await inlineScriptHashes(html)).toEqual([]);
    });

    test('an injected script is hashed only if it is part of the trusted template', async () => {
        const trusted = await inlineScriptHashes('<script>init()</script>');
        const injected = await inlineScriptHashes(
            '<script>init()</script><script>steal()</script>'
        );
        expect(injected).toEqual([...trusted, await sha256('steal()')]);
        expect(trusted).not.toContain(await sha256('steal()'));
    });
});

describe('bootstrap script hashes from the SvelteKit policy', () => {
    test('reads only hash sources from script-src', () => {
        const policy =
            "default-src 'self'; script-src 'self' 'sha256-AAAA=' 'sha384-BBBB='; style-src 'self' 'sha256-CCCC='";
        expect(bootstrapScriptHashes(policy)).toEqual(["'sha256-AAAA='", "'sha384-BBBB='"]);
    });

    test('returns nothing when no policy or no script-src is present', () => {
        expect(bootstrapScriptHashes(null)).toEqual([]);
        expect(bootstrapScriptHashes("style-src 'self'")).toEqual([]);
    });
});

describe('static theme scripts', () => {
    test('both apps serve identical copies of the start-up scripts', async () => {
        for (const name of ['theme-init.js', 'accessibility-init.js']) {
            const web = await Bun.file(
                path.resolve(import.meta.dir, '../apps/web/static', name)
            ).text();
            const admin = await Bun.file(
                path.resolve(import.meta.dir, '../apps/admin/static', name)
            ).text();
            expect(admin).toBe(web);
        }
    });

    test('the app shells reference the static scripts instead of inline code', async () => {
        for (const app of ['web', 'admin']) {
            const shell = await Bun.file(
                path.resolve(import.meta.dir, `../apps/${app}/src/app.html`)
            ).text();
            expect(shell).toContain('<script src="/theme-init.js"></script>');
            expect(shell).toContain('<script src="/accessibility-init.js"></script>');
            expect(await inlineScriptHashes(shell)).toEqual([]);
        }
    });
});

describe('HTML policy from a SvelteKit response', () => {
    test('merges the bootstrap hashes of the response with the extra hashes', () => {
        const response = new Response('', {
            headers: { 'content-security-policy': "script-src 'self' 'sha256-BOOT='" }
        });
        const policy = htmlContentSecurityPolicy(response, { dev: false }, ["'sha256-ANALYTICS='"]);
        const scriptSrc = policy.split('; ').find(part => part.startsWith('script-src '));
        expect(scriptSrc).toContain("'sha256-BOOT='");
        expect(scriptSrc).toContain("'sha256-ANALYTICS='");
        expect(scriptSrc).not.toContain("'unsafe-inline'");
    });
});
