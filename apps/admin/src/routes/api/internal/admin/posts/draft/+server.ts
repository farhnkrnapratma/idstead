// SPDX-FileCopyrightText: 2026 Farhan Kurnia Pratama
//
// SPDX-License-Identifier: AGPL-3.0-only

import type { RequestHandler } from './$types';
import { adminServices } from '#lib/server/adminRequest.ts';
import { apiError } from '#lib/server/apiError.ts';
import { UUID_PATTERN } from '#lib/blogBanner.ts';

export const GET: RequestHandler = async ({ request, url, platform }) => {
    const admin = await adminServices(request, url, platform, {
        code: 'BLOG_POSTS_UNAVAILABLE',
        message: 'Post storage is not configured.'
    });
    if (admin.response) return admin.response;
    const { service } = admin;
    const id = url.searchParams.get('id')?.toLowerCase() ?? '';
    if (!UUID_PATTERN.test(id)) return apiError(400, 'BLOG_POST_INVALID', 'Invalid post id.');
    let post;
    try {
        post = await service.adminPosts.posts.get(id);
    } catch (error) {
        console.error('Admin post load failed:', error);
        return apiError(503, 'BLOG_POSTS_UNAVAILABLE', 'The post could not be loaded.');
    }
    if (!post) return apiError(404, 'BLOG_POST_NOT_FOUND', 'Post not found.');
    return Response.json({ post }, { headers: { 'Cache-Control': 'no-store' } });
};
