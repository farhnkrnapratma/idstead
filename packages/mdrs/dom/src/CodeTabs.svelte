<script lang="ts">
    import { Copy, CopyCheck, Download } from '@lucide/svelte';
    import { cn } from '@idstead/ui/utils/cn.ts';
    import { copyText, downloadUrl } from '@idstead/ui/utils/fileActions.ts';
    import { bindCodeTheme, CODE_ICON_BUTTON_CLASS } from './codeBlocks';
    import { createCodeScrollbar } from './codeScrollbar';
    import { getTabPreference, onTabPreference, setTabPreference } from './tabs';

    interface CodeTab {
        label: string;
        code: string;
        copyLabel?: string;
        downloadUrl?: string;
        downloadLabel?: string;
    }

    interface Props {
        tabs: CodeTab[];
        ariaLabel: string;
        syncKey?: string;
        command?: boolean;
        class?: string;
    }

    let { tabs, ariaLabel, syncKey, command = false, class: className = '' }: Props = $props();

    const id = $props.id();
    let active = $state(0);
    let copied = $state(false);
    let copyTimer: ReturnType<typeof setTimeout> | undefined;
    let scrollbarUpdate: (() => void) | undefined;
    const current = $derived(tabs[Math.min(active, tabs.length - 1)]);

    $effect(() => {
        void current.code;
        queueMicrotask(() => scrollbarUpdate?.());
    });

    $effect(() => {
        if (!syncKey) return;
        const follow = (label: string | undefined) => {
            const index = tabs.findIndex(tab => tab.label === label);
            if (index >= 0) active = index;
        };
        follow(getTabPreference(syncKey));
        return onTabPreference((key, label) => {
            if (key === syncKey) follow(label);
        });
    });

    function choose(index: number) {
        active = index;
        if (syncKey) setTabPreference(syncKey, tabs[index].label);
    }

    function select(index: number) {
        choose((index + tabs.length) % tabs.length);
        document.getElementById(`${id}-tab-${active}`)?.focus();
    }

    function onKeydown(event: KeyboardEvent) {
        const moves: Record<string, number> = {
            ArrowRight: active + 1,
            ArrowLeft: active - 1,
            Home: 0,
            End: tabs.length - 1
        };
        if (!(event.key in moves)) return;
        event.preventDefault();
        select(moves[event.key]);
    }

    async function copy() {
        if (!(await copyText(current.code, current.copyLabel ?? 'Code'))) return;
        copied = true;
        clearTimeout(copyTimer);
        copyTimer = setTimeout(() => (copied = false), 1500);
    }

    function enhance(container: HTMLElement) {
        const body = container.querySelector<HTMLElement>('.mdrs-code-body');
        const header = container.querySelector<HTMLElement>('.mdrs-snippets-header');
        const pre = container.querySelector<HTMLElement>('pre');
        if (!body || !header || !pre) return;
        const bar = createCodeScrollbar(pre, { reserve: true });
        container.querySelector('.mdrs-snippets-body')?.appendChild(bar.element);
        bindCodeTheme(container, body, [header, bar.element]);
        scrollbarUpdate = bar.update;
        bar.update();
        return () => {
            bar.destroy();
            bar.element.remove();
            scrollbarUpdate = undefined;
        };
    }
</script>

<div
    class={cn('mdrs-snippets my-0!', className)}
    {@attach enhance}>
    <div class="mdrs-snippets-header hljs">
        <div
            role="tablist"
            aria-label={ariaLabel}
            tabindex="-1"
            class="mdrs-snippets-nav"
            onkeydown={onKeydown}>
            {#each tabs as tab, index (index)}
                <button
                    type="button"
                    role="tab"
                    id="{id}-tab-{index}"
                    aria-selected={index === active}
                    aria-controls="{id}-panel"
                    tabindex={index === active ? 0 : -1}
                    onclick={() => choose(index)}
                    class={cn(
                        'mdrs-tab focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-focus-ring',
                        index === active && 'mdrs-is-active'
                    )}>
                    {tab.label}
                </button>
            {/each}
        </div>
        <div class="mdrs-snippets-actions">
            {#if current.downloadUrl}
                {@const url = current.downloadUrl}
                <button
                    type="button"
                    class={CODE_ICON_BUTTON_CLASS}
                    aria-label={current.downloadLabel ?? `Download ${current.label}`}
                    title={current.downloadLabel ?? `Download ${current.label}`}
                    onclick={() => downloadUrl(url)}>
                    <Download
                        class="size-3"
                        aria-hidden="true" />
                </button>
            {/if}
            <button
                type="button"
                class={CODE_ICON_BUTTON_CLASS}
                aria-label="Copy {current.copyLabel?.toLowerCase() ?? 'code'}"
                title="Copy"
                onclick={copy}>
                {#if copied}
                    <CopyCheck
                        class="size-3 text-accent-text"
                        aria-hidden="true" />
                {:else}
                    <Copy
                        class="size-3"
                        aria-hidden="true" />
                {/if}
            </button>
        </div>
    </div>
    <div class="mdrs-snippets-body">
        <div
            id="{id}-panel"
            role="tabpanel"
            aria-labelledby="{id}-tab-{active}"
            tabindex="0"
            class="mdrs-code-body mdrs-code-body--in-tabs hljs focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-focus-ring">
            {#if command}
                <div
                    class="mdrs-code-gutter mdrs-code-gutter--command"
                    aria-hidden="true">
                    <div class="mdrs-code-prompt">$</div>
                </div>
            {/if}
            <pre
                class="m-0 min-w-0 flex-1 scrollbar-none overflow-x-auto rounded-none border-0 bg-transparent px-0 pt-0 pb-1.5 font-mono text-code leading-snug whitespace-pre [-ms-overflow-style:none] focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-focus-ring"><code
                    ><div
                        class={cn(
                            'mdrs-code-line',
                            command ? 'mdrs-code-line--command' : 'pl-3'
                        )}>{current.code}</div></code></pre>
        </div>
    </div>
</div>
