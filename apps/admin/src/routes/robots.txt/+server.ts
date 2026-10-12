import type { RequestHandler } from './$types';

export const GET: RequestHandler = () =>
    new Response('User-agent: *\nDisallow: /\n', {
        headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store' }
    });
