import { accessConfig } from '#lib/server/accessAuth.ts';
import type { LayoutServerLoad } from './$types';

export const load: LayoutServerLoad = async ({ locals, platform }) => {
    const admin = await locals.getAdmin();
    return {
        admin:
            admin ?
                { email: admin.email, signedInAt: new Date(admin.authTime * 1000).toISOString() }
            :   null,
        accessTeamDomain: accessConfig(platform)?.teamDomain ?? null
    };
};
