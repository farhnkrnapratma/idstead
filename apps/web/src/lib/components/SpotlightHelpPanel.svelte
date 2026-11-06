<!--
SPDX-FileCopyrightText: 2026 Farhan Kurnia Pratama

SPDX-License-Identifier: AGPL-3.0-only
-->

<script lang="ts">
    import { portal } from '@idstead/ui/utils/actions.ts';
    import { elementRef } from '@idstead/ui/utils/elementRef.ts';
    import { cn } from '@idstead/ui/utils/cn.ts';
    import CommandSectionHeading from '@idstead/ui/components/CommandSectionHeading.svelte';
    import { CaseSensitive, Keyboard, Regex, WholeWord, X } from '@lucide/svelte';
    import type { HelpCategory, HelpCommandSpec } from './spotlight/types';

    interface Props {
        categories: (HelpCategory & { context?: string })[];
        helpCmdIndexMap: Map<string, number>;
        activeIndex?: number;
        dialogEl?: HTMLDivElement | null;
        onClose: () => void;
        onOpenShortcuts: () => void;
        onSelect: (cmd: HelpCommandSpec) => void;
        onPointerMove: (index: number) => void;
        onKeydown: (event: KeyboardEvent) => void;
    }

    let {
        categories,
        helpCmdIndexMap,
        activeIndex = $bindable(-1),
        dialogEl = $bindable(null),
        onClose,
        onOpenShortcuts,
        onSelect,
        onPointerMove,
        onKeydown
    }: Props = $props();
</script>

