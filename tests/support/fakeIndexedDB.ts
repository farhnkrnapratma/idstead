// SPDX-FileCopyrightText: 2026 Farhan Kurnia Pratama
//
// SPDX-License-Identifier: AGPL-3.0-only

export function installIndexedDB(
    options: { openError?: boolean; txError?: boolean; abort?: boolean; getError?: boolean } = {}
) {
    const stores = new Map<string, unknown>();
    globalThis.indexedDB = {
        open() {
            const request: Record<string, unknown> & { result?: unknown } = {};
            queueMicrotask(() => {
                if (options.openError) return (request.onerror as () => void)?.();
                request.result = {
                    transaction() {
                        const transaction: Record<string, unknown> = {
                            error: new Error('transaction')
                        };
                        const objectStore = {
                            put: (value: unknown, key: string) => void stores.set(key, value),
                            delete: (key: string) => void stores.delete(key),
                            get(key: string) {
                                const get: Record<string, unknown> & {
                                    result?: unknown;
                                    error?: unknown;
                                } = { result: stores.get(key) };
                                queueMicrotask(() => {
                                    if (options.getError) {
                                        get.error = new Error('get');
                                        (get.onerror as () => void)?.();
                                    } else (get.onsuccess as () => void)?.();
                                });
                                return get;
                            }
                        };
                        queueMicrotask(() => {
                            if (options.txError) (transaction.onerror as () => void)?.();
                            else if (options.abort) (transaction.onabort as () => void)?.();
                            else (transaction.oncomplete as () => void)?.();
                        });
                        return Object.assign(transaction, { objectStore: () => objectStore });
                    },
                    createObjectStore() {},
                    close() {}
                };
                (request.onupgradeneeded as () => void)?.();
                (request.onsuccess as () => void)?.();
            });
            return request;
        }
    } as unknown as IDBFactory;
    return stores;
}
