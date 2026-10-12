import { workerBinding, type RateLimit } from '#lib/server/workerEnv.ts';

export const RATE_LIMIT_WINDOW_MS = 60 * 1000;
export const MAX_REQUESTS_PER_WINDOW = 60;

const records = new Map<string, number[]>();

export function clientIp(request: Request, fallback?: () => string): string {
    try {
        return (
            request.headers.get('cf-connecting-ip')
            || request.headers.get('x-forwarded-for')?.split(',')[0].trim()
            || fallback?.()
            || '127.0.0.1'
        );
    } catch {
        return '127.0.0.1';
    }
}

export type RateLimitResult =
    | { limited: false; headers: Record<string, string> }
    | { limited: true; headers: Record<string, string> };

export async function checkRateLimit(key: string): Promise<RateLimitResult> {
    const now = Date.now();
    for (const [entry, times] of records)
        if (!times.some(time => time > now - RATE_LIMIT_WINDOW_MS)) records.delete(entry);
    if (records.size >= 10000 && !records.has(key)) records.delete(records.keys().next().value!);
    const times = (records.get(key) ?? []).filter(time => now - time < RATE_LIMIT_WINDOW_MS);

    const limiter = await workerBinding<RateLimit>('API_RATE_LIMITER');
    const limited =
        limiter ? !(await limiter.limit({ key })).success : times.length >= MAX_REQUESTS_PER_WINDOW;

    if (limited) {
        const resetSeconds = Math.max(
            1,
            Math.ceil(((times[0] ?? now) + RATE_LIMIT_WINDOW_MS - now) / 1000)
        );
        return {
            limited: true,
            headers: {
                'Retry-After': String(resetSeconds),
                'X-RateLimit-Limit': String(MAX_REQUESTS_PER_WINDOW),
                'X-RateLimit-Remaining': '0',
                'X-RateLimit-Reset': String(Math.floor((now + resetSeconds * 1000) / 1000))
            }
        };
    }

    times.push(now);
    records.set(key, times);
    return {
        limited: false,
        headers: {
            'X-RateLimit-Limit': String(MAX_REQUESTS_PER_WINDOW),
            'X-RateLimit-Remaining': String(MAX_REQUESTS_PER_WINDOW - times.length),
            'X-RateLimit-Reset': String(Math.floor((now + RATE_LIMIT_WINDOW_MS) / 1000))
        }
    };
}
