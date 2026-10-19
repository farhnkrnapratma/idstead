import { createSupabaseAuthorRepository } from '../packages/data/src/supabase/author.ts';
import {
    authorRepositoryContract,
    type AuthorSeed
} from './contracts/authorRepository.contract.ts';
import { fakeSupabase } from './support/fakeSupabase.ts';

function supabaseFromSeed(seed: AuthorSeed) {
    const { db } = fakeSupabase({
        db_profiles: [
            {
                id: seed.profile.uuid,
                name: seed.profile.name,
                headline: seed.profile.headline,
                email: seed.profile.email,
                site_url: seed.profile.siteUrl,
                avatar_version: seed.profile.avatarVersion,
                banner_version: null,
                profile_revision: seed.profile.revision
            }
        ],
        db_links: seed.links.map(link => ({
            id: link.uuid,
            category: link.category,
            platform: link.platform,
            url: link.url,
            display_value: link.displayValue ?? '',
            sort_order: link.sortOrder
        })),
        db_experiences: seed.experiences.map(item => ({
            id: item.uuid,
            title: item.title,
            start_month: item.startMonth,
            start_year: 2020,
            sort_order: item.sortOrder
        })),
        db_educations: seed.educations.map(item => ({
            id: item.uuid,
            institution: item.institution,
            start_month: item.startMonth,
            start_year: 2020,
            sort_order: item.sortOrder
        })),
        db_categories: seed.skills.map(category => ({
            id: category.uuid,
            category: category.category,
            sort_order: category.sortOrder
        })),
        db_items: seed.skills.flatMap(category =>
            category.items.map(item => ({
                id: item.uuid,
                category_id: category.uuid,
                name: item.name,
                sort_order: item.sortOrder
            }))
        ),
        db_project_repo_rules: seed.repoRules.map(rule => ({
            rule_type: rule.type,
            repo_name: rule.repo,
            sort_order: rule.sortOrder
        })),
        db_documents: seed.documents.map(document => ({
            id: document.uuid,
            filename: document.filename,
            file_url: document.fileUrl,
            hash: document.hash,
            is_active: document.active,
            sort_order: document.sortOrder
        })),
        db_openpgp_keys: seed.openPgpKeys.map(key => ({
            fingerprint: key.fingerprint,
            armored: '-----BEGIN PGP PUBLIC KEY BLOCK-----',
            is_active: key.active,
            user_ids: [],
            keyservers: key.keyservers
        }))
    });
    const fetchFn = (async (input: string | URL) =>
        String(input) in seed.files ?
            new Response(seed.files[String(input)])
        :   new Response('missing', { status: 404 })) as unknown as typeof fetch;
    return createSupabaseAuthorRepository(db, { fetch: fetchFn });
}

authorRepositoryContract('Supabase adapter', supabaseFromSeed);
