// SPDX-FileCopyrightText: 2026 Farhan Kurnia Pratama
//
// SPDX-License-Identifier: AGPL-3.0-only

import { beforeEach, describe, expect, test } from 'bun:test';
import { admin, slot } from './support.ts';

const UUID = '0f8fad5b-d9cb-469f-a165-70867728950e';

const state = {
    boundedError: false,
    postState: { slug: 'hello', published: true } as any,
    assetStateError: false,
    putError: false,
    puts: [] as Array<[string, string]>,
    validateError: undefined as unknown,
    avifError: undefined as unknown,
    names: [] as Array<{ post?: Record<string, unknown> }>
};

slot.boundedBody = async (request: Request) => {
    if (state.boundedError) throw new Error('Body is too large.');
    return request;
};
slot.validateContentImage = async () => {
    if (state.validateError !== undefined) throw state.validateError;
    return { width: 640, height: 480, bytes: 3 };
};
slot.validateContentImageAvif = () => {
    if (state.avifError !== undefined) throw state.avifError;
};
slot.uniqueAssetName = async (options: any) => {
    state.names.push(options);
    return `${options.base}-unique`;
};
slot.putContentAsset = async (
    _platform: unknown,
    key: string,
    _bytes: Uint8Array,
    type: string
) => {
    if (state.putError) throw new Error('r2');
    state.puts.push([key, type]);
};

const image =
    await import('../../apps/admin/src/routes/api/internal/admin/blog/content-image/+server.ts');
const video =
    await import('../../apps/admin/src/routes/api/internal/admin/blog/content-video/+server.ts');

function event(form: FormData | string) {
    const url = new URL('https://admin.example.com/api/internal/admin/blog/content');
    return { request: new Request(url, { method: 'POST', body: form }), url, platform: {} } as any;
}

function formOf(fields: Record<string, string | Blob | null>) {
    const form = new FormData();
    for (const [key, value] of Object.entries(fields)) if (value !== null) form.set(key, value);
    return form;
}

async function code(response: Response) {
    return ((await response.json()) as any).code;
}

const bytes = (...values: number[]) => new Blob([new Uint8Array(values)]);
const WEBM = [0x1a, 0x45, 0xdf, 0xa3, 0x01, 0x00, 0x00, 0x00, ...Buffer.from('webm')];

beforeEach(() => {
    admin.response = null;
    state.boundedError = false;
    state.postState = { slug: 'hello', published: true };
    state.assetStateError = false;
    state.putError = false;
    state.puts = [];
    state.validateError = undefined;
    state.avifError = undefined;
    state.names = [];
    admin.service = {
        adminPosts: {
            posts: {
                assetState: async () => {
                    if (state.assetStateError) throw new Error('db');
                    return state.postState;
                }
            }
        }
    };
});

