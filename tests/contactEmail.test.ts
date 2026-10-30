import { describe, expect, mock, test } from 'bun:test';

mock.module('$app/env/private', () => ({}));

const { contactMessageEmail } = await import('../packages/lib/src/server/subscribers.ts');

const base = {
    sentAt: new Date('2026-02-12T13:30:54Z'),
    timeZone: 'Asia/Jakarta',
    site: 'https://example.com',
    reference: '7F3A9C2E'
};

describe('contact message email', () => {
    const mail = contactMessageEmail({
        ...base,
        kind: 'feedback',
        name: '<b>Eve</b>',
        email: 'eve@example.com',
        message: 'Broken <script>alert(1)</script> link',
        pageUrl: 'https://example.com/blog/x?a=1&b="2"',
        location: 'Jakarta, Indonesia',
        client: 'Firefox 132 on Linux'
    });

    test('lets the owner reply straight to the visitor', () => {
        expect(mail.replyTo).toBe('eve@example.com');
    });

    test('names the kind, the page and the sender in the subject', () => {
        expect(mail.subject).toBe('[Feedback] Report on /blog/x from <b>Eve</b>');
        const plain = contactMessageEmail({
            ...base,
            kind: 'message',
            name: 'Ann\r\nBcc: someone@example.com',
            email: 'ann@example.com',
            message: 'Hi'
        });
        expect(plain.subject).toBe('[Contact] Message from Ann Bcc: someone@example.com');
        expect(plain.subject).not.toContain('portfolio');
    });

    test('opens with a header block in the sender time zone', () => {
        expect(mail.text.split('\n').slice(0, 10)).toEqual([
            'From:       <b>Eve</b> <eve@example.com>',
            'Date:       Thursday February 12, 2026 20:30:54 GMT+0700',
            'Time zone:  Asia/Jakarta',
            'Location:   Jakarta, Indonesia (approximate, from IP address)',
            'Client:     Firefox 132 on Linux',
            'Type:       Feedback report',
            'Site:       https://example.com',
            'Page:       https://example.com/blog/x?a=1&b="2"',
            'Reference:  7F3A9C2E',
            ''
        ]);
    });

    test('ends with the message and a signature', () => {
        expect(mail.text).toContain('\n\nBroken <script>alert(1)</script> link\n\n-- \n');
        expect(mail.text.endsWith('Reply to this email to answer <b>Eve</b> directly.')).toBe(true);
    });

    test('escapes every visitor-supplied value in the HTML body', () => {
        expect(mail.html).not.toContain('<script>');
        expect(mail.html).not.toContain('<b>Eve</b>');
        expect(mail.html).toContain('&lt;script&gt;');
        expect(mail.html).toContain('&amp;b=&quot;2&quot;');
        expect(mail.html).toContain('Thursday February 12, 2026 20:30:54 GMT+0700');
    });

    test('omits the lines it has no value for', () => {
        const plain = contactMessageEmail({
            ...base,
            kind: 'message',
            name: 'Ann',
            email: 'ann@example.com',
            message: 'Hi'
        });
        expect(plain.text).toContain('Type:       Contact message');
        expect(plain.text).not.toContain('Page:');
        expect(plain.text).not.toContain('Location:');
        expect(plain.text).not.toContain('Client:');
        expect(plain.html).not.toContain('Location');
    });
});

describe('contact form payloads', () => {
    test('escapes visitor text exactly once', () => {
        const mail = contactMessageEmail({
            ...base,
            kind: 'feedback',
            name: "Tom's",
            email: 'tom@example.com',
            message: 'A&B',
            pageUrl: 'https://example.com/blog/x'
        });
        expect(mail.html).toContain('A&amp;B');
        expect(mail.html).toContain('https://example.com/blog/x');
        expect(mail.html).not.toContain('&amp;amp;');
        expect(mail.text).toContain("From:       Tom's <tom@example.com>");
        expect(mail.text).toContain('Page:       https://example.com/blog/x');
    });

    test.each(['(site)/contact/+page.svelte', 'feedback/+page.svelte'])(
        '%s sends raw text and the browser time zone, and leaves escaping to the server',
        async page => {
            const source = await Bun.file(
                new URL(`../apps/web/src/routes/${page}`, import.meta.url)
            ).text();
            expect(source).toContain("fetch('/api/internal/contact'");
            expect(source).toContain('timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone');
            expect(source).not.toContain('sanitizeInput');
            expect(source).not.toContain('&#x2F;');
        }
    );
});
