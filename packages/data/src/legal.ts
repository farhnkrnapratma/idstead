// SPDX-FileCopyrightText: 2026 Farhan Kurnia Pratama
//
// SPDX-License-Identifier: AGPL-3.0-only

export type { LegalSlug } from '@idstead/domain/legal.ts';
import type { LegalSlug } from '@idstead/domain/legal.ts';

export interface LegalPage {
    slug: string;
    title: string;
    content: string;
    updated_at?: string;
}

export interface LegalPageRepository {
    page(slug: string): Promise<LegalPage | null>;
    pages(): Promise<LegalPage[]>;
}

export type LegalPageSave = { status: 'saved' } | { status: 'rejected'; message: string };

export interface LegalPageWriter {
    save(page: { slug: LegalSlug; title: string; content: string }): Promise<LegalPageSave>;
}
