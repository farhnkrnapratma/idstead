// SPDX-FileCopyrightText: 2026 Farhan Kurnia Pratama
//
// SPDX-License-Identifier: AGPL-3.0-only

export type ViewsRange = '1d' | '7d' | '30d' | '90d' | '1y';

export interface ViewsBucketRow {
    bucket: string;
    views: number;
}

export const VIEWS_RANGES: Record<ViewsRange, { label: string }> = {
    '1d': { label: '24h' },
    '7d': { label: '7d' },
    '30d': { label: '30d' },
    '90d': { label: '90d' },
    '1y': { label: '1y' }
};
