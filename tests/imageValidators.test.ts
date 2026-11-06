// SPDX-FileCopyrightText: 2026 Farhan Kurnia Pratama
//
// SPDX-License-Identifier: AGPL-3.0-only

import { describe, expect, test } from 'bun:test';
import { deflate } from 'pako';
import {
    ascii,
    avatarForm,
    avif,
    box,
    concat,
    ico,
    pngChunk,
    rebuildPng,
    riff,
    sizes,
    solidPng,
    u32,
    vector,
    vp8,
    vp8l,
    vp8x
} from './imageFixtures.ts';

import { inspectAvif } from '../packages/lib/src/avif.ts';
import { inspectWebp } from '../packages/lib/src/webp.ts';
import { BANNER_HEIGHT, BANNER_LIMIT, BANNER_WIDTH } from '../packages/lib/src/blogBanner.ts';
import { crc32, encodePng } from '../packages/lib/src/png.ts';
import { iconSizes } from '../packages/lib/src/siteIdentity.ts';
import {
    validateAvatar,
    validateIco,
    validatePng
} from '../packages/lib/src/server/validateAvatar.ts';

const limits = { maxBytes: 100_000, width: 64, height: 32 };
const webpFailure = (bytes: Uint8Array, custom = limits) =>
    expect(() => inspectWebp(bytes, custom)).toThrow('WebP');

describe('inspectWebp', () => {
    test('accepts lossy, lossless and extended images', () => {
        expect(inspectWebp(riff([['VP8 ', vp8(64, 32)]]), limits)).toMatchObject({
            width: 64,
            height: 32,
            type: 'image/webp'
        });
        expect(inspectWebp(riff([['VP8L', vp8l(64, 32)]]), limits).width).toBe(64);
        const extended = riff([
            ['VP8X', vp8x(64, 32)],
            ['ICCP', new Uint8Array(3)],
            ['ALPH', new Uint8Array(4)],
            ['VP8 ', vp8(64, 32)],
            ['EXIF', new Uint8Array(2)],
            ['XMP ', new Uint8Array(2)]
        ]);
        expect(inspectWebp(extended, limits).height).toBe(32);
    });

    test('uses the banner limits by default and ignores unset dimensions', () => {
        const banner = riff([['VP8L', vp8l(BANNER_WIDTH, BANNER_HEIGHT)]]);
        expect(inspectWebp(banner).width).toBe(BANNER_WIDTH);
        expect(banner.length).toBeLessThan(BANNER_LIMIT);
        expect(() => inspectWebp(riff([['VP8L', vp8l(2, 2)]]))).toThrow('Banner must be');
        const loose = riff([['VP8L', vp8l(5, 5)]]);
        expect(inspectWebp(loose, { maxBytes: 1000, maxPixels: 25 }).width).toBe(5);
        expect(() => inspectWebp(loose, { maxBytes: 1000, maxPixels: 24 })).toThrow(
            'Image must be a valid, still WebP'
        );
    });

    test('rejects malformed containers', () => {
        const good = riff([['VP8L', vp8l(64, 32)]]);
        webpFailure(good.slice(0, 10));
        webpFailure(new Uint8Array(good.length + 1).fill(0), limits);
        webpFailure(good, { ...limits, maxBytes: 10 });
        const badTag = good.slice();
        badTag.set(ascii('RIFX'), 0);
        webpFailure(badTag);
        const badSize = good.slice();
        badSize[4] += 2;
        webpFailure(badSize);
        const truncatedHeader = concat([ascii('RIFF'), u32(14, true), ascii('WEBPVP8L'), u32(0)]);
        webpFailure(truncatedHeader.slice(0, 20));
        webpFailure(riff([['VP8L', new Uint8Array(0)]]));
        webpFailure(
            riff([
                ['VP8L', vp8l(64, 32)],
                ['VP8L', vp8l(64, 32)]
            ])
        );
        const oversized = riff([['VP8L', vp8l(64, 32)]]);
        new DataView(oversized.buffer).setUint32(16, 100, true);
        webpFailure(oversized);
    });

    test('rejects malformed chunks', () => {
        webpFailure(
            riff([
                ['ICCP', new Uint8Array(2)],
                ['VP8X', vp8x(64, 32)],
                ['VP8 ', vp8(64, 32)]
            ])
        );
        webpFailure(
            riff([
                ['VP8X', new Uint8Array(9)],
                ['VP8 ', vp8(64, 32)]
            ])
        );
        for (const flags of [0x01, 0x80]) webpFailure(riff([['VP8X', vp8x(64, 32, flags)]]));
        const reserved = vp8x(64, 32);
        reserved[1] = 1;
        webpFailure(
            riff([
                ['VP8X', reserved],
                ['VP8 ', vp8(64, 32)]
            ])
        );
        webpFailure(riff([['VP8 ', new Uint8Array(10)]]));
        const interframe = vp8(64, 32);
        interframe[0] = 0x11;
        webpFailure(riff([['VP8 ', interframe]]));
        const hidden = vp8(64, 32);
        hidden[0] = 0;
        webpFailure(riff([['VP8 ', hidden]]));
        const badStart = vp8(64, 32);
        badStart[3] = 0;
        webpFailure(riff([['VP8 ', badStart]]));
        const bigPartition = vp8(64, 32);
        bigPartition[0] = 0xf0;
        bigPartition[1] = 0xff;
        webpFailure(riff([['VP8 ', bigPartition]]));
        webpFailure(riff([['VP8L', new Uint8Array(5)]]));
        const badSignature = vp8l(64, 32);
        badSignature[0] = 0;
        webpFailure(riff([['VP8L', badSignature]]));
        const badVersion = vp8l(64, 32);
        badVersion[4] = 0xe0;
        webpFailure(riff([['VP8L', badVersion]]));
        webpFailure(
            riff([
                ['ALPH', new Uint8Array(4)],
                ['VP8 ', vp8(64, 32)]
            ])
        );
        webpFailure(
            riff([
                ['VP8X', vp8x(64, 32)],
                ['VP8 ', vp8(64, 32)],
                ['ALPH', new Uint8Array(4)]
            ])
        );
        webpFailure(
            riff([
                ['VP8X', vp8x(64, 32)],
                ['ALPH', new Uint8Array(1)],
                ['VP8 ', vp8(64, 32)]
            ])
        );
        webpFailure(riff([['ANIM', new Uint8Array(6)]]));
    });

    test('rejects missing images and mismatched dimensions', () => {
        webpFailure(riff([['ICCP', new Uint8Array(2)]]));
        webpFailure(riff([['VP8L', vp8l(63, 32)]]));
        webpFailure(
            riff([
                ['VP8X', vp8x(10, 10)],
                ['VP8 ', vp8(64, 32)]
            ])
        );
    });
});

