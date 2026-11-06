// SPDX-FileCopyrightText: 2026 Farhan Kurnia Pratama
//
// SPDX-License-Identifier: AGPL-3.0-only

export function lenient(): unknown {
    const target = function () {};
    return new Proxy(target, {
        get(_, key) {
            if (key === Symbol.toPrimitive) return () => '';
            if (key === Symbol.iterator) return function* () {};
            if (key === 'then') return undefined;
            if (key === 'length') return 0;
            return lenient();
        },
        apply: () => lenient(),
        has: () => true
    });
}
