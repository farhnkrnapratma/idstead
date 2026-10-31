// SPDX-FileCopyrightText: 2026 Farhan Kurnia Pratama
//
// SPDX-License-Identifier: AGPL-3.0-only

import type { RequestHandler } from './$types';
import { blogDocument } from '#lib/server/rawDocuments.ts';

export const GET: RequestHandler = ({ params, fetch }) =>
    blogDocument(params.slug, params.format, fetch);
