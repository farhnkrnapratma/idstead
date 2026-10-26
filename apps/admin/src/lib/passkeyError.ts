const DISMISSED_PROMPTS = new Set(['NotAllowedError', 'AbortError']);

export function passkeyErrorMessage(error: unknown, fallback: string): string {
    if (!(error instanceof Error)) return fallback;
    if (DISMISSED_PROMPTS.has(error.name)) return 'Passkey request canceled or timed out.';
    return error.message || fallback;
}
