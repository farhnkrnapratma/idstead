// SPDX-FileCopyrightText: 2026 Farhan Kurnia Pratama
//
// SPDX-License-Identifier: AGPL-3.0-only

export function pluralize(
    count: number,
    singular: string,
    plural: string = `${singular}s`,
    format: (count: number) => string = String
): string {
    return `${format(count)} ${count === 1 ? singular : plural}`;
}
