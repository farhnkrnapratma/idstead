import type { Repositories, Writers } from '@idstead/data';
import { dataStores } from './data';

export function publicRepositories(fetchFn: typeof fetch = fetch): Repositories {
    return dataStores(undefined, { fetch: fetchFn }).public;
}

export function serviceData(platform?: unknown): (Repositories & { writers: Writers }) | null {
    return dataStores(platform).service;
}
