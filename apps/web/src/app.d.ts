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
            permalink?: string;
        }
        interface Locals {
            supabase: import('#lib/server/supabaseAuth.ts').AuthClient;
            getAdminSession: () => Promise<
                import('#lib/server/supabaseAuth.ts').AdminSession | null
            >;
        }
        interface Platform {
            env: { AI?: unknown; API_RATE_LIMITER?: RateLimit; [key: string]: unknown };
        }
    }
}

export {};
