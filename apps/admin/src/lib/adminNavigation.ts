import { page } from '$app/state';
import { goto } from '$app/navigation';
import { cleanAdminParams } from './adminUrl';

export function adminUrl() {
    const url = new URL(page.url.href);
    if (typeof page.state.adminSearch === 'string') url.search = page.state.adminSearch;
    return url;
}

export async function navigateAdmin(url: URL, replace = false) {
    const scroll = document.getElementById('main')?.scrollTop ?? 0;
    if (!replace)
        await goto('', {
            state: { ...page.state, adminScroll: scroll },
            shallow: true,
            replace: true
        });
    const query = cleanAdminParams(url.searchParams).toString();
    const state = {
        ...page.state,
        adminSearch: query ? `?${query}` : '',
        adminScroll: replace ? scroll : 0
    };
    await goto(query ? `/?${query}` : '/', { state, shallow: true, replace });
}
