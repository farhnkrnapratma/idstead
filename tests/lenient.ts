// SPDX-FileCopyrightText: 2026 Farhan Kurnia Pratama
//
// SPDX-License-Identifier: AGPL-3.0-only

export function lenient(width = 0): unknown {
    const target = function () {};
    return new Proxy(target, {
        get(_, key) {
            if (key === Symbol.toPrimitive)
                return (hint: string) =>
                    width === 0 ? ''
                    : hint === 'number' ? 0
                    : '2026-01-01T00:00:00.000Z';
            if (key === Symbol.iterator)
                return function* () {
                    for (let index = 0; index < width; index++) yield lenient(width);
                };
            if (key === 'then') return undefined;
            if (key === 'length') return width;
            return lenient(width);
        },
        apply: () => lenient(width),
        has: () => true
    });
}
