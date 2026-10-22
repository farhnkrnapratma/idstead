import {
    contactLinkFromRow,
    educationFromRow,
    experienceFromRow,
    fundingLinkFromRow,
    skillItemFromRow,
    socialLinkFromRow,
    type ProjectRepoRules
} from '@idstead/domain/author.ts';
import type {
    AdminAuthorSnapshot,
    AdminAuthorStore,
    AuthorWrite,
    AuthorWriter,
    IdentityVersionMeta,
    IdentityVersionRecord,
    LinkCategory,
    ProfileRecord,
    ProfileSave
} from '../adminAuthor';
import type { Row } from '../authorReader';
import { DataError } from '../errors';
import { createD1AuthorReader, profileRow } from './author';
import type { D1Like, D1Statement } from './client';

const NOW = "strftime('%Y-%m-%dT%H:%M:%fZ', 'now')";
const IDENTITY_DEFAULTS = {
    theme_color: '#09090b',
    background_color: '#09090b',
    display: 'standalone'
};
const IDENTITY_ASSETS = [
    'android-chrome-192x192.png',
    'android-chrome-512x512.png',
    'apple-touch-icon.png',
    'avatar.avif',
    'avatar.png',
    'avatar.webp',
    'banner-og.webp',
    'banner.avif',
    'banner.webp',
    'favicon-16x16.png',
    'favicon-32x32.png',
    'favicon.ico',
    'favicon.svg'
];
const IDENTITY_COLUMNS = [
    'id',
    'profile_id',
    'kind',
    'source',
    'fingerprint',
    'avatar_source',
    'avatar_fingerprint',
    'banner_source',
    'banner_fingerprint',
    'assets',
    'retired_at',
    'cleanup_started_at'
];
const PROFILE_TEXT = [
    'name',
    'username',
    'headline',
    'job_title',
    'bio',
    'email',
    'city',
    'postal_code',
    'country',
    'site_url',
    'pronunciation'
];

class ProfileFailure extends Error {
    readonly code: string | null;

    constructor(code: string | null, message: string) {
        super(message);
        this.code = code;
    }
}

function identityMeta(rows: Row[], kind: 'avatar' | 'banner', id: string | null | undefined) {
    const row = rows.find(entry => entry.id === id);
    if (!row) return null;
    if (row.kind !== 'identity')
        return { source: row.source, fingerprint: row.fingerprint ?? null } as IdentityVersionMeta;
    return {
        source: row[`${kind}_source`] ?? 'custom',
        fingerprint: row[`${kind}_fingerprint`] ?? null
    } as IdentityVersionMeta;
}

function sqliteCode(error: unknown): string | null {
    const message =
        error instanceof Error ? `${error.message} ${String(error.cause ?? '')}` : String(error);
    if (/UNIQUE constraint failed/i.test(message)) return '23505';
    if (/NOT NULL constraint failed/i.test(message)) return '23502';
    if (/FOREIGN KEY constraint failed/i.test(message)) return '23503';
    if (/CHECK constraint failed/i.test(message)) return '23514';
    return null;
}

function identityRecord(row: Row): IdentityVersionRecord {
    let assets: unknown = [];
    try {
        assets = typeof row.assets === 'string' ? JSON.parse(row.assets) : (row.assets ?? []);
    } catch {}
    return { ...row, id: String(row.id), assets };
}

