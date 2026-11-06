// SPDX-FileCopyrightText: 2026 Farhan Kurnia Pratama
//
// SPDX-License-Identifier: AGPL-3.0-only

export interface HotModule {
    data: Record<string, unknown>;
}

export function persistAcrossHmr<T>(hot: HotModule | undefined, key: string, create: () => T): T {
    const value = (hot?.data[key] as T | undefined) ?? create();
    if (hot) hot.data[key] = value;
    return value;
}