<div
    use:portal
    class="fixed inset-0 z-100000 flex items-center justify-center overscroll-contain p-4">
    <button
        type="button"
        class="fixed inset-0 cursor-default touch-none bg-overlay/80 transition-opacity duration-200"
        aria-label="Close reference guide"
        tabindex="-1"
        onclick={() => {
            onClose();
        }}></button>

    <div
        {@attach elementRef<HTMLDivElement>(node => (dialogEl = node))}
        class="relative z-10 flex max-h-[80vh] w-full max-w-xl flex-col overflow-hidden rounded-md border-0 bg-surface text-fg shadow-xl outline-none focus:outline-none md:w-[40vw] md:max-w-none"
        role="dialog"
        tabindex="-1"
        aria-modal="true"
        aria-label="Reference guide"
        onkeydown={onKeydown}>
        <div class="flex items-center justify-between border-b border-line-subtle px-4 py-2.5">
            <span class="text-xs font-bold tracking-wide text-fg select-none">
                Reference Guide
            </span>
            <button
                type="button"
                onclick={() => {
                    onClose();
                }}
                class="flex size-6 shrink-0 cursor-pointer items-center justify-center rounded-md text-fg-muted transition-colors hover:bg-surface-hover hover:text-fg focus-visible:ring-2 focus-visible:ring-accent focus-visible:outline-none"
                aria-label="Close guide">
                <X class="size-3.5" />
            </button>
        </div>

        <div class="flex-1 space-y-3 overflow-y-auto px-2.5 py-2.5 text-xs">
            {#each categories as category (category.id)}
                <section aria-label={category.label}>
                    <CommandSectionHeading
                        label={category.label}
                        context={category.context} />
                    <div class="flex flex-col gap-0.5">
                        {#each category.commands as cmd (cmd.command)}
                            {@const cmdIdx = helpCmdIndexMap.get(cmd.command) ?? 0}
                            {@const CmdIcon = cmd.icon}
                            <button
                                type="button"
                                data-help-idx={cmdIdx}
                                onfocus={() => (activeIndex = cmdIdx)}
                                onclick={() => onSelect(cmd)}
                                onpointermove={() => onPointerMove(cmdIdx)}
                                class={cn(
                                    'group flex w-full cursor-pointer flex-col gap-1.5 rounded-md px-2 py-1.5 text-left transition-colors focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-focus-ring',
                                    activeIndex === cmdIdx ?
                                        'bg-accent/10 text-fg dark:bg-accent/20'
                                    :   'text-fg-secondary hover:bg-surface-hover hover:text-fg'
                                )}>
                                <div class="flex min-w-0 items-start gap-1.5">
                                    <div
                                        class={cn(
                                            'flex size-6 shrink-0 items-center justify-center transition-colors select-none',
                                            activeIndex === cmdIdx ? 'text-fg-accent' : (
                                                'text-fg-secondary group-hover:text-fg-accent'
                                            )
                                        )}>
                                        <CmdIcon class="size-3.5" />
                                    </div>
                                    <div
                                        class="flex min-w-0 flex-1 flex-wrap items-baseline gap-x-2 gap-y-1 py-1">
                                        <span class="text-xs font-medium text-fg">
                                            {cmd.command}{#if cmd.argHint}<span
                                                    class="ml-1 font-normal text-fg-muted">
                                                    {cmd.argHint}</span
                                                >{/if}
                                        </span>
                                        <span
                                            class="hidden text-2xs text-fg-muted/40 select-none sm:inline"
                                            >—</span>
                                        <span
                                            class="min-w-0 basis-full font-sans text-2xs text-fg-muted sm:flex-1 sm:basis-auto">
                                            {cmd.description}
                                        </span>
                                    </div>
                                    {#if COMMAND_SHORTCUTS[cmd.command]}
                                        <span class="shrink-0 pt-1">
                                            <ShortcutBadge
                                                combo={COMMAND_SHORTCUTS[cmd.command]}
                                                leader
                                                active={activeIndex === cmdIdx} />
                                        </span>
                                    {/if}
                                </div>
                                {#if cmd.validArgs.length > 0}
                                    <div
                                        class="flex flex-wrap items-center gap-1 pl-7.5 font-mono text-3xs">
                                        {#each cmd.validArgs as arg (arg)}
                                            <span
                                                class="inline-flex items-center rounded bg-surface-hover px-1 py-0.5 leading-normal text-fg-secondary"
                                                >{arg}</span>
                                        {/each}
                                    </div>
                                {/if}
                            </button>
                        {/each}
                    </div>
                </section>
            {/each}

            <div>
                <CommandSectionHeading label="Search filters" />
                <div class="space-y-0.5 text-2xs">
                    <div
                        class="flex items-center justify-between gap-3 rounded-md px-2 py-1.5 transition-colors hover:bg-surface-hover/70">
                        <div class="flex min-w-0 items-center gap-2">
                            <div
                                class="flex size-6 shrink-0 items-center justify-center text-fg-secondary select-none">
                                <CaseSensitive class="size-3.5" />
                            </div>
                            <span class="font-medium text-fg">Match case</span>
                            <span class="text-fg-muted/40 select-none">—</span>
                            <span class="hidden font-sans text-fg-muted sm:inline"
                                >Case-sensitive search toggle</span>
                        </div>
                        <span class="font-mono text-3xs text-fg-accent">Aa</span>
                    </div>
                    <div
                        class="flex items-center justify-between gap-3 rounded-md px-2 py-1.5 transition-colors hover:bg-surface-hover/70">
                        <div class="flex min-w-0 items-center gap-2">
                            <div
                                class="flex size-6 shrink-0 items-center justify-center text-fg-secondary select-none">
                                <WholeWord class="size-3.5" />
                            </div>
                            <span class="font-medium text-fg">Whole word</span>
                            <span class="text-fg-muted/40 select-none">—</span>
                            <span class="hidden font-sans text-fg-muted sm:inline"
                                >Match exact whole words</span>
                        </div>
                        <span class="font-mono text-3xs text-fg-accent">ab</span>
                    </div>
                    <div
                        class="flex items-center justify-between gap-3 rounded-md px-2 py-1.5 transition-colors hover:bg-surface-hover/70">
                        <div class="flex min-w-0 items-center gap-2">
                            <div
                                class="flex size-6 shrink-0 items-center justify-center text-fg-secondary select-none">
                                <Regex class="size-3.5" />
                            </div>
                            <span class="font-medium text-fg">Regex mode</span>
                            <span class="text-fg-muted/40 select-none">—</span>
                            <span class="hidden font-sans text-fg-muted sm:inline"
                                >Regular expression pattern matching</span>
                        </div>
                        <span class="font-mono text-3xs text-fg-accent">.*</span>
                    </div>
                </div>
            </div>

            <div>
                <CommandSectionHeading label="Keyboard shortcuts" />
                <button
                    type="button"
                    class="flex w-full cursor-pointer items-center justify-between gap-3 rounded-md px-2 py-1.5 text-left transition-colors hover:bg-surface-hover/70 focus-visible:outline-2 focus-visible:outline-focus-ring"
                    onclick={() => {
                        onOpenShortcuts();
                    }}>
                    <div class="flex min-w-0 items-center gap-2">
                        <div
                            class="flex size-6 shrink-0 items-center justify-center text-fg-secondary select-none">
                            <Keyboard class="size-3.5" />
                        </div>
                        <span class="font-sans text-2xs text-fg-secondary">
                            Browse keyboard shortcuts on this page
                        </span>
                    </div>
                    <span class="flex shrink-0 items-center gap-1">
                        <ShortcutBadge
                            combo={CATALOG_KEY}
                            leader />
                    </span>
                </button>
            </div>
        </div>

        <div
            class="hidden flex-none items-center justify-end gap-2.5 border-t border-line-subtle px-3.5 py-2 text-2xs leading-none select-none sm:flex">
            <span class="flex items-center gap-1">
                {@render iconKey(ArrowUpDown)}
                <span class="text-fg-muted">navigate</span>
            </span>
            <span class="flex items-center gap-1">
                {@render iconKey(CornerDownLeft)}
                <span class="text-fg-muted">execute</span>
            </span>
            <span class="flex items-center gap-1">
                <ShortcutBadge combo="Esc" />
                <span class="text-fg-muted">close</span>
            </span>
        </div>
    </div>
</div>
