// SPDX-FileCopyrightText: 2026 Farhan Kurnia Pratama
//
// SPDX-License-Identifier: AGPL-3.0-only

export interface StoredArdIndex {
    entries: unknown;
    indexedAt: string;
}

export interface ArdIndexStore {
    read(siteUrl: string): Promise<StoredArdIndex | null>;
    write(
        siteUrl: string,
        entries: readonly unknown[],
        sources: string[],
        indexedAt: string
    ): Promise<void>;
}
