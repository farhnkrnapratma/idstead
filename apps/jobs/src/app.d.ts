interface R2Object {
    key: string;
    version: string;
    size: number;
    etag: string;
    httpEtag: string;
    uploaded: Date;
}

interface R2Bucket {
    put(
        key: string,
        value: ReadableStream | ArrayBuffer | ArrayBufferView | string | Blob,
        options?: {
            httpMetadata?: {
                contentType?: string;
                contentLanguage?: string;
                contentDisposition?: string;
                contentEncoding?: string;
                cacheControl?: string;
            };
            customMetadata?: Record<string, string>;
        }
    ): Promise<R2Object | null>;
    delete(keys: string | string[]): Promise<void>;
    get(key: string): Promise<R2Object | null>;
}

interface RateLimit {
    limit(options: { key: string }): Promise<{ success: boolean }>;
}

declare global {
    namespace App {
        interface Error {
            message: string;
            code?: string;
            details?: string;
        }
        interface PageState {
            adminSearch?: string;
            adminScroll?: number;
        }
        interface Locals {
            supabase: import('#lib/server/supabaseAuth.ts').AuthClient;
            getAdminSession: () => Promise<
                import('#lib/server/supabaseAuth.ts').AdminSession | null
            >;
        }
        interface Platform {
            env: {
                GITHUB_TOKEN?: string;
                AI?: unknown;
                R2_BUCKET?: R2Bucket;
                MY_BUCKET?: R2Bucket;
                API_RATE_LIMITER?: RateLimit;
                TURNSTILE_SECRET?: string;
                [key: string]: unknown;
            };
        }
    }
}

export {};
