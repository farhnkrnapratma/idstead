const WRAPPER_CLASS = 'mdrs-code-scrollbar hljs';
const TRACK_CLASS = 'mdrs-code-scrollbar-track';
const THUMB_CLASS = 'mdrs-code-scrollbar-thumb';

export interface CodeScrollbarOptions {
    reserve?: boolean;
    bordered?: boolean;
    suppressed?: () => boolean;
    onLayout?: (visible: boolean) => void;
    onResize?: () => void;
}

export function createCodeScrollbar(scroller: HTMLElement, options: CodeScrollbarOptions = {}) {
    const { reserve = false, bordered = false, suppressed, onLayout, onResize } = options;
    const wrapper = document.createElement('div');
    wrapper.className = `${WRAPPER_CLASS}${bordered ? ' mdrs-code-scrollbar--bordered' : ''}`;
    const track = document.createElement('div');
    track.className = TRACK_CLASS;
    const thumb = document.createElement('div');
    thumb.className = THUMB_CLASS;
    track.appendChild(thumb);
    wrapper.appendChild(track);

    function update() {
        const { scrollLeft, scrollWidth, clientWidth } = scroller;
        const hidden = suppressed?.() ?? false;
        const overflowing = !hidden && scrollWidth > clientWidth + 2;
        const visible = overflowing || (reserve && !hidden);
        wrapper.style.display = visible ? 'flex' : 'none';
        thumb.style.visibility = overflowing ? '' : 'hidden';
        track.style.backgroundColor = overflowing ? '' : 'transparent';
        track.style.cursor = overflowing ? '' : 'default';
        if (overflowing) {
            const thumbWidthPercent = Math.max((clientWidth / scrollWidth) * 100, 10);
            const maxScroll = scrollWidth - clientWidth;
            const left = maxScroll > 0 ? (scrollLeft / maxScroll) * (100 - thumbWidthPercent) : 0;
            thumb.style.width = `${thumbWidthPercent}%`;
            thumb.style.left = `${left}%`;
        }
        onLayout?.(visible);
    }

    const cleanups: (() => void)[] = [];
    scroller.addEventListener('scroll', update, { passive: true });
    cleanups.push(() => scroller.removeEventListener('scroll', update));

    if (typeof ResizeObserver !== 'undefined') {
        const observer = new ResizeObserver(() => {
            if (!scroller.isConnected) {
                observer.disconnect();
                return;
            }
            onResize?.();
            update();
        });
        observer.observe(scroller);
        cleanups.push(() => observer.disconnect());
    } else {
        const handleResize = () => {
            if (!scroller.isConnected) {
                window.removeEventListener('resize', handleResize);
                return;
            }
            update();
            onResize?.();
        };
        window.addEventListener('resize', handleResize);
        cleanups.push(() => window.removeEventListener('resize', handleResize));
    }

    track.addEventListener('pointerdown', event => {
        if (event.target === thumb || thumb.style.visibility === 'hidden') return;
        const rect = track.getBoundingClientRect();
        const ratio = Math.max(0, Math.min(1, (event.clientX - rect.left) / rect.width));
        scroller.scrollLeft = ratio * (scroller.scrollWidth - scroller.clientWidth);
    });

    let dragging = false;
    let startX = 0;
    let startScrollLeft = 0;
    let slack = 1;

    thumb.addEventListener('pointerdown', event => {
        dragging = true;
        startX = event.clientX;
        startScrollLeft = scroller.scrollLeft;
        slack = Math.max(
            track.getBoundingClientRect().width - thumb.getBoundingClientRect().width,
            1
        );
        thumb.setPointerCapture(event.pointerId);
        thumb.style.backgroundColor = 'var(--color-code-thumb-hover)';
        document.body.style.userSelect = 'none';
        event.preventDefault();
    });

    thumb.addEventListener('pointermove', event => {
        if (!dragging) return;
        const maxScroll = scroller.scrollWidth - scroller.clientWidth;
        scroller.scrollLeft = startScrollLeft + (event.clientX - startX) * (maxScroll / slack);
    });

    const end = (event: PointerEvent) => {
        if (!dragging) return;
        dragging = false;
        if (thumb.hasPointerCapture(event.pointerId)) thumb.releasePointerCapture(event.pointerId);
        thumb.style.backgroundColor = '';
        document.body.style.userSelect = '';
    };
    thumb.addEventListener('pointerup', end);
    thumb.addEventListener('pointercancel', end);

    return { element: wrapper, update, destroy: () => cleanups.forEach(cleanup => cleanup()) };
}
