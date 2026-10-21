import { readFileSync } from 'node:fs';
import { describe, expect, mock, test } from 'bun:test';

mock.module('$app/env/private', () => ({}));

const { contactMessageEmail } = await import('../packages/lib/src/server/subscribers.ts');

describe('contact message email', () => {
    const mail = contactMessageEmail('New feedback report from website!', {
        name: '<b>Eve</b>',
        email: 'eve@example.com',
        message: 'Broken <script>alert(1)</script> link',
        pageUrl: 'https://example.com/blog/x?a=1&b="2"'
    });

    test('lets the owner reply straight to the visitor', () => {
        expect(mail.replyTo).toBe('eve@example.com');
        expect(mail.subject).toBe('New feedback report from website!');
    });

    test('escapes every visitor-supplied value in the HTML body', () => {
        expect(mail.html).not.toContain('<script>');
        expect(mail.html).not.toContain('<b>Eve</b>');
        expect(mail.html).toContain('&lt;script&gt;');
        expect(mail.html).toContain('&amp;b=&quot;2&quot;');
    });

    test('keeps the plain-text body readable', () => {
        expect(mail.text).toContain('Name: <b>Eve</b>');
        expect(mail.text).toContain('Page: https://example.com/blog/x?a=1&b="2"');
        expect(mail.text.endsWith('Broken <script>alert(1)</script> link')).toBe(true);
    });

    test('omits the page row for plain messages', () => {
        const plain = contactMessageEmail('New message from portfolio website!', {
            name: 'Ann',
            email: 'ann@example.com',
            message: 'Hi'
        });
        expect(plain.text).not.toContain('Page:');
    });
});

describe('contact form payloads', () => {
    test('escapes visitor text exactly once', () => {
        const mail = contactMessageEmail('New feedback report from website!', {
            name: "Tom's",
            email: 'tom@example.com',
            message: 'A&B',
            pageUrl: 'https://example.com/blog/x'
        });
        expect(mail.html).toContain('A&amp;B');
        expect(mail.html).toContain('https://example.com/blog/x');
        expect(mail.html).not.toContain('&amp;amp;');
        expect(mail.text).toContain("Name: Tom's");
        expect(mail.text).toContain('Page: https://example.com/blog/x');
    });

    test.each(['(site)/contact/+page.svelte', 'feedback/+page.svelte'])(
        '%s sends raw text and leaves escaping to the server',
        page => {
            const source = readFileSync(
                new URL(`../apps/web/src/routes/${page}`, import.meta.url),
                'utf8'
            );
            expect(source).toContain("fetch('/api/internal/contact'");
            expect(source).not.toContain('sanitizeInput');
            expect(source).not.toContain('&#x2F;');
        }
    );
});
