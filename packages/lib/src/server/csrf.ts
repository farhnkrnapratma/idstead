// SPDX-FileCopyrightText: 2026 Farhan Kurnia Pratama
//
// SPDX-License-Identifier: AGPL-3.0-only

import type { Handle } from '@sveltejs/kit/hooks';

const MUTATING_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);
const FORM_CONTENT_TYPES = new Set([
    'application/x-www-form-urlencoded',
    'multipart/form-data',
    'text/plain',
    'application/x-sveltekit-formdata'
]);
const CROSS_SITE_FORM_PATHS = new Set(['/oauth/token', '/oauth/revoke', '/oauth/userinfo']);

export function isForbiddenCrossSiteForm(request: Request, url: URL): boolean {
    if (!MUTATING_METHODS.has(request.method) || CROSS_SITE_FORM_PATHS.has(url.pathname))
        return false;
    const type = request.headers.get('content-type')?.split(';', 1)[0].trim().toLowerCase();
    if (type && !FORM_CONTENT_TYPES.has(type)) return false;
    return request.headers.get('origin') !== url.origin;
}

export const csrfHandle: Handle = ({ event, resolve }) => {
    if (!isForbiddenCrossSiteForm(event.request, event.url)) return resolve(event);
    const message = `Cross-site ${event.request.method} form submissions are forbidden`;
    return event.request.headers.get('accept') === 'application/json' ?
            Response.json({ message }, { status: 403 })
        :   new Response(message, {
                status: 403,
                headers: { 'Content-Type': 'text/plain; charset=utf-8' }
            });
};
