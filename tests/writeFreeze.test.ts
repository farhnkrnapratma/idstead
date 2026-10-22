import { describe, expect, mock, test } from 'bun:test';

mock.module('$app/env/private', () => ({}));

const { frozenWriteResponse, isFrozenWrite, writesFrozen } =
    await import('../packages/lib/src/server/writeFreeze.ts');

const { apiErrorEnvelope } = await import('../packages/lib/src/server/apiEnvelope.ts');

const frozen = { env: { WRITES_FROZEN: '1' } };
const open = { env: { WRITES_FROZEN: '' } };

function request(method: string) {
    return new Request('https://example.com/api/internal/blog/comments', { method });
}

describe('write freeze', () => {
    test('reads WRITES_FROZEN as on only for 1 or true', () => {
        expect(writesFrozen(frozen)).toBe(true);
        expect(writesFrozen({ env: { WRITES_FROZEN: 'TRUE' } })).toBe(true);
        expect(writesFrozen({ env: { WRITES_FROZEN: '0' } })).toBe(false);
        expect(writesFrozen(open)).toBe(false);
    });

    test('blocks only writes to the internal API while frozen', () => {
        const url = new URL('https://example.com/api/internal/blog/comments');
        expect(isFrozenWrite(request('POST'), url, frozen)).toBe(true);
        expect(isFrozenWrite(request('DELETE'), url, frozen)).toBe(true);
        expect(isFrozenWrite(request('GET'), url, frozen)).toBe(false);
        expect(isFrozenWrite(request('OPTIONS'), url, frozen)).toBe(false);
        expect(isFrozenWrite(request('POST'), url, open)).toBe(false);
        expect(
            isFrozenWrite(request('POST'), new URL('https://example.com/subscribe'), frozen)
        ).toBe(false);
    });

    test('answers 503 MAINTENANCE with a retry hint', async () => {
        const response = frozenWriteResponse();
        expect(response.status).toBe(503);
        expect(response.headers.get('Retry-After')).toBe('60');
        expect(await response.json()).toEqual({
            code: 'MAINTENANCE',
            message: 'Changes are paused for maintenance. Try again in a few minutes.'
        });
    });

    test('keeps the retry hint when the response is wrapped in the error envelope', async () => {
        const wrapped = await apiErrorEnvelope(frozenWriteResponse(), { requestId: 'req-1' });
        expect(wrapped.status).toBe(503);
        expect(wrapped.headers.get('Retry-After')).toBe('60');
        expect(await wrapped.json()).toEqual({
            error: {
                code: 'MAINTENANCE',
                message: 'Changes are paused for maintenance. Try again in a few minutes.'
            }
        });
    });
});
