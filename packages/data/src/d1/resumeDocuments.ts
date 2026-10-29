import { socialLinkFromRow } from '@idstead/domain/author.ts';
import type { ProfileRecord } from '../adminAuthor';
import type { Row } from '../authorReader';
import type {
    ResumeDocumentStore,
    ResumeSourceData,
    NewResumeDocument,
    OpenPgpKeyInput,
    OpenPgpKeyStore,
    StoredResumeDocument
} from '../resumeDocuments';
import { DataError } from '../errors';
import { booleanColumns, createD1AuthorReader, profileRow } from './author';
import type { D1Like } from './client';

async function guarded<T>(operation: string, task: () => Promise<T>): Promise<T> {
    try {
        return await task();
    } catch (error) {
        throw error instanceof DataError ? error : new DataError(operation, error);
    }
}

export function createD1ResumeDocumentStore(db: D1Like): ResumeDocumentStore {
    const reader = createD1AuthorReader(db);

    return {
        sourceData: () =>
            guarded('resumeDocuments.sourceData', async (): Promise<ResumeSourceData | null> => {
                const profile = await db.prepare('SELECT * FROM db_profiles LIMIT 1').first<Row>();
                if (!profile?.id) return null;
                const [experiences, educations, categories, socials, repoRules] = await Promise.all(
                    [
                        db
                            .prepare(
                                `SELECT title, company, type, location, loc_type, start_date, end_date, currently_in, description
                             FROM db_experiences ORDER BY sort_order`
                            )
                            .all<Row>(),
                        db
                            .prepare(
                                `SELECT institution, degree, field, grade, start_date, end_date, currently_in, description
                             FROM db_educations ORDER BY sort_order`
                            )
                            .all<Row>(),
                        reader.skills(),
                        reader.links('social'),
                        reader.projectRepoRules()
                    ]
                );
                return {
                    profile: profileRow(profile) as ProfileRecord,
                    experiences: experiences.results.map(row =>
                        booleanColumns(row, ['currently_in'])
                    ),
                    educations: educations.results.map(row =>
                        booleanColumns(row, ['currently_in'])
                    ),
                    skills: categories.map(category => ({
                        category: category.category,
                        items: ((category.db_items ?? []) as Row[])
                            .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))
                            .map(item => item.name as string)
                    })),
                    socials: socials.map(socialLinkFromRow),
                    repoRules
                };
            }),

        active: () =>
            guarded('resumeDocuments.active', async (): Promise<StoredResumeDocument | null> => {
                const row = await db
                    .prepare(
                        'SELECT id, filename, file_url, signed_at FROM db_documents WHERE is_active = 1 LIMIT 1'
                    )
                    .first<Row>();
                if (!row?.filename || !row.file_url) return null;
                return {
                    id: String(row.id),
                    filename: String(row.filename),
                    file_url: String(row.file_url),
                    signed_at: typeof row.signed_at === 'string' ? row.signed_at : null
                };
            }),

        activeFilenames: () =>
            guarded('resumeDocuments.activeFilenames', async () => {
                const { results } = await db
                    .prepare('SELECT filename FROM db_documents WHERE is_active = 1')
                    .all<{ filename: string }>();
                return results.map(row => row.filename).filter(Boolean);
            }),

        findFilename: (filename: string) =>
            guarded('resumeDocuments.findFilename', async () => {
                const row = await db
                    .prepare('SELECT filename FROM db_documents WHERE filename = ?1 LIMIT 1')
                    .bind(filename)
                    .first<{ filename: string }>();
                return row?.filename ?? null;
            }),

        snapshot: (documentId: string) =>
            guarded('resumeDocuments.snapshot', async () => {
                const row = await db
                    .prepare('SELECT content FROM db_document_snapshots WHERE document_id = ?1')
                    .bind(documentId)
                    .first<{ content: string }>();
                return row ? JSON.parse(row.content) : null;
            }),

        publish: (document: NewResumeDocument, snapshot: unknown) =>
            guarded('resumeDocuments.publish', async () => {
                const id = crypto.randomUUID();
                await db.batch([
                    db.prepare('UPDATE db_documents SET is_active = 0 WHERE is_active = 1'),
                    db
                        .prepare(
                            `INSERT INTO db_documents (id, author_id, filename, file_url, hash, checksums, version, is_active)
                             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, 1)`
                        )
                        .bind(
                            id,
                            document.authorId,
                            document.filename,
                            document.fileUrl,
                            document.hash,
                            JSON.stringify(document.checksums),
                            document.version
                        )
                ]);
                try {
                    await db
                        .prepare(
                            'INSERT INTO db_document_snapshots (document_id, content) VALUES (?1, ?2)'
                        )
                        .bind(id, JSON.stringify(snapshot))
                        .run();
                } catch (error) {
                    console.error('Resume snapshot could not be saved:', error);
                }
                return { id };
            }),

        setChecksums: (documentId: string, checksums: Record<string, string>) =>
            guarded('resumeDocuments.setChecksums', async () => {
                await db
                    .prepare('UPDATE db_documents SET checksums = ?2 WHERE id = ?1')
                    .bind(documentId, JSON.stringify(checksums))
                    .run();
            }),

        setSignature: (documentId, signature) =>
            guarded('resumeDocuments.setSignature', async () => {
                await db
                    .prepare(
                        'UPDATE db_documents SET signed_at = ?2, signer_fingerprint = ?3 WHERE id = ?1'
                    )
                    .bind(documentId, signature?.signedAt ?? null, signature?.fingerprint ?? null)
                    .run();
            }),

        signerFingerprint: (documentId: string) =>
            guarded('resumeDocuments.signerFingerprint', async () => {
                const row = await db
                    .prepare('SELECT signer_fingerprint FROM db_documents WHERE id = ?1')
                    .bind(documentId)
                    .first<{ signer_fingerprint: string | null }>();
                return row?.signer_fingerprint ?? null;
            }),

        async delete(filename: string) {
            try {
                await db
                    .prepare('DELETE FROM db_documents WHERE filename = ?1')
                    .bind(filename)
                    .run();
                return true;
            } catch {
                return false;
            }
        },

        siteUrl: () => reader.siteUrl()
    };
}

