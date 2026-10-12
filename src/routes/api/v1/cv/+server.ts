import type { RequestHandler } from './$types';
import { supabase } from '#lib/supabase.ts';
import { getAuthor } from '#lib/server/api/author.ts';
import { runApi } from '#lib/server/api/responses.ts';

export const GET: RequestHandler = ({ url, request, fetch }) =>
    runApi(() => getAuthor({ url, request, fetch, db: supabase }, ['cv']));
