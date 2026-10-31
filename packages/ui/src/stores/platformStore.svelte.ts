// SPDX-FileCopyrightText: 2026 Farhan Kurnia Pratama
//
// SPDX-License-Identifier: AGPL-3.0-only

import { detectPlatform, type Platform } from '../platform.ts';

let current = $state<Platform>('other');

export const platformStore = {
    get current() {
        return current;
    },
    detect() {
        if (typeof navigator === 'undefined') return;
        current = detectPlatform(
            navigator as Navigator & { userAgentData?: { platform?: string } }
        );
    }
};
