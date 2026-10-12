import type { RequestHandler } from './$types';
import { blogDocument } from '#lib/server/rawDocuments.ts';

export const GET: RequestHandler = ({ params, fetch }) =>
    blogDocument(params.slug, params.format, fetch);
