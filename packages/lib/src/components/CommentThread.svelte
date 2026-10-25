<script
    lang="ts"
    module>
    export interface CommentItem {
        id: string;
        post_id?: string;
        parent_id: string | null;
        author_name: string | null;
        is_admin?: boolean;
        is_anonymous?: boolean;
        content: string;
        created_at: string;
        reply_to_author?: string | null;
        reports?: number | null;
    }

    export interface CommentTreeNode<T> {
        comment: T;
        children: CommentTreeNode<T>[];
        reply_to_author?: string;
    }
</script>

<script
    lang="ts"
    generics="T extends CommentItem">
    import Avatar from '@idstead/ui/components/Avatar.svelte';
    import { commentAuthorName } from '#lib/commentAuthor.ts';
    import { clampPage, pageCount, pageOfIndex, pageSlice } from '@idstead/domain/pagination.ts';
    import {
        arrangeThreads,
        commentMatchesQuery,
        countThreadComments,
        type CommentFilter,
        type CommentSort,
        type CommentSortDirection
    } from '#lib/commentFilter.ts';
    import Pagination from '@idstead/ui/components/Pagination.svelte';
    import Input from '@idstead/ui/components/Input.svelte';
    import FilterToolbar from '@idstead/ui/components/filter/FilterToolbar.svelte';
    import SortControl from '@idstead/ui/components/filter/SortControl.svelte';
    import SearchResultCount from '@idstead/ui/components/filter/SearchResultCount.svelte';
    import type { Snippet } from 'svelte';
    import { SvelteMap, SvelteSet } from 'svelte/reactivity';
    import {
        Ellipsis,
        Copy,
        Flag,
        Trash,
        BadgeCheck,
        ChevronDown,
        ChevronUp
    } from '@lucide/svelte';
    import RelativeTime from '@idstead/ui/components/RelativeTime.svelte';
    import IconButton from '@idstead/ui/components/IconButton.svelte';
    import { cn } from '@idstead/ui/utils/cn.ts';
    import Dropdown from '@idstead/ui/components/Dropdown.svelte';
    import { focusScope } from '@idstead/ui/utils/focusScope.ts';
    import { shortcut } from '@idstead/ui/utils/shortcut.svelte.ts';
    import { contentFontStore } from '@idstead/ui/stores/contentFontStore.svelte.ts';
    import { decodeHtmlEntities } from '@mdrs/core';
    import { toastStore } from '@idstead/ui/stores/toastStore.svelte.ts';

    interface Props {
        class?: string;
        comments: T[];
        replyTo?: T | null;
        authorName?: string;
        pageSize?: number;
        controls?: boolean;
        useContentFont?: boolean;
        isAdmin?: boolean;
        statusBadge?: Snippet<[comment: T]>;
        actions?: Snippet<[comment: T]>;
        replyForm?: Snippet<[comment: T]>;
        focusCommentId?: string | null;
        onReport?: (comment: T) => void;
        onDelete?: (comment: T) => void;
    }

    let {
        class: className = '',
        comments = [],
        replyTo = null,
        authorName = '',
        pageSize,
        controls = false,
        useContentFont = false,
        isAdmin = false,
        statusBadge,
        actions,
        replyForm,
        focusCommentId = null,
        onReport,
        onDelete
    }: Props = $props();

    async function handleCopyId(commentId: string) {
        try {
            await navigator.clipboard.writeText(commentId);
            toastStore.success('Comment ID copied to clipboard');
        } catch {
            toastStore.error('Failed to copy Comment ID');
        }
    }

    function handleReport(comment: T) {
        onReport?.(comment);
    }

    function handleDelete(comment: T) {
        onDelete?.(comment);
    }

    function isAuthorComment(comment: T): boolean {
        return Boolean(comment.is_admin);
    }

    function getCommentAuthor(comment: T): string {
        return commentAuthorName(comment, authorName);
    }

    function buildCommentTree(items: T[]): CommentTreeNode<T>[] {
        const map = new SvelteMap<string, CommentTreeNode<T>>();

        for (const item of items) {
            map.set(item.id, { comment: item, children: [] });
        }

        const roots: CommentTreeNode<T>[] = [];

        function getRootNode(item: T): CommentTreeNode<T> | null {
            let current: T = item;
            const visited = new SvelteSet<string>([item.id]);

            while (current.parent_id && map.has(current.parent_id)) {
                const parentNode = map.get(current.parent_id)!;
                const parentId = parentNode.comment.id;
                if (visited.has(parentId)) break;

                visited.add(parentId);
                current = parentNode.comment;
            }

            return map.get(current.id) ?? null;
        }

        for (const item of items) {
            const node = map.get(item.id)!;
            if (item.parent_id && map.has(item.parent_id)) {
                const directParent = map.get(item.parent_id)!;
                node.reply_to_author = getCommentAuthor(directParent.comment);

                const rootNode = getRootNode(item);
                if (rootNode && rootNode.comment.id !== node.comment.id) {
                    rootNode.children.push(node);
                } else {
                    roots.push(node);
                }
            } else {
                roots.push(node);
            }
        }

        const sortFn = (a: CommentTreeNode<T>, b: CommentTreeNode<T>) =>
            new Date(a.comment.created_at).getTime() - new Date(b.comment.created_at).getTime();

        roots.sort(sortFn);
        for (const root of roots) {
            if (root.children.length > 0) {
                root.children.sort(sortFn);
            }
        }
        return roots;
    }

    let query = $state('');
    let filter = $state<CommentFilter>('all');
    let sortField = $state<CommentSort>('date');
    let direction = $state<CommentSortDirection>('asc');
    const filterOptions = $derived([
        { value: 'all', label: 'All' },
        { value: 'replied', label: 'With replies' },
        { value: 'unanswered', label: 'No replies' },
        { value: 'admin', label: 'From author' },
        ...(isAdmin ? [{ value: 'reported', label: 'Reported' }] : [])
    ]);
    const sortFields = [
        { value: 'date', label: 'Date' },
        { value: 'replies', label: 'Replies' },
        { value: 'author', label: 'Name' }
    ];
    const fullTree = $derived(buildCommentTree(comments));
    const commentTree = $derived(
        controls ?
            arrangeThreads(fullTree, {
                query,
                filter,
                sort: sortField,
                direction,
                nameOf: getCommentAuthor
            })
        :   fullTree
    );
    const searching = $derived(controls && query.trim() !== '');
    const visibleCount = $derived(countThreadComments(commentTree));
    const expandedReplies = new SvelteSet<string>();

    function repliesOpen(node: CommentTreeNode<T>) {
        return (
            expandedReplies.has(node.comment.id)
            || (searching
                && node.children.some(child =>
                    commentMatchesQuery(child.comment, query, getCommentAuthor)
                ))
        );
    }

    function updateControls(next: {
        query?: string;
        filter?: CommentFilter;
        sort?: CommentSort;
        direction?: CommentSortDirection;
    }) {
        query = next.query ?? query;
        filter = next.filter ?? filter;
        sortField = next.sort ?? sortField;
        direction = next.direction ?? direction;
        page = 1;
    }
    let threadElement = $state<HTMLElement | null>(null);
    let page = $state(1);
    const totalPages = $derived(pageSize ? pageCount(commentTree.length, pageSize) : 1);
    const currentPage = $derived(pageSize ? clampPage(page, commentTree.length, pageSize) : 1);
    const visibleTree = $derived(
        pageSize ? pageSlice(commentTree, currentPage, pageSize) : commentTree
    );

    function rootIndexOf(commentId: string) {
        return commentTree.findIndex(
            node =>
                node.comment.id === commentId
                || node.children.some(child => child.comment.id === commentId)
        );
    }

    function goToPage(next: number) {
        page = next;
        threadElement?.scrollIntoView({ block: 'start' });
    }

    let knownIds: Set<string> | null = null;
    $effect(() => {
        const previous = knownIds;
        knownIds = new Set(comments.map(comment => comment.id));
        if (!pageSize || !previous) return;
        const added = comments.filter(comment => !previous.has(comment.id));
        if (added.length !== 1) return;
        const index = rootIndexOf(added[0].id);
        if (index >= 0) page = pageOfIndex(index, pageSize);
    });

    $effect(() => {
        if (!focusCommentId) return;
        const index = rootIndexOf(focusCommentId);
        if (index < 0) {
            if (controls && (query || filter !== 'all')) {
                query = '';
                filter = 'all';
            }
            return;
        }
        if (pageSize) page = pageOfIndex(index, pageSize);
        const root = commentTree[index];
        if (root.children.length > 0) expandedReplies.add(root.comment.id);
    });

    function toggleReplies(commentId: string) {
        if (expandedReplies.has(commentId)) {
            expandedReplies.delete(commentId);
            return;
        }

        expandedReplies.add(commentId);
    }

    function getReplyToggleLabel(count: number, expanded: boolean): string {
        const replyLabel = count === 1 ? 'reply' : 'replies';
        if (expanded) return `Hide ${count} ${replyLabel}`;
        return `View ${count} ${replyLabel}`;
    }
