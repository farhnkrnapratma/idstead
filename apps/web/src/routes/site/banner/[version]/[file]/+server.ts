import type { RequestHandler } from './$types';
import { error } from '@sveltejs/kit';
import { supabase } from '#lib/supabase.ts';

export const GET: RequestHandler = async event => {
    const { version, file } = event.params;

    // Validate format
    if (!/^[a-z0-9-]+\.(?:webp|avif)$/i.test(file)) {
        throw error(400, 'Invalid file format');
    }

    // Get the banner version
    const { data: banner } = await supabase
        .from('db_profile_banner_versions')
        .select(
            'wide_webp_object_key, wide_avif_object_key, og_webp_object_key, wide_bytes, og_bytes, wide_sha256, og_sha256'
        )
        .eq('id', version)
        .eq('state', 'active')
        .single();

    if (!banner) throw error(404, 'Not found');

    let objectKey: string | null = null;
    let bytes: number;
    let sha256: string;
    let contentType: 'image/webp' | 'image/avif' = 'image/webp';

    if (file === 'wide.avif') {
        objectKey = banner.wide_avif_object_key;
        bytes = banner.wide_bytes;
        sha256 = banner.wide_sha256;
        contentType = 'image/avif';
    } else if (file === 'wide.webp') {
        objectKey = banner.wide_webp_object_key;
        bytes = banner.wide_bytes;
        sha256 = banner.wide_sha256;
    } else if (file === 'og.webp') {
        objectKey = banner.og_webp_object_key;
        bytes = banner.og_bytes;
        sha256 = banner.og_sha256;
    } else {
        throw error(404, 'Not found');
    }

    if (!objectKey) throw error(404, 'Not found');

    const bucket = event.platform?.env?.MY_BUCKET;
    if (!bucket) throw error(503, 'Storage unavailable');
    const object = await bucket.get(objectKey);

    if (!object) throw error(404, 'Not found');

    const buffer = await (object.arrayBuffer as unknown as () => Promise<ArrayBuffer>)();
    const etag = `"${sha256}"`;
    const ifNoneMatch = event.request.headers.get('if-none-match');

    if (ifNoneMatch === etag) {
        return new Response(null, { status: 304 });
    }

    return new Response(buffer, {
        headers: {
            'content-type': contentType,
            'content-length': String(bytes),
            'cache-control': 'public, max-age=31536000, immutable',
            etag: etag,
            vary: 'Accept'
        }
    });
};
