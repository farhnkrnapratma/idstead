<script lang="ts">
    import { buttonKey } from '#lib/shortcuts.ts';
    import { PersonStanding, ToggleLeft, ToggleRight } from '@lucide/svelte';
    import { cn } from '../../utils/cn';
    import { popoverPosition } from '../../utils/popoverPosition';
    import Badge from '../Badge.svelte';
    import IconButton from '../IconButton.svelte';
    import ShortcutBadge from '../ShortcutBadge.svelte';
    import { a11yStore, A11Y_TOGGLES, type FontScale } from '../../stores/a11yStore.svelte';

    interface Props {
        class?: string;
        dropdownDirection?: 'up' | 'down';
    }

    let { class: className = '', dropdownDirection = 'down' }: Props = $props();

    let isOpen = $state(false);

    function decreaseFontScale() {
        if (a11yStore.current.fontScale > 100) {
            a11yStore.setFontScale((a11yStore.current.fontScale - 10) as FontScale);
        }
    }

    function increaseFontScale() {
        if (a11yStore.current.fontScale < 150) {
            a11yStore.setFontScale((a11yStore.current.fontScale + 10) as FontScale);
        }
    }

    let containerRef: HTMLDivElement | undefined = $state();

    function close() {
        isOpen = false;
    }

    function handleWindowPointerDown(event: PointerEvent) {
        if (isOpen && containerRef && !containerRef.contains(event.target as Node)) {
            close();
        }
    }

    function handleKeydown(event: KeyboardEvent) {
        if (!isOpen) return;
        if (event.key === 'Escape') {
            event.preventDefault();
            close();
            return;
        }
        if (event.ctrlKey || event.metaKey || event.altKey) return;
        const index = Number(event.key) - 1;
        if (Number.isInteger(index) && index >= 0 && index < A11Y_TOGGLES.length) {
            event.preventDefault();
            A11Y_TOGGLES[index].toggle();
        }
    }
</script>

<svelte:window
    onpointerdown={handleWindowPointerDown}
    onkeydown={handleKeydown} />

<div
    class={cn(
        'items-center gap-2 select-none',
        isOpen ? 'z-60' : 'z-20',
        className.includes('hidden') ? className : `inline-flex ${className}`
    )}>
    <div
        bind:this={containerRef}
        class="relative inline-block">
        <IconButton
            ariaLabel="Accessibility"
            keyboardShortcut={buttonKey('accessibility')}
            shortcutLabel="Accessibility options"
            tooltip="Accessibility"
            tooltipPlacement={dropdownDirection === 'up' ? 'top' : 'bottom'}
            tooltipAlign="right"
            size="sm"
            aria-haspopup="true"
            aria-expanded={isOpen}
            onclick={() => (isOpen = !isOpen)}
            class={cn(
                'border-border-subtle bg-surface backdrop-blur-none hover:border-accent hover:bg-surface-hover sm:h-9 sm:w-9',
                isOpen && 'border-accent text-accent-text'
            )}>
            <PersonStanding class="size-4" />
        </IconButton>

        {#if isOpen}
            <button
                type="button"
                class="fixed inset-0 z-65 cursor-default"
                onclick={close}
                aria-label="Close accessibility selector"></button>

            <div
                role="dialog"
                aria-labelledby="a11y-settings-heading"
                use:popoverPosition={{
                    placement: dropdownDirection === 'up' ? 'top-end' : 'bottom-end',
                    offset: 8,
                    padding: 8
                }}
                class={cn(
                    'absolute z-70 flex w-72 max-w-[calc(100vw-1.5rem)] flex-col popover-surface p-4 leading-normal'
                )}>
                <div class="relative z-10 flex flex-col gap-3">
                    <div class="flex items-center justify-between">
                        <span
                            id="a11y-settings-heading"
                            class="text-xs font-bold tracking-tight text-text-primary">
                            Accessibility
                        </span>
                        <button
                            type="button"
                            onclick={a11yStore.reset}
                            class="cursor-pointer text-2xs font-medium text-text-secondary transition-colors hover:text-accent-text">
                            Reset to default
                        </button>
                    </div>

                    <p class="text-3xs text-text-muted">
                        Customize display preferences for improved accessibility. Settings marked
                        Device are on because of your system settings; change them anytime.
                    </p>

                    <div
                        role="group"
                        aria-label="Text size"
                        class="flex items-center justify-between rounded-md border border-border-subtle bg-surface-hover/50 px-2.5 py-1.5">
                        <span class="text-xs text-text-secondary">Text size</span>
                        <div class="flex items-center gap-2">
                            <button
                                type="button"
                                onclick={decreaseFontScale}
                                disabled={a11yStore.current.fontScale <= 100}
                                class="flex size-6 cursor-pointer items-center justify-center rounded-md border border-border-subtle bg-surface text-xs font-bold text-text-primary hover:bg-surface-hover disabled:cursor-not-allowed disabled:opacity-40"
                                aria-label="Decrease text size">
                                -
                            </button>
                            <span
                                class="min-w-8 text-center font-mono text-xs font-medium text-text-primary">
                                {a11yStore.current.fontScale}%
                            </span>
                            <button
                                type="button"
                                onclick={increaseFontScale}
                                disabled={a11yStore.current.fontScale >= 150}
                                class="flex size-6 cursor-pointer items-center justify-center rounded-md border border-border-subtle bg-surface text-xs font-bold text-text-primary hover:bg-surface-hover disabled:cursor-not-allowed disabled:opacity-40"
                                aria-label="Increase text size">
                                +
                            </button>
                        </div>
                    </div>

                    <div
                        class="flex flex-col gap-1"
                        role="group"
                        aria-labelledby="a11y-settings-heading">
                        {#each A11Y_TOGGLES as item, index (item.key)}
                            {@const checked = a11yStore.current[item.key]}
                            {@const fromDevice = a11yStore.enabledByDevice(item.key)}
                            <div class="group/item flex items-center justify-between gap-2 py-0.5">
                                <span
                                    class="flex min-w-0 items-center gap-1.5 truncate text-xs font-normal text-text-secondary transition-colors group-hover/item:text-text-primary">
                                    {item.label}
                                    {#if fromDevice}
                                        <Badge class="px-1.5 py-0 text-3xs">Device</Badge>
                                    {/if}
                                    <ShortcutBadge
                                        combo={String(index + 1)}
                                        class="opacity-0 transition-opacity group-hover/item:opacity-100" />
                                </span>
                                <button
                                    type="button"
                                    role="switch"
                                    aria-checked={checked}
                                    aria-keyshortcuts={String(index + 1)}
                                    aria-label="{item.label}: {item.description}{fromDevice ?
                                        ', turned on by your device settings'
                                    :   ''}"
                                    onclick={item.toggle}
                                    class="relative flex h-6.5 w-7 shrink-0 cursor-pointer items-center justify-center">
                                    <ToggleLeft
                                        class={cn(
                                            'absolute size-6.5 transition-[transform,opacity] duration-150',
                                            checked ? 'scale-75 opacity-0' : (
                                                'scale-100 text-text-muted opacity-100 group-hover/item:text-text-secondary'
                                            )
                                        )} />
                                    <ToggleRight
                                        class={cn(
                                            'absolute size-6.5 transition-[transform,opacity] duration-150',
                                            checked ?
                                                'scale-100 text-accent-text opacity-100'
                                            :   'scale-75 opacity-0'
                                        )} />
                                </button>
                            </div>
                        {/each}
                    </div>
                </div>
            </div>
        {/if}
    </div>
</div>
