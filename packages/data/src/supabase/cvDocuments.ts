import type { SupabaseClient } from '@supabase/supabase-js';
import { socialLinkFromRow } from '@idstead/domain/author.ts';
import type {
    CvDocumentStore,
    CvSourceData,
    NewCvDocument,
    OpenPgpKeyInput,
    OpenPgpKeyStore,
    StoredCvDocument
} from '../cvDocuments';
import type { ProfileRecord } from '../adminAuthor';
import { DataError } from '../errors';
import { createAuthorReader, type Row } from './author';

const DOCUMENTS = 'db_documents';
const SNAPSHOTS = 'db_document_snapshots';
const OPENPGP_KEYS = 'db_openpgp_keys';
const FALLBACK_BUCKET = 'cv_documents';

export function createSupabaseCvDocumentStore(db: SupabaseClient): CvDocumentStore {
    const reader = createAuthorReader(db);
    const fallback = () => db.storage.from(FALLBACK_BUCKET);

    return {
        async sourceData(): Promise<CvSourceData | null> {
            const { data: profile, error } = await db
                .from('db_profiles')
                .select('*')
                .limit(1)
                .maybeSingle();
            if (error) throw new DataError('cvDocuments.sourceData.profile', error);
            if (!profile?.id) return null;
            const [experiences, educations, categories, socials, repoRules] = await Promise.all([
                db
                    .from('db_experiences')
                    .select(
                        'title, company, type, location, loc_type, start_date, end_date, currently_in, description'
                    )
                    .order('sort_order', { ascending: true }),
                db
                    .from('db_educations')
                    .select(
                        'institution, degree, field, grade, start_date, end_date, currently_in, description'
                    )
                    .order('sort_order', { ascending: true }),
                reader.skills(),
                reader.links('social'),
                reader.projectRepoRules()
            ]);
            const loadError = experiences.error || educations.error;
            if (loadError) throw new DataError('cvDocuments.sourceData.entries', loadError);
            return {
                profile: profile as ProfileRecord,
                experiences: (experiences.data ?? []) as Row[],
                educations: (educations.data ?? []) as Row[],
                skills: categories.map(category => ({
                    category: category.category,
                    items: ((category.db_items ?? []) as Row[])
                        .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))
                        .map(item => item.name as string)
                })),
                socials: socials.map(socialLinkFromRow),
                repoRules
            };
        },

        async active(): Promise<StoredCvDocument | null> {
            const { data, error } = await db
                .from(DOCUMENTS)
                .select('id, filename, file_url, signed_at')
                .eq('is_active', true)
                .limit(1)
                .maybeSingle();
            if (error) throw new DataError('cvDocuments.active', error);
            if (!data?.filename || !data.file_url) return null;
            return {
                id: data.id as string,
                filename: data.filename as string,
                file_url: data.file_url as string,
                signed_at: (data.signed_at as string | null | undefined) ?? null
            } satisfies StoredCvDocument;
        },

        async activeFilenames(): Promise<string[]> {
            const { data, error } = await db
                .from(DOCUMENTS)
                .select('filename')
                .eq('is_active', true);
            if (error) throw new DataError('cvDocuments.activeFilenames', error);
            return ((data ?? []) as Row[]).map(row => row.filename).filter(Boolean);
        },

        async findFilename(filename: string): Promise<string | null> {
            const { data, error } = await db
                .from(DOCUMENTS)
                .select('filename')
                .eq('filename', filename)
                .limit(1)
                .maybeSingle();
            if (error) throw new DataError('cvDocuments.findFilename', error);
            return (data?.filename as string | undefined) ?? null;
        },

        async snapshot(documentId: string): Promise<unknown | null> {
            const { data, error } = await db
                .from(SNAPSHOTS)
                .select('content')
                .eq('document_id', documentId)
                .maybeSingle();
            if (error) throw new DataError('cvDocuments.snapshot', error);
            return data?.content ?? null;
        },

        async publish(document: NewCvDocument, snapshot: unknown) {
            const { error: deactivateError } = await db
                .from(DOCUMENTS)
                .update({ is_active: false })
                .eq('is_active', true);
            if (deactivateError)
                throw new DataError('cvDocuments.publish.deactivate', deactivateError);
            const { data, error } = await db
                .from(DOCUMENTS)
                .insert({
                    author_id: document.authorId,
                    filename: document.filename,
                    file_url: document.fileUrl,
                    hash: document.hash,
                    checksums: document.checksums,
                    version: document.version,
                    is_active: true
                })
                .select('id')
                .single();
            if (error || !data?.id) throw new DataError('cvDocuments.publish', error);
            const { error: snapshotError } = await db
                .from(SNAPSHOTS)
                .insert({ document_id: data.id, content: snapshot });
            if (snapshotError) console.error('CV snapshot could not be saved:', snapshotError);
            return { id: data.id as string };
        },

        async setChecksums(documentId: string, checksums: Record<string, string>) {
            const { error } = await db.from(DOCUMENTS).update({ checksums }).eq('id', documentId);
            if (error) throw new DataError('cvDocuments.setChecksums', error);
        },

        async setSignature(documentId, signature) {
            const { error } = await db
                .from(DOCUMENTS)
                .update({
                    signed_at: signature?.signedAt ?? null,
                    signer_fingerprint: signature?.fingerprint ?? null
                })
                .eq('id', documentId);
            if (error) throw new DataError('cvDocuments.setSignature', error);
        },

        async signerFingerprint(documentId: string): Promise<string | null> {
            const { data, error } = await db
                .from(DOCUMENTS)
                .select('signer_fingerprint')
                .eq('id', documentId)
                .maybeSingle();
            if (error) throw new DataError('cvDocuments.signerFingerprint', error);
            return (data?.signer_fingerprint as string | null | undefined) ?? null;
        },

        async delete(filename: string): Promise<boolean> {
            const { error } = await db.from(DOCUMENTS).delete().eq('filename', filename);
            return !error;
        },

        siteUrl: () => reader.siteUrl(),

        async uploadFallback(key: string, body: Uint8Array, contentType: string) {
            const { error } = await fallback().upload(key, body, {
                contentType,
                upsert: true,
                cacheControl: '60'
            });
            if (error) throw new DataError('cvDocuments.uploadFallback', error);
        },

        async removeFallback(keys: string[]) {
            const { error } = await fallback().remove(keys);
            if (error) throw new DataError('cvDocuments.removeFallback', error);
        },

        fallbackUrl(key: string) {
            return fallback().getPublicUrl(key).data.publicUrl;
        }
    };
}

