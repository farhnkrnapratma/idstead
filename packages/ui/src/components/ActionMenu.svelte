<!--
SPDX-FileCopyrightText: 2026 Farhan Kurnia Pratama

SPDX-License-Identifier: AGPL-3.0-only
-->

<script lang="ts">
    import type { Component } from 'svelte';
    import { Check, Ellipsis } from '@lucide/svelte';
    import IconButton from './IconButton.svelte';
    import { cn } from '../utils/cn';
    import { MENU_ITEM_TONE_CLASSES } from '../utils/menuItemStyles';
    import { portal } from '../utils/actions';

    interface MenuItem {
        label: string;
        icon?: Component<{ class?: string }>;
        danger?: boolean;
        disabled?: boolean;
        selected?: boolean;
        onSelect: () => void;
    }

    type MenuEntry = MenuItem | { divider: true };

    let {
        items,
        ariaLabel = 'More actions',
        disabled = false,
        triggerIcon: TriggerIcon = Ellipsis,
        class: className = ''
    }: {
        items: MenuEntry[];
        ariaLabel?: string;
        disabled?: boolean;
        triggerIcon?: Component<{ class?: string }>;
        class?: string;
    } = $props();

    let open = $state(false);
    let position = $state<{ top?: number; bottom?: number; right: number }>({ top: 0, right: 0 });
    let trigger = $state<HTMLElement | null>(null);
    let menu = $state<HTMLElement | null>(null);

    function place() {
        const rect = trigger?.getBoundingClientRect();
        if (!rect) return;
        const right = Math.max(8, window.innerWidth - rect.right);
        const estimated = items.length * 34 + 8;
        const spaceBelow = window.innerHeight - rect.bottom - 8;
        const spaceAbove = rect.top - 8;
        position =
            spaceBelow < estimated && spaceAbove > spaceBelow ?
                { bottom: window.innerHeight - rect.top + 4, right }
            :   { top: rect.bottom + 4, right };
    }

    function toggle() {
        if (open) {
            open = false;
            return;
        }
        place();
        open = true;
    }

    $effect(() => {
        if (!open) return;
        const close = () => (open = false);
        const onPointerDown = (event: PointerEvent) => {
            const target = event.target as Node;
            if (!menu?.contains(target) && !trigger?.contains(target)) close();
        };
        const onKeyDown = (event: KeyboardEvent) => {
            if (event.key === 'Escape') {
                close();
                trigger?.querySelector('button')?.focus();
            }
        };
        window.addEventListener('pointerdown', onPointerDown, true);
        window.addEventListener('keydown', onKeyDown);
        window.addEventListener('scroll', close, true);
        window.addEventListener('resize', close);
        return () => {
            window.removeEventListener('pointerdown', onPointerDown, true);
            window.removeEventListener('keydown', onKeyDown);
            window.removeEventListener('scroll', close, true);
            window.removeEventListener('resize', close);
        };
    });
</script>

<span
    bind:this={trigger}
    class={cn('inline-flex', className)}>
    <IconButton
        {ariaLabel}
        {disabled}
        variant="ghost"
        size="sm"
        showTooltip={false}
        aria-haspopup="menu"
        aria-expanded={open}
        onclick={toggle}><TriggerIcon class="size-4" /></IconButton>
</span>

{#if open}
    <div
        bind:this={menu}
        use:portal
        role="menu"
        tabindex="-1"
        style:top={position.top === undefined ? undefined : `${position.top}px`}
        style:bottom={position.bottom === undefined ? undefined : `${position.bottom}px`}
        style:right={`${position.right}px`}
        class="fixed z-110 min-w-36 overflow-hidden popover-surface p-0">
        <div class="flex max-h-[calc(100dvh-1rem)] flex-col overflow-y-auto">
            {#each items as item, index ('divider' in item ? `divider-${index}` : item.label)}
                {#if 'divider' in item}
                    <div
                        role="separator"
                        class="h-px shrink-0 bg-line-subtle">
                    </div>
                {:else}
                    <button
                        type="button"
                        role={item.selected === undefined ? 'menuitem' : 'menuitemradio'}
                        aria-checked={item.selected}
                        disabled={item.disabled}
                        class={cn(
                            'flex w-full cursor-pointer items-center gap-2 px-3 py-2 text-left text-xs font-medium whitespace-nowrap transition-colors focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50 pointer-coarse:min-h-11',
                            MENU_ITEM_TONE_CLASSES[item.danger ? 'danger' : 'default']
                        )}
                        onclick={() => {
                            open = false;
                            item.onSelect();
                        }}>
                        {#if item.icon}{@const Icon = item.icon}<Icon
                                class="size-3.5 shrink-0" />{/if}
                        {item.label}
                        {#if item.selected}<Check class="ml-auto size-3.5 shrink-0" />{/if}
                    </button>
                {/if}
            {/each}
        </div>
    </div>
{/if}
