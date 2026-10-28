import { defineParams } from '@sveltejs/kit/params';
import { isLegalSlug } from '@idstead/domain/legal.ts';

export const params = defineParams({
    legal: (param: string) => (isLegalSlug(param) ? param : undefined),
    textformat: (param: string) => (param === 'md' || param === 'txt' ? param : undefined)
});
