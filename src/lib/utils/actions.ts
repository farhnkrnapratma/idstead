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