const avifLimits = { maxBytes: 100_000, width: 64, height: 32 };
const avifFailure = (bytes: Uint8Array) =>
    expect(() => inspectAvif(bytes, avifLimits)).toThrow('valid AVIF');

describe('inspectAvif', () => {
    test('accepts valid images and sequences', () => {
        expect(inspectAvif(avif(64, 32), avifLimits)).toMatchObject({ width: 64, height: 32 });
        expect(inspectAvif(avif(64, 32, { brand: 'avis' }), avifLimits).type).toBe('image/avif');
    });

    test('supports large and open-ended boxes', () => {
        const normal = avif(64, 32);
        const largeFtyp = concat([
            u32(1),
            ascii('ftyp'),
            u32(0),
            u32(24),
            ascii('avif'),
            new Uint8Array(4),
            normal.slice(16)
        ]);
        expect(inspectAvif(largeFtyp, avifLimits).width).toBe(64);
        const openEnded = normal.slice();
        const mdatStart = openEnded.length - 12;
        new DataView(openEnded.buffer).setUint32(mdatStart, 0);
        expect(inspectAvif(openEnded, avifLimits).height).toBe(32);
    });

    test('rejects malformed boxes', () => {
        avifFailure(new Uint8Array(8));
        expect(() => inspectAvif(avif(64, 32), { ...avifLimits, maxBytes: 20 })).toThrow(
            'valid AVIF'
        );
        const normal = avif(64, 32);
        avifFailure(normal.slice(0, normal.length - 3));
        avifFailure(concat([normal, new Uint8Array(4)]));
        const highSize = concat([u32(1), ascii('ftyp'), u32(1), u32(24), new Uint8Array(16)]);
        avifFailure(highSize);
        const shortLarge = concat([u32(1), ascii('ftyp'), new Uint8Array(4), new Uint8Array(4)]);
        avifFailure(shortLarge.slice(0, 15));
        avifFailure(concat([u32(4), ascii('ftyp'), new Uint8Array(16)]));
    });

    test('rejects unsupported structures', () => {
        avifFailure(avif(64, 32, { brand: 'heic' }));
        avifFailure(avif(64, 32, { skip: 'meta' }));
        avifFailure(avif(64, 32, { skip: 'mdat' }));
        avifFailure(avif(32, 32));
        avifFailure(avif(64, 16));
        const noIprp = concat([
            box('ftyp', concat([ascii('avif'), new Uint8Array(4)])),
            box('meta', concat([new Uint8Array(4), box('free', new Uint8Array(4))])),
            box('mdat', new Uint8Array(4))
        ]);
        avifFailure(noIprp);
        const shortIspe = concat([
            box('ftyp', concat([ascii('avif'), new Uint8Array(4)])),
            box(
                'meta',
                concat([
                    new Uint8Array(4),
                    box('iprp', box('ipco', box('ispe', new Uint8Array(8))))
                ])
            ),
            box('mdat', new Uint8Array(4))
        ]);
        avifFailure(shortIspe);
    });
});

