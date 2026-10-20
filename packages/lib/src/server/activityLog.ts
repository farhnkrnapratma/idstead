import { hashIp } from '@idstead/domain/hash.ts';
import { createSupabaseActivityLog } from '@idstead/data';
import type { SupabaseClient } from '@supabase/supabase-js';

export type ActivityCategory = 'profile' | 'cv' | 'skills' | 'links' | 'blog' | 'auth' | 'security';

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

export async function logActivity(
    input: LogActivityInput,
    db: SupabaseClient | null
): Promise<void> {
    if (!db) {
        console.error('logActivity: no database client available');
        return;
    }

    try {
        const ipHash = input.ip && input.ipSalt ? await hashIp(input.ip, input.ipSalt) : null;
        await createSupabaseActivityLog(db).append({
            actor: input.actor,
            action: input.action,
            category: input.category,
            entityId: input.entityId ?? null,
            summary: input.summary,
            details: input.details ?? null,
            ip: input.ip ?? null,
            ipHash,
            userAgent: input.userAgent?.slice(0, 300) ?? null
        });
    } catch (error) {
        console.error('logActivity failed:', error);
    }
}
