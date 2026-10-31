// SPDX-FileCopyrightText: 2026 Farhan Kurnia Pratama
//
// SPDX-License-Identifier: AGPL-3.0-only

export function siteOrigin(value: string | null | undefined): string | null {
    if (!value?.trim()) return null;
    try {
        const url = new URL(value.trim());
        if (!['https:', 'http:'].includes(url.protocol) || url.username || url.password)
            return null;
        return url.origin;
    } catch {
        return null;
    }
}
