// SPDX-FileCopyrightText: 2026 Farhan Kurnia Pratama
//
// SPDX-License-Identifier: AGPL-3.0-only

export async function publicResponse(request: Request, body: string, type: string, ttl = 60) {
    const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(body));
    const etag =
        '"'
        + Array.from(new Uint8Array(digest), b => b.toString(16).padStart(2, '0')).join('')
        + '"';
    const match = request.headers
        .get('if-none-match')
        ?.split(',')
        .some(value => value.trim().replace(/^W\//, '') === etag || value.trim() === '*');
    return new Response(match || request.method === 'HEAD' ? null : body, {
        status: match ? 304 : 200,
        headers: {
            'Content-Type': type,
            'Cache-Control': `public, max-age=0, s-maxage=${ttl}, must-revalidate`,
            ETag: etag
        }
    });
}
