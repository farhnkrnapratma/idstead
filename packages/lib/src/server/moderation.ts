// SPDX-FileCopyrightText: 2026 Farhan Kurnia Pratama
//
// SPDX-License-Identifier: AGPL-3.0-only

import * as Sentry from '@sentry/sveltekit';
import { MODERATION_MODEL } from '#lib/server/aiModels.ts';

export interface ModerationResult {
    safe: boolean;
    categories: string[];
    engine: 'llama-guard-3';
}

export async function moderateContent(
    content: string,
    ai: unknown
): Promise<ModerationResult | null> {
    if (!ai || typeof (ai as { run?: unknown }).run !== 'function') {
        return null;
    }

    try {
        const runner = ai as { run: (model: string, input: unknown) => Promise<unknown> };
        const result = await runner.run(MODERATION_MODEL, {
            messages: [{ role: 'user', content }],
            max_tokens: 128,
            temperature: 0
        });
        return parseModeration((result as { response?: unknown })?.response);
    } catch (err) {
        console.error('Llama Guard moderation failed:', err);
        Sentry.captureException(err);
        return null;
    }
}

export function parseModeration(response: unknown): ModerationResult | null {
    if (response && typeof response === 'object') {
        const verdict = response as { safe?: unknown; categories?: unknown };
        if (typeof verdict.safe !== 'boolean') return null;
        const categories =
            Array.isArray(verdict.categories) ?
                verdict.categories.filter((c): c is string => typeof c === 'string')
            :   [];
        return { safe: verdict.safe, categories, engine: 'llama-guard-3' };
    }
    if (typeof response !== 'string') return null;
    const [verdict = '', categoryLine = ''] = response.trim().toLowerCase().split('\n');
    if (verdict.trim() === 'safe') return { safe: true, categories: [], engine: 'llama-guard-3' };
    const categories = categoryLine
        .split(',')
        .map(s => s.trim().toUpperCase())
        .filter(Boolean);
    return { safe: false, categories, engine: 'llama-guard-3' };
}
