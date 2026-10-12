import { apiError } from '#lib/server/apiError.ts';
import { ApiRequestError } from './params';

const PUBLIC_CACHE = 'public, max-age=0, s-maxage=60, must-revalidate';

export function jsonResponse(body: unknown, headers: Record<string, string> = {}) {
    return Response.json(body, {
        headers: { 'Cache-Control': PUBLIC_CACHE, 'X-Robots-Tag': 'index, follow', ...headers }
    });
}

export function textResponse(body: string, type: 'md' | 'txt') {
    return new Response(body, {
        headers: {
            'Content-Type':
                type === 'md' ? 'text/markdown; charset=utf-8' : 'text/plain; charset=utf-8',
            'Cache-Control': PUBLIC_CACHE,
            'X-Robots-Tag': 'index, follow'
        }
    });
}

export async function runApi(handler: () => Promise<Response>): Promise<Response> {
    try {
        return await handler();
    } catch (error) {
        if (error instanceof ApiRequestError)
            return apiError(error.status, error.code, error.message, error.details);
        throw error;
    }
}
