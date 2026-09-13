import {page} from '$app/state';
import {pushState, replaceState} from '$app/navigation';
import {resolve} from '$app/paths';

export function adminUrl() {
  const url = new URL(page.url);
  if (typeof page.state.adminSearch === 'string')
    url.search = page.state.adminSearch;
  return url;
}

export function navigateAdmin(url: URL, replace = false) {
  const scroll = document.getElementById('main-content')?.scrollTop ?? 0;
  if (!replace) replaceState('', {...page.state, adminScroll: scroll});
  const state = {
    ...page.state,
    adminSearch: url.search,
    adminScroll: replace ? scroll : 0
  };
  (replace ? replaceState : pushState)(
    resolve(`/admin?${url.searchParams}`),
    state
  );
}
