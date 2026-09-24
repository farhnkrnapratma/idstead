import {page} from '$app/state';
import {pushState, replaceState} from '$app/navigation';
import {resolve} from '$app/paths';
import {cleanAdminParams} from './adminUrl';

export function adminUrl() {
  const url = new URL(page.url);
  if (typeof page.state.adminSearch === 'string')
    url.search = page.state.adminSearch;
  return url;
}

export function navigateAdmin(url: URL, replace = false) {
  const scroll = document.getElementById('main-content')?.scrollTop ?? 0;
  if (!replace) replaceState('', {...page.state, adminScroll: scroll});
  const query = cleanAdminParams(url.searchParams).toString();
  const state = {
    ...page.state,
    adminSearch: query ? `?${query}` : '',
    adminScroll: replace ? scroll : 0
  };
  (replace ? replaceState : pushState)(
    query ? resolve(`/admin?${query}`) : resolve('/admin'),
    state
  );
}
