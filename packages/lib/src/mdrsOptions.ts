// SPDX-FileCopyrightText: 2026 Farhan Kurnia Pratama
//
// SPDX-License-Identifier: AGPL-3.0-only

import type { RenderOptions } from '@mdrs/core';

export function siteRenderOptions(siteUrl: string | null | undefined): RenderOptions {
    let url: URL;
    try {
        url = new URL(siteUrl ?? '');
    } catch {
        return {};
    }
    const host = url.hostname.replace(/^www\./, '');
    return { internalOrigins: [`${url.protocol}//${host}`, `${url.protocol}//www.${host}`] };
}
