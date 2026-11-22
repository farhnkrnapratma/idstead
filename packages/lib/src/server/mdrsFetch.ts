// SPDX-FileCopyrightText: 2026 Farhan Kurnia Pratama
//
// SPDX-License-Identifier: AGPL-3.0-only

import { DefineError, checkGetUrl } from '@mdrs/core';

const MAX_JSON_BYTES = 256_000;
const TIMEOUT_MS = 5000;

export async function fetchJson(value: string): Promise<unknown> {
    const url = checkGetUrl(value);
    const response = await fetch(url, {
        headers: { Accept: 'application/json' },
        redirect: 'error',
        signal: AbortSignal.timeout(TIMEOUT_MS)
    }).catch(() => {
        throw new DefineError(`get() could not reach ${url}`);
    });
    if (!response.ok) throw new DefineError(`get() received HTTP ${response.status} from ${url}`);
    if (!/[/+]json\b/i.test(response.headers.get('content-type') ?? ''))
        throw new DefineError(`get() requires a JSON response from ${url}`);
    if (Number(response.headers.get('content-length') ?? 0) > MAX_JSON_BYTES)
        throw new DefineError(`get() response from ${url} is larger than 256 KB`);
    const text = await response.text();
    if (new TextEncoder().encode(text).length > MAX_JSON_BYTES)
        throw new DefineError(`get() response from ${url} is larger than 256 KB`);
    try {
        return JSON.parse(text) as unknown;
    } catch {
        throw new DefineError(`get() received invalid JSON from ${url}`);
    }
}
