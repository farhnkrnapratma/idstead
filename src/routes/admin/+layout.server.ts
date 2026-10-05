import {redirect} from '@sveltejs/kit';
import type {LayoutServerLoad} from './$types';

export const load: LayoutServerLoad = async ({locals, url}) => {
  const session = await locals.getAdminSession();

  if (url.pathname === '/admin/login') {
    if (session?.role === 'admin' && session.mfaSatisfied)
      redirect(303, '/admin');
    return {session: null};
  }

  if (!session || !session.mfaSatisfied)
    redirect(
      303,
      `/admin/login?redirectTo=${encodeURIComponent(url.pathname + url.search)}`
    );

  if (session.role !== 'admin') redirect(303, '/admin/login');

  return {session};
};
