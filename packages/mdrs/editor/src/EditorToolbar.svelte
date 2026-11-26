<!--
SPDX-FileCopyrightText: 2026 Farhan Kurnia Pratama

SPDX-License-Identifier: MIT OR Apache-2.0
-->

<script lang="ts">
    import {
        Baseline,
        Bold,
        BookOpen,
        ChartLine,
        ChevronDown,
        ChevronsUpDown,
        CircleAlert,
        Code,
        FileCode,
        Footprints,
        Heading,
        Heading1,
        Heading2,
        Heading3,
        Heading4,
        Heading5,
        Heading6,
        Highlighter,
        Image as ImageIcon,
        Info,
        Italic,
        Keyboard,
        Lightbulb,
        Link2 as LinkIcon,
        List,
        ListOrdered,
        ListTodo,
        MessageSquareText,
        MessageSquareWarning,
        Minus,
        MonitorPlay,
        PanelsTopLeft,
        Plus,
        Quote,
        Sigma,
        Split,
        SquareCode,
        Strikethrough,
        Subscript,
        Superscript,
        Table as TableIcon,
        TriangleAlert,
        Type,
        Underline,
        Variable,
        Video,
        Workflow
    } from '@lucide/svelte';
    import type { DropdownAction } from '@idstead/ui/components/Dropdown.svelte';
    import { assetAltText } from '@idstead/domain/assetNaming.ts';
    import type { Component } from 'svelte';
    import Dropdown from '@idstead/ui/components/Dropdown.svelte';
    import { assetMarkdown } from './textEdits';

    interface Props {
        insert: (prefix: string, suffix?: string) => void;
        prefixLines: (prefix: string) => void;
        insertBlock: (opening: string, closing?: string) => void;
        insertDefine: () => void;
        insertVerbatim: () => void;
        onImageUpload?: (file: File) => Promise<string | null>;
        onVideoUpload?: (file: File) => Promise<string | null>;
    }

    let {
        insert,
        prefixLines,
        insertBlock,
        insertDefine,
        insertVerbatim,
        onImageUpload, onVideoUpload }: Props = $props();

    let imageFileInput = $state<HTMLInputElement | null>(null);
    let videoFileInput = $state<HTMLInputElement | null>(null);

    function handleImageClick() {
        if (onImageUpload) imageFileInput?.click();
        else insert('![', '](url)');
    }

    function handleVideoClick() {
        if (onVideoUpload) videoFileInput?.click();
        else insert('![Video](', ')');
    }

    async function uploadAsset(
        event: Event,
        upload: ((file: File) => Promise<string | null>) | undefined,
        fallbackAlt: string,
        suffix: string
    ) {
        const input = event.target as HTMLInputElement;
        const file = input.files?.[0];
        if (!file || !upload) return;
        try {
            const url = await upload(file);
            if (url) insert(`${assetMarkdown(url, assetAltText(file.name, fallbackAlt))}${suffix}`);
        } catch {
        } finally {
            input.value = '';
        }
    }

    const handleFileSelected = (event: Event) => uploadAsset(event, onImageUpload, 'Image', '');
    const handleVideoFileSelected = (event: Event) =>
        uploadAsset(event, onVideoUpload, 'Video', '\n');

    interface Tool {
        label: string;
        icon: Component;
        action: () => void;
    }

    const headingTools: Tool[] = [
        { label: 'H1 heading', icon: Heading1, action: () => prefixLines('# ') },
        { label: 'H2 heading', icon: Heading2, action: () => prefixLines('## ') },
        { label: 'H3 heading', icon: Heading3, action: () => prefixLines('### ') }
    ];

    const moreHeadings: DropdownAction[] = [
        { label: 'Heading 4', icon: Heading4, onSelect: () => prefixLines('#### ') },
        { label: 'Heading 5', icon: Heading5, onSelect: () => prefixLines('##### ') },
        { label: 'Heading 6', icon: Heading6, onSelect: () => prefixLines('###### ') }
    ];

    const textTools: Tool[] = [
        { label: 'Bold', icon: Bold, action: () => insert('**', '**') },
        { label: 'Italic', icon: Italic, action: () => insert('*', '*') },
        { label: 'Underline', icon: Underline, action: () => insert('<u>', '</u>') },
        { label: 'Strikethrough', icon: Strikethrough, action: () => insert('~~', '~~') },
        { label: 'Inline code', icon: Code, action: () => insert('`', '`') }
    ];

    const moreTextStyles: DropdownAction[] = [
        { label: 'Highlight', icon: Highlighter, onSelect: () => insert('<mark>', '</mark>') },
        { label: 'Keyboard key', icon: Keyboard, onSelect: () => insert('<kbd>', '</kbd>') },
        { label: 'Subscript', icon: Subscript, onSelect: () => insert('<sub>', '</sub>') },
        { label: 'Superscript', icon: Superscript, onSelect: () => insert('<sup>', '</sup>') }
    ];

    const structureTools: Tool[] = [
        { label: 'Bulleted list', icon: List, action: () => prefixLines('- ') },
        { label: 'Numbered list', icon: ListOrdered, action: () => prefixLines('1. ') },
        { label: 'Task list', icon: ListTodo, action: () => prefixLines('- [ ] ') },
        { label: 'Blockquote', icon: Quote, action: () => prefixLines('> ') }
    ];

    const insertTools: Tool[] = [
        { label: 'Insert link', icon: LinkIcon, action: () => insert('[', '](url)') },
        { label: 'Insert image', icon: ImageIcon, action: handleImageClick },
        { label: 'Insert video', icon: Video, action: handleVideoClick },
        {
            label: 'Insert table',
            icon: TableIcon,
            action: () =>
                insertBlock('| Header 1 | Header 2 |\n| -------- | -------- |\n| Cell 1   | Cell 2   |')
        },
        { label: 'Code block', icon: SquareCode, action: () => insertBlock('```\n', '\n```') },
        { label: 'Horizontal rule', icon: Minus, action: () => insertBlock('---') }
    ];

    const container = (name: string) => () => insertBlock(`:::${name}\n`, '\n:::');

    const mdrsBlocks: DropdownAction[] = [
        { label: 'Variables (define)', icon: Variable, onSelect: () => insertDefine() },
        { label: 'Conditional (if)', icon: Split, onSelect: () => insertBlock(':::if true\n', '\n:::endif') },
        {
            label: 'Callout',
            icon: MessageSquareText,
            onSelect: () => insertBlock(':::callout title="Title"\n', '\n:::')
        },
        { label: 'Note', icon: Info, onSelect: container('note') },
        { label: 'Tip', icon: Lightbulb, onSelect: container('tip') },
        { label: 'Important', icon: MessageSquareWarning, onSelect: container('important') },
        { label: 'Warning', icon: TriangleAlert, onSelect: container('warning') },
        { label: 'Caution', icon: CircleAlert, onSelect: container('caution') },
        {
            label: 'Collapsible details',
            icon: ChevronsUpDown,
            onSelect: () => insertBlock(':::details summary="Details"\n', '\n:::')
        },
        {
            label: 'Tabs',
            icon: PanelsTopLeft,
            onSelect: () =>
                insertBlock(':::tabs\n::tab label="First"\n', '\n::\n::tab label="Second"\n\n::\n:::')
        },
        {
            label: 'Code snippets',
            icon: FileCode,
            onSelect: () =>
                insertBlock(
                    ':::snippets\n::tab label="JavaScript"\n```js\n',
                    '\n```\n::\n::tab label="Python"\n```python\n\n```\n::\n:::'
                )
        },
        { label: 'Steps', icon: Footprints, onSelect: container('steps') },
        { label: 'Math', icon: Sigma, onSelect: container('math') },
        {
            label: 'Embed',
            icon: MonitorPlay,
            onSelect: () => insertBlock(':::embed url="https://youtu.be/"')
        },
        {
            label: 'Chart',
            icon: ChartLine,
            onSelect: () =>
                insertBlock(
                    '```chart\ntype: line\nx: month\ny: users\ndata:\n  - { month: "Jan", users: 10 }\n  - { month: "Feb", users: 20 }\n```'
                )
        },
        {
            label: 'Diagram',
            icon: Workflow,
            onSelect: () => insertBlock('```mermaid\nflowchart LR\n  A --> B\n```')
        },
        {
            label: 'References',
            icon: BookOpen,
            onSelect: () => insertBlock(':::references\n[^1]: Source\n\n:::')
        },
        { label: 'Verbatim', icon: Type, onSelect: () => insertVerbatim() }
    ];
