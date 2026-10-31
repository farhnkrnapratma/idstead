import { apiError } from './apiError';
import { isSameOriginRequest } from './sameOrigin';
import { verifyTurnstileToken } from './turnstile';

export type JsonRequest = { body: any; response?: never } | { body?: never; response: Response };

interface PublicWriteEvent {
    request: Request;
    url: URL;
    platform: unknown;
    getClientAddress: () => string;
}

export async function readPublicWrite(
    event: PublicWriteEvent,
    turnstileErrorCode: string
): Promise<JsonRequest> {
    if (!isSameOriginRequest(event.request, event.url))
        return {
            response: apiError(
                403,
                'FORBIDDEN_ORIGIN',
                'Cross-origin requests are not allowed on this endpoint.'
            )
        };
    let body: any;
    try {
        body = await event.request.json();
    } catch {
        return { response: apiError(400, 'INVALID_JSON_BODY', 'Invalid JSON body.') };
    }
    const token = typeof body?.turnstileToken === 'string' ? body.turnstileToken : '';
    if (!(await verifyTurnstileToken(token, event.getClientAddress(), event.platform)))
        return { response: apiError(403, turnstileErrorCode, 'Turnstile verification failed.') };
    return { body };
}
