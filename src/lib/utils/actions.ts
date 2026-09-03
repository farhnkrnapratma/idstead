export function autoResize(node: HTMLTextAreaElement, value?: string) {
  void value;

  const adjustHeight = () => {
    if (!node) return;
    node.style.height = 'auto';
    if (node.scrollHeight > 0) {
      node.style.height = `${node.scrollHeight}px`;
    }
  };

  node.addEventListener('input', adjustHeight);
  node.addEventListener('change', adjustHeight);

  requestAnimationFrame(adjustHeight);
  const timer1 = setTimeout(adjustHeight, 0);
  const timer2 = setTimeout(adjustHeight, 100);

  const resizeObserver = new ResizeObserver(() => {
    adjustHeight();
  });
  resizeObserver.observe(node);

  return {
    update(nextValue?: string) {
      void nextValue;
      requestAnimationFrame(adjustHeight);
      setTimeout(adjustHeight, 0);
    },
    destroy() {
      node.removeEventListener('input', adjustHeight);
      node.removeEventListener('change', adjustHeight);
      clearTimeout(timer1);
      clearTimeout(timer2);
      resizeObserver.disconnect();
    }
  };
}

export function staggerChildren(node: HTMLElement) {
  const assignIndices = () => {
    Array.from(node.children).forEach((child, i) => {
      (child as HTMLElement).style.setProperty('--stagger-i', String(i));
    });
  };

  assignIndices();

  const observer = new MutationObserver(assignIndices);
  observer.observe(node, {childList: true});

  return {
    destroy() {
      observer.disconnect();
    }
  };
}

export function portal(
  node: HTMLElement,
  target: HTMLElement | string = 'body'
) {
  const targetEl =
    (typeof target === 'string' ?
      document.querySelector<HTMLElement>(target)
    : target) ?? document.body;
  targetEl.appendChild(node);

  return {
    update(newTarget: HTMLElement | string = 'body') {
      const nextTargetEl =
        (typeof newTarget === 'string' ?
          document.querySelector<HTMLElement>(newTarget)
        : newTarget) ?? document.body;
      if (nextTargetEl !== node.parentNode) {
        nextTargetEl.appendChild(node);
      }
    },
    destroy() {
      if (node.parentNode) {
        node.parentNode.removeChild(node);
      }
    }
  };
}

export function scrollReveal(
  node: HTMLElement,
  options: {threshold?: number; rootMargin?: string; once?: boolean} = {}
) {
  const {
    threshold = 0.1,
    rootMargin = '0px 0px -40px 0px',
    once = true
  } = options;

  if (typeof window === 'undefined' || !('IntersectionObserver' in window)) {
    return;
  }

  const isReducedMotion =
    window.matchMedia('(prefers-reduced-motion: reduce)').matches
    || document.documentElement.getAttribute('data-reduce-motion') === 'true';

  if (isReducedMotion) {
    node.style.opacity = '1';
    node.style.transform = 'none';
    return;
  }

  node.style.opacity = '0';
  node.style.transform = 'translateY(24px)';
  node.style.transition =
    'opacity 0.6s cubic-bezier(0.16, 1, 0.3, 1), transform 0.6s cubic-bezier(0.16, 1, 0.3, 1)';
  node.style.willChange = 'opacity, transform';

  const observer = new IntersectionObserver(
    entries => {
      for (const entry of entries) {
        if (entry.isIntersecting) {
          node.style.opacity = '1';
          node.style.transform = 'translateY(0)';
          if (once) {
            observer.unobserve(node);
          }
        } else if (!once) {
          node.style.opacity = '0';
          node.style.transform = 'translateY(24px)';
        }
      }
    },
    {threshold, rootMargin}
  );

  observer.observe(node);

  return {
    destroy() {
      observer.disconnect();
    }
  };
}
