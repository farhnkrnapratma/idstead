<script lang="ts">
    import { untrack } from 'svelte';
    import { buttonKey } from '../../shortcuts.ts';
    import { Info, PersonStanding, ToggleLeft, ToggleRight } from '@lucide/svelte';
    import { cn } from '../../utils/cn';
    import { popoverPosition } from '../../utils/popoverPosition';
    import Badge from '../Badge.svelte';
    import IconButton from '../IconButton.svelte';
    import Tooltip from '../Tooltip.svelte';
    import { a11yStore, A11Y_TOGGLES, type FontScale } from '../../stores/a11yStore.svelte';
    import { shortcutStore } from '../../stores/shortcutStore.svelte';
    import { shortcut } from '../../utils/shortcut.svelte';

    const SHORTCUT_SCOPE = 'accessibility-menu';

    const modalShortcutScope = () => {
        untrack(() => shortcutStore.pushScope(SHORTCUT_SCOPE, true));
        return () => untrack(() => shortcutStore.popScope(SHORTCUT_SCOPE));
    };

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
        if (event.defaultPrevented || event.ctrlKey || event.metaKey || event.altKey) return;
        const index = Number(event.key) - 1;
        if (Number.isInteger(index) && index >= 0 && index < A11Y_TOGGLES.length) {
            event.preventDefault();
            A11Y_TOGGLES[index].toggle();
        }
    }
</script>

{#snippet infoTip(label: string, description: string)}
    <Tooltip
        content={description}
        placement="top"
        toggleOnClick
        class="max-w-56 leading-relaxed whitespace-normal!">
        <button
            type="button"
            aria-label="{label}: {description}"
            class="inline-flex size-4 shrink-0 cursor-help items-center justify-center rounded-sm text-fg-muted opacity-0 transition-opacity group-hover/item:opacity-100 hover:text-fg focus-visible:opacity-100 focus-visible:outline-2 focus-visible:outline-focus-ring pointer-coarse:opacity-100">
            <Info class="size-3.5" />
        </button>
    </Tooltip>
{/snippet}

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
        {@attach node => {
            containerRef = node;
            return () => {
                containerRef = undefined;
            };
        }}
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
                'border-line-subtle bg-surface backdrop-blur-none hover:border-accent hover:bg-surface-hover sm:h-9 sm:w-9',
                isOpen && 'border-accent text-fg-accent'
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
                data-shortcut-scope={SHORTCUT_SCOPE}
                {@attach modalShortcutScope}
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
                            class="text-xs font-bold tracking-tight text-fg">
                            Accessibility
                        </span>
                        <button
                            type="button"
                            onclick={a11yStore.reset}
                            class="cursor-pointer text-2xs font-medium text-fg-secondary transition-colors hover:text-fg-accent">
                            Reset to default
                        </button>
                    </div>

                    <p class="text-3xs text-fg-muted">
                        Adjust how this site looks and moves. Device marks a setting your system
                        turned on.
                    </p>

                    <div
                        role="group"
                        aria-label="Text size"
                        class="group/item flex items-center justify-between rounded-md border border-line-subtle bg-surface-hover/50 px-2.5 py-1.5">
                        <span class="flex items-center gap-1.5 text-xs text-fg-secondary">
                            Text size
                            {@render infoTip(
                                'Text size',
                                'Scales all text on the site from 100% to 150%.'
                            )}
                        </span>
                        <div class="flex items-center gap-2">
                            <button
                                type="button"
                                onclick={decreaseFontScale}
                                disabled={a11yStore.current.fontScale <= 100}
                                class="flex size-6 cursor-pointer items-center justify-center rounded-md border border-line-subtle bg-surface text-xs font-bold text-fg hover:bg-surface-hover disabled:cursor-not-allowed disabled:opacity-40"
                                aria-label="Decrease text size">
                                -
                            </button>
                            <span class="min-w-8 text-center font-mono text-xs font-medium text-fg">
                                {a11yStore.current.fontScale}%
                            </span>
                            <button
                                type="button"
                                onclick={increaseFontScale}
                                disabled={a11yStore.current.fontScale >= 150}
                                class="flex size-6 cursor-pointer items-center justify-center rounded-md border border-line-subtle bg-surface text-xs font-bold text-fg hover:bg-surface-hover disabled:cursor-not-allowed disabled:opacity-40"
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
                                    class="flex min-w-0 items-center gap-1.5 truncate text-xs font-normal text-fg-secondary transition-colors group-hover/item:text-fg">
                                    {item.label}
                                    {@render infoTip(item.label, item.description)}
                                    {#if fromDevice}
                                        <Badge class="px-1.5 py-0 text-3xs">Device</Badge>
                                    {/if}
                                </span>
                                <button
                                    type="button"
                                    role="switch"
                                    aria-checked={checked}
                                    aria-keyshortcuts={String(index + 1)}
                                    use:shortcut={{ combo: String(index + 1), label: item.label }}
                                    aria-label="{item.label}: {item.description}{fromDevice ?
                                        ', turned on by your device settings'
                                    :   ''}"
                                    onclick={item.toggle}
                                    class="relative flex h-6.5 w-7 shrink-0 cursor-pointer items-center justify-center">
                                    <ToggleLeft
                                        class={cn(
                                            'absolute size-6.5 transition-transform duration-150',
                                            checked ? 'invisible scale-75' : (
                                                'visible scale-100 text-fg-muted group-hover/item:text-fg-secondary'
                                            )
                                        )} />
                                    <ToggleRight
                                        class={cn(
                                            'absolute size-6.5 transition-transform duration-150',
                                            checked ?
                                                'visible scale-100 text-fg-accent'
                                            :   'invisible scale-75'
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