const pngFailure = (bytes: Uint8Array, size: number, message: string) =>
    expect(() => validatePng(bytes.slice().buffer, size)).toThrow(message);

describe('validatePng', () => {
    test('accepts encoder output', () => {
        validatePng(solidPng(16).buffer as ArrayBuffer, 16);
    });

    test('rejects invalid headers', () => {
        const png = solidPng(16);
        pngFailure(png, 32, 'Invalid PNG dimensions or format.');
        pngFailure(png.slice(0, 40), 16, 'Invalid PNG dimensions or format.');
        const badSignature = png.slice();
        badSignature[1] = 0;
        pngFailure(badSignature, 16, 'Invalid PNG dimensions or format.');
        const badDepth = png.slice();
        badDepth[24] = 16;
        pngFailure(badDepth, 16, 'Invalid PNG dimensions or format.');
        const interlaced = png.slice();
        interlaced[28] = 1;
        pngFailure(interlaced, 16, 'Invalid PNG dimensions or format.');
    });

    test('rejects structural problems', () => {
        const png = solidPng(16);
        pngFailure(png.slice(0, png.length - 5), 16, 'Truncated PNG.');
        const truncatedLength = png.slice();
        new DataView(truncatedLength.buffer).setUint32(33, 999999);
        pngFailure(truncatedLength, 16, 'Truncated PNG.');
        const badCrc = png.slice();
        badCrc[40] ^= 0xff;
        pngFailure(badCrc, 16, 'Invalid PNG checksum.');
        pngFailure(
            rebuildPng(png, chunks => {
                chunks[0][0] = 'IDAT';
            }),
            16,
            'Invalid PNG header.'
        );
        pngFailure(
            rebuildPng(png, chunks => {
                chunks.splice(1, 0, ['IHDR', chunks[0][1]]);
            }),
            16,
            'Invalid PNG header.'
        );
        pngFailure(
            rebuildPng(png, chunks => {
                chunks.splice(1, 0, ['tEXt', ascii('k\0v')]);
            }),
            16,
            'Unsupported image metadata.'
        );
        pngFailure(
            rebuildPng(png, chunks => {
                chunks.splice(1, chunks.length - 2);
            }),
            16,
            'Invalid PNG data.'
        );
        pngFailure(concat([png, new Uint8Array(4)]), 16, 'Invalid PNG data.');
        pngFailure(
            rebuildPng(png, chunks => {
                chunks.pop();
            }),
            16,
            'Invalid PNG data.'
        );
        pngFailure(
            rebuildPng(png, chunks => {
                chunks[chunks.length - 1][1] = new Uint8Array(1);
            }),
            16,
            'Invalid PNG data.'
        );
    });

    test('rejects corrupt and oversized image data', () => {
        const png = solidPng(16);
        pngFailure(
            rebuildPng(png, chunks => {
                const index = chunks.findIndex(([name]) => name === 'IDAT');
                chunks[index][1] = ascii('not a zlib stream');
            }),
            16,
            'Invalid PNG data.'
        );
        pngFailure(
            rebuildPng(png, chunks => {
                const index = chunks.findIndex(([name]) => name === 'IDAT');
                chunks[index][1] = deflate(new Uint8Array(50_000));
            }),
            16,
            'decompression limit'
        );
    });
});

