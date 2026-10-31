// SPDX-FileCopyrightText: 2026 Farhan Kurnia Pratama
//
// SPDX-License-Identifier: AGPL-3.0-only

import { adminWorkspace } from '#lib/server/adminWorkspace.ts';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = ({ request, url, platform, getClientAddress }) =>
    adminWorkspace({ request, url, platform, getClientAddress });
export const POST = GET;