</script>

{#snippet toolButton(tool: Tool)}
    <button
        type="button"
        onclick={tool.action}
        aria-label={tool.label}
        class="touch-target relative flex h-7 w-7 shrink-0 cursor-pointer items-center justify-center rounded-md transition-colors hover:bg-surface-hover/30 hover:text-fg">
        <tool.icon class="size-4" />
    </button>
{/snippet}

{#snippet separator()}
    <div
        class="mx-1 h-4 w-px shrink-0 bg-line-subtle"
        aria-hidden="true">
    </div>
{/snippet}

{#snippet menu(label: string, Icon: Component, actions: DropdownAction[])}
    <Dropdown
        ariaLabel={label}
        {actions}>
        {#snippet trigger({ isOpen, toggle })}
            <button
                type="button"
                onclick={toggle}
                aria-label={label}
                aria-haspopup="menu"
                aria-expanded={isOpen}
                class="touch-target relative flex h-7 shrink-0 cursor-pointer items-center justify-center gap-0.5 rounded-md px-1 transition-colors hover:bg-surface-hover/30 hover:text-fg">
                <Icon class="size-4" />
                <ChevronDown
                    class="size-3 transition-transform duration-200 {isOpen ? 'rotate-180' : ''}" />
            </button>
        {/snippet}
    </Dropdown>
{/snippet}

<div
    class="editor-chrome editor-toolbar flex min-h-10 items-stretch border-b p-0 text-xs select-none">
    <div
        class="editor-toolbar-scroll flex min-w-0 flex-1 scrollbar-none items-center gap-1 overflow-x-auto px-2 py-1.5 sm:px-3"
        role="toolbar"
        aria-label="Formatting tools">
        {#each headingTools as tool (tool.label)}
            {@render toolButton(tool)}
        {/each}
        {@render menu('More headings (H4-H6)', Heading, moreHeadings)}

        {@render separator()}

        {#each textTools as tool (tool.label)}
            {@render toolButton(tool)}
        {/each}
        {@render menu('More text styles', Baseline, moreTextStyles)}

        {@render separator()}

        {#each structureTools as tool (tool.label)}
            {@render toolButton(tool)}
        {/each}

        {@render separator()}

        {#each insertTools as tool (tool.label)}
            {@render toolButton(tool)}
        {/each}
        <input
            type="file"
            bind:this={imageFileInput}
            name="image-upload"
            accept="image/png, image/webp, image/avif, image/jpeg, image/jpg"
            onchange={handleFileSelected}
            class="hidden"
            aria-label="Upload image file" />
        <input
            type="file"
            bind:this={videoFileInput}
            name="video-upload"
            accept="video/webm,.webm"
            onchange={handleVideoFileSelected}
            class="hidden"
            aria-label="Upload video file" />

        <div class="ml-auto shrink-0 pl-2">
            <Dropdown
                ariaLabel="Insert an MDRS block"
                placement="bottom-end"
                actions={mdrsBlocks}>
                {#snippet trigger({ isOpen, toggle })}
                    <button
                        type="button"
                        onclick={toggle}
                        aria-label="Insert an MDRS block"
                        aria-haspopup="menu"
                        aria-expanded={isOpen}
                        class="editor-tab-list touch-target relative flex h-7 cursor-pointer items-center gap-1 rounded-md border px-2 font-mono text-xs font-medium transition-colors hover:bg-fg/5 hover:text-fg {isOpen ? 'bg-fg/5 text-fg' : 'text-fg-secondary'}">
                        <Plus class="size-3.5" />
                        <span>Blocks</span>
                        <ChevronDown
                            class="size-3 transition-transform duration-200 {isOpen ? 'rotate-180' : ''}" />
                    </button>
                {/snippet}
            </Dropdown>
        </div>
    </div>
</div>
