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
