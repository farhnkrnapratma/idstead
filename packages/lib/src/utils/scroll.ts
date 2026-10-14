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

export function preferredScrollBehavior(): ScrollBehavior {
    if (typeof document === 'undefined') return 'auto';
    return document.documentElement.dataset.reduceMotion === 'true' ? 'auto' : 'smooth';
}

export function scrollToTop(behavior: ScrollBehavior = preferredScrollBehavior()): void {
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

export function whenScrollSettles(scroller: HTMLElement | Window, settled: () => void): () => void {
    if (typeof window === 'undefined') return () => {};

    let done = false;
    let scrolled = false;
    let idleTimer: ReturnType<typeof setTimeout> | undefined;

    const onScroll = () => {
        scrolled = true;
        clearTimeout(idleTimer);
        idleTimer = setTimeout(finish, SCROLL_IDLE_MS);
    };

    const detach = () => {
        scroller.removeEventListener('scroll', onScroll);
        scroller.removeEventListener('scrollend', finish);
        clearTimeout(graceTimer);
        clearTimeout(idleTimer);
        clearTimeout(capTimer);
    };

    function finish() {
        if (done) return;
        done = true;
        detach();
        settled();
    }

    scroller.addEventListener('scroll', onScroll, { passive: true });
    scroller.addEventListener('scrollend', finish, { once: true });
    const graceTimer = setTimeout(() => {
        if (!scrolled) finish();
    }, SCROLL_START_GRACE_MS);
    const capTimer = setTimeout(finish, SCROLL_SETTLE_CAP_MS);

    return () => {
        done = true;
        detach();
    };
}

export function highlightAfterScroll(
    target: HTMLElement,
    scroller: HTMLElement | Window = window
): () => void {
    if (typeof window === 'undefined') return () => {};

    document
        .querySelectorAll(`.${TARGET_HIGHLIGHT_CLASS}`)
        .forEach(node => node.classList.remove(TARGET_HIGHLIGHT_CLASS));

    const highlightEl = (target.closest('sup') || target) as HTMLElement;
    let removeTimer: ReturnType<typeof setTimeout> | undefined;

    const cancelWait = whenScrollSettles(scroller, () => {
        highlightEl.classList.remove(TARGET_HIGHLIGHT_CLASS);
        void highlightEl.offsetWidth;
        highlightEl.classList.add(TARGET_HIGHLIGHT_CLASS);
        removeTimer = setTimeout(
            () => highlightEl.classList.remove(TARGET_HIGHLIGHT_CLASS),
            TARGET_HIGHLIGHT_MS
        );
    });

    return () => {
        cancelWait();
        clearTimeout(removeTimer);
        highlightEl.classList.remove(TARGET_HIGHLIGHT_CLASS);
    };
}

export function scrollToBottom(behavior: ScrollBehavior = preferredScrollBehavior()): void {
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
