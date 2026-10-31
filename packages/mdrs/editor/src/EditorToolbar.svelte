<script lang="ts">
    import {
        Bold,
        ChevronDown,
        ChevronsUpDown,
        Code,
        Ellipsis,
        Heading,
        Heading1,
        Heading2,
        Heading3,
        Heading4,
        Heading5,
        Heading6,
        Highlighter,
        Image as ImageIcon,
        Italic,
        Keyboard,
        Link2 as LinkIcon,
        List,
        ListOrdered,
        ListTodo,
        Minus,
        Quote,
        SquareCode,
        Strikethrough,
        Subscript,
        Superscript,
        Table as TableIcon,
        Underline,
        Video
    } from '@lucide/svelte';
    import { assetAltText } from '@idstead/domain/assetNaming.ts';
    import type { Component } from 'svelte';
    import Dropdown from '@idstead/ui/components/Dropdown.svelte';
    import { assetMarkdown } from './textEdits';

    interface Props {
        insert: (prefix: string, suffix?: string) => void;
        onImageUpload?: (file: File) => Promise<string | null>;
        onVideoUpload?: (file: File) => Promise<string | null>;
    }

    let { insert, onImageUpload, onVideoUpload }: Props = $props();

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
        { label: 'H1 heading', icon: Heading1, action: () => insert('# ') },
        { label: 'H2 heading', icon: Heading2, action: () => insert('## ') },
        { label: 'H3 heading', icon: Heading3, action: () => insert('### ') }
    ];

    const inlineTools: Tool[] = [
        { label: 'Bold', icon: Bold, action: () => insert('**', '**') },
        { label: 'Italic', icon: Italic, action: () => insert('*', '*') },
        { label: 'Underline', icon: Underline, action: () => insert('<u>', '</u>') },
        { label: 'Strikethrough', icon: Strikethrough, action: () => insert('~~', '~~') },
        { label: 'Inline code', icon: Code, action: () => insert('`', '`') }
    ];

    const blockTools: Tool[] = [
        { label: 'Insert link', icon: LinkIcon, action: () => insert('[', '](url)') },
        { label: 'Numbered list', icon: ListOrdered, action: () => insert('1. ') },
        { label: 'Bulleted list', icon: List, action: () => insert('- ') },
        { label: 'Task list', icon: ListTodo, action: () => insert('- [ ] ') },
        { label: 'Blockquote', icon: Quote, action: () => insert('> ') }
    ];

    const codeBlockTool: Tool = {
        label: 'Code block',
        icon: SquareCode,
        action: () => insert('```\n', '\n```')
    };
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

<div
    class="editor-chrome editor-toolbar flex min-h-10 items-stretch border-b p-0 text-xs select-none">
    <div
        class="editor-toolbar-scroll flex min-w-0 flex-1 scrollbar-none items-center gap-1 overflow-x-auto px-2 py-1.5 sm:px-3"
        role="toolbar"
        aria-label="Formatting tools">
        {#each headingTools as tool (tool.label)}
            {@render toolButton(tool)}
        {/each}

        <Dropdown
            ariaLabel="More headings"
            actions={[
                { label: 'Heading 4', icon: Heading4, onSelect: () => insert('#### ') },
                { label: 'Heading 5', icon: Heading5, onSelect: () => insert('##### ') },
                { label: 'Heading 6', icon: Heading6, onSelect: () => insert('###### ') }
            ]}>
            {#snippet trigger({ isOpen, toggle })}
                <button
                    type="button"
                    onclick={toggle}
                    aria-label="More headings (H4-H6)"
                    aria-haspopup="menu"
                    aria-expanded={isOpen}
                    class="touch-target relative flex h-7 shrink-0 cursor-pointer items-center justify-center gap-0.5 rounded-md px-1 transition-colors hover:bg-surface-hover/30 hover:text-fg">
                    <Heading class="size-4" />
                    <ChevronDown
                        class="size-3 transition-transform duration-200 {isOpen ? 'rotate-180' : (
                            ''
                        )}" />
                </button>
            {/snippet}
        </Dropdown>

        {@render separator()}

        {#each inlineTools as tool (tool.label)}
            {@render toolButton(tool)}
        {/each}

        {@render separator()}

        {@render toolButton({ label: 'Insert image', icon: ImageIcon, action: handleImageClick })}
        <input
            type="file"
            bind:this={imageFileInput}
            name="image-upload"
            accept="image/png, image/webp, image/avif, image/jpeg, image/jpg"
            onchange={handleFileSelected}
            class="hidden"
            aria-label="Upload image file" />
        {@render toolButton({ label: 'Insert video', icon: Video, action: handleVideoClick })}
        <input
            type="file"
            bind:this={videoFileInput}
            name="video-upload"
            accept="video/webm,.webm"
            onchange={handleVideoFileSelected}
            class="hidden"
            aria-label="Upload video file" />
        {#each blockTools as tool (tool.label)}
            {@render toolButton(tool)}
        {/each}

        {@render separator()}

        {@render toolButton(codeBlockTool)}

        {@render separator()}

        <Dropdown
            ariaLabel="More formatting options"
            actions={[
                {
                    onSelect: () => insert('<kbd>', '</kbd>'),
                    icon: Keyboard,
                    label: 'Keyboard key'
                },
                {
                    onSelect: () => insert('<mark>', '</mark>'),
                    icon: Highlighter,
                    label: 'Highlight'
                },
                { onSelect: () => insert('<sub>', '</sub>'), icon: Subscript, label: 'Subscript' },
                {
                    onSelect: () => insert('<sup>', '</sup>'),
                    icon: Superscript,
                    label: 'Superscript'
                },
                {
                    onSelect: () =>
                        insert(
                            '| Header 1 | Header 2 |\n|----------|-----------|\n|  Cell 1  |  Cell 2  |\n'
                        ),
                    icon: TableIcon,
                    label: 'Add table'
                },
                {
                    onSelect: () => insert(':::details summary="Details"\n', '\n:::\n'),
                    icon: ChevronsUpDown,
                    label: 'Collapsible details'
                },
                { onSelect: () => insert('\n---\n'), icon: Minus, label: 'Horizontal rule' }
            ]}>
            {#snippet trigger({ isOpen, toggle })}
                <button
                    type="button"
                    onclick={toggle}
                    aria-label="More formatting options"
                    aria-haspopup="menu"
                    aria-expanded={isOpen}
                    class="touch-target relative flex h-7 w-7 shrink-0 cursor-pointer items-center justify-center rounded-md transition-colors hover:bg-surface-hover/30 hover:text-fg">
                    <Ellipsis class="size-4" />
                </button>
            {/snippet}
        </Dropdown>
    </div>
</div>
