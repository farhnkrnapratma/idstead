// SPDX-FileCopyrightText: 2026 Farhan Kurnia Pratama
//
// SPDX-License-Identifier: MIT OR Apache-2.0

import { MAX_GET_URLS } from '../limits';
import { DefineError } from './errors';

export type JsonFetcher = (url: string) => Promise<unknown>;

export function unavailableFetcher(): JsonFetcher {
    return async () => {
        throw new DefineError('Network access is unavailable in this context.');
    };
}

function isPrivateIpv4(host: string): boolean {
    const match = host.match(/^(\d+)\.(\d+)\.\d+\.\d+$/);
    if (!match) return false;
    const a = Number(match[1]);
    const b = Number(match[2]);
    return (
        a === 0 ||
        a === 10 ||
        a === 127 ||
        a >= 224 ||
        (a === 100 && b >= 64 && b <= 127) ||
        (a === 169 && b === 254) ||
        (a === 172 && b >= 16 && b <= 31) ||
        (a === 192 && b === 168)
    );
}

function isPublicHost(hostname: string): boolean {
    const host = hostname.toLowerCase().replace(/\.$/, '');
    if (host === 'localhost' || host.endsWith('.localhost')) return false;
    if (host.startsWith('[')) return false;
    return !isPrivateIpv4(host);
}

export function checkGetUrl(value: string): string {
    let url: URL;
    try {
        url = new URL(value);
    } catch {
        throw new DefineError(`get() URL '${value}' is not a valid URL`);
    }
    if (url.protocol !== 'https:') throw new DefineError(`get() URL '${value}' must use https`);
    if (url.username || url.password)
        throw new DefineError(`get() URL '${value}' must not contain credentials`);
    if (!isPublicHost(url.hostname))
        throw new DefineError(`get() URL '${value}' must point to a public host`);
    return url.href;
}

export function documentFetcher(fetcher: JsonFetcher): JsonFetcher {
    const requests = new Map<string, Promise<unknown>>();
    return async value => {
        const url = checkGetUrl(value);
        let request = requests.get(url);
        if (!request) {
            if (requests.size >= MAX_GET_URLS)
                throw new DefineError(
                    `A document can call get() with at most ${MAX_GET_URLS} different URLs`
                );
            request = fetcher(url);
            requests.set(url, request);
        }
        return request;
    };
}
