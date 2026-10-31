// SPDX-FileCopyrightText: 2026 Farhan Kurnia Pratama
//
// SPDX-License-Identifier: AGPL-3.0-only

import { adminActivity } from '#lib/server/adminActivity.ts';
import type { RequestHandler } from './$types';
export const GET: RequestHandler = ({ request, url, platform }) =>
    adminActivity({ request, url, platform }, true);
export const POST = GET;
