// SPDX-FileCopyrightText: 2026 Farhan Kurnia Pratama
//
// SPDX-License-Identifier: AGPL-3.0-only

import { isValidPostSlug } from './slug';

export const PUBLIC_ID_PATTERN = /^[0-9a-f]{64}$/;
export const PUBLIC_ID_PREFIX_PATTERN = /^[0-9a-f]{7,63}$/;

export interface PostReference {
    publicId: string | null;
    slug: string | null;
    prefix: string | null;
}

export function isPostReference(value: string): boolean {
    return PUBLIC_ID_PATTERN.test(value) || isValidPostSlug(value);
}

export function parsePostReference(reference: string): PostReference | null {
    const value = reference.trim().toLowerCase();
    if (!isPostReference(value)) return null;
    return {
        publicId: PUBLIC_ID_PATTERN.test(value) ? value : null,
        slug: isValidPostSlug(value) ? value : null,
        prefix: PUBLIC_ID_PREFIX_PATTERN.test(value) ? value : null
    };
}
