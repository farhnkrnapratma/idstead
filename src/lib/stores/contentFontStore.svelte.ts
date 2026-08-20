import {browser} from '$app/environment';

export type ContentFont = 'sans' | 'serif' | 'mono';

const STORAGE_KEY = 'fkp_content_font';
const DEFAULT_FONT: ContentFont = 'sans';

function createContentFontStore() {
  let current = $state<ContentFont>(DEFAULT_FONT);

  if (browser) {
    try {
      const stored = localStorage.getItem(STORAGE_KEY) as ContentFont | null;
      if (
        stored
        && (stored === 'sans' || stored === 'serif' || stored === 'mono')
      ) {
        current = stored;
      }
    } catch {}
  }

  function setFont(font: ContentFont) {
    current = font;
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
      return current;
    },
    setFont,
    reset
  };
}

export const contentFontStore = createContentFontStore();
