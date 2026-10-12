import { describe, expect, test } from 'bun:test';
import { buildContentSecurityPolicy } from '../packages/lib/src/server/csp';

const policy = buildContentSecurityPolicy({
    supabaseUrl: 'https://abc.supabase.co/rest/v1',
    sentryDsn: 'https://key@o1.ingest.de.sentry.io/42',
    cdnBaseUrl: 'https://cdn.example.test/'
});

function directive(name: string) {
    const entry = policy.split('; ').find(part => part.startsWith(`${name} `));
    return entry ? entry.slice(name.length + 1).split(' ') : [];
}

describe('content security policy', () => {
    test('every source is a valid, separated token', () => {
        for (const part of policy.split('; ')) {
            for (const source of part.split(' ').slice(1)) {
                expect(source).toMatch(
                    /^(?:'[a-z-]+'|data:|blob:|https:\/\/[\w*.-]+(?::\d+)?|wss:\/\/[\w*.-]+|ws:\/\/localhost:\*|http:\/\/localhost:\*)$/
                );
            }
        }
    });

    test('markdown embeds are allowed to frame youtube and codepen', () => {
        expect(directive('frame-src')).toContain('https://www.youtube.com');
        expect(directive('frame-src')).toContain('https://codepen.io');
    });

    test('Cloudflare Insights is allowed to load its beacon script', () => {
        expect(directive('script-src')).toContain('https://static.cloudflareinsights.com');
    });

    test('Google Analytics regional image and collection hosts are allowed', () => {
        expect(directive('img-src')).toContain('https://www.google.co.id');
        expect(directive('connect-src')).toContain('https://www.google.com');
        expect(directive('connect-src')).toContain('https://analytics.google.com');
    });

    test('supabase is allowed over https and wss, derived from the env', () => {
        expect(directive('connect-src')).toContain('https://abc.supabase.co');
        expect(directive('connect-src')).toContain('wss://abc.supabase.co');
    });

    test('sentry and cdn origins come from the env', () => {
        expect(directive('connect-src')).toContain('https://o1.ingest.de.sentry.io');
        expect(directive('img-src')).toContain('https://cdn.example.test');
        expect(directive('media-src')).toContain('https://cdn.example.test');
    });

    test('images and media are not opened to arbitrary https hosts', () => {
        expect(directive('img-src')).not.toContain('https:');
        expect(directive('media-src')).not.toContain('https:');
        expect(directive('default-src')).toEqual(["'self'"]);
    });

    test('dangerous capabilities stay closed', () => {
        expect(policy).not.toContain('unsafe-eval');
        expect(directive('object-src')).toEqual(["'none'"]);
        expect(directive('frame-ancestors')).toEqual(["'none'"]);
        expect(directive('base-uri')).toEqual(["'self'"]);
    });

    test('missing env values are skipped instead of producing broken tokens', () => {
        const bare = buildContentSecurityPolicy();
        expect(bare).not.toContain('undefined');
        expect(bare).not.toContain('wss://');
        expect(bare).not.toMatch(/\s{2,}/);
    });

    test('dev adds the local websocket for hot reload', () => {
        expect(buildContentSecurityPolicy({ dev: true })).toContain('ws://localhost:*');
        expect(policy).not.toContain('localhost');
    });
});
