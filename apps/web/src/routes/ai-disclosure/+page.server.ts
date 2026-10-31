import type { PageServerLoad } from './$types';
import { loadLegalPage } from '#lib/server/legalPages.ts';

export const load: PageServerLoad = ({ url }) => loadLegalPage('ai-disclosure', url.origin);
