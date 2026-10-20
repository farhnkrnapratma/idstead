import type { SupabaseClient } from '@supabase/supabase-js';
import {
    contactLinkFromRow,
    educationFromRow,
    experienceFromRow,
    fundingLinkFromRow,
    skillItemFromRow,
    socialLinkFromRow,
    type ProjectRepoRules
} from '@fkp/domain/author.ts';
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
import { DataError } from '../errors';
import { createAuthorReader, type Row } from './author';

const PROFILES = 'db_profiles';
const IDENTITY_VERSIONS = 'db_identity_versions';

type DbError = { code?: string; message?: string } | null;

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

export function createSupabaseAdminAuthorStore(
    db: SupabaseClient,
    options: { fetch?: typeof fetch } = {}
): AdminAuthorStore {
    const reader = createAuthorReader(db, options);

    return {
        async snapshot(): Promise<AdminAuthorSnapshot> {
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
            const versions = [profile?.avatarVersion, profile?.bannerVersion].filter(
                (id): id is string => Boolean(id)
            );
            let identityRows: Row[] = [];
            if (versions.length) {
                const { data, error } = await db
                    .from(IDENTITY_VERSIONS)
                    .select(
                        'id, kind, source, fingerprint, avatar_source, avatar_fingerprint, banner_source, banner_fingerprint'
                    )
                    .in('id', versions);
                if (error) throw new DataError('adminAuthor.identity', error);
                identityRows = (data ?? []) as Row[];
            }
            return {
                profile,
                identity: {
                    avatar: identityMeta(identityRows, 'avatar', profile?.avatarVersion),
                    banner: identityMeta(identityRows, 'banner', profile?.bannerVersion)
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
        },

        profile: () => reader.profile({ includeEmail: true }),

        async cvEntries() {
            const [experience, education] = await Promise.all([
                reader.experience(),
                reader.education()
            ]);
            return {
                experience: experience.map(experienceFromRow),
                education: education.map(educationFromRow)
            };
        },

        async profileRecord(id?: string): Promise<ProfileRecord | null> {
            const query = db.from(PROFILES).select('*');
            const { data, error } = await (id ? query.eq('id', id) : query.limit(1)).maybeSingle();
            if (error) throw new DataError('adminAuthor.profileRecord', error);
            return (data as ProfileRecord | null) ?? null;
        },

        async profileWithAvatarVersion(version: string): Promise<ProfileRecord | null> {
            const { data, error } = await db
                .from(PROFILES)
                .select('*')
                .eq('avatar_version', version)
                .maybeSingle();
            if (error) throw new DataError('adminAuthor.profileWithAvatarVersion', error);
            return (data as ProfileRecord | null) ?? null;
        },

        async saveProfile(profile, identity): Promise<ProfileSave> {
            const { data, error } = (await db.rpc('db_save_profile_identity', {
                p_profile: profile,
                p_identity: identity
            })) as { data: Record<string, unknown> | null; error: DbError };
            if (error)
                return {
                    status: 'failed',
                    code: error.code ?? null,
                    message: error.message || 'Profile could not be saved.'
                };
            return { status: 'saved', profile: data ?? {} };
        },

        async identityDefaults() {
            const { data, error } = await db.rpc('db_identity_defaults');
            if (error) throw new DataError('adminAuthor.identityDefaults', error);
            return data;
        },

        async identityVersions(ids: string[]): Promise<IdentityVersionRecord[]> {
            if (!ids.length) return [];
            const { data, error } = await db
                .from(IDENTITY_VERSIONS)
                .select(
                    'id, kind, source, fingerprint, avatar_source, avatar_fingerprint, banner_source, banner_fingerprint, assets'
                )
                .in('id', ids);
            if (error) throw new DataError('adminAuthor.identityVersions', error);
            return (data ?? []) as IdentityVersionRecord[];
        },

        async registerIdentityVersion(version: IdentityVersionRecord) {
            const { error } = await db.from(IDENTITY_VERSIONS).insert(version);
            if (error) throw new DataError('adminAuthor.registerIdentityVersion', error);
        },

        async deleteIdentityVersion(id: string) {
            const { error } = await db.from(IDENTITY_VERSIONS).delete().eq('id', id);
            if (error) throw new DataError('adminAuthor.deleteIdentityVersion', error);
        },

        async ensureProfileId(): Promise<string> {
            const { data, error } = await db.from(PROFILES).select('id').limit(1).maybeSingle();
            if (error) throw new DataError('adminAuthor.ensureProfileId', error);
            if (data?.id) return data.id as string;
            const { data: created, error: createError } = await db
                .from(PROFILES)
                .insert({})
                .select('id')
                .single();
            if (createError || !created?.id)
                throw new DataError('adminAuthor.ensureProfileId.create', createError);
            return created.id as string;
        }
    };
}

export function createSupabaseAuthorWriter(db: SupabaseClient): AuthorWriter {
    async function call(name: string, args: Record<string, unknown>): Promise<AuthorWrite> {
        const { error } = (await db.rpc(name, args)) as { error: DbError };
        return error ?
                { status: 'rejected', message: error.message || 'Save failed.' }
            :   { status: 'saved' };
    }

    return {
        saveCv: (authorId, experiences, education) =>
            call('db_save_cv', {
                p_author_id: authorId,
                p_experiences: experiences,
                p_education: education
            }),

        saveSkills: (authorId, categories) =>
            call('db_save_skills', { p_author_id: authorId, p_categories: categories }),

        saveLinks: (authorId, category: LinkCategory, items) =>
            call('db_save_links', { p_author_id: authorId, p_category: category, p_items: items }),

        async saveRepoRules(authorId: string, rules: ProjectRepoRules) {
            const pinned = await call('db_save_project_repo_rules', {
                p_author_id: authorId,
                p_rule_type: 'pin',
                p_names: rules.pinned
            });
            if (pinned.status !== 'saved') return pinned;
            return call('db_save_project_repo_rules', {
                p_author_id: authorId,
                p_rule_type: 'exclude',
                p_names: rules.excluded
            });
        }
    };
}
