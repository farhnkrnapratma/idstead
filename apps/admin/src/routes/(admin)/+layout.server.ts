import type { LayoutServerLoad } from './$types';

export const load: LayoutServerLoad = async ({ locals }) => {
    const admin = await locals.getAdmin();
    return {
        admin:
            admin ?
                { email: admin.email, signedInAt: new Date(admin.authTime * 1000).toISOString() }
            :   null
    };
};
