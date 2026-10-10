import type { RequestHandler } from './$types';

import readme from '../README.md?raw';

export const GET: RequestHandler = async () => {
    return new Response(readme, {
        headers: {
            'Content-Type': 'text/markdown; charset=utf-8',
            'Cache-Control': 'public, max-age=0, s-maxage=60, must-revalidate',
            'Access-Control-Allow-Origin': '*'
        }
    });
};
