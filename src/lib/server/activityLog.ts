export type ActivityCategory = 'profile' | 'cv' | 'skills' | 'links' | 'blog' | 'auth' | 'security';

interface ActivityLogClient {
    from: (table: string) => {
        insert: (row: Record<string, unknown>) => PromiseLike<{ error: unknown }>;
    };
}

export interface LogActivityInput {
    actor: string | null;
    action: string;
    category: ActivityCategory;
    entityId?: string | null;
    summary: string;
    details?: Record<string, unknown> | null;
    ip?: string | null;
    ipSalt?: string;
    userAgent?: string | null;
}

async function hashIp(ip: string, salt: string): Promise<string> {
    const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(ip + salt));
    return Array.from(new Uint8Array(digest), b => b.toString(16).padStart(2, '0')).join('');
}

export async function logActivity(
    input: LogActivityInput,
    db: ActivityLogClient | null
): Promise<void> {
    if (!db) {
        console.error('logActivity: no database client available');
        return;
    }

    try {
        const ipHash = input.ip && input.ipSalt ? await hashIp(input.ip, input.ipSalt) : null;
        const { error } = await db
            .from('db_activity_log')
            .insert({
                actor: input.actor,
                action: input.action,
                category: input.category,
                entity_id: input.entityId ?? null,
                summary: input.summary,
                details: input.details ?? null,
                ip: input.ip ?? null,
                ip_hash: ipHash,
                user_agent: input.userAgent?.slice(0, 300) ?? null
            });
        if (error) console.error('logActivity insert failed:', error);
    } catch (error) {
        console.error('logActivity failed:', error);
    }
}
