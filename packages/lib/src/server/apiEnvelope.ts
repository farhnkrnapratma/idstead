const DEFAULT_CODES: Record<number, string> = {
    400: 'BAD_REQUEST',
    401: 'UNAUTHORIZED',
    403: 'FORBIDDEN',
    404: 'NOT_FOUND',
    405: 'METHOD_NOT_ALLOWED',
    429: 'RATE_LIMITED'
};

const ARD_DEFAULT_CODES: Record<number, string> = {
    400: 'INVALID_ARGUMENT',
    401: 'UNAUTHENTICATED',
    403: 'UNAUTHENTICATED',
    404: 'NOT_FOUND',
    405: 'INVALID_ARGUMENT',
    429: 'RATE_LIMIT_EXCEEDED'
};

const DEFAULT_MESSAGES: Record<number, string> = {
    400: 'The request was invalid.',
    401: 'Authentication is required to access this privileged endpoint.',
    403: 'You do not have permission to access this privileged resource.',
    404: 'Requested API endpoint or resource does not exist.',
    405: 'This HTTP method is not supported for this endpoint.',
    429: 'Rate limit exceeded. Please wait before retrying.'
};

const SENSITIVE =
    /row-level security|violates|postgres|supabase|column|relation|syntax error|duplicate key|PGRST|permission denied/i;

export interface ApiEnvelopeOptions {
    requestId: string;
    ard?: boolean;
    publicCors?: boolean;
    allow?: string;
    fallbackAllow?: string;
    noindex?: boolean;
    headers?: Record<string, string>;
}

export function needsApiEnvelope(response: Response) {
    const type = response.headers.get('content-type') ?? '';
    return response.status >= 400 || type.includes('text/html');
}

export async function apiErrorEnvelope(
    response: Response,
    options: ApiEnvelopeOptions
): Promise<Response> {
    const status = response.status >= 400 ? response.status : 404;
    const contentType = response.headers.get('content-type') ?? '';
    let code =
        options.ard ?
            (ARD_DEFAULT_CODES[status] ?? 'INTERNAL_ERROR')
        :   (DEFAULT_CODES[status] ?? 'INTERNAL_ERROR');
    let message =
        DEFAULT_MESSAGES[status] ?? 'An unexpected error occurred while processing the request.';
    let details: string | undefined;

    if (contentType.includes('application/json')) {
        try {
            const body = await response.clone().json();
            if (body && typeof body === 'object') {
                if (options.ard && typeof body.errorCode === 'string' && body.errorCode)
                    code = body.errorCode;
                else if (!options.ard && typeof body.code === 'string' && body.code)
                    code = body.code;

                const rawMessage = String(body.message ?? body.error ?? '').trim();
                if (rawMessage && !SENSITIVE.test(rawMessage))
                    message = rawMessage.replace(/^\d{3}\s+[^:]+:\s*/, '');

                const rawDetails = String(body.details ?? '').trim();
                if (rawDetails && !SENSITIVE.test(rawDetails)) details = rawDetails;
            }
        } catch {}
    }

    const headers: Record<string, string> = {
        'Content-Type': 'application/json; charset=utf-8',
        'Cache-Control': 'no-store',
        'X-Request-ID': options.requestId,
        ...(options.noindex ? { 'X-Robots-Tag': 'noindex, nofollow' } : {}),
        ...(status === 405 ?
            {
                Allow:
                    options.allow
                    ?? response.headers.get('allow')
                    ?? options.fallbackAllow
                    ?? 'GET, HEAD, OPTIONS'
            }
        :   {}),
        ...(options.publicCors ?
            {
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Expose-Headers': 'X-Request-ID, Retry-After'
            }
        :   {}),
        ...options.headers
    };
    return new Response(
        JSON.stringify(
            options.ard ?
                { errorCode: code, message }
            :   { error: { code, message, ...(details ? { details } : {}) } }
        ),
        { status, headers }
    );
}
