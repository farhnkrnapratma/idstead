import type { RequestHandler } from './$types';

export const GET: RequestHandler = () =>
    new Response('', {
        headers: {
            'Content-Type': 'text/plain; charset=utf-8',
            'Cache-Control': 'public, max-age=3600',
            'Access-Control-Allow-Origin': '*'
        }
    });
