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
</script>

<div
    class="editor-chrome editor-toolbar flex min-h-10 items-stretch border-b p-0 text-xs select-none">
    <div
        class="editor-toolbar-scroll flex min-w-0 flex-1 scrollbar-none items-center gap-1 overflow-x-auto px-2 py-1.5 sm:px-3"
        role="toolbar"
        aria-label="Formatting tools">
        {#each [{ action: () => insert('# '), icon: Heading1, label: 'H1 heading' }, { action: () => insert('## '), icon: Heading2, label: 'H2 heading' }, { action: () => insert('### '), icon: Heading3, label: 'H3 heading' }] as const as item (item.label)}
            <button
                type="button"
                onclick={item.action}
                aria-label={item.label}
                class="touch-target relative flex h-7 w-7 shrink-0 cursor-pointer items-center justify-center rounded-md transition-colors hover:bg-surface-hover/30 hover:text-fg">
                <item.icon class="size-4" />
            </button>
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

        <div
            class="mx-1 h-4 w-px shrink-0 bg-line-subtle"
            aria-hidden="true">
        </div>

        {#each [{ action: () => insert('**', '**'), icon: Bold, label: 'Bold' }, { action: () => insert('*', '*'), icon: Italic, label: 'Italic' }, { action: () => insert('<u>', '</u>'), icon: Underline, label: 'Underline' }, { action: () => insert('~~', '~~'), icon: Strikethrough, label: 'Strikethrough' }, { action: () => insert('`', '`'), icon: Code, label: 'Inline code' }] as const as item (item.label)}
            <button
                type="button"
                onclick={item.action}
                aria-label={item.label}
                class="touch-target relative flex h-7 w-7 shrink-0 cursor-pointer items-center justify-center rounded-md transition-colors hover:bg-surface-hover/30 hover:text-fg">
                <item.icon class="size-4" />
            </button>
        {/each}

        <div
            class="mx-1 h-4 w-px shrink-0 bg-line-subtle"
            aria-hidden="true">
        </div>

        <button
            type="button"
            onclick={handleImageClick}
            title="Upload image"
            aria-label="Insert image"
            class="touch-target relative flex h-7 w-7 shrink-0 cursor-pointer items-center justify-center rounded-md transition-colors hover:bg-surface-hover/30 hover:text-fg">
            <ImageIcon class="size-4" />
        </button>
        <input
            type="file"
            bind:this={imageFileInput}
            name="image-upload"
            accept="image/png, image/webp, image/avif, image/jpeg, image/jpg"
            onchange={handleFileSelected}
            class="hidden"
            aria-label="Upload image file" />
        <button
            type="button"
            onclick={handleVideoClick}
            title="Upload video"
            aria-label="Insert video"
            class="touch-target relative flex h-7 w-7 shrink-0 cursor-pointer items-center justify-center rounded-md transition-colors hover:bg-surface-hover/30 hover:text-fg">
            <Video class="size-4" />
        </button>
        <input
            type="file"
            bind:this={videoFileInput}
            name="video-upload"
            accept="video/webm,.webm"
            onchange={handleVideoFileSelected}
            class="hidden"
            aria-label="Upload video file" />
        {#each [{ action: () => insert('[', '](url)'), icon: LinkIcon, label: 'Insert link' }, { action: () => insert('1. '), icon: ListOrdered, label: 'Numbered list' }, { action: () => insert('- '), icon: List, label: 'Bulleted list' }, { action: () => insert('- [ ] '), icon: ListTodo, label: 'Task list' }, { action: () => insert('> '), icon: Quote, label: 'Blockquote' }] as const as item (item.label)}
            <button
                type="button"
                onclick={item.action}
                aria-label={item.label}
                class="touch-target relative flex h-7 w-7 shrink-0 cursor-pointer items-center justify-center rounded-md transition-colors hover:bg-surface-hover/30 hover:text-fg">
                <item.icon class="size-4" />
            </button>
        {/each}

        <div
            class="mx-1 h-4 w-px shrink-0 bg-line-subtle"
            aria-hidden="true">
        </div>

        <button
            type="button"
            onclick={() => insert('```\n', '\n```')}
            aria-label="Code block"
            class="touch-target relative flex h-7 w-7 shrink-0 cursor-pointer items-center justify-center rounded-md transition-colors hover:bg-surface-hover/30 hover:text-fg">
            <SquareCode class="size-4" />
        </button>

        <div
            class="mx-1 h-4 w-px shrink-0 bg-line-subtle"
            aria-hidden="true">
        </div>

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
