// SPDX-FileCopyrightText: 2026 Farhan Kurnia Pratama
//
// SPDX-License-Identifier: AGPL-3.0-only

export interface RateLimit {
    limit(options: { key: string }): Promise<{ success: boolean }>;
}

type WorkersModule = typeof import('cloudflare:workers');

let workersModule: Promise<WorkersModule | null> | undefined;

function loadWorkersModule(): Promise<WorkersModule | null> {
    workersModule ??= import('cloudflare:workers').then(
        module => module,
        () => null
    );
    return workersModule;
}

export async function workerBinding<T = unknown>(name: string): Promise<T | undefined> {
    const module = await loadWorkersModule();
    if (!module) return undefined;
    try {
        return ((module.env as Record<string, unknown>)[name] ?? undefined) as T | undefined;
    } catch {
        return undefined;
    }
}

export async function runInBackground(task: Promise<unknown>): Promise<void> {
    const module = await loadWorkersModule();
    if (module) module.waitUntil(task);
}
