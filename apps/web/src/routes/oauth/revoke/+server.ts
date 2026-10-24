import type { RequestHandler } from './$types';
import { handleRevoke } from '#lib/server/oidc/endpoints.ts';
import { oauthPreflight, oauthRoute } from '#lib/server/oidc/route.ts';

export const OPTIONS: RequestHandler = () => oauthPreflight();

export const POST: RequestHandler = event => oauthRoute(event, handleRevoke);
