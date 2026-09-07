export interface PopoverPositionOptions {
  placement?:
    'bottom' | 'top' | 'bottom-end' | 'bottom-start' | 'top-end' | 'top-start';
  offset?: number;
  padding?: number;
  anchor?: HTMLElement | null;
  autoMaxHeight?: boolean;
}

export function popoverPosition(
  node: HTMLElement,
  options: PopoverPositionOptions = {}
) {
  let opts = {
    placement: options.placement ?? 'bottom-end',
    offset: options.offset ?? 6,
    padding: options.padding ?? 8,
    anchor: options.anchor,
    autoMaxHeight: options.autoMaxHeight ?? true
  };

  let rafId: number | null = null;

  const update = () => {
    if (!node || typeof window === 'undefined') return;

    const anchor = opts.anchor ?? (node.parentElement as HTMLElement | null);
    if (!anchor) return;

    const effectiveParent =
      (node.offsetParent as HTMLElement | null)
      ?? (node.parentElement as HTMLElement | null)
      ?? document.documentElement;

    const anchorRect = anchor.getBoundingClientRect();
    const parentRect = effectiveParent.getBoundingClientRect();
    const viewportWidth =
      document.documentElement.clientWidth || window.innerWidth;
    const viewportHeight =
      document.documentElement.clientHeight || window.innerHeight;

    const popoverWidth = node.offsetWidth || node.scrollWidth;
    const popoverHeight = node.offsetHeight || node.scrollHeight;

    const spaceBelow =
      viewportHeight - anchorRect.bottom - opts.offset - opts.padding;
    const spaceAbove = anchorRect.top - opts.offset - opts.padding;

    const prefersTop = opts.placement.startsWith('top');
    let actualPlacement: 'top' | 'bottom';

    if (prefersTop) {
      if (popoverHeight <= spaceAbove || spaceAbove >= spaceBelow) {
        actualPlacement = 'top';
      } else {
        actualPlacement = 'bottom';
      }
    } else {
      if (popoverHeight <= spaceBelow || spaceBelow >= spaceAbove) {
        actualPlacement = 'bottom';
      } else {
        actualPlacement = 'top';
      }
    }

    const anchorRelTop = anchorRect.top - parentRect.top;
    const anchorRelLeft = anchorRect.left - parentRect.left;
    const anchorRelBottom = anchorRelTop + anchorRect.height;
    const anchorRelRight = anchorRelLeft + anchorRect.width;

    let targetTop: number;
    if (actualPlacement === 'bottom') {
      targetTop = anchorRelBottom + opts.offset;
      if (opts.autoMaxHeight && spaceBelow > 0) {
        node.style.maxHeight = `${Math.floor(spaceBelow)}px`;
      }
    } else {
      targetTop = anchorRelTop - popoverHeight - opts.offset;
      if (opts.autoMaxHeight && spaceAbove > 0) {
        node.style.maxHeight = `${Math.floor(spaceAbove)}px`;
      }
    }

    let targetLeft: number;
    if (opts.placement.endsWith('-end')) {
      targetLeft = anchorRelRight - popoverWidth;
    } else if (opts.placement.endsWith('-start')) {
      targetLeft = anchorRelLeft;
    } else {
      targetLeft = anchorRelLeft + (anchorRect.width - popoverWidth) / 2;
    }

    const predictedViewportLeft = parentRect.left + targetLeft;
    const predictedViewportRight = predictedViewportLeft + popoverWidth;

    if (predictedViewportRight > viewportWidth - opts.padding) {
      const overflowX = predictedViewportRight - (viewportWidth - opts.padding);
      targetLeft -= overflowX;
    }

    if (parentRect.left + targetLeft < opts.padding) {
      targetLeft = opts.padding - parentRect.left;
    }

    node.style.top = `${Math.round(targetTop)}px`;
    node.style.bottom = 'auto';
    node.style.left = `${Math.round(targetLeft)}px`;
    node.style.right = 'auto';
    node.style.maxWidth = `calc(100vw - ${opts.padding * 2}px)`;
    node.setAttribute('data-placement', actualPlacement);
  };

  const scheduleUpdate = () => {
    if (rafId !== null) cancelAnimationFrame(rafId);
    rafId = requestAnimationFrame(update);
  };

  scheduleUpdate();
  const timer = setTimeout(update, 0);

  window.addEventListener('resize', scheduleUpdate, {passive: true});
  window.addEventListener('scroll', scheduleUpdate, {
    passive: true,
    capture: true
  });

  const anchorEl = opts.anchor ?? (node.parentElement as HTMLElement | null);
  let resizeObserver: ResizeObserver | null = null;
  if (typeof ResizeObserver !== 'undefined') {
    resizeObserver = new ResizeObserver(scheduleUpdate);
    resizeObserver.observe(node);
    if (anchorEl) resizeObserver.observe(anchorEl);
  }

  return {
    update(newOptions?: PopoverPositionOptions) {
      opts = {
        placement: newOptions?.placement ?? opts.placement,
        offset: newOptions?.offset ?? opts.offset,
        padding: newOptions?.padding ?? opts.padding,
        anchor: newOptions?.anchor ?? opts.anchor,
        autoMaxHeight: newOptions?.autoMaxHeight ?? opts.autoMaxHeight
      };
      scheduleUpdate();
    },
    destroy() {
      if (rafId !== null) cancelAnimationFrame(rafId);
      clearTimeout(timer);
      window.removeEventListener('resize', scheduleUpdate);
      window.removeEventListener('scroll', scheduleUpdate, true);
      resizeObserver?.disconnect();
    }
  };
}
