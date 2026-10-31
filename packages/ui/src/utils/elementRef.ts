// SPDX-FileCopyrightText: 2026 Farhan Kurnia Pratama
//
// SPDX-License-Identifier: AGPL-3.0-only

import type { Attachment } from 'svelte/attachments';

export function elementRef<T extends Element>(assign: (node: T | null) => void): Attachment<T> {
    return node => {
        assign(node);
        return () => assign(null);
    };
}