</script>

{#snippet renderNode(node: CommentTreeNode<T>, showReplyToggle: boolean = false)}
    {@const comment = node.comment}
    {@const children = node.children}
    {@const hasChildren = children.length > 0}
    {@const isExpanded = repliesOpen(node)}
    {@const replyContainerId = `reply-container-${comment.id}`}
    {@const author = getCommentAuthor(comment)}
    {@const commentScope = `comment-${comment.id}`}

    <div
        id="comment-{comment.id}"
        use:focusScope={commentScope}
        class={cn(
            'comment-row-wrapper flex min-w-0 items-start gap-2.5 rounded-md transition-shadow sm:gap-3',
            focusCommentId === comment.id ?
                'ring-2 ring-accent ring-offset-2 ring-offset-canvas'
            :   ''
        )}>
        <Avatar
            name={author}
            class="z-10 size-6.5 sm:size-7" />

        <div class="min-w-0 flex-1">
            <div
                class="relative inline-block max-w-full rounded-md border border-line-subtle bg-surface px-2 py-1 text-left">
                <div class="flex min-h-6.5 items-center justify-between gap-3">
                    <div class="flex min-w-0 items-center gap-1">
                        <span class="truncate text-xs leading-none font-semibold text-fg">
                            {author}
                        </span>
                        {#if isAuthorComment(comment)}
                            <span
                                class="inline-flex shrink-0 items-center text-fg-accent"
                                title="Verified administrator"
                                aria-label="Verified administrator">
                                <BadgeCheck class="size-3" />
                            </span>
                        {/if}
                        {#if statusBadge}
                            {@render statusBadge(comment)}
                        {/if}
                    </div>

                    {#if isAdmin || !isAuthorComment(comment)}
                        <Dropdown
                            ariaLabel="Comment options"
                            placement="bottom-end"
                            shortcutScope={commentScope}
                            actions={[
                                {
                                    label: 'Copy ID',
                                    icon: Copy,
                                    onSelect: () => handleCopyId(comment.id),
                                    shortcut: {
                                        combo: 'I',
                                        scope: commentScope,
                                        label: 'Copy comment ID',
                                        placement: 'inline'
                                    }
                                },
                                ...(onReport ?
                                    [
                                        {
                                            label: 'Report',
                                            icon: Flag,
                                            onSelect: () => handleReport(comment),
                                            shortcut: {
                                                combo: 'F',
                                                scope: commentScope,
                                                label: 'Report comment',
                                                placement: 'inline' as const
                                            }
                                        }
                                    ]
                                :   []),
                                ...(isAdmin && onDelete ?
                                    [
                                        {
                                            label: 'Delete',
                                            icon: Trash,
                                            danger: true,
                                            onSelect: () => handleDelete(comment)
                                        }
                                    ]
                                :   [])
                            ]}>
                            {#snippet trigger({ isOpen, toggle })}
                                <IconButton
                                    ariaLabel="Comment options"
                                    variant="ghost"
                                    size="xs"
                                    showTooltip={false}
                                    aria-haspopup="menu"
                                    aria-expanded={isOpen}
                                    keyboardShortcut="O"
                                    shortcutScope={commentScope}
                                    shortcutLabel="Comment options"
                                    onclick={toggle}>
                                    <Ellipsis class="size-3.5" />
                                </IconButton>
                            {/snippet}
                        </Dropdown>
                    {/if}
                </div>
                <div
                    class={cn(
                        'mt-0.5 type-body font-normal text-fg-secondary',
                        useContentFont && `font-content-${contentFontStore.current}`,
                        useContentFont
                            && contentFontStore.current === 'mono'
                            && 'text-[calc(0.78125rem*var(--type-scale)*var(--a11y-scale))]! sm:text-[calc(0.84375rem*var(--type-scale)*var(--a11y-scale))]!'
                    )}>
                    {#if node.reply_to_author}
                        <span class="font-normal text-fg-accent select-none">
                            @{node.reply_to_author}
                        </span>
                    {/if}
                    <span class="whitespace-pre-line">{decodeHtmlEntities(comment.content)}</span>
                </div>
            </div>

            <div
                class="mt-1 ml-1 flex flex-wrap items-center gap-2.5 text-2xs text-fg-muted select-none sm:ml-1.5 sm:gap-3">
                {#if actions}
                    {@render actions(comment)}
                {:else}
                    <RelativeTime
                        date={comment.created_at}
                        tag="time" />
                {/if}
                {#if showReplyToggle && hasChildren}
                    <button
                        type="button"
                        use:shortcut={{ combo: 'T', scope: commentScope, label: 'Toggle replies' }}
                        class="relative inline-flex cursor-pointer items-center gap-0.5 text-2xs leading-none font-semibold text-fg-muted transition-colors hover:text-fg-accent hover:underline focus-visible:text-fg-accent focus-visible:underline"
                        aria-expanded={isExpanded}
                        aria-controls={replyContainerId}
                        onclick={() => toggleReplies(comment.id)}>
                        {#if isExpanded}
                            <ChevronUp class="size-3 shrink-0" />
                        {:else}
                            <ChevronDown class="size-3 shrink-0" />
                        {/if}
                        <span>{getReplyToggleLabel(children.length, isExpanded)}</span>
                    </button>
                {/if}
            </div>

            {#if replyTo?.id === comment.id && replyForm}
                <div class="mt-3">
                    {@render replyForm(comment)}
                </div>
            {/if}
        </div>
    </div>
{/snippet}

<div
    bind:this={threadElement}
    class={cn('comment-thread-root flex scroll-mt-28 flex-col gap-4.5 sm:gap-5.5', className)}>
    {#if controls && comments.length > 0}
        <FilterToolbar
            title="Comment filters"
            controlSize="sm">
            {#snippet searchSlot()}
                <Input
                    type="search"
                    size="sm"
                    aria-label="Search comments"
                    placeholder="Search comments or names…"
                    value={query}
                    oninput={event => updateControls({ query: event.currentTarget.value })} />
            {/snippet}
            {#snippet filterControlsSlot()}
                <Dropdown
                    label="Show"
                    value={filter}
                    options={filterOptions}
                    onChange={value => updateControls({ filter: value })} />
            {/snippet}
            {#snippet sortSlot()}
                <SortControl
                    fields={sortFields}
                    currentField={sortField}
                    currentDirection={direction}
                    onFieldChange={value => updateControls({ sort: value as CommentSort })}
                    onDirectionToggle={() =>
                        updateControls({ direction: direction === 'asc' ? 'desc' : 'asc' })} />
            {/snippet}
            {#snippet countSlot()}
                <SearchResultCount
                    count={visibleCount}
                    total={comments.length}
                    itemLabel="comments" />
            {/snippet}
        </FilterToolbar>
        {#if commentTree.length === 0}
            <p class="text-xs text-fg-muted">No comments match your search or filter.</p>
        {/if}
    {/if}
    {#each visibleTree as rootNode (rootNode.comment.id)}
        {@const rootReplyContainerId = `reply-container-${rootNode.comment.id}`}
        {@const rootExpanded = repliesOpen(rootNode)}

        <div class="comment-thread-node flex min-w-0 flex-col">
            {@render renderNode(rootNode, true)}

            {#if rootNode.children.length > 0 && rootExpanded}
                <div
                    id={rootReplyContainerId}
                    class="mt-3 ml-4.5 flex flex-col gap-3 sm:ml-10">
                    {#each rootNode.children as childNode (childNode.comment.id)}
                        {@render renderNode(childNode)}
                    {/each}
                </div>
            {/if}
        </div>
    {/each}
    {#if pageSize && totalPages > 1}
        <Pagination
            page={currentPage}
            {totalPages}
            onPageChange={goToPage}
            size="sm" />
    {/if}
</div>
