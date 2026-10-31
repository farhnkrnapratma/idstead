// SPDX-FileCopyrightText: 2026 Farhan Kurnia Pratama
//
// SPDX-License-Identifier: AGPL-3.0-only

export interface LockoutStore {
    retryAfter(keys: string[]): Promise<number>;
    recordFailure(keys: string[]): Promise<void>;
    clear(keys: string[]): Promise<void>;
}
