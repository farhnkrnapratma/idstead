import {shortcutStore} from '$lib/stores/shortcutStore.svelte';

export interface ShortcutParams {
  combo?: string;
  group?: string;
  label?: string;
  scope?: string;
  disabled?: boolean;
  placement?: keyof typeof HINT_PLACEMENT;
}

const HINT_BASE =
  'pointer-events-none absolute z-10 inline-flex items-center rounded border border-border-subtle/80 bg-surface-elevated px-1 py-0.5 font-mono text-3xs leading-none font-medium whitespace-nowrap text-text-primary shadow-xs select-none';

/**
 * Overhang looks best on standalone controls, but gets clipped inside a
 * scrolling list, so rows opt into sitting the badge within their own box.
 */
const HINT_PLACEMENT = {
  overhang: '-top-1.5 -right-1.5',
  inline: 'top-1/2 right-1 -translate-y-1/2',
  // Inside the box but clear of a trailing disclosure icon, for summary rows
  // whose <details> clips anything that overhangs.
  trailing: 'top-1/2 right-8 -translate-y-1/2',
  // Entirely outside to the right, so a bare text link keeps its words legible.
  after: 'top-1/2 left-full ml-1.5 -translate-y-1/2'
} as const;

function comboList(combo?: string): string[] {
  if (!combo) return [];
  return combo
    .split(',')
    .map(part => part.trim())
    .filter(Boolean);
}

function resolveLabel(node: HTMLElement, label?: string): string {
  if (label) return label;
  return (
    node.getAttribute('aria-label')
    || node.getAttribute('title')
    || node.textContent?.trim().slice(0, 60)
    || 'Action'
  );
}

/**
 * Registers any clickable element with the shortcut registry and renders its
 * hint badge. Activation goes through element.click(), so anchors, buttons and
 * their existing handlers all work untouched.
 *
 * The badge is created here rather than in each component's markup so raw
 * elements, Button and IconButton all share one implementation.
 */
export function shortcut(node: HTMLElement, params: ShortcutParams = {}) {
  let id: string | null = null;
  let badge: HTMLElement | null = null;
  let placement: keyof typeof HINT_PLACEMENT = params.placement ?? 'overhang';

  const detach = () => {
    if (id) shortcutStore.unregister(id);
    id = null;
  };

  const attach = (next: ShortcutParams) => {
    const combos = comboList(next.combo);
    if (next.disabled || (combos.length === 0 && !next.group)) {
      detach();
      return;
    }

    const entry = {
      combos,
      group: next.group,
      label: resolveLabel(node, next.label),
      scope: next.scope ?? 'page',
      element: node
    };

    if (id) shortcutStore.update(id, entry);
    else id = shortcutStore.register(entry);
  };

  const renderHint = () => {
    const hint = id ? shortcutStore.hintFor(id) : '';
    if (!hint) {
      badge?.remove();
      badge = null;
      return;
    }
    if (!badge) {
      badge = document.createElement('kbd');
      badge.setAttribute('aria-hidden', 'true');
    }
    badge.className = `${HINT_BASE} ${HINT_PLACEMENT[placement]}`;
    badge.textContent = hint;
    if (badge.parentElement !== node) node.appendChild(badge);
  };

  attach(params);

  const stopEffect = $effect.root(() => {
    $effect(() => {
      renderHint();
    });
  });

  return {
    update(next: ShortcutParams = {}) {
      placement = next.placement ?? 'overhang';
      attach(next);
    },
    destroy() {
      stopEffect();
      badge?.remove();
      badge = null;
      detach();
    }
  };
}
