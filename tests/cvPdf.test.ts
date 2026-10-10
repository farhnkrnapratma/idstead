import { describe, expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { PDFDict, PDFDocument, PDFName } from 'pdf-lib';
import {
    formatDateRange,
    generateCvPdfBuffer,
    gpaDisplay,
    sanitizePdfText,
    type AuthorCvData,
    type CvFontBytes
} from '../src/lib/server/pdfGenerator';

const font = (path: string) => new Uint8Array(readFileSync(`node_modules/@fontsource/${path}`));

const fonts: CvFontBytes = {
    sans: font('ia-writer-quattro/files/ia-writer-quattro-latin-400-normal.woff'),
    sansBold: font('ia-writer-quattro/files/ia-writer-quattro-latin-700-normal.woff'),
    sansItalic: font('ia-writer-quattro/files/ia-writer-quattro-latin-400-italic.woff'),
    serif: font('ibm-plex-serif/files/ibm-plex-serif-latin-400-normal.woff'),
    serifBold: font('ibm-plex-serif/files/ibm-plex-serif-latin-700-normal.woff'),
    mono: font('lilex/files/lilex-latin-400-normal.woff')
};

const fixture = (): AuthorCvData => ({
    profile: {
        name: 'Farhan Kurnia Pratama',
        title: 'Software Engineer',
        bio: 'Security and privacy-focused Software Engineer.',
        email: 'contact@fkp.my.id',
        website: 'https://fkp.my.id',
        location: 'Palembang, Indonesia'
    },
    links: [{ url: 'https://github.com/example' }],
    experiences: [
        {
            title: 'Founder &amp; CEO',
            company: 'PT Secure Modern Technology Indonesia',
            type: 'Self-employed',
            location: 'Palembang, Indonesia',
            loc_type: 'Hybrid',
            start_date: '2025-09-01',
            currently_in: true,
            description: '- Led product.\n- Shipped secure releases.'
        }
    ],
    projects: [
        {
            name: 'www',
            url: 'https://github.com/example/www',
            desc: 'Personal website',
            lang: 'Svelte'
        }
    ],
    educations: [
        {
            institution: 'Indo Global Mandiri University',
            degree: 'Bachelor of Computer Science',
            field: 'Computer Science',
            grade: '3.44&#x2F;4.00',
            start_date: '2024-09-01',
            currently_in: true
        }
    ],
    skills: [{ category: 'Cybersecurity', items: ['GRC', 'IAM', 'Cryptography'] }]
});

describe('cv pdf', () => {
    test('renders one page with the web fonts embedded', async () => {
        const bytes = await generateCvPdfBuffer(fixture(), fonts);
        const doc = await PDFDocument.load(bytes);
        expect(doc.getPageCount()).toBe(1);
        const baseFonts = doc.context
            .enumerateIndirectObjects()
            .flatMap(([, object]) =>
                object instanceof PDFDict ?
                    [object.get(PDFName.of('BaseFont'))?.toString() ?? '']
                :   []
            )
            .join(' ');
        expect(baseFonts).toContain('iAWriterQuattro');
        expect(baseFonts).toContain('IBMPlexSerif');
        expect(baseFonts).toContain('Lilex');
    });

    test('does not throw on glyphs missing from the fonts', async () => {
        const data = fixture();
        data.profile.bio = `Hello 世界 😀 ${String.fromCharCode(0x2014)} done`;
        const bytes = await generateCvPdfBuffer(data, fonts);
        expect((await PDFDocument.load(bytes)).getPageCount()).toBe(1);
    });

    test('gpa is shown only at 3.5 or above on a 4.0 scale', () => {
        expect(gpaDisplay('3.44/4.00')).toBeNull();
        expect(gpaDisplay('3.44&#x2F;4.00')).toBeNull();
        expect(gpaDisplay('3.5/4.00')).toBe('3.5/4.00');
        expect(gpaDisplay('3.6/4.00')).toBe('3.6/4.00');
        expect(gpaDisplay('85/100')).toBeNull();
        expect(gpaDisplay('First Class Honours')).toBe('First Class Honours');
        expect(gpaDisplay('')).toBeNull();
    });

    test('decodes html entities in a single pass', () => {
        expect(sanitizePdfText('I&#x27;m A&amp;B UI&#x2F;UX &#39;x&#39;')).toBe(
            "I'm A&B UI/UX 'x'"
        );
        expect(sanitizePdfText('&amp;lt;')).toBe('&lt;');
    });

    test('flows onto extra pages without throwing', async () => {
        const data = fixture();
        data.experiences = Array.from({ length: 12 }, (_, index) => ({
            ...data.experiences[0],
            title: `Role ${index}`,
            description: Array.from({ length: 6 }, () => 'Delivered a measurable win.').join('\n')
        }));
        const doc = await PDFDocument.load(await generateCvPdfBuffer(data, fonts));
        expect(doc.getPageCount()).toBeGreaterThan(1);
    });

    test('drops links that could break out of the pdf string', async () => {
        const countLinks = async (website: string) => {
            const data = fixture();
            data.profile.website = website;
            const doc = await PDFDocument.load(await generateCvPdfBuffer(data, fonts));
            return doc.context
                .enumerateIndirectObjects()
                .filter(
                    ([, object]) =>
                        object instanceof PDFDict
                        && object.get(PDFName.of('Subtype'))?.toString() === '/Link'
                ).length;
        };
        const safe = await countLinks('https://fkp.my.id');
        expect(await countLinks('https://a)/S/JavaScript/JS(x)')).toBe(safe - 1);
        expect(await countLinks('javascript:alert(1)')).toBe(safe - 1);
    });

    test('formats date ranges', () => {
        expect(formatDateRange('2025-09-01', null, true)).toBe('Sep 2025 - Present');
        expect(formatDateRange('2020-01-01', '2022-06-01', false)).toBe('Jan 2020 - Jun 2022');
        expect(formatDateRange(null, null, false)).toBe('');
    });
});
