import { describe, expect, test } from 'bun:test';
import { decodeHtmlEntities as domainDecode } from '../packages/domain/src/entities.ts';
import { decodeHtmlEntities as mdrsDecode } from '../packages/mdrs/src/entities.ts';

const SAMPLES = [
    '',
    'Plain text',
    'Ada &amp; Co &lt;b&gt;bold&lt;/b&gt;',
    '&quot;quoted&quot; &#39;single&#39; &apos;apos&apos; &#x27;hex&#x27;',
    'a&#x2F;b&#47;c &nbsp;space&#160; &ndash; &mdash; &#8211; &#8212;',
    '&#38;&#x26;&#34;&#x22;&#60;&#x3C;&#62;&#x3E;'
];

describe('decodeHtmlEntities', () => {
    test('the domain copy matches the MDRS engine copy', () => {
        for (const sample of SAMPLES) expect(domainDecode(sample)).toBe(mdrsDecode(sample));
        expect(domainDecode(null)).toBe('');
    });
});
