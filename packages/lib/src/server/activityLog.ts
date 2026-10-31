import { hashIp } from '@idstead/domain/hash.ts';
import type { ActivityLog } from '@idstead/data';

export type ActivityCategory =
    'profile' | 'resume' | 'skills' | 'links' | 'blog' | 'security' | 'settings';

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

export function clientAddress(getClientAddress?: () => string): string | null {
    if (!getClientAddress) return null;
    try {
        return getClientAddress() || null;
    } catch {
        return null;
    }
}

export async function logActivity(
    input: LogActivityInput,
    log: ActivityLog | null | undefined
): Promise<void> {
    if (!log) {
        console.error('logActivity: no activity log available');
        return;
    }

    try {
        const ipHash = input.ip && input.ipSalt ? await hashIp(input.ip, input.ipSalt) : null;
        await log.append({
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
