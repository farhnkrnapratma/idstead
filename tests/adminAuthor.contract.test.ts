import { describe, expect, test } from 'bun:test';
import {
    createSupabaseAdminAuthorStore,
    createSupabaseAuthorWriter
} from '../packages/data/src/supabase/adminAuthor.ts';
import {
    ADMIN_AUTHOR_SEED,
    adminAuthorContract,
    type AdminAuthorSeed
} from './contracts/adminAuthor.contract.ts';
import { authorFetch, authorTables } from './support/authorTables.ts';
import { fakeSupabase, type Row } from './support/fakeSupabase.ts';

const NEW_PROFILE = '00000000-0000-4000-8000-000000000777';

function supabaseFromSeed(
    seed: AdminAuthorSeed,
    rpc: NonNullable<Parameters<typeof fakeSupabase>[2]>['rpc'] = {}
) {
    const tables = authorTables(seed.author);
    tables.db_identity_versions = seed.identityVersions.map(version => ({
        id: version.uuid,
        kind: 'avatar',
        source: version.source,
        fingerprint: version.fingerprint
    }));
    const { db } = fakeSupabase(
        tables,
        {},
        { rpc, defaults: { db_profiles: () => ({ id: NEW_PROFILE, profile_revision: 0 }) } }
    );
    return {
        db,
        tables,
        store: createSupabaseAdminAuthorStore(db, { fetch: authorFetch(seed.author) }),
        writer: createSupabaseAuthorWriter(db)
    };
}

adminAuthorContract('Supabase adapter', supabaseFromSeed);

const calls = (log: Row[]) => (name: string) => (args: Row) => {
    log.push({ name, ...args });
    return { data: null, error: null };
};

describe('Supabase admin author adapter', () => {
    test('creates a profile when none exists', async () => {
        const { store, tables } = supabaseFromSeed(ADMIN_AUTHOR_SEED);
        tables.db_profiles = [];
        expect(await store.ensureProfileId()).toBe(NEW_PROFILE);
        expect(tables.db_profiles).toHaveLength(1);
    });

    test('saves repository rules as a pin call followed by an exclude call', async () => {
        const log: Row[] = [];
        const record = calls(log);
        const { writer } = supabaseFromSeed(ADMIN_AUTHOR_SEED, {
            db_save_project_repo_rules: record('rules')
        });
        expect(await writer.saveRepoRules('author', { pinned: ['a'], excluded: ['b'] })).toEqual({
            status: 'saved'
        });
        expect(log).toEqual([
            { name: 'rules', p_author_id: 'author', p_rule_type: 'pin', p_names: ['a'] },
            { name: 'rules', p_author_id: 'author', p_rule_type: 'exclude', p_names: ['b'] }
        ]);
    });

    test('stops after a rejected pin save and reports the database message', async () => {
        let count = 0;
        const { writer } = supabaseFromSeed(ADMIN_AUTHOR_SEED, {
            db_save_project_repo_rules: () => {
                count++;
                return { data: null, error: { message: 'too many pins' } };
            }
        });
        expect(await writer.saveRepoRules('author', { pinned: [], excluded: [] })).toEqual({
            status: 'rejected',
            message: 'too many pins'
        });
        expect(count).toBe(1);
    });

    test('passes CV, skills and links to their save functions', async () => {
        const log: Row[] = [];
        const record = calls(log);
        const { writer } = supabaseFromSeed(ADMIN_AUTHOR_SEED, {
            db_save_cv: record('cv'),
            db_save_skills: record('skills'),
            db_save_links: record('links')
        });
        await writer.saveCv('author', [{ title: 'x' }], []);
        await writer.saveSkills('author', [{ category: 'c' }]);
        await writer.saveLinks('author', 'funding', [{ platform: 'p' }]);
        expect(log).toEqual([
            { name: 'cv', p_author_id: 'author', p_experiences: [{ title: 'x' }], p_education: [] },
            { name: 'skills', p_author_id: 'author', p_categories: [{ category: 'c' }] },
            {
                name: 'links',
                p_author_id: 'author',
                p_category: 'funding',
                p_items: [{ platform: 'p' }]
            }
        ]);
    });

    test('returns the identity versions claimed for cleanup', async () => {
        const { store } = supabaseFromSeed(ADMIN_AUTHOR_SEED, {
            db_claim_identity_cleanup: () => ({ data: [{ id: 'v1' }, { id: 'v2' }], error: null })
        });
        expect(await store.claimIdentityCleanup()).toEqual(['v1', 'v2']);
    });

    test('reports a failed profile save with its database code', async () => {
        const { store } = supabaseFromSeed(ADMIN_AUTHOR_SEED, {
            db_save_profile_identity: () => ({
                data: null,
                error: { code: '40001', message: 'revision conflict' }
            })
        });
        expect(await store.saveProfile({ id: 'x' }, null)).toEqual({
            status: 'failed',
            code: '40001',
            message: 'revision conflict'
        });
    });
});
