import { describe, expect, test } from 'bun:test';
import type { SupabaseClient } from '@supabase/supabase-js';
import { createSupabaseAdminAuthorStore } from '../packages/data/src/supabase/adminAuthor.ts';

describe('author data loading', () => {
    test('loads experience and education concurrently', async () => {
        const requested: string[] = [];
        const pending = new Map<string, (result: { data: unknown[]; error: null }) => void>();
        const supabaseClient = {
            from(table: string) {
                return {
                    select() {
                        return {
                            order() {
                                requested.push(table);
                                return new Promise<{ data: unknown[]; error: null }>(resolve => {
                                    pending.set(table, resolve);
                                });
                            }
                        };
                    }
                };
            }
        };

        const cvPromise = createSupabaseAdminAuthorStore(
            supabaseClient as unknown as SupabaseClient
        ).cvEntries();

        expect(requested).toEqual(['db_experiences', 'db_educations']);

        pending.get('db_experiences')?.({ data: [], error: null });
        pending.get('db_educations')?.({ data: [], error: null });

        await expect(cvPromise).resolves.toEqual({ experience: [], education: [] });
    });
});
