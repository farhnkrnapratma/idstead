import type { Attachment } from 'svelte/attachments';

export function elementRef<T extends Element>(assign: (node: T | null) => void): Attachment<T> {
    return node => {
        assign(node);
        return () => assign(null);
    };
}
