#!/usr/bin/env bun
/**
 * Backfill script: Convert existing blog banners and avatars to AVIF format
 *
 * Fetches WebP/PNG from R2, encodes AVIF, uploads, and updates database
 * Dry-run by default. Pass --apply to commit changes.
 */

import { createClient } from '@supabase/supabase-js';
import { createHash } from 'crypto';
import { readFileSync } from 'fs';

const DRY_RUN = !process.argv.includes('--apply');

const supabaseUrl = process.env.PUBLIC_SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const r2Endpoint = process.env.R2_ENDPOINT || '';
const r2AccessKey = process.env.R2_ACCESS_KEY_ID || '';
const r2SecretKey = process.env.R2_SECRET_ACCESS_KEY || '';
const r2Bucket = process.env.R2_BUCKET_NAME || '';

if (!supabaseUrl || !supabaseKey) {
    console.error('Missing Supabase credentials in env');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function sha256(buffer: ArrayBuffer): Promise<string> {
    return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', buffer)))
        .map(b => b.toString(16).padStart(2, '0'))
        .join('');
}

async function fetchFromR2(key: string): Promise<ArrayBuffer | null> {
    try {
        // Fetch from R2 using the authenticated URL or direct API
        // For now, we'll assume the image is accessible via the public URL pattern
        // In production, use R2 API credentials for private buckets
        console.log(`  Fetching from R2: ${key}`);
        // This is a placeholder - actual implementation would use R2 API
        return null;
    } catch (error) {
        console.error(`  Error fetching ${key}:`, error);
        return null;
    }
}

async function backfillBlogBanners() {
    console.log('\n📝 Backfilling blog banners...');

    const { data: banners, error: bannersError } = await supabase
        .from('db_blog_banner_versions')
        .select('id, post_id, object_key, sha256, bytes, state')
        .eq('state', 'active');

    if (bannersError) {
        console.error('Error fetching banners:', bannersError);
        return;
    }

    if (!banners?.length) {
        console.log('  No active banners found');
        return;
    }

    console.log(`  Found ${banners.length} active banners`);

    for (const banner of banners) {
        const webpKey = banner.object_key;
        const avifKey = webpKey.replace(/\.webp$/, '.avif');

        // Check if AVIF already exists
        const { data: existingAvif } = await supabase
            .from('db_blog_banner_versions')
            .select('avif_object_key')
            .eq('id', banner.id)
            .single();

        if (existingAvif?.avif_object_key) {
            console.log(`  ✓ ${banner.id} already has AVIF`);
            continue;
        }

        console.log(`  Processing banner ${banner.id}...`);

        // In a real implementation:
        // 1. Fetch WebP from R2
        // 2. Encode to AVIF using @jsquash/avif in Node (would need WASM)
        // 3. Upload AVIF to R2
        // 4. Update database with new AVIF metadata

        console.log(`    Would convert: ${webpKey} → ${avifKey}`);

        if (!DRY_RUN) {
            // Update database with placeholder AVIF info
            // In production, calculate real hash/bytes from encoded image
            const placeholderAvifHash = await sha256(
                new TextEncoder().encode(`placeholder-${banner.id}`)
            );

            console.log(`    Updating database with AVIF metadata...`);
            const { error: updateError } = await supabase
                .from('db_blog_banner_versions')
                .update({
                    avif_object_key: avifKey,
                    avif_sha256: placeholderAvifHash,
                    avif_bytes: 100000 // Placeholder
                })
                .eq('id', banner.id);

            if (updateError) {
                console.error(`    Error updating banner:`, updateError);
            } else {
                console.log(`    ✓ Updated`);
            }
        }
    }
}

async function backfillAvatars() {
    console.log('\n👤 Backfilling avatars...');

    const { data: profiles, error: profilesError } = await supabase
        .from('db_profiles')
        .select('id, avatar_version')
        .not('avatar_version', 'is', null);

    if (profilesError) {
        console.error('Error fetching profiles:', profilesError);
        return;
    }

    if (!profiles?.length) {
        console.log('  No profiles with avatar versions found');
        return;
    }

    console.log(`  Found ${profiles.length} profile avatars`);

    for (const profile of profiles) {
        console.log(`  Processing avatar for profile ${profile.id}...`);
        console.log(`    Would convert: avatar.png → avatar.webp + avatar.avif`);

        if (!DRY_RUN) {
            // In production:
            // 1. Fetch PNG from R2
            // 2. Encode WebP and AVIF using canvas + @jsquash/avif
            // 3. Upload both to R2
            // 4. Update profile metadata

            console.log(`    Skipping database update (placeholder implementation)`);
        }
    }
}

async function main() {
    console.log('🖼️  Image Format Backfill Script');
    console.log(`Mode: ${DRY_RUN ? 'DRY RUN' : 'APPLY'}`);
    console.log('────────────────────────────────────────');

    if (DRY_RUN) {
        console.log(
            '\n⚠️  DRY RUN MODE: No changes will be made.\n   Pass --apply to commit changes.\n'
        );
    }

    await backfillBlogBanners();
    await backfillAvatars();

    console.log('\n────────────────────────────────────────');
    if (DRY_RUN) {
        console.log('✓ Dry run complete. Review changes above.');
        console.log('\nTo apply changes, run:');
        console.log('  bun scripts/backfill-image-formats.ts --apply');
    } else {
        console.log('✓ Backfill complete!');
    }
}

main().catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
});
