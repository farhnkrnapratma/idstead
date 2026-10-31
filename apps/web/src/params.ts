// SPDX-FileCopyrightText: 2026 Farhan Kurnia Pratama
//
// SPDX-License-Identifier: AGPL-3.0-only

import { defineParams } from '@sveltejs/kit/params';
import { isLegalSlug } from '@idstead/domain/legal.ts';

export const params = defineParams({
    legal: (param: string) => (isLegalSlug(param) ? param : undefined),
    textformat: (param: string) => (param === 'md' || param === 'txt' ? param : undefined)
});