export function createD1OpenPgpKeyStore(db: D1Like): OpenPgpKeyStore {
    const reader = createD1AuthorReader(db);

    return {
        active: () => reader.activeOpenPgpKey(),

        removeActive: () =>
            guarded('openPgpKeys.removeActive', async () => {
                await db.prepare('DELETE FROM db_openpgp_keys WHERE is_active = 1').run();
            }),

        publish: (key: OpenPgpKeyInput) =>
            guarded('openPgpKeys.publish', async () => {
                const updatedAt = new Date().toISOString();
                await db.batch([
                    db
                        .prepare(
                            'UPDATE db_openpgp_keys SET is_active = 0, updated_at = ?2 WHERE is_active = 1 AND fingerprint <> ?1'
                        )
                        .bind(key.fingerprint, updatedAt),
                    db
                        .prepare(
                            `INSERT INTO db_openpgp_keys (fingerprint, armored, user_ids, algorithm, key_created_at, expires_at, keyservers, is_active, updated_at)
                             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, 1, ?8)
                             ON CONFLICT (fingerprint) DO UPDATE SET armored = excluded.armored, user_ids = excluded.user_ids,
                                 algorithm = excluded.algorithm, key_created_at = excluded.key_created_at, expires_at = excluded.expires_at,
                                 keyservers = excluded.keyservers, is_active = 1, updated_at = excluded.updated_at`
                        )
                        .bind(
                            key.fingerprint,
                            key.armored,
                            JSON.stringify(key.userIds),
                            key.algorithm,
                            key.createdAt,
                            key.expiresAt,
                            JSON.stringify(key.keyservers),
                            updatedAt
                        )
                ]);
            })
    };
}
