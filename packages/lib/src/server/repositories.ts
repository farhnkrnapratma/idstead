// SPDX-FileCopyrightText: 2026 Farhan Kurnia Pratama
//
// SPDX-License-Identifier: AGPL-3.0-only

import type { Repositories, Writers } from '@idstead/data';
import { dataStores } from './data';

export function publicRepositories(fetchFn: typeof fetch = fetch): Repositories {
    return dataStores(undefined, { fetch: fetchFn }).public;
}

export function serviceData(platform?: unknown): (Repositories & { writers: Writers }) | null {
    return dataStores(platform).service;
}