export function createD1AdminAuthorStore(
    db: D1Like,
    options: { fetch?: typeof fetch } = {}
): AdminAuthorStore {
    const reader = createD1AuthorReader(db, options);

    async function guarded<T>(operation: string, task: () => Promise<T>): Promise<T> {
        try {
            return await task();
        } catch (error) {
            throw error instanceof DataError ? error : new DataError(operation, error);
        }
    }

    async function profileBy(where: string, value?: string): Promise<ProfileRecord | null> {
        const statement = db.prepare(`SELECT * FROM db_profiles ${where} LIMIT 1`);
        const row = await (value === undefined ? statement : statement.bind(value)).first<Row>();
        return row ? (profileRow(row) as ProfileRecord) : null;
    }

    async function identityRows(ids: string[]) {
        if (!ids.length) return [];
        const { results } = await db
            .prepare(
                `SELECT id, kind, source, fingerprint, avatar_source, avatar_fingerprint, banner_source, banner_fingerprint, assets
                 FROM db_identity_versions WHERE id IN (SELECT value FROM json_each(?1))`
            )
            .bind(JSON.stringify(ids))
            .all<Row>();
        return results;
    }

    async function saveProfile(
        profile: Record<string, unknown>,
        identity: Record<string, unknown> | null
    ): Promise<Record<string, unknown>> {
        const requestedId = typeof profile.id === 'string' && profile.id ? profile.id : null;
        const identityId =
            identity && typeof identity.version === 'string' && identity.version ?
                identity.version
            :   null;
        let current: ProfileRecord | null;
        const targetId = requestedId ?? crypto.randomUUID();
        if (!requestedId) {
            if (await profileBy('')) throw new ProfileFailure('40001', 'Profile already exists');
            if (!identityId)
                throw new ProfileFailure('P0001', 'Profile image and website banner are required');
            current = null;
        } else {
            current = await profileBy('WHERE id = ?1', requestedId);
            if (!current || Number(current.profile_revision) !== Number(profile.revision))
                throw new ProfileFailure('40001', 'Profile revision conflict');
        }
        const base: Record<string, unknown> = current ?? { manifest_settings: IDENTITY_DEFAULTS };
        const manifest: Record<string, unknown> = {
            ...(base.manifest_settings as Record<string, unknown>),
            ...((profile.manifest_settings as Record<string, unknown> | undefined) ?? {}),
            display: 'standalone'
        };
        const merged: Record<string, unknown> = { ...base, ...profile };
        if (identityId) {
            const assets = identity?.assets;
            const names =
                Array.isArray(assets) ?
                    assets.map(asset => String((asset as Record<string, unknown>)?.name)).sort()
                :   null;
            if (!names || names.join('\n') !== IDENTITY_ASSETS.join('\n'))
                throw new ProfileFailure('P0001', 'Incomplete identity package');
        }
        const statements: D1Statement[] = [];
        if (current)
            statements.push(
                db
                    .prepare(
                        `SELECT json(CASE WHEN EXISTS (SELECT 1 FROM db_profiles WHERE id = ?1 AND profile_revision = ?2) THEN '0' ELSE 'revision-conflict' END) AS ok`
                    )
                    .bind(targetId, Number(current.profile_revision))
            );
        else
            statements.push(
                db.prepare(
                    `SELECT json(CASE WHEN NOT EXISTS (SELECT 1 FROM db_profiles) THEN '0' ELSE 'revision-conflict' END) AS ok`
                ),
                db
                    .prepare(
                        `INSERT INTO db_profiles (id, ${PROFILE_TEXT.join(', ')}, avatar)
                         VALUES (?1, ${PROFILE_TEXT.map((_, index) => `?${index + 2}`).join(', ')}, '')`
                    )
                    .bind(
                        targetId,
                        ...PROFILE_TEXT.map(key =>
                            typeof profile[key] === 'string' ? profile[key] : null
                        )
                    )
            );
        if (identityId)
            statements.push(
                db
                    .prepare(
                        `SELECT json(CASE WHEN EXISTS (
                             SELECT 1 FROM db_identity_versions WHERE id = ?1 AND kind = 'identity' AND profile_id IS NULL
                                 AND retired_at IS NOT NULL AND cleanup_started_at IS NULL
                         ) THEN '0' ELSE 'identity-unavailable' END) AS ok`
                    )
                    .bind(identityId),
                db
                    .prepare(
                        `UPDATE db_identity_versions SET assets = ?2, profile_id = ?3, retired_at = NULL WHERE id = ?1`
                    )
                    .bind(identityId, JSON.stringify(identity?.assets), targetId)
            );
        statements.push(
            db
                .prepare(
                    `UPDATE db_profiles SET ${PROFILE_TEXT.map((key, index) => `${key} = ?${index + 2}`).join(', ')},
                         manifest_settings = ?${PROFILE_TEXT.length + 2},
                         avatar_version = coalesce(?${PROFILE_TEXT.length + 3}, avatar_version),
                         banner_version = coalesce(?${PROFILE_TEXT.length + 3}, banner_version),
                         avatar = CASE WHEN coalesce(?${PROFILE_TEXT.length + 3}, avatar_version) IS NOT NULL
                             THEN rtrim(?${PROFILE_TEXT.indexOf('site_url') + 2}, '/') || '/avatar.png' ELSE avatar END
                     WHERE id = ?1`
                )
                .bind(
                    targetId,
                    ...PROFILE_TEXT.map(key =>
                        typeof merged[key] === 'string' ? merged[key] : null
                    ),
                    JSON.stringify({
                        theme_color: manifest.theme_color,
                        background_color: manifest.background_color,
                        display: manifest.display
                    }),
                    identityId
                )
        );
        if (identityId && current)
            statements.push(
                db
                    .prepare(
                        `UPDATE db_identity_versions SET retired_at = ${NOW} WHERE id IN (?1, ?2) AND id <> ?3`
                    )
                    .bind(
                        current.avatar_version ?? null,
                        current.banner_version ?? null,
                        identityId
                    )
            );
        try {
            await db.batch(statements);
        } catch (error) {
            const message =
                error instanceof Error ? `${error.message} ${String(error.cause ?? '')}` : '';
            if (message.includes('malformed JSON')) {
                const latest = await profileBy('WHERE id = ?1', targetId);
                if (
                    (current
                        && (!latest
                            || Number(latest.profile_revision)
                                !== Number(current.profile_revision)))
                    || (!current && (await profileBy('')))
                )
                    throw new ProfileFailure('40001', 'Profile revision conflict');
                throw new ProfileFailure('P0001', 'Identity version unavailable');
            }
            throw new ProfileFailure(
                sqliteCode(error),
                error instanceof Error ? error.message : 'Profile could not be saved.'
            );
        }
        return (await profileBy('WHERE id = ?1', targetId)) ?? {};
    }

    return {
        snapshot: () =>
            guarded('adminAuthor.snapshot', async (): Promise<AdminAuthorSnapshot> => {
                const [
                    profile,
                    experience,
                    education,
                    skills,
                    social,
                    funding,
                    contact,
                    repoRules,
                    cvDocument,
                    openPgpKey
                ] = await Promise.all([
                    reader.profile({ includeEmail: true }),
                    reader.experience(),
                    reader.education(),
                    reader.skills(),
                    reader.links('social'),
                    reader.links('funding'),
                    reader.links('contact'),
                    reader.projectRepoRules(),
                    reader.activeCvDocument(),
                    reader.activeOpenPgpKey()
                ]);
                const rows = await identityRows(
                    [profile?.avatarVersion, profile?.bannerVersion].filter((id): id is string =>
                        Boolean(id)
                    )
                );
                return {
                    profile,
                    identity: {
                        avatar: identityMeta(rows, 'avatar', profile?.avatarVersion),
                        banner: identityMeta(rows, 'banner', profile?.bannerVersion)
                    },
                    cv: {
                        experience: experience.map(experienceFromRow),
                        education: education.map(educationFromRow)
                    },
                    skills: skills.map(skillItemFromRow),
                    social: social.map(socialLinkFromRow),
                    funding: funding.map(fundingLinkFromRow),
                    contact: contact.map(contactLinkFromRow),
                    repoRules,
                    cvDocument,
                    openPgpKey
                };
            }),

        profile: () => reader.profile({ includeEmail: true }),

        cvEntries: () =>
            guarded('adminAuthor.cvEntries', async () => {
                const [experience, education] = await Promise.all([
                    reader.experience(),
                    reader.education()
                ]);
                return {
                    experience: experience.map(experienceFromRow),
                    education: education.map(educationFromRow)
                };
            }),

        profileRecord: (id?: string) =>
            guarded('adminAuthor.profileRecord', () =>
                id ? profileBy('WHERE id = ?1', id) : profileBy('')
            ),

        profileWithAvatarVersion: (version: string) =>
            guarded('adminAuthor.profileWithAvatarVersion', () =>
                profileBy('WHERE avatar_version = ?1', version)
            ),

        async saveProfile(profile, identity): Promise<ProfileSave> {
            try {
                return { status: 'saved', profile: await saveProfile(profile, identity) };
            } catch (error) {
                if (error instanceof ProfileFailure)
                    return { status: 'failed', code: error.code, message: error.message };
                return {
                    status: 'failed',
                    code: null,
                    message: error instanceof Error ? error.message : 'Profile could not be saved.'
                };
            }
        },

        identityDefaults: async () => ({ ...IDENTITY_DEFAULTS }),

        identityVersions: (ids: string[]) =>
            guarded('adminAuthor.identityVersions', async () =>
                (await identityRows(ids)).map(identityRecord)
            ),

        registerIdentityVersion: (version: IdentityVersionRecord) =>
            guarded('adminAuthor.registerIdentityVersion', async () => {
                const columns = IDENTITY_COLUMNS.filter(column => column in version);
                await db
                    .prepare(
                        `INSERT INTO db_identity_versions (${columns.join(', ')}) VALUES (${columns.map((_, index) => `?${index + 1}`).join(', ')})`
                    )
                    .bind(
                        ...columns.map(column =>
                            column === 'assets' ?
                                JSON.stringify(version.assets ?? [])
                            :   (version[column] ?? null)
                        )
                    )
                    .run();
            }),

        deleteIdentityVersion: (id: string) =>
            guarded('adminAuthor.deleteIdentityVersion', async () => {
                await db.prepare('DELETE FROM db_identity_versions WHERE id = ?1').bind(id).run();
            }),

        claimIdentityCleanup: () =>
            guarded('adminAuthor.claimIdentityCleanup', async () => {
                const { results } = await db
                    .prepare(
                        `UPDATE db_identity_versions SET cleanup_started_at = ${NOW}
                         WHERE id IN (
                             SELECT candidate.id FROM db_identity_versions candidate
                             WHERE candidate.retired_at IS NOT NULL AND json_array_length(candidate.assets) > 0
                                 AND NOT EXISTS (
                                     SELECT 1 FROM db_profiles p
                                     WHERE p.avatar_version = candidate.id OR p.banner_version = candidate.id
                                 )
                             ORDER BY candidate.retired_at LIMIT 10
                         )
                         RETURNING id`
                    )
                    .all<{ id: string }>();
                return results.map(row => row.id);
            }),

        ensureProfileId: () =>
            guarded('adminAuthor.ensureProfileId', async () => {
                const existing = await db
                    .prepare('SELECT id FROM db_profiles LIMIT 1')
                    .first<{ id: string }>();
                if (existing) return existing.id;
                const id = crypto.randomUUID();
                await db
                    .prepare(
                        `INSERT INTO db_profiles (id, ${PROFILE_TEXT.filter(key => key !== 'pronunciation').join(', ')}, avatar)
                         SELECT ?1, ${PROFILE_TEXT.filter(key => key !== 'pronunciation')
                             .map(() => "''")
                             .join(', ')}, ''
                         WHERE NOT EXISTS (SELECT 1 FROM db_profiles)`
                    )
                    .bind(id)
                    .run();
                const row = await db
                    .prepare('SELECT id FROM db_profiles LIMIT 1')
                    .first<{ id: string }>();
                if (!row)
                    throw new DataError(
                        'adminAuthor.ensureProfileId.create',
                        'No profile was created.'
                    );
                return row.id;
            })
    };
}

