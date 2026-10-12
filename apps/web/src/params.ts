import { defineParams } from '@sveltejs/kit/params';

export const params = defineParams({
    legal: (param: string) =>
        param === 'privacy' || param === 'terms' || param === 'security' ? param : undefined,
    textformat: (param: string) => (param === 'md' || param === 'txt' ? param : undefined)
});
