import { supabase } from '#lib/supabase.ts';
import { requiredText } from '@fkp/domain/fieldValidation.ts';

const VALIDATE_ENDPOINT = '/api/internal/blog/validate-define';
const MAX_SHOWN_ERRORS = 3;

function readMessages(body: unknown): string[] {
    if (!body || typeof body !== 'object') return [];
    const record = body as Record<string, unknown>;
    const source =
        record.error && typeof record.error === 'object' ?
            (record.error as Record<string, unknown>)
        :   record;
    const details = typeof source.details === 'string' ? source.details : '';
    const message = typeof source.message === 'string' ? source.message : '';
    return (details || message).split(/\n| \| /).filter(Boolean);
}

export async function validateMdrsRemote(markdown: string): Promise<string> {
    if (!markdown.trim()) return '';
    const { data } = await supabase.auth.getSession();
    const accessToken = data.session?.access_token;
    if (!accessToken) return '';
    let response: Response;
    try {
        response = await fetch(VALIDATE_ENDPOINT, {
            method: 'POST',
            headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({ markdown })
        });
    } catch {
        return '';
    }
    if (response.status !== 422) return '';
    const messages = readMessages(await response.json().catch(() => null));
    if (!messages.length) return 'The document has MDRS errors.';
    const shown = messages.slice(0, MAX_SHOWN_ERRORS).join(' · ');
    const hidden = messages.length - MAX_SHOWN_ERRORS;
    return hidden > 0 ? `${shown} (+${hidden} more)` : shown;
}

export const mdrsContent = (label: string) => async (value: string) =>
    requiredText(label)(value) || validateMdrsRemote(value);
