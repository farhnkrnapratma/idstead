import type { RequestHandler } from './$types';
import { supabase } from '#lib/supabase.ts';
import { getRoot } from '#lib/server/api/root.ts';
import { runApi } from '#lib/server/api/responses.ts';
import readme from './README.md?raw';

export const GET: RequestHandler = ({ url, request, fetch }) =>
    runApi(() => getRoot({ url, request, fetch, db: supabase }, readme));
