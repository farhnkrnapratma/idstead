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
            getAdmin: () => Promise<import('#lib/server/accessAuth.ts').AccessIdentity | null>;
        }
        interface Platform {
            env: { API_RATE_LIMITER?: RateLimit; [key: string]: unknown };
        }
    }
}

export {};
