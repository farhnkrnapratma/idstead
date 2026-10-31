// SPDX-FileCopyrightText: 2026 Farhan Kurnia Pratama
//
// SPDX-License-Identifier: AGPL-3.0-only

import { describe, expect, test } from 'bun:test';
import { encode, QrCodeDataType } from 'uqr';
import { QR_BACKGROUND, QR_COLOR, renderQrSvg } from '../apps/web/src/lib/qrSvg';

const LOGO =
    'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';
const URL_TEXT = 'https://example.com/blog/qr-code-test';

function dotCenters(svg: string) {
    const d = svg.match(/<path fill="[^"]+" d="([^"]*)"/)?.[1] ?? '';
    return [...d.matchAll(/M([\d.]+) ([\d.]+)a/g)].map(([, x, y]) => ({
        x: Math.floor(Number(x)),
        y: Math.floor(Number(y))
    }));
}

describe('renderQrSvg', () => {
    test('renders one standalone svg with three finders', () => {
        const svg = renderQrSvg(URL_TEXT);
        expect(svg.startsWith('<svg xmlns="http://www.w3.org/2000/svg"')).toBe(true);
        expect(svg.match(/<svg/g)).toHaveLength(1);
        expect(svg.match(/data-qr-finder/g)).toHaveLength(3);
        expect(svg).toContain(`fill="${QR_COLOR}"`);
        expect(svg).toContain(`fill="${QR_BACKGROUND}"`);
    });

    test('is deterministic and never embeds the encoded text', () => {
        expect(renderQrSvg(URL_TEXT)).toBe(renderQrSvg(URL_TEXT));
        expect(renderQrSvg('<script>alert(1)</script>')).not.toContain('script');
        expect(renderQrSvg(URL_TEXT)).not.toContain('example.com');
    });

    test('draws one dot per dark data module when there is no logo', () => {
        const qr = encode(URL_TEXT, { ecc: 'H', border: 0 });
        const expected = qr.data
            .flatMap((row, y) =>
                row.map(
                    (dark, x) =>
                        dark
                        && qr.types[y][x] !== QrCodeDataType.Position
                        && qr.types[y][x] !== QrCodeDataType.Alignment
                )
            )
            .filter(Boolean).length;
        expect(dotCenters(renderQrSvg(URL_TEXT))).toHaveLength(expected);
    });

    test('clears the centre for the logo and embeds it', () => {
        const plain = dotCenters(renderQrSvg(URL_TEXT));
        const withLogo = renderQrSvg(URL_TEXT, { logoDataUrl: LOGO });
        const dots = dotCenters(withLogo);
        const size = encode(URL_TEXT, { ecc: 'H', border: 0 }).size;
        const centre = Math.floor(size / 2);
        expect(dots.length).toBeLessThan(plain.length);
        expect(dots.some(({ x, y }) => x === centre && y === centre)).toBe(false);
        expect(withLogo).toContain(`href="${LOGO}"`);
    });

    test('draws a themed code on a transparent background for the on-screen version', () => {
        const svg = renderQrSvg(URL_TEXT, { color: '#909692', background: 'none' });
        expect(svg).toContain('fill="#909692"');
        expect(svg).toContain('<rect width="');
        expect(svg).not.toContain(`fill="${QR_COLOR}"`);
        expect(svg).not.toContain(`fill="${QR_BACKGROUND}"`);
        expect(renderQrSvg(URL_TEXT, { color: 'currentColor' })).toContain(`fill="${QR_COLOR}"`);
    });

    test('rejects logos and colours that are not plain data', () => {
        const svg = renderQrSvg(URL_TEXT, {
            logoDataUrl: 'javascript:alert(1)',
            color: 'red" onload="alert(1)',
            background: 'url(x)'
        });
        expect(svg).not.toContain('<image');
        expect(svg).not.toContain('onload');
        expect(svg).toContain(`fill="${QR_COLOR}"`);
    });
});
