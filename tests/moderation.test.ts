import { describe, expect, mock, test } from 'bun:test';

mock.module('@sentry/sveltekit', () => ({ captureException: () => {} }));

const { moderateContent, parseModeration } =
    await import('../packages/lib/src/server/moderation.ts');

describe('Llama Guard moderation', () => {
    test('accepts the plain-text safe verdict the model returns', () => {
        expect(parseModeration('\n\nsafe')).toEqual({
            safe: true,
            categories: [],
            engine: 'llama-guard-3'
        });
    });

    test('reads hazard categories from an unsafe plain-text verdict', () => {
        expect(parseModeration('unsafe\nS1,s10')).toEqual({
            safe: false,
            categories: ['S1', 'S10'],
            engine: 'llama-guard-3'
        });
    });

    test('accepts the JSON verdict shape', () => {
        expect(parseModeration({ safe: false, categories: ['S2', 3] })).toEqual({
            safe: false,
            categories: ['S2'],
            engine: 'llama-guard-3'
        });
    });

    test('holds unexpected text back instead of publishing it', () => {
        expect(parseModeration('[object Object]')?.safe).toBe(false);
    });

    test('reports moderation as unavailable when the verdict is unreadable', () => {
        expect(parseModeration({ verdict: 'safe' })).toBeNull();
        expect(parseModeration(undefined)).toBeNull();
    });

    test('reports moderation as unavailable without an AI binding or on model failure', async () => {
        expect(await moderateContent('hello', undefined)).toBeNull();
        const failing = {
            run: async () => {
                throw new Error('model unavailable');
            }
        };
        expect(await moderateContent('hello', failing)).toBeNull();
    });
});
