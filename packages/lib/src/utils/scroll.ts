let lockCount = 0;
let originalBodyOverflow = '';
let originalHtmlOverflow = '';
let originalBodyPaddingRight = '';

export function lockScroll(): () => void {
    if (typeof window === 'undefined' || typeof document === 'undefined') {
        return () => {};
    }

    lockCount++;
    if (lockCount === 1) {
        originalBodyOverflow = document.body.style.overflow;
        originalHtmlOverflow = document.documentElement.style.overflow;
        originalBodyPaddingRight = document.body.style.paddingRight;

        const scrollbarWidth = window.innerWidth - document.documentElement.clientWidth;
        if (scrollbarWidth > 0) {
            document.body.style.paddingRight = `${scrollbarWidth}px`;
        }

        document.documentElement.style.overflow = 'hidden';
        document.body.style.overflow = 'hidden';
    }

    let released = false;
    return () => {
        if (released) return;
        released = true;
        lockCount = Math.max(0, lockCount - 1);
        if (lockCount === 0) {
            document.documentElement.style.overflow = originalHtmlOverflow;
            document.body.style.overflow = originalBodyOverflow;
            document.body.style.paddingRight = originalBodyPaddingRight;
        }
    };
}

export function scrollToTop(behavior: ScrollBehavior = 'smooth'): void {
    if (typeof window === 'undefined') return;

    const article = document.querySelector<HTMLElement>('article.article-scroll-container');
    if (article && (article.scrollTop > 0 || article.scrollHeight > article.clientHeight)) {
        article.scrollTo({ top: 0, behavior });
    }

    const main = document.getElementById('main-content');
    if (main && (main.scrollTop > 0 || main.scrollHeight > main.clientHeight)) {
        main.scrollTo({ top: 0, behavior });
    }

    window.scrollTo({ top: 0, behavior });
}

const TARGET_HIGHLIGHT_CLASS = 'footnote-target-highlight';
const TARGET_HIGHLIGHT_MS = 3200;
const SCROLL_START_GRACE_MS = 120;
const SCROLL_IDLE_MS = 150;
const SCROLL_SETTLE_CAP_MS = 4000;

export function highlightAfterScroll(
    target: HTMLElement,
    scroller: HTMLElement | Window = window
): () => void {
    if (typeof window === 'undefined') return () => {};

    document
        .querySelectorAll(`.${TARGET_HIGHLIGHT_CLASS}`)
        .forEach(node => node.classList.remove(TARGET_HIGHLIGHT_CLASS));

    const highlightEl = (target.closest('sup') || target) as HTMLElement;
    let applied = false;
    let scrolled = false;
    let removeTimer: ReturnType<typeof setTimeout> | undefined;
    let idleTimer: ReturnType<typeof setTimeout> | undefined;

    const onScroll = () => {
        scrolled = true;
        clearTimeout(idleTimer);
        idleTimer = setTimeout(apply, SCROLL_IDLE_MS);
    };

    const detach = () => {
        scroller.removeEventListener('scroll', onScroll);
        scroller.removeEventListener('scrollend', apply);
        clearTimeout(graceTimer);
        clearTimeout(idleTimer);
        clearTimeout(capTimer);
    };

    function apply() {
        if (applied) return;
        applied = true;
        detach();
        highlightEl.classList.remove(TARGET_HIGHLIGHT_CLASS);
        void highlightEl.offsetWidth;
        highlightEl.classList.add(TARGET_HIGHLIGHT_CLASS);
        removeTimer = setTimeout(
            () => highlightEl.classList.remove(TARGET_HIGHLIGHT_CLASS),
            TARGET_HIGHLIGHT_MS
        );
    }

    scroller.addEventListener('scroll', onScroll, { passive: true });
    scroller.addEventListener('scrollend', apply, { once: true });
    const graceTimer = setTimeout(() => {
        if (!scrolled) apply();
    }, SCROLL_START_GRACE_MS);
    const capTimer = setTimeout(apply, SCROLL_SETTLE_CAP_MS);

    return () => {
        detach();
        clearTimeout(removeTimer);
        highlightEl.classList.remove(TARGET_HIGHLIGHT_CLASS);
    };
}

export function scrollToBottom(behavior: ScrollBehavior = 'smooth'): void {
    if (typeof window === 'undefined') return;

    const article = document.querySelector<HTMLElement>('article.article-scroll-container');
    if (article && article.scrollHeight > article.clientHeight) {
        article.scrollTo({ top: article.scrollHeight, behavior });
    }

    const main = document.getElementById('main-content');
    if (main && main.scrollHeight > main.clientHeight) {
        main.scrollTo({ top: main.scrollHeight, behavior });
    }

    const maxScroll = Math.max(
        document.documentElement.scrollHeight,
        document.body.scrollHeight,
        document.documentElement.offsetHeight,
        document.body.offsetHeight
    );
    window.scrollTo({ top: maxScroll, behavior });
}
