// SPDX-FileCopyrightText: 2026 Farhan Kurnia Pratama
//
// SPDX-License-Identifier: AGPL-3.0-only

import type { PageServerLoad } from './$types';
import { loadLegalPage } from '#lib/server/legalPages.ts';

export const load: PageServerLoad = ({ url }) => loadLegalPage('security', url.origin);
