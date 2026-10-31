// SPDX-FileCopyrightText: 2026 Farhan Kurnia Pratama
//
// SPDX-License-Identifier: AGPL-3.0-only

import type { RequestHandler } from './$types';
import { handleRevoke } from '#lib/server/oidc/endpoints.ts';
import { oauthPreflight, oauthRoute } from '#lib/server/oidc/route.ts';

export const OPTIONS: RequestHandler = () => oauthPreflight();

export const POST: RequestHandler = event => oauthRoute(event, handleRevoke, { writes: true });
