import { emailError } from '@fkp/domain/fieldValidation.ts';

export type MailingAction = 'subscribe' | 'unsubscribe';
export type MailingCommand = { action: MailingAction; email: string };

export function parseMailingCommand(query: string): MailingCommand | null {
    const match = /^\/mailing\s+(subscribe|unsubscribe)(?:\s+(.+))?$/i.exec(query.trim());
    return match ?
            { action: match[1].toLowerCase() as MailingAction, email: match[2]?.trim() ?? '' }
        :   null;
}

export function mailingEmailError(email: string) {
    return (
        !email.trim() ? 'Enter your email address.'
        : email.trim().length > 254 ? 'Use an email address of at most 254 characters.'
        : emailError(email.trim())
    );
}

export async function submitMailing(
    action: MailingAction,
    email: string,
    verify: () => Promise<string>,
    signal?: AbortSignal,
    request: (input: string, init: RequestInit) => Promise<Response> = fetch
) {
    const validation = mailingEmailError(email);
    if (validation) throw new Error(validation);
    const turnstileToken = await verify();
    signal?.throwIfAborted();
    if (!turnstileToken) throw new Error('Verification failed. Please try again.');
    const fallback = `Could not ${action} right now. Please try again.`;
    const response = await request(
        action === 'subscribe' ? '/api/internal/subscribe' : (
            '/api/internal/subscribe/unsubscribe-request'
        ),
        {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email: email.trim(), turnstileToken }),
            signal
        }
    );
    const result = (await response.json().catch(() => null)) as {
        message?: string;
        error?: { message?: string };
    } | null;
    if (!response.ok) throw new Error(result?.error?.message || result?.message || fallback);
    return result?.message || 'Check your inbox for the confirmation link.';
}
