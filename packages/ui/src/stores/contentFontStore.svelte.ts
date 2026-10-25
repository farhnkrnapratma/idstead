import { browser } from '$app/env';
import { a11yStore } from './a11yStore.svelte';

export type ContentFont = 'sans' | 'serif' | 'mono';

const STORAGE_KEY = 'idstead_content_font';
const DEFAULT_FONT: ContentFont = 'sans';

function createContentFontStore() {
    let preference = $state<ContentFont>(DEFAULT_FONT);

    if (browser) {
        try {
            const stored = localStorage.getItem(STORAGE_KEY) as ContentFont | null;
            if (stored && (stored === 'sans' || stored === 'serif' || stored === 'mono')) {
                preference = stored;
            }
        } catch {}
    }

    function setFont(font: ContentFont) {
        if (a11yStore.current.dyslexicFont) return;
        preference = font;
        if (browser) {
            try {
                localStorage.setItem(STORAGE_KEY, font);
            } catch {}
        }
    }

    function reset() {
        setFont(DEFAULT_FONT);
    }

    return {
        get current() {
            return a11yStore.current.dyslexicFont ? DEFAULT_FONT : preference;
        },
        get preference() {
            return preference;
        },
        get locked() {
            return a11yStore.current.dyslexicFont;
        },
        setFont,
        reset
    };
}

export const contentFontStore = createContentFontStore();