export function createSupabaseOpenPgpKeyStore(db: SupabaseClient): OpenPgpKeyStore {
    const reader = createAuthorReader(db);

    return {
        active: () => reader.activeOpenPgpKey(),

        async removeActive() {
            const { error } = await db.from(OPENPGP_KEYS).delete().eq('is_active', true);
            if (error) throw new DataError('openPgpKeys.removeActive', error);
        },

        async publish(key: OpenPgpKeyInput) {
            const updatedAt = new Date().toISOString();
            const { error: deactivateError } = await db
                .from(OPENPGP_KEYS)
                .update({ is_active: false, updated_at: updatedAt })
                .eq('is_active', true)
                .neq('fingerprint', key.fingerprint);
            if (deactivateError)
                throw new DataError('openPgpKeys.publish.deactivate', deactivateError);
            const { error } = await db
                .from(OPENPGP_KEYS)
                .upsert(
                    {
                        fingerprint: key.fingerprint,
                        armored: key.armored,
                        user_ids: key.userIds,
                        algorithm: key.algorithm,
                        key_created_at: key.createdAt,
                        expires_at: key.expiresAt,
                        keyservers: key.keyservers,
                        is_active: true,
                        updated_at: updatedAt
                    },
                    { onConflict: 'fingerprint' }
                );
            if (error) throw new DataError('openPgpKeys.publish', error);
        }
    };
}
