// SPDX-FileCopyrightText: 2026 Farhan Kurnia Pratama
//
// SPDX-License-Identifier: AGPL-3.0-only

import { error } from '@sveltejs/kit';
import { siteOrigin } from '@idstead/domain/siteOrigin.ts';
import { publicRepositories } from './repositories';
import { configuredSiteUrl } from './siteUrl';

function configuredOrigin(platform: unknown) {
    try {
        return configuredSiteUrl(platform);
    } catch {
        return null;
    }
}

export async function readSite(platform?: unknown) {
    let profile: Awaited<ReturnType<ReturnType<typeof publicRepositories>['author']['profile']>>;
    try {
        profile = await publicRepositories().author.profile({ includeEmail: true });
    } catch {
        error(503, 'Site metadata is temporarily unavailable.');
    }
    const siteUrl = siteOrigin(profile?.siteUrl) ?? siteOrigin(configuredOrigin(platform));
    if (!siteUrl) error(503, 'Site metadata is temporarily unavailable.');
    const site =
        profile ?
            {
                name: profile.name,
                username: profile.username,
                bio: profile.bio,
                headline: profile.headline,
                email: profile.email,
                manifest_settings: profile.manifestSettings,
                created_at: profile.createdAt,
                updated_at: profile.updatedAt
            }
        :   null;
    return { siteUrl, profile: site };
}

export async function readPublishedPosts() {
    const { blog } = publicRepositories();
    const posts: {
        id: string;
        slug: string;
        title: string;
        excerpt: string | null;
        created_at: string;
        updated_at: string | null;
    }[] = [];
    try {
        for (let offset = 0; ; offset += 500) {
            const page = await blog.listPublished({ limit: 500, offset });
            posts.push(
                ...page.posts.map(post => ({
                    slug: post.slug,
                    title: post.title,
                    excerpt: post.excerpt,
                    created_at: post.created_at,
                    updated_at: post.updated_at,
                    id: post.id
                }))
            );
            if (page.posts.length < 500) break;
        }
    } catch {
        error(503, 'Published content is temporarily unavailable.');
    }
    return posts;
}

export function validDate(value: unknown): string | undefined {
    if (typeof value !== 'string') return undefined;
    const date = new Date(value);
    return Number.isFinite(date.getTime()) ? date.toISOString() : undefined;
}

export function markdownText(value: string): string {
    return value.replace(/[\r\n]+/g, ' ').replace(/[\\`*_[\]<>]/g, '\\$&');
}

export { publicResponse } from './publicResponse';
