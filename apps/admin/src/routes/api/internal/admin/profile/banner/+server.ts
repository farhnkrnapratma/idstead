import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { isSameOriginRequest } from '#lib/server/sameOrigin.ts';
import { apiError } from '#lib/server/apiError.ts';
import { getSupabaseAdminClient } from '#lib/server/supabaseAdmin.ts';
import { requireAdminAuth } from '#lib/server/adminCv.ts';
import { sha256, UUID_PATTERN } from '#lib/blogBanner.ts';

export const POST: RequestHandler = async ({ request, url, platform }) => {
    if (!isSameOriginRequest(request, url)) return apiError(403, 'CORS_BLOCKED', 'CORS blocked');
    const authError = await requireAdminAuth(request, platform);
    if (authError) return authError;

    try {
        const form = await request.formData();
        const operation = form.get('operation');
        const supabaseAdmin = getSupabaseAdminClient(platform);

        if (!supabaseAdmin) throw new Error('Database unavailable.');

        const { data: profile, error: profileError } = await supabaseAdmin
            .from('db_profiles')
            .select('id, banner_version')
            .single();

        if (profileError || !profile?.id) throw new Error('Profile not found.');
        const profileId = profile.id;

        if (operation === 'remove') {
            if (profile?.banner_version) {
                await supabaseAdmin
                    .from('db_profile_banner_versions')
                    .update({ state: 'retired', retired_at: new Date().toISOString() })
                    .eq('id', profile.banner_version);

                await supabaseAdmin.from('db_profiles').update({ banner_version: null }).select();
            }

            return json({ ok: true });
        }

        if (operation !== 'replace') throw new Error('Invalid operation.');

        const wideWebp = form.get('wideWebp');
        const wideAvif = form.get('wideAvif');
        const ogWebp = form.get('ogWebp');

        if (!(wideWebp instanceof File) || !(wideAvif instanceof File) || !(ogWebp instanceof File))
            throw new Error('Missing banner files.');

        const [wideWebpBuf, wideAvifBuf, ogWebpBuf] = await Promise.all([
            wideWebp.arrayBuffer(),
            wideAvif.arrayBuffer(),
            ogWebp.arrayBuffer()
        ]);

        const [wideWebpHash, wideAvifHash, ogWebpHash] = await Promise.all([
            sha256(wideWebpBuf),
            sha256(wideAvifBuf),
            sha256(ogWebpBuf)
        ]);

        const versionId = crypto.randomUUID();
        if (!UUID_PATTERN.test(versionId)) throw new Error('Invalid version ID.');

        const bucket = platform?.env?.MY_BUCKET;
        if (!bucket) throw new Error('Storage unavailable.');

        const wideWebpKey = `site/banner/${versionId}/wide.webp`;
        const wideAvifKey = `site/banner/${versionId}/wide.avif`;
        const ogWebpKey = `site/banner/${versionId}/og.webp`;

        await Promise.all([
            bucket.put(wideWebpKey, wideWebpBuf, { httpMetadata: { contentType: 'image/webp' } }),
            bucket.put(wideAvifKey, wideAvifBuf, { httpMetadata: { contentType: 'image/avif' } }),
            bucket.put(ogWebpKey, ogWebpBuf, { httpMetadata: { contentType: 'image/webp' } })
        ]);

        const { data } = await supabaseAdmin.rpc('db_prepare_profile_banner_version', {
            p_version_id: versionId,
            p_profile_id: profileId,
            p_wide_webp_object_key: wideWebpKey,
            p_wide_webp_sha256: wideWebpHash,
            p_wide_webp_bytes: wideWebpBuf.byteLength,
            p_wide_avif_object_key: wideAvifKey,
            p_wide_avif_sha256: wideAvifHash,
            p_wide_avif_bytes: wideAvifBuf.byteLength,
            p_og_webp_object_key: ogWebpKey,
            p_og_webp_sha256: ogWebpHash,
            p_og_webp_bytes: ogWebpBuf.byteLength
        });

        if (!data) throw new Error('Failed to commit banner.');

        await supabaseAdmin.from('db_profiles').update({ banner_version: versionId }).select();

        return json({ ok: true, versionId });
    } catch (error) {
        const message = error instanceof Error ? error.message : 'Failed to process banner.';
        return apiError(400, 'BANNER_UPLOAD_ERROR', message);
    }
};