describe('POST /api/internal/admin/blog/content-image', () => {
    const fields = {
        file: bytes(1, 2, 3),
        fileAvif: bytes(4, 5, 6),
        postId: UUID,
        name: 'Photo One.png'
    };
    const post = (overrides: Record<string, string | Blob | null> = {}) =>
        (image.POST as any)(event(formOf({ ...fields, ...overrides }))) as Promise<Response>;

    test('returns the admin failure response', async () => {
        admin.response = Response.json({ code: 'NO' }, { status: 401 });
        expect((await post()).status).toBe(401);
    });

    test('rejects invalid uploads', async () => {
        const cases: Array<[Record<string, string | Blob | null>, string]> = [
            [{ postId: 'nope' }, 'A valid post ID is required.'],
            [{ postId: null }, 'A valid post ID is required.'],
            [{ name: null }, 'A file name is required.'],
            [{ name: 'n'.repeat(256) }, 'A file name is required.'],
            [{ file: null }, 'An image file is required.'],
            [{ file: new Blob([]) }, 'An image file is required.'],
            [{ file: 'text' }, 'An image file is required.'],
            [{ file: new Blob([new Uint8Array(512 * 1024 + 1)]) }, 'Image must be no larger'],
            [{ fileAvif: null }, 'An AVIF image is required.'],
            [{ fileAvif: new Blob([]) }, 'An AVIF image is required.'],
            [{ fileAvif: new Blob([new Uint8Array(512 * 1024 + 1)]) }, 'AVIF image must be']
        ];
        for (const [overrides, message] of cases) {
            const response = await post(overrides);
            expect(response.status).toBe(400);
            const body = (await response.json()) as any;
            expect(body.code).toBe('BLOG_CONTENT_IMAGE_INVALID_INPUT');
            expect(body.message).toContain(message);
        }
        state.boundedError = true;
        expect((await post()).status).toBe(400);
        state.boundedError = false;
        const notForm = (image.POST as any)(event('plain text')) as Promise<Response>;
        expect(await code(await notForm)).toBe('BLOG_CONTENT_IMAGE_INVALID_INPUT');
    });

    test('rejects images that fail validation', async () => {
        state.validateError = new Error('Not a WebP.');
        const response = await post();
        expect(await response.json()).toMatchObject({
            code: 'BLOG_CONTENT_IMAGE_INVALID',
            message: 'Not a WebP.'
        });
        state.validateError = 'odd';
        expect(((await (await post()).json()) as any).message).toBe('Invalid image data.');
        state.validateError = undefined;
        state.avifError = new Error('AVIF mismatch.');
        expect(((await (await post()).json()) as any).message).toBe('AVIF mismatch.');
    });

    test('stores both formats under a unique name', async () => {
        const response = await post();
        expect(response.status).toBe(201);
        const body = (await response.json()) as any;
        expect(body).toMatchObject({ width: 640, height: 480, bytes: 3 });
        expect(body.url).toMatch(/^https:\/\/cdn\.test\/.+\/images\/.+-unique\.avif$/);
        expect(state.puts.map(entry => entry[1])).toEqual(['image/webp', 'image/avif']);
        expect(state.names[0].post).toMatchObject({ slug: 'hello', published: true });
        state.postState = null;
        expect((await post({ postId: UUID.toUpperCase() })).status).toBe(201);
        expect(state.names[1].post?.slug).toBeUndefined();
    });

    test('reports storage failures', async () => {
        state.putError = true;
        expect(await code(await post())).toBe('BLOG_CONTENT_IMAGE_STORAGE_FAILED');
        state.putError = false;
        state.assetStateError = true;
        expect((await post()).status).toBe(502);
    });
});

describe('POST /api/internal/admin/blog/content-video', () => {
    const fields = { file: bytes(...WEBM), postId: UUID, name: 'Clip.webm' };
    const post = (overrides: Record<string, string | Blob | null> = {}) =>
        (video.POST as any)(event(formOf({ ...fields, ...overrides }))) as Promise<Response>;

    test('returns the admin failure response', async () => {
        admin.response = Response.json({ code: 'NO' }, { status: 401 });
        expect((await post()).status).toBe(401);
    });

    test('rejects invalid uploads', async () => {
        const cases: Array<[Record<string, string | Blob | null>, string]> = [
            [{ postId: 'nope' }, 'A valid post ID is required.'],
            [{ name: null }, 'A file name is required.'],
            [{ name: 'n'.repeat(256) }, 'A file name is required.'],
            [{ file: null }, 'A video file is required.'],
            [{ file: new Blob([]) }, 'A video file is required.'],
            [
                { file: new Blob([new Uint8Array(50 * 1024 * 1024 + 1)]) },
                'Video must be 50 MB or less.'
            ]
        ];
        for (const [overrides, message] of cases) {
            const body = (await (await post(overrides)).json()) as any;
            expect(body.code).toBe('BLOG_CONTENT_VIDEO_INVALID_INPUT');
            expect(body.message).toContain(message);
        }
        state.boundedError = true;
        expect((await post()).status).toBe(400);
        state.boundedError = false;
        expect(await code(await post({ file: bytes(1, 2, 3, 4) }))).toBe(
            'BLOG_CONTENT_VIDEO_INVALID_FORMAT'
        );
        expect(await code(await (video.POST as any)(event('plain text')))).toBe(
            'BLOG_CONTENT_VIDEO_INVALID_INPUT'
        );
    });

    test('stores webm videos and reports storage failures', async () => {
        const response = await post();
        expect(response.status).toBe(201);
        const body = (await response.json()) as any;
        expect(body.bytes).toBe(WEBM.length);
        expect(body.url).toMatch(/\/videos\/.+-unique\.webm$/);
        expect(state.puts[0][1]).toBe('video/webm');
        state.postState = null;
        expect((await post()).status).toBe(201);
        state.putError = true;
        expect(await code(await post())).toBe('BLOG_CONTENT_VIDEO_STORAGE_FAILED');
    });
});
