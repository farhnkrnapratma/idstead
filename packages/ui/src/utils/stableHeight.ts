import type { Attachment } from 'svelte/attachments';

export const stableHeight: Attachment<HTMLElement> = node => {
    let skeletonHeight = 0;
    let watched: Element | null = null;
    const resize = new ResizeObserver(entries => {
        for (const entry of entries)
            skeletonHeight = entry.borderBoxSize[0]?.blockSize ?? skeletonHeight;
    });

    const sync = () => {
        const busy = node.querySelector('[aria-busy="true"]');
        if (busy !== watched) {
            if (watched) resize.unobserve(watched);
            if (busy) {
                skeletonHeight = busy.getBoundingClientRect().height;
                resize.observe(busy);
            }
            watched = busy;
        }
        const empty = node.querySelector<HTMLElement>('[data-empty-state]');
        if (empty && !busy && skeletonHeight > 0) empty.style.minHeight = `${skeletonHeight}px`;
    };

    const mutations = new MutationObserver(sync);
    mutations.observe(node, { childList: true, subtree: true });
    sync();

    return () => {
        mutations.disconnect();
        resize.disconnect();
    };
};
