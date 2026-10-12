import type { RequestHandler } from './$types';
import { supabase } from '#lib/supabase.ts';
import { getBlogContent } from '#lib/server/api/blog.ts';
import { runApi } from '#lib/server/api/responses.ts';

export const GET: RequestHandler = ({ url, request, fetch }) =>
    runApi(() => getBlogContent({ url, request, fetch, db: supabase }));
