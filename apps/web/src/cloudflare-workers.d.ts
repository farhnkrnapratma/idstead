// SPDX-FileCopyrightText: 2026 Farhan Kurnia Pratama
//
// SPDX-License-Identifier: AGPL-3.0-only

declare module 'cloudflare:workers' {
    export const env: Record<string, unknown>;
    export function waitUntil(promise: Promise<unknown>): void;
}
