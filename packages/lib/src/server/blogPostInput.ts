import { UUID_PATTERN, BANNER_LIMIT, sha256 } from '#lib/blogBanner.ts';
import { validateBanner } from './validateBanner';
import { isValidPostSlug, POST_SLUG_MAX_LENGTH } from '#lib/slug.ts';

export const POST_PAYLOAD_LIMIT = 3 * 1024 * 1024;
export const MARKDOWN_LIMIT = 2 * 1024 * 1024;

export async function boundedBody(request: Request, limit = POST_PAYLOAD_LIMIT) {
    if (Number(request.headers.get('content-length')) > limit)
        throw new Error('Post payload is too large.');
    const reader = request.body?.getReader();
    if (!reader) throw new Error('Post data is required.');
    const chunks: Uint8Array[] = [];
    let length = 0;
    try {
        for (;;) {
            const { done, value } = await reader.read();
            if (done) break;
            length += value.length;
            if (length > limit) {
                await reader.cancel();
                throw new Error('Post payload is too large.');
            }
            chunks.push(value);
        }
    } finally {
        reader.releaseLock();
    }
    const bytes = new Uint8Array(length);
    let offset = 0;
    for (const chunk of chunks) {
        bytes.set(chunk, offset);
        offset += chunk.length;
    }
    return new Response(bytes, {
        headers: { 'Content-Type': request.headers.get('content-type') || '' }
    });
}

function text(value: unknown, max: number, required = false): string | null {
    if (value == null && !required) return null;
    if (
        typeof value !== 'string'
        || value.trim().length > max
        || (required && !value.trim())
        || value.includes('\0')
    )
        throw new Error('Invalid post text.');
    return value.trim() || null;
}

function list(value: unknown, count: number, max: number) {
    if (value == null) return [];
    if (!Array.isArray(value) || value.length > count) throw new Error('Invalid post list.');
    return value.map(item => text(item, max, true)!);
}

export async function parsePostInput(request: Request, wasm: WebAssembly.Module) {
    const form = await (await boundedBody(request)).formData();
    const raw = form.get('post');
    if (typeof raw !== 'string') throw new Error('Post metadata is required.');
    const input = JSON.parse(raw);
    if (
        !input
        || typeof input !== 'object'
        || !UUID_PATTERN.test(input.operationId)
        || !UUID_PATTERN.test(input.id)
    )
        throw new Error('Invalid operation or post ID.');
    if (input.revision !== null && (!Number.isSafeInteger(input.revision) || input.revision < 0))
        throw new Error('A post revision is required.');
    if (input.kind !== 'save' && input.kind !== 'delete')
        throw new Error('Invalid post operation.');
    let post: Record<string, unknown> = {};
    let markdown = '';
    let banner: {
        operation: string;
        sha256?: string;
        bytes?: number;
        avifSha256?: string;
        avifBytes?: number;
    } = { operation: 'keep' };
    let image: Uint8Array<ArrayBuffer> | null = null;
    let avifImage: Uint8Array<ArrayBuffer> | null = null;
    if (input.kind === 'save') {
        if (typeof input.published !== 'boolean') throw new Error('Invalid publication status.');
        const slug = text(input.slug, POST_SLUG_MAX_LENGTH, true)!;
        if (!isValidPostSlug(slug)) throw new Error('Invalid post slug.');
        post = {
            title: text(input.title, 60, true),
            slug,
            excerpt: text(input.excerpt, 250),
            tags: list(input.tags, 5, 40),
            collaborators: list(input.collaborators, 20, 39),
            published: input.published
        };
        if (input.published && !post.excerpt)
            throw new Error('Excerpt is required to publish a post.');
        if ('summary' in input) post.summary = text(input.summary, 5000);
        if ('tldr' in input) post.tldr = input.tldr === null ? null : list(input.tldr, 4, 200);
        if (
            (post.collaborators as string[]).some(
                value => !/^[a-z\d](?:[a-z\d-]{0,37}[a-z\d])?$/i.test(value)
            )
        )
            throw new Error('Invalid collaborator username.');
        const body = form.get('markdown');
        if (
            typeof body !== 'string'
            || !body.trim()
            || new TextEncoder().encode(body).length > MARKDOWN_LIMIT
            || body.includes('\0')
        )
            throw new Error('Markdown is required and must be no larger than 2 MiB.');
        markdown = body;
        if (!['keep', 'replace', 'remove'].includes(input.bannerOperation))
            throw new Error('Invalid banner operation.');
        if (
            input.bannerOperation === 'remove'
            || (input.revision === null && input.bannerOperation !== 'replace')
        )
            throw new Error('Banner image is required.');
        banner = { operation: input.bannerOperation };
        const file = form.get('banner');
        const avifFile = form.get('bannerAvif');
        if (banner.operation === 'replace') {
            if (!(file instanceof Blob) || file.size > BANNER_LIMIT)
                throw new Error('A WebP banner no larger than 500 KiB is required.');
            if (!(avifFile instanceof Blob) || avifFile.size > BANNER_LIMIT)
                throw new Error('An AVIF banner no larger than 500 KiB is required.');
            image = new Uint8Array(await file.arrayBuffer());
            avifImage = new Uint8Array(await avifFile.arrayBuffer());
            await validateBanner(image, wasm);
            await validateBanner(avifImage, wasm);
            banner = {
                ...banner,
                sha256: await sha256(image),
                bytes: image.byteLength,
                avifSha256: await sha256(avifImage),
                avifBytes: avifImage.byteLength
            };
        } else if (file !== null || avifFile !== null) throw new Error('Unexpected banner upload.');
        post.banner_references = [
            ...new Set(
                Array.from(
                    markdown.matchAll(/\/blog\/banners\/([0-9a-f-]{36})\/([0-9a-f-]{36})\.webp/gi),
                    match => match[2].toLowerCase()
                )
            )
        ];
    }
    const hash = await sha256(
        new TextEncoder().encode(
            JSON.stringify({
                id: input.id,
                revision: input.revision,
                kind: input.kind,
                post,
                banner,
                markdown
            })
        )
    );
    return {
        id: input.id as string,
        operationId: input.operationId as string,
        revision: input.revision as number | null,
        kind: input.kind as 'save' | 'delete',
        post,
        banner,
        markdown,
        image,
        avifImage,
        hash
    };
}
