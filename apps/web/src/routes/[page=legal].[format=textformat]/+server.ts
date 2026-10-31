// SPDX-FileCopyrightText: 2026 Farhan Kurnia Pratama
//
// SPDX-License-Identifier: AGPL-3.0-only

import type { RequestHandler } from './$types';
import { legalDocument } from '#lib/server/rawDocuments.ts';

export const GET: RequestHandler = ({ params }) => legalDocument(params.page, params.format);
