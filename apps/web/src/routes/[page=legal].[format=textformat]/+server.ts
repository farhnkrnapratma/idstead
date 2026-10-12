import type { RequestHandler } from './$types';
import { legalDocument } from '#lib/server/rawDocuments.ts';

export const GET: RequestHandler = ({ params }) => legalDocument(params.page, params.format);
