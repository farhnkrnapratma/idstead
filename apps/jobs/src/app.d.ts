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
        interface Platform {
            env: { AI?: unknown; API_RATE_LIMITER?: RateLimit; [key: string]: unknown };
        }
    }
}

export {};
