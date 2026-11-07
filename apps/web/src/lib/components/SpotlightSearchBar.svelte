<!--
SPDX-FileCopyrightText: 2026 Farhan Kurnia Pratama

SPDX-License-Identifier: AGPL-3.0-only
-->

<script lang="ts">
    import Button from '@idstead/ui/components/Button.svelte';
    import { cn } from '@idstead/ui/utils/cn.ts';
    import { elementRef } from '@idstead/ui/utils/elementRef.ts';
    import { CaseSensitive, Regex, WholeWord } from '@lucide/svelte';

    interface Props {
        rawQuery?: string;
        activeIndex: number;
        isCaseSensitive: boolean;
        isWholeWord: boolean;
        isRegex: boolean;
        inputEl?: HTMLInputElement | null;
        onInput: () => void;
        onKeydown: (event: KeyboardEvent) => void;
        onToggle: (option: 'case' | 'word' | 'regex') => void;
    }

    let {
        rawQuery = $bindable(''),
        activeIndex,
        isCaseSensitive,
        isWholeWord,
        isRegex,
        inputEl = $bindable(null),
        onInput,
        onKeydown,
        onToggle
    }: Props = $props();
</script>

<div
    class="flex items-center justify-between border-b border-line-subtle px-3 py-1.5 sm:px-4 sm:py-2">
    <input
        {@attach elementRef<HTMLInputElement>(node => (inputEl = node))}
        bind:value={rawQuery}
        oninput={onInput}
        onkeydown={onKeydown}
        type="search"
        id="spotlight-search-input"
        name="q"
        spellcheck="false"
        autocomplete="off"
        placeholder="Search or type / for commands..."
        class="search-input min-w-0 flex-1 border-none! border-transparent! bg-transparent py-0! pt-0! pb-0! text-xs font-medium text-fg shadow-none! ring-0! ring-transparent! ring-offset-0! outline-none! [-webkit-box-shadow:none]! [-webkit-tap-highlight-color:transparent] placeholder:text-xs placeholder:font-normal placeholder:text-fg-muted focus:border-none! focus:border-transparent! focus:shadow-none! focus:ring-0! focus:ring-transparent! focus:outline-none! focus-visible:border-none! focus-visible:border-transparent! focus-visible:shadow-none! focus-visible:ring-0! focus-visible:ring-transparent! focus-visible:outline-none! active:border-none! active:border-transparent! active:shadow-none! active:ring-0! active:ring-transparent! active:outline-none!"
        aria-label="Search query"
        aria-autocomplete="list"
        aria-controls="search-results"
        aria-activedescendant={activeIndex >= 0 ? `result-${activeIndex}` : undefined} />

    <div class="flex shrink-0 items-center gap-0.5 pl-1.5 select-none sm:gap-1 sm:pl-2">
        <Button
            type="ghost"
            size="xs"
            class="flex size-5 cursor-pointer items-center justify-center rounded p-0 transition-colors hover:bg-surface-hover sm:size-6 sm:rounded-md"
            title="Match Case ({isCaseSensitive ? 'ON' : 'OFF'})"
            aria-label="Toggle case sensitivity"
            aria-pressed={isCaseSensitive}
            onclick={() => onToggle('case')}>
            <CaseSensitive
                class={cn(
                    'size-3 transition-colors sm:size-3.5',
                    isCaseSensitive ? 'text-fg-accent' : 'text-fg-muted hover:text-fg'
                )} />
        </Button>

        <Button
            type="ghost"
            size="xs"
            class="flex size-5 cursor-pointer items-center justify-center rounded p-0 transition-colors hover:bg-surface-hover sm:size-6 sm:rounded-md"
            title="Match Whole Word ({isWholeWord ? 'ON' : 'OFF'})"
            aria-label="Toggle whole word search"
            aria-pressed={isWholeWord}
            onclick={() => onToggle('word')}>
            <WholeWord
                class={cn(
                    'size-3 transition-colors sm:size-3.5',
                    isWholeWord ? 'text-fg-accent' : 'text-fg-muted hover:text-fg'
                )} />
        </Button>

        <Button
            type="ghost"
            size="xs"
            class="flex size-5 cursor-pointer items-center justify-center rounded p-0 transition-colors hover:bg-surface-hover sm:size-6 sm:rounded-md"
            title="Use Regular Expression ({isRegex ? 'ON' : 'OFF'})"
            aria-label="Toggle regular expression search"
            aria-pressed={isRegex}
            onclick={() => onToggle('regex')}>
            <Regex
                class={cn(
                    'size-3 transition-colors sm:size-3.5',
                    isRegex ? 'text-fg-accent' : 'text-fg-muted hover:text-fg'
                )} />
        </Button>
    </div>
</div>

<style>
    @reference "@idstead/ui/styles/global.css";

    .search-input::-webkit-search-cancel-button,
    .search-input::-webkit-search-decoration,
    .search-input::-webkit-search-results-button,
    .search-input::-webkit-search-results-decoration {
        @apply hidden appearance-none;
    }
</style>
