import { describe, expect, mock, test } from 'bun:test';

mock.module('$app/env/private', () => ({}));

const { contactMessageEmail } = await import('../packages/lib/src/server/subscribers.ts');

describe('contact message email', () => {
    const mail = contactMessageEmail('New feedback report from website!', {
        name: '<b>Eve</b>',
        email: 'eve@example.com',
        message: 'Broken <script>alert(1)</script> link',
        pageUrl: 'https://fkp.my.id/blog/x?a=1&b="2"'
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
        expect(mail.text).toContain('Page: https://fkp.my.id/blog/x?a=1&b="2"');
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
