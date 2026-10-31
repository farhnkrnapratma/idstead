// SPDX-FileCopyrightText: 2026 Farhan Kurnia Pratama
//
// SPDX-License-Identifier: AGPL-3.0-only

export const PRODUCT_NAME = 'Idstead';

export function copyrightLine(name: string | null | undefined, year: number): string {
    const holder = name?.trim() || PRODUCT_NAME;
    return `© ${year} ${holder}.`;
}
