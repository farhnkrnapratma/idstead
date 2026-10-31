// SPDX-FileCopyrightText: 2026 Farhan Kurnia Pratama
//
// SPDX-License-Identifier: AGPL-3.0-only

import type { AuthorSeed } from '../contracts/authorRepository.contract.ts';

export function authorFetch(seed: AuthorSeed) {
    return (async (input: string | URL) =>
        String(input) in seed.files ?
            new Response(seed.files[String(input)])
        :   new Response('missing', { status: 404 })) as unknown as typeof fetch;
}

export function d1AuthorRows(seed: AuthorSeed): Record<string, Record<string, unknown>[]> {
    const authorId = seed.profile.uuid;
    return {
        db_identity_versions:
            seed.profile.avatarVersion ?
                [
                    {
                        id: seed.profile.avatarVersion,
                        source: 'custom',
                        avatar_source: 'custom',
                        banner_source: 'custom'
                    }
                ]
            :   [],
        db_profiles: [
            {
                id: authorId,
                name: seed.profile.name,
                username: 'ada',
                headline: seed.profile.headline,
                job_title: 'Engineer',
                bio: 'Bio',
                avatar: '',
                email: seed.profile.email,
                city: 'City',
                postal_code: '00000',
                country: 'Country',
                site_url: seed.profile.siteUrl,
                avatar_version: seed.profile.avatarVersion,
                profile_revision: seed.profile.revision
            }
        ],
        db_links: seed.links.map(link => ({
            id: link.uuid,
            author_id: authorId,
            category: link.category,
            platform: link.platform,
            url: link.url,
            display_value: link.displayValue ?? '',
            sort_order: link.sortOrder
        })),
        db_experiences: seed.experiences.map(item => ({
            id: item.uuid,
            author_id: authorId,
            title: item.title,
            type: 'Full-time',
            company: 'Company',
            start_month: item.startMonth,
            start_year: 2020,
            location: 'Remote',
            loc_type: 'Remote',
            description: '',
            sort_order: item.sortOrder
        })),
        db_educations: seed.educations.map(item => ({
            id: item.uuid,
            author_id: authorId,
            institution: item.institution,
            degree: 'BSc',
            field: 'CS',
            start_month: item.startMonth,
            start_year: 2020,
            grade: '',
            description: '',
            sort_order: item.sortOrder
        })),
        db_categories: seed.skills.map(category => ({
            id: category.uuid,
            author_id: authorId,
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
            author_id: authorId,
            rule_type: rule.type,
            repo_name: rule.repo,
            sort_order: rule.sortOrder
        })),
        db_documents: seed.documents.map(document => ({
            id: document.uuid,
            author_id: authorId,
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
            user_ids: '[]',
            keyservers: JSON.stringify(key.keyservers)
        }))
    };
}