function integer(value: unknown, fallback: number | null): number | null {
    if (value === null || value === undefined || value === '' || value === 'null') return fallback;
    const parsed = typeof value === 'number' ? value : Number(String(value).trim());
    if (!Number.isInteger(parsed)) throw new Error(`Invalid integer: ${String(value)}`);
    return parsed;
}

function bool(value: unknown): number {
    if (value === null || value === undefined) return 0;
    if (value === true || value === 'true' || value === 't') return 1;
    if (value === false || value === 'false' || value === 'f') return 0;
    throw new Error(`Invalid boolean: ${String(value)}`);
}

function str(value: unknown, fallback: string | null = null): string | null {
    if (value === null || value === undefined) return fallback;
    return typeof value === 'string' ? value : JSON.stringify(value);
}

function blankToNull(value: unknown): string | null {
    const text = str(value);
    return text === '' ? null : text;
}

export function createD1AuthorWriter(db: D1Like): AuthorWriter {
    async function write(build: () => D1Statement[]): Promise<AuthorWrite> {
        try {
            await db.batch(build());
            return { status: 'saved' };
        } catch (error) {
            return {
                status: 'rejected',
                message: error instanceof Error ? error.message : 'Save failed.'
            };
        }
    }

    function repoRules(authorId: string, type: 'pin' | 'exclude', names: string[]) {
        return [
            db
                .prepare(
                    'DELETE FROM db_project_repo_rules WHERE author_id = ?1 AND rule_type = ?2'
                )
                .bind(authorId, type),
            ...names.map((name, index) =>
                db
                    .prepare(
                        'INSERT INTO db_project_repo_rules (author_id, rule_type, repo_name, sort_order) VALUES (?1, ?2, ?3, ?4)'
                    )
                    .bind(authorId, type, name, index)
            )
        ];
    }

    return {
        saveCv: (authorId, experiences, education) =>
            write(() => {
                const year = new Date().getUTCFullYear();
                return [
                    db.prepare('DELETE FROM db_experiences WHERE author_id = ?1').bind(authorId),
                    db.prepare('DELETE FROM db_educations WHERE author_id = ?1').bind(authorId),
                    ...(experiences ?? []).map((item, index) =>
                        db
                            .prepare(
                                `INSERT INTO db_experiences (author_id, title, type, company, start_month, start_year, end_month, end_year,
                                     currently_in, location, loc_type, description, sort_order)
                                 VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13)`
                            )
                            .bind(
                                authorId,
                                str(item.title, ''),
                                str(item.type, ''),
                                str(item.company, ''),
                                str(item.start_month, ''),
                                integer(item.start_year, year),
                                blankToNull(item.end_month),
                                integer(item.end_year, null),
                                bool(item.currently_in),
                                str(item.location, ''),
                                str(item.loc_type, ''),
                                str(item.description, ''),
                                integer(item.sort_order, index + 1)
                            )
                    ),
                    ...(education ?? []).map((item, index) =>
                        db
                            .prepare(
                                `INSERT INTO db_educations (author_id, institution, degree, field, start_month, start_year, end_month, end_year,
                                     currently_in, grade, description, sort_order)
                                 VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12)`
                            )
                            .bind(
                                authorId,
                                str(item.institution, ''),
                                str(item.degree, ''),
                                str(item.field, ''),
                                str(item.start_month, 'September'),
                                integer(item.start_year, year),
                                blankToNull(item.end_month),
                                integer(item.end_year, null),
                                bool(item.currently_in),
                                str(item.grade, ''),
                                str(item.description, ''),
                                integer(item.sort_order, index + 1)
                            )
                    )
                ];
            }),

        saveSkills: (authorId, categories) =>
            write(() => [
                db.prepare('DELETE FROM db_categories WHERE author_id = ?1').bind(authorId),
                ...(categories ?? []).flatMap((category, categoryIndex) => {
                    const id = crypto.randomUUID();
                    const skills = Array.isArray(category.skills) ? category.skills : [];
                    return [
                        db
                            .prepare(
                                'INSERT INTO db_categories (id, author_id, category, sort_order) VALUES (?1, ?2, ?3, ?4)'
                            )
                            .bind(id, authorId, str(category.category), categoryIndex),
                        ...skills.map((skill, skillIndex) =>
                            db
                                .prepare(
                                    'INSERT INTO db_items (category_id, name, sort_order) VALUES (?1, ?2, ?3)'
                                )
                                .bind(id, str(skill), skillIndex)
                        )
                    ];
                })
            ]),

        saveLinks: (authorId, category: LinkCategory, items) => {
            if ((items ?? []).length > 10)
                return Promise.resolve({
                    status: 'rejected',
                    message: `LINK_CATEGORY_LIMIT: ${category} allows at most 10 links`
                });
            return write(() => [
                db
                    .prepare('DELETE FROM db_links WHERE author_id = ?1 AND category = ?2')
                    .bind(authorId, category),
                ...(items ?? []).map((item, index) =>
                    db
                        .prepare(
                            `INSERT INTO db_links (author_id, category, platform, display_value, url, icon, description, sort_order)
                             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)`
                        )
                        .bind(
                            authorId,
                            category,
                            str(item.platform),
                            blankToNull(item.display_value),
                            str(item.url),
                            blankToNull(item.icon) ?? 'bi-link',
                            blankToNull(item.description),
                            integer(item.sort_order, index)
                        )
                )
            ]);
        },

        saveRepoRules: (authorId: string, rules: ProjectRepoRules) => {
            if (rules.pinned.length > 3)
                return Promise.resolve({
                    status: 'rejected',
                    message: 'Maximum of 3 pinned repos allowed'
                });
            return write(() => [
                ...repoRules(authorId, 'pin', rules.pinned),
                ...repoRules(authorId, 'exclude', rules.excluded)
            ]);
        }
    };
}
