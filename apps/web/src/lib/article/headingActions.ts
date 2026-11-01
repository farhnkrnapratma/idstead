// SPDX-FileCopyrightText: 2026 Farhan Kurnia Pratama
//
// SPDX-License-Identifier: AGPL-3.0-only

import { mount, unmount } from 'svelte';
import { resolveMdrsHash, type HeadingLink } from '@mdrs/dom/headingAnchors.ts';
import HeadingActions from './HeadingActions.svelte';

export function mountHeadingActions(pageSlug: string, container: HTMLElement) {
    const activeId = resolveMdrsHash(window.location.hash, container)?.id;
    return (slot: HTMLElement, link: HeadingLink) => {
        const component = mount(HeadingActions, {
            target: slot,
            props: {
                href: `#${link.fragment}`,
                url: link.url,
                title: link.text,
                qrSlug: `${pageSlug}-${link.fragment}`,
                active: link.id === activeId
            }
        });
        return () => void unmount(component);
    };
}
