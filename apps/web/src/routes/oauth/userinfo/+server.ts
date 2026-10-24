import type { RequestHandler } from './$types';
import { handleUserinfo } from '#lib/server/oidc/endpoints.ts';
import { oauthPreflight, oauthRoute } from '#lib/server/oidc/route.ts';

export const OPTIONS: RequestHandler = () => oauthPreflight();

export const GET: RequestHandler = event => oauthRoute(event, handleUserinfo);

export const POST: RequestHandler = event => oauthRoute(event, handleUserinfo);
