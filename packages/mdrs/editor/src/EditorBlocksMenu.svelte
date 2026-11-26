<!--
SPDX-FileCopyrightText: 2026 Farhan Kurnia Pratama

SPDX-License-Identifier: MIT OR Apache-2.0
-->

<script lang="ts">
    import {
        Blocks,
        BookOpen,
        ChartLine,
        ChevronsUpDown,
        CircleAlert,
        FileCode,
        Footprints,
        Info,
        Lightbulb,
        MessageSquareText,
        MessageSquareWarning,
        MonitorPlay,
        PanelsTopLeft,
        Sigma,
        Split,
        TriangleAlert,
        Type,
        Variable,
        Workflow
    } from '@lucide/svelte';
    import type { Component } from 'svelte';
    import { cn } from '@idstead/ui/utils/cn.ts';
    import Dropdown from '@idstead/ui/components/Dropdown.svelte';
    import IconButton from '@idstead/ui/components/IconButton.svelte';

    interface Props {
        insertBlock: (opening: string, closing?: string) => void;
        insertDefine: () => void;
        insertVerbatim: () => void;
    }

    let { insertBlock, insertDefine, insertVerbatim }: Props = $props();

    interface Block {
        label: string;
        icon: Component<{ class?: string }>;
        insert: () => void;
    }

    const container = (name: string) => () => insertBlock(`:::${name}\n`, '\n:::');

    const sections: { title: string; blocks: Block[] }[] = [
        {
            title: 'Data',
            blocks: [
                { label: 'Variables', icon: Variable, insert: () => insertDefine() },
                {
                    label: 'Conditional',
                    icon: Split,
                    insert: () => insertBlock(':::if true\n', '\n:::endif')
                }
            ]
        },
        {
            title: 'Callouts',
            blocks: [
                {
                    label: 'Callout',
                    icon: MessageSquareText,
                    insert: () => insertBlock(':::callout title="Title"\n', '\n:::')
                },
                { label: 'Note', icon: Info, insert: container('note') },
                { label: 'Tip', icon: Lightbulb, insert: container('tip') },
                { label: 'Important', icon: MessageSquareWarning, insert: container('important') },
                { label: 'Warning', icon: TriangleAlert, insert: container('warning') },
                { label: 'Caution', icon: CircleAlert, insert: container('caution') }
            ]
        },
        {
            title: 'Layout',
            blocks: [
                {
                    label: 'Details',
                    icon: ChevronsUpDown,
                    insert: () => insertBlock(':::details summary="Details"\n', '\n:::')
                },
                {
                    label: 'Tabs',
                    icon: PanelsTopLeft,
                    insert: () =>
                        insertBlock(
                            ':::tabs\n::tab label="First"\n',
                            '\n::\n::tab label="Second"\n\n::\n:::'
                        )
                },
                {
                    label: 'Snippets',
                    icon: FileCode,
                    insert: () =>
                        insertBlock(
                            ':::snippets\n::tab label="JavaScript"\n```js\n',
                            '\n```\n::\n::tab label="Python"\n```python\n\n```\n::\n:::'
                        )
                },
                { label: 'Steps', icon: Footprints, insert: container('steps') }
            ]
        },
        {
            title: 'Media',
            blocks: [
                { label: 'Math', icon: Sigma, insert: container('math') },
                {
                    label: 'Embed',
                    icon: MonitorPlay,
                    insert: () => insertBlock(':::embed url="https://youtu.be/"')
                },
                {
                    label: 'Chart',
                    icon: ChartLine,
                    insert: () =>
                        insertBlock(
                            '```chart\ntype: line\nx: month\ny: users\ndata:\n  - { month: "Jan", users: 10 }\n  - { month: "Feb", users: 20 }\n```'
                        )
                },
                {
                    label: 'Diagram',
                    icon: Workflow,
                    insert: () => insertBlock('```mermaid\nflowchart LR\n  A --> B\n```')
                }
            ]
        },
        {
            title: 'Other',
            blocks: [
                {
                    label: 'References',
                    icon: BookOpen,
                    insert: () => insertBlock(':::references\n[^1]: Source\n\n:::')
                },
                { label: 'Verbatim', icon: Type, insert: () => insertVerbatim() }
            ]
        }
    ];
</script>

<Dropdown
    ariaLabel="Insert an MDRS block"
    placement="bottom-end">
    {#snippet trigger({ isOpen, toggle })}
        <IconButton
            ariaLabel="Insert an MDRS block"
            tooltip="Insert block"
            variant="ghost"
            size="2xs"
            class={cn(isOpen && 'bg-surface-hover text-fg')}
            aria-haspopup="dialog"
            aria-expanded={isOpen}
            onclick={toggle}>
            <Blocks class="size-4" />
        </IconButton>
    {/snippet}
    {#snippet children({ close })}
        <div class="flex max-h-[70vh] w-80 max-w-[calc(100vw-1rem)] flex-col gap-3 overflow-y-auto p-3 text-xs">
            {#each sections as section (section.title)}
                <section class="flex flex-col gap-1">
                    <h3 class="font-medium text-fg-muted">{section.title}</h3>
                    <div class="grid grid-cols-2 gap-0.5">
                        {#each section.blocks as block (block.label)}
                            <button
                                type="button"
                                class="flex min-w-0 cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-left text-fg-secondary transition-colors hover:bg-fg/5 hover:text-fg focus-visible:bg-fg/5 focus-visible:outline-none"
                                onclick={() => {
                                    close();
                                    block.insert();
                                }}>
                                <block.icon class="size-3.5 shrink-0" />
                                <span class="truncate">{block.label}</span>
                            </button>
                        {/each}
                    </div>
                </section>
            {/each}
        </div>
    {/snippet}
</Dropdown>
