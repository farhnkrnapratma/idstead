import {shortcutStore} from '$lib/stores/shortcutStore.svelte';
import {platformStore} from '$lib/stores/platformStore.svelte';
import {keyLabel} from '$lib/shortcuts';

export interface ShortcutParams {
  combo?: string;
  group?: string;
  chordKey?: string;
  label?: string;
  scope?: string;
  disabled?: boolean;
  placement?: keyof typeof HINT_PLACEMENT;
}

export const KEY_GROUP_CLASS =
  'inline-flex shrink-0 items-stretch whitespace-nowrap font-mono text-3xs leading-none font-medium select-none';

export const KEY_SEGMENT_CLASS =
  'inline-flex h-4.5 min-w-4.5 items-center justify-center border px-1 transition-colors not-first:-ml-px first:rounded-l-sm last:rounded-r-sm';

const HINT_TONE =
  'border-border-subtle/80 bg-surface-elevated text-text-primary';

const HINT_BASE = `pointer-events-none absolute z-10 rounded-sm shadow-xs ${KEY_GROUP_CLASS}`;

const HINT_PLACEMENT = {
  overhang: '-top-1.5 -right-1.5',
  inline: 'top-1/2 right-1 -translate-y-1/2',
  trailing: 'top-1/2 right-8 -translate-y-1/2',
  after: 'top-1/2 left-full ml-1.5 -translate-y-1/2'
} as const;

function comboList(combo?: string): string[] {
  if (!combo) return [];
  return combo
    .split(',')
    .map(part => part.trim())
    .filter(Boolean);
}

function inheritedScope(node: HTMLElement): string {
  return (
    node.closest('[data-shortcut-scope]')?.getAttribute('data-shortcut-scope')
    || 'page'
  );
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

export function shortcut(node: HTMLElement, params: ShortcutParams = {}) {
  let id: string | null = null;
  let badge: HTMLElement | null = null;
  let rendered = '';
  let placement: keyof typeof HINT_PLACEMENT = params.placement ?? 'overhang';

  const detach = () => {
    if (id) shortcutStore.unregister(id);
    id = null;
  };

  const attach = (next: ShortcutParams) => {
    const combos = comboList(next.combo);
    if (next.disabled || (combos.length === 0 && !next.group)) {
      detach();
      renderHint();
      return;
    }

    const entry = {
      combos,
      group: next.group,
      chordKey: next.chordKey?.toLowerCase(),
      label: resolveLabel(node, next.label),
      scope: next.scope ?? inheritedScope(node),
      element: node
    };

    if (id) shortcutStore.update(id, entry);
    else id = shortcutStore.register(entry);
    renderHint();
  };

  const renderHint = () => {
    const _alt = shortcutStore.altHeld;
    const _leader = shortcutStore.leaderArmed;
    const _group = shortcutStore.pendingGroup;
    const platform = platformStore.current;
    const parts = (id ? shortcutStore.hintFor(id) : []).map(
      token => keyLabel(token, platform).text
    );
    if (parts.length === 0) {
      badge?.remove();
      badge = null;
      rendered = '';
      return;
    }
    if (!badge) {
      badge = document.createElement('span');
      badge.setAttribute('aria-hidden', 'true');
      badge.dataset.shortcutHint = '';
    }
    badge.className = `${HINT_BASE} ${HINT_PLACEMENT[placement]}`;
    const signature = parts.join(' ');
    if (signature !== rendered) {
      badge.replaceChildren(
        ...parts.map(part => {
          const segment = document.createElement('kbd');
          segment.className = `${KEY_SEGMENT_CLASS} ${HINT_TONE}`;
          segment.textContent = part;
          return segment;
        })
      );
      rendered = signature;
    }
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
      rendered = '';
      detach();
    }
  };
}