describe('validateIco', () => {
    test('accepts three PNG entries', () => {
        validateIco(ico(sizes).slice().buffer);
    });

    test('rejects invalid containers', () => {
        const fail = (bytes: Uint8Array, message: string) =>
            expect(() => validateIco(bytes.slice().buffer)).toThrow(message);
        fail(new Uint8Array(10), 'Invalid ICO.');
        fail(ico(sizes, { count: 2 }), 'Invalid ICO.');
        const wrongType = ico(sizes);
        wrongType[2] = 2;
        fail(wrongType, 'Invalid ICO.');
        fail(ico(sizes, { lengthOffset: 1 }), 'Invalid ICO directory.');
        const wrongSize = ico(sizes);
        wrongSize[6] = 99;
        fail(wrongSize, 'Invalid ICO directory.');
        const overrun = ico(sizes);
        new DataView(overrun.buffer).setUint32(14, 9_999_999, true);
        fail(overrun, 'Invalid ICO directory.');
        fail(concat([ico(sizes), new Uint8Array(3)]), 'Invalid ICO length.');
        fail(new Uint8Array(600_000), 'Invalid ICO.');
    });
});

describe('validateAvatar', () => {
    test('returns the validated package', async () => {
        const files = await validateAvatar(avatarForm());
        expect(Object.keys(files ?? {}).sort()).toEqual(
            [
                ...Object.keys(iconSizes),
                'avatar.avif',
                'avatar.webp',
                'favicon.ico',
                'favicon.svg'
            ].sort()
        );
        expect(new TextDecoder().decode(files!['favicon.svg'])).toContain('<svg');
    });

    test('ignores identity fields and skips empty uploads', async () => {
        const form = new FormData();
        form.set('profile', '{}');
        expect(await validateAvatar(form)).toBeNull();
    });

    test('rejects incomplete and extended packages', async () => {
        await expect(validateAvatar(avatarForm({ 'avatar.avif': null }))).rejects.toThrow(
            'complete icon package'
        );
        const extra = avatarForm();
        extra.set('surprise', 'x');
        await expect(validateAvatar(extra)).rejects.toThrow('complete icon package');
    });

    test('rejects invalid members', async () => {
        const text = (value: string) => value;
        await expect(
            validateAvatar(avatarForm({ 'avatar.png': text('not a file') }))
        ).rejects.toThrow('Invalid image file.');
        await expect(
            validateAvatar(
                avatarForm({ 'favicon-16x16.png': new File([new Uint8Array(500_001)], 'x') })
            )
        ).rejects.toThrow('Invalid image file.');
        await expect(validateAvatar(avatarForm({ 'favicon.ico': text('x') }))).rejects.toThrow(
            'Missing ICO.'
        );
        await expect(
            validateAvatar(avatarForm({ vector: new File([vector], 'vector') }))
        ).rejects.toThrow('Invalid vector icon.');
        await expect(validateAvatar(avatarForm({ vector: 'x'.repeat(500_001) }))).rejects.toThrow(
            'Invalid vector icon.'
        );
        await expect(validateAvatar(avatarForm({ 'avatar.webp': text('x') }))).rejects.toThrow(
            'avatar.webp must be no larger'
        );
        await expect(
            validateAvatar(avatarForm({ 'avatar.avif': new File([new Uint8Array(500_001)], 'x') }))
        ).rejects.toThrow('avatar.avif must be no larger');
        await expect(
            validateAvatar(
                avatarForm({ 'avatar.webp': new File([riff([['VP8L', vp8l(8, 8)]])], 'x') })
            )
        ).rejects.toThrow('WebP');
        await expect(
            validateAvatar(avatarForm({ 'avatar.avif': new File([avif(8, 8)], 'x') }))
        ).rejects.toThrow('AVIF');
    });
});
